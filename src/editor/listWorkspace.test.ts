import { describe, expect, it, vi } from 'vitest'
import { PENDING_WINDOW, WorkspaceHistory, chronologicalEntries, mergeParagraphs, moveEntries, parseWorkspace, reconcileWorkspace, renameWindow, reorderEntries, serializeWorkspace, splitParagraphs } from './listWorkspace'
import { LogManager } from '../logManager/logManager'

vi.mock('~/store', () => ({ useStore: () => ({ pcList: [] }) }))
const fixture = '团名\n测试员(外层(内层))(QQ:123)#微笑 2026/11/24 20:00:00 [大厅 › 初遇]\n第一段\n\n第二段\n\n同行者(QQ:456) 2026/11/24 20:01:00 [大厅]\n同行发言\n\n测试员(外层(内层))(QQ:123) 2026/11/24 20:02:00 [花园]\n花园发言\n'

describe('log organization workspace', () => {
  it('roundtrips nested names, account IDs, scenes, paragraph breaks and preamble', () => {
    const state = parseWorkspace(fixture, '原文件.txt')
    expect(state.entries).toHaveLength(3)
    expect(state.entries[0]).toMatchObject({ name: '测试员(外层(内层))', account: 'QQ:123', expression: '微笑', scene: '初遇', window: '大厅', source: '原文件.txt', text: '第一段\n\n第二段' })
    expect(state.preamble).toBe('团名\n')
    const serialized = serializeWorkspace(state)
    expect(serializeWorkspace(parseWorkspace(serialized))).toBe(serialized)
  })

  it('retains groups and scenes through the existing core import/export and flush', () => {
    const manager = new LogManager()
    manager.syncChange(fixture, [0, 0], [0, fixture.length])
    manager.flush()
    const parsed = parseWorkspace(manager.lastText)
    expect(parsed.entries.map(e => [e.window, e.scene])).toEqual([['大厅', '初遇'], ['大厅', ''], ['花园', '']])
    expect(parsed.entries.map(e => e.text)).toEqual(parseWorkspace(fixture).entries.map(e => e.text))
  })

  it('moves by stable IDs with a filtered view, retaining original file sources', () => {
    const state = parseWorkspace(fixture, '主窗.txt')
    const [first, second, third] = state.entries
    const next = moveEntries(state, [third.id], '大厅', second.id)
    expect(next.entries.map(e => e.id)).toEqual([first.id, third.id, second.id])
    expect(next.entries[1]).toMatchObject({ source: '主窗.txt', window: '大厅', scene: '' })
    expect(state.entries[2].window).toBe('花园')
    expect(moveEntries(next, [third.id], '大厅', third.id)).toBe(next)
  })

  it('batch moves to pending without deleting messages and adopts the target scene on drop', () => {
    const state = parseWorkspace(fixture)
    const ids = state.entries.slice(1).map(e => e.id)
    const pending = moveEntries(state, ids, PENDING_WINDOW)
    expect(pending.entries).toHaveLength(3)
    expect(pending.windows).not.toContain(PENDING_WINDOW)
    expect(pending.entries.slice(1).every(e => e.window === PENDING_WINDOW)).toBe(true)
    const next = moveEntries(pending, ids, '大厅', pending.entries[0].id, true)
    expect(next.entries.map(e => e.scene)).toEqual(['初遇', '初遇', '初遇'])
  })

  it('reorders the flat list without changing window or scene membership', () => {
    const state = parseWorkspace(fixture)
    const first = state.entries[0]
    const moved = reorderEntries(state, [first.id], state.entries[2].id, true)
    expect(moved.entries[2]).toEqual(first)
    expect(moved.entries[2].window).toBe('大厅')
    expect(moved.entries[2].scene).toBe('初遇')
  })

  it('splits and merges paragraphs without changing speaker identity', () => {
    const state = parseWorkspace(fixture)
    const split = splitParagraphs(state, state.entries[0].id)
    expect(split.entries).toHaveLength(4)
    const ids = split.entries.slice(0, 2).map(e => e.id)
    expect(new Set(ids).size).toBe(2)
    const merged = mergeParagraphs(split, ids)
    expect(serializeWorkspace(merged)).toBe(serializeWorkspace(state))
    expect(() => mergeParagraphs(state, state.entries.slice(0, 2).map(e => e.id))).toThrow('同一角色')
  })

  it('refuses merging non-adjacent paragraphs', () => {
    const state = parseWorkspace(fixture)
    // Create three compatible adjacent messages, then select only the endpoints.
    const first = state.entries[0]
    const rows = { ...state, entries: [first, { ...first, id: 'middle' }, { ...first, id: 'last' }] }
    expect(() => mergeParagraphs(rows, [first.id, 'last'])).toThrow('排在一起')
  })

  it('restores complete window, scene, source and entry state on undo/redo', () => {
    const history = new WorkspaceHistory()
    const original = parseWorkspace(fixture, 'original.txt')
    history.record(original)
    const moved = renameWindow(moveEntries(original, [original.entries[0].id], '花园'), '花园', '私聊')
    expect(history.undo(moved)).toEqual(original)
    expect(history.redo(original)).toEqual(moved)
    history.undo(moved)
    history.record(original)
    expect(history.future).toHaveLength(0)
    for (let i = 0; i < 30; i++) history.record(original)
    expect(history.past).toHaveLength(20)
  })

  it('preserves distinct provenance for duplicate timestamps after external text edits', () => {
    const previous = parseWorkspace(fixture)
    previous.entries.push({ ...previous.entries[0], id: 'second-copy', source: '另一个.txt' })
    const edited = parseWorkspace(serializeWorkspace(previous).replace('同行发言', '修订后的发言'))
    const next = reconcileWorkspace(previous, edited)
    expect(next.entries.map(e => [e.id, e.source])).toEqual(previous.entries.map(e => [e.id, e.source]))
    expect(next.entries[1].text).toBe('修订后的发言')
  })

  it('sorts timestamps stably and refuses mixed dates instead of guessing', () => {
    const state = parseWorkspace(fixture)
    expect(chronologicalEntries([...state.entries].reverse())).toEqual(state.entries)
    const mixed = [...state.entries, { ...state.entries[0], time: '20:01:00' }]
    expect(() => chronologicalEntries(mixed)).toThrow('有日期和无日期')
    expect(mixed).toHaveLength(4)
  })

  it('merges renamed windows while retaining every message and original source', () => {
    const state = parseWorkspace(fixture, '原始.txt')
    const merged = renameWindow(state, '花园', '大厅')
    expect(merged.windows).toEqual(['大厅'])
    expect(merged.entries).toHaveLength(3)
    expect(merged.entries.every(e => e.source === '原始.txt')).toBe(true)
  })
})

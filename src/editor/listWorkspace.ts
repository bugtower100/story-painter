import { reEditLogHeader } from '../logManager/logHeader'

export const PENDING_WINDOW = '待分拣'
// Group labels stay compatible with the existing parser and all existing exporters.
export const SCENE_SEPARATOR = ' › '
export interface WorkspaceEntry {
  id: string
  name: string
  account: string
  expression: string
  time: string
  text: string
  window: string
  scene: string
  source: string
}
export interface WorkspaceState {
  entries: WorkspaceEntry[]
  windows: string[]
  preamble: string
  blocks: ContentBlock[]
}
export interface ContentBlock { id: string; name: string; entryIds: string[] }
export interface ContentUnit { id: string; blockId?: string; name: string; entries: WorkspaceEntry[]; order: number }
export const emptyWorkspace = (): WorkspaceState => ({ entries: [], windows: [], preamble: '', blocks: [] })
let sequence = 0
export const entryId = () => `log-${++sequence}`
const blockId = () => `block-${++sequence}`
export const validGroupName = (name: string) => !!name.trim() && !/[\[\]\r\n]/.test(name) && !name.includes(SCENE_SEPARATOR)

export function parseWorkspace(text: string, source = '当前日志', defaultWindow = 'main'): WorkspaceState {
  const normalized = text.replace(/\r\n/g, '\n')
  const matches = [...normalized.matchAll(new RegExp(reEditLogHeader.source, 'gm'))]
  const entries = matches.map((m, index): WorkspaceEntry => {
    const group = m[10] || defaultWindow
    const split = group.indexOf(SCENE_SEPARATOR)
    return {
      id: entryId(), name: m[1], account: m[2]?.slice(1, -1) || '',
      expression: m[5] || '', time: ((m[7] || '') + m[8]).trim(),
      text: normalized.slice(m.index! + m[0].length, matches[index + 1]?.index ?? normalized.length).replace(/^\n/, '').replace(/\n+$/, ''),
      window: split < 0 ? group : group.slice(0, split),
      scene: split < 0 ? '' : group.slice(split + SCENE_SEPARATOR.length), source,
    }
  })
  return { entries, windows: [...new Set(entries.map(e => e.window))].filter(w => w !== PENDING_WINDOW), preamble: matches.length ? normalized.slice(0, matches[0].index) : normalized, blocks: [] }
}

export function serializeWorkspace(state: WorkspaceState): string {
  return state.preamble + state.entries.map(e => {
    const account = e.account ? `(${e.account})` : ''
    const expression = e.expression ? `#${e.expression}` : ''
    const group = e.window + (e.scene ? SCENE_SEPARATOR + e.scene : '')
    return `${e.name}${account}${expression} ${e.time} [${group}]\n${e.text}\n\n`
  }).join('')
}

export function reconcileWorkspace(previous: WorkspaceState, next: WorkspaceState): WorkspaceState {
  // A queue per identity handles repeated timestamps without reusing a source twice.
  const remaining = [...previous.entries]
  next.entries = next.entries.map(entry => {
    let index = remaining.findIndex(old => old.name === entry.name && old.account === entry.account && old.time === entry.time && old.text === entry.text)
    if (index < 0) index = remaining.findIndex(old => old.name === entry.name && old.account === entry.account && old.time === entry.time)
    if (index < 0) return entry
    const old = remaining.splice(index, 1)[0]
    return { ...entry, id: old.id, source: old.source }
  })
  return normalizeBlocks({ ...next, blocks: previous.blocks, windows: [...new Set([...previous.windows, ...next.windows])] })
}

// A block always represents a contiguous part of the final reading order.
// Individual edits may split it into separate runs, but never merge independent blocks.
export function normalizeBlocks(state: WorkspaceState): WorkspaceState {
  const membership = new Map(state.blocks.flatMap(block => block.entryIds.map(id => [id, block] as const)))
  const seen = new Set<string>()
  const blocks: ContentBlock[] = []
  let previousId: string | undefined
  for (const entry of state.entries) {
    const original = membership.get(entry.id)
    if (!original) { previousId = undefined; continue }
    if (previousId === original.id) blocks[blocks.length - 1].entryIds.push(entry.id)
    else {
      blocks.push({ id: seen.has(original.id) ? blockId() : original.id, name: original.name, entryIds: [entry.id] })
      seen.add(original.id)
    }
    previousId = original.id
  }
  return { ...state, blocks }
}

export function contentUnits(state: WorkspaceState): ContentUnit[] {
  const membership = new Map(state.blocks.flatMap(block => block.entryIds.map(id => [id, block] as const)))
  const units: ContentUnit[] = []
  for (const entry of state.entries) {
    const block = membership.get(entry.id)
    const last = units[units.length - 1]
    if (block && last?.blockId === block.id) last.entries.push(entry)
    else units.push({ id: block?.id || entry.id, blockId: block?.id, name: block?.name || '', entries: [entry], order: units.length + 1 })
  }
  return units
}

export function createContentBlock(state: WorkspaceState, ids: string[], name = ''): WorkspaceState {
  const selected = new Set(ids)
  const entries = state.entries.filter(e => selected.has(e.id))
  if (!entries.length) throw new Error('请先选择要组成内容块的发言。')
  const position = state.entries.findIndex(e => selected.has(e.id))
  const rest = state.entries.filter(e => !selected.has(e.id))
  rest.splice(position, 0, ...entries)
  const blocks = state.blocks.map(block => ({ ...block, entryIds: block.entryIds.filter(id => !selected.has(id)) }))
  blocks.push({ id: blockId(), name: name.trim() || '内容块', entryIds: entries.map(e => e.id) })
  return normalizeBlocks({ ...state, entries: rest, blocks })
}

export function dissolveContentBlocks(state: WorkspaceState, ids: string[]): WorkspaceState {
  return { ...state, blocks: state.blocks.filter(block => !ids.includes(block.id)) }
}

export function extractBlockEntries(state: WorkspaceState, ids: string[]): WorkspaceState {
  const selected = new Set(ids)
  return normalizeBlocks({ ...state, blocks: state.blocks.map(block => ({ ...block, entryIds: block.entryIds.filter(id => !selected.has(id)) })) })
}

export function mergeContentBlocks(state: WorkspaceState, ids: string[], name = ''): WorkspaceState {
  const blocks = state.blocks.filter(block => ids.includes(block.id))
  if (blocks.length < 2) throw new Error('请至少勾选两个内容块。')
  return createContentBlock(state, blocks.flatMap(block => block.entryIds), name || blocks[0].name)
}

export function reorderContentUnits(state: WorkspaceState, ids: string[], targetId: string, after = false): WorkspaceState {
  const units = contentUnits(state)
  const target = units.find(unit => unit.id === targetId)
  if (!target || ids.includes(targetId)) return state
  const selected = units.filter(unit => ids.includes(unit.id)).flatMap(unit => unit.entries.map(e => e.id))
  const anchor = target.entries[after ? target.entries.length - 1 : 0].id
  return normalizeBlocks(reorderEntries(state, selected, anchor, after))
}

export function moveEntries(state: WorkspaceState, ids: string[], window: string, targetId?: string, after = false): WorkspaceState {
  const selected = new Set(ids)
  if (targetId && selected.has(targetId)) return state
  const target = state.entries.find(e => e.id === targetId)
  const moving = state.entries.filter(e => selected.has(e.id)).map(e => ({
    ...e, window,
    // Dropping next to a message adopts its scene; moving to another empty window clears it.
    scene: target ? target.scene : e.window === window ? e.scene : '',
  }))
  if (!moving.length || (targetId && !target)) return state
  const rest = state.entries.filter(e => !selected.has(e.id))
  let position = targetId ? rest.findIndex(e => e.id === targetId) + (after ? 1 : 0) : -1
  if (!targetId) {
    for (let i = rest.length - 1; i >= 0; i--) if (rest[i].window === window) { position = i + 1; break }
    if (position < 0) position = rest.length
  }
  rest.splice(position, 0, ...moving)
  return { ...state, entries: rest, windows: window === PENDING_WINDOW ? state.windows : [...new Set([...state.windows, window])] }
}

export function renameWindow(state: WorkspaceState, from: string, to: string): WorkspaceState {
  return {
    ...state, windows: [...new Set(state.windows.map(w => w === from ? to : w))],
    entries: state.entries.map(e => e.window === from ? { ...e, window: to } : e),
  }
}

export function reorderEntries(state: WorkspaceState, ids: string[], targetId: string, after = false): WorkspaceState {
  if (ids.includes(targetId) || !state.entries.some(e => e.id === targetId)) return state
  const moving = state.entries.filter(e => ids.includes(e.id))
  if (!moving.length) return state
  const entries = state.entries.filter(e => !ids.includes(e.id))
  entries.splice(entries.findIndex(e => e.id === targetId) + (after ? 1 : 0), 0, ...moving)
  return { ...state, entries }
}

export function mergeParagraphs(state: WorkspaceState, ids: string[]): WorkspaceState {
  const selected = state.entries.filter(e => ids.includes(e.id))
  if (selected.length < 2) throw new Error('请至少选择两条发言。')
  const first = selected[0]
  const membership = new Map(state.blocks.flatMap(block => block.entryIds.map(id => [id, block.id] as const)))
  if (selected.some(e => membership.get(e.id) !== membership.get(first.id))) throw new Error('请先把这些发言移入同一内容块，或解除分块后再合并正文。')
  if (selected.some(e => e.name !== first.name || e.account !== first.account || e.window !== first.window || e.scene !== first.scene || e.expression !== first.expression)) {
    throw new Error('仅能合并同一角色、窗口、场景和差分的发言，避免丢失身份。')
  }
  const positions = selected.map(e => state.entries.indexOf(e))
  if (positions.some((p, i) => i > 0 && p !== positions[i - 1] + 1)) throw new Error('请先把要合并的发言排在一起。')
  const combined = { ...first, text: selected.map(e => e.text).join('\n\n'), source: [...new Set(selected.map(e => e.source))].join('、') }
  return normalizeBlocks({ ...state, entries: state.entries.flatMap(e => e.id === first.id ? [combined] : ids.includes(e.id) ? [] : [e]) })
}

export function splitParagraphs(state: WorkspaceState, id: string): WorkspaceState {
  const entry = state.entries.find(e => e.id === id)
  if (!entry || !/\n\s*\n/.test(entry.text)) throw new Error('请在正文中用空行分隔段落后再拆分。')
  const paragraphs = entry.text.split(/\n\s*\n/).map((text, i) => ({ ...entry, id: i ? entryId() : entry.id, text }))
  return {
    ...state, entries: state.entries.flatMap(e => e.id === id ? paragraphs : [e]),
    blocks: state.blocks.map(block => ({ ...block, entryIds: block.entryIds.flatMap(entryId => entryId === id ? paragraphs.map(e => e.id) : [entryId]) })),
  }
}

export function chronologicalEntries(entries: WorkspaceEntry[]): WorkspaceEntry[] {
  const dated = entries.map(e => /^\d{4}\//.test(e.time))
  if (dated.some(Boolean) && !dated.every(Boolean)) throw new Error('同时存在有日期和无日期的记录，无法可靠按时间排序；已保留当前顺序。')
  const timeValue = (time: string) => {
    const match = time.match(/^(?:(\d{4})\/(\d{1,2})\/(\d{1,2}) )?(\d{1,2}):(\d{1,2}):(\d{2})$/)
    if (!match) throw new Error('日志时间无法识别，已保留当前顺序。')
    const [, y, m, d, h, min, s] = match
    return Date.UTC(Number(y || 1970), Number(m || 1) - 1, Number(d || 1), Number(h), Number(min), Number(s))
  }
  return [...entries].sort((a, b) => timeValue(a.time) - timeValue(b.time))
}

export class WorkspaceHistory {
  past: WorkspaceState[] = []
  future: WorkspaceState[] = []
  record(state: WorkspaceState) {
    // Entries are updated immutably; copying the arrays keeps each snapshot independent.
    this.past.push({ ...state, entries: [...state.entries], windows: [...state.windows], blocks: state.blocks.map(block => ({ ...block, entryIds: [...block.entryIds] })) })
    if (this.past.length > 20) this.past.shift()
    this.future = []
  }
  undo(state: WorkspaceState) {
    const previous = this.past.pop()
    if (!previous) return state
    this.future.push(state)
    return previous
  }
  redo(state: WorkspaceState) {
    const next = this.future.pop()
    if (!next) return state
    this.past.push(state)
    return next
  }
  clear() { this.past = []; this.future = [] }
}

import { describe, expect, it, vi } from 'vitest'
import { LogManager } from './logManager'
import { sampleLog } from '../sample'

vi.mock('~/store', () => ({ useStore: () => ({ pcList: [] }) }))

describe('editor whitespace and character identity', () => {
  it('does not accumulate separators on repeated parse, refresh and export', () => {
    const manager = new LogManager()
    manager.syncChange(sampleLog, [0, 0], [0, sampleLog.length])
    const text = manager.lastText
    expect(text).toContain('记录已经开启。\n\n木落')
    for (let i = 0; i < 5; i++) {
      manager.curItems = manager.parse(manager.lastText, true)!.items
      manager.flush()
      expect(manager.lastText).toBe(text)
    }
  })

  it('compacts message separators while preserving internal blank paragraphs and raw preamble', () => {
    const manager = new LogManager()
    const input = '团名\n\n甲(123) 20:00:00\n第一段\n\n\n第二段\n\n\n\n乙(456) 20:01:00\n回复'
    manager.syncChange(input, [0, 0], [0, input.length])
    expect(manager.lastText).toBe('团名\n\n甲(123) 20:00:00\n第一段\n\n\n第二段\n\n乙(456) 20:01:00\n回复\n\n')
  })

  it('keeps incremental editor offsets exact when typing blank lines then editing another message', () => {
    const manager = new LogManager()
    const input = '甲(123) 20:00:00\n一\n\n\n\n乙(456) 20:01:00\n二\n\n丙(789) 20:02:00\n三'
    manager.syncChange(input, [0, 0], [0, input.length])
    const at = manager.lastText.indexOf('乙(456)')
    let text = manager.lastText.slice(0, at) + '\n\n' + manager.lastText.slice(at)
    manager.syncChange(text, [at, at], [at, at + 2])
    const second = text.indexOf('二')
    text = text.slice(0, second) + '二已修改' + text.slice(second + 1)
    manager.syncChange(text, [second, second + 1], [second, second + 4])
    expect(manager.lastText).toBe(text)
    for (const info of manager.lastIndexInfoList.filter(info => !info.item.isRaw)) {
      expect(text.slice(info.indexStart, info.indexContent)).toContain(info.item.nickname)
      expect(text.slice(info.indexContent, info.indexEnd)).toBe(info.item.message)
    }
    expect(manager.curItems.filter(item => !item.isRaw).map(item => item.message.trim())).toEqual(['一', '二已修改', '三'])
  })

  it('changes only the selected name and ID pair, merging a same-name account without reordering', () => {
    const manager = new LogManager()
    const input = '甲(123) 20:00:00 [HO1]\n第一段\n\n甲(456) 20:01:00 [main]\n第二段\n\n乙(123) 20:02:00 [HO2]\n第三段\n'
    manager.syncChange(input, [0, 0], [0, input.length])
    manager.changeIdentity({ name: '甲', IMUserId: '123' }, '甲', '456')
    const result = manager.parse(manager.lastText)!
    expect(result.charInfo.size).toBe(2)
    expect(result.items.map(item => [item.nickname, item.IMUserId, item.groupName, item.message.trim()])).toEqual([
      ['甲', '456', 'HO1', '第一段'], ['甲', '456', 'main', '第二段'], ['乙', '123', 'HO2', '第三段'],
    ])
  })

  it('updates renamed character mentions and keeps expressions, times and paragraph spacing', () => {
    const manager = new LogManager()
    const input = '甲(123)#微笑 20:00:00 [HO1]\n第一段\n\n第二段\n\n乙(456) 20:01:00 [main]\n<甲> 的回复\n'
    manager.syncChange(input, [0, 0], [0, input.length])
    manager.changeIdentity({ name: '甲', IMUserId: '123' }, '新甲', 'QQ:789')
    expect(manager.lastText).toContain('新甲(QQ:789)#微笑 20:00:00 [HO1]\n第一段\n\n第二段')
    expect(manager.lastText).toContain('<新甲> 的回复')
  })
})

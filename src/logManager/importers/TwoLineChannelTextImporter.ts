import { LogImporter, TextInfo } from './_logImpoter'
import type { CharItem, LogItem } from '../types'

const headerRe = /^\s*-?\s*([^\(]+)\(([^)]+)\)\s*(?:#([^\s\[]+))?\s+(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2})(?:\s+\[([^\]]+)\])?\s*$/

function isDiceMessage(msg: string): boolean {
  if (/\b\d+[dD]\d+\b/.test(msg)) return true
  if (/CCB\s*<=/i.test(msg)) return true
  if (/＞\s*\d+/.test(msg)) return true
  return false
}

export class TwoLineChannelTextImporter extends LogImporter {
  get name() { return '两行文本(含频道)' }
  check(text: string): boolean {
    const lines = text.split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      if (headerRe.test(lines[i])) return true
    }
    return false
  }
  parse(text: string): TextInfo {
    const lines = text.split(/\r?\n/)
    const charInfo = new Map<string, CharItem>()
    const items: LogItem[] = []
    let idx = 0
    while (idx < lines.length) {
      const header = lines[idx]
      const m = header.match(headerRe)
      if (!m) { idx += 1; continue }
      const nickname = m[1].trim()
      const imuidRaw = m[2].trim()
      const expressionTagRaw = (m[3] || '').trim()
      const timeTextRaw = m[4].trim()
      const channelRaw = m[5] || 'main'
      const channel = channelRaw.toLowerCase()
      idx += 1
      const bodyLines: string[] = []
      while (idx < lines.length && lines[idx].trim() !== '') {
        bodyLines.push(lines[idx])
        idx += 1
      }
      // 跳过空行
      while (idx < lines.length && lines[idx].trim() === '') idx += 1

      const item = {} as LogItem
      item.id = items.length
      item.nickname = nickname
      item.IMUserId = imuidRaw || this.getAutoIMUserId(items.length, nickname)
      const [t, tt] = this.parseTime(timeTextRaw)
      item.time = t
      item.timeText = tt
      if (expressionTagRaw) item.expressionTag = expressionTagRaw
      const body = bodyLines.join('\n').trim()
      item.message = body
      item.isDice = isDiceMessage(body)
      item.commandId = 0
      ;(item as any).commandInfo = { channel }
      item.groupName = channelRaw
      if (/^\s*kp\s*$/i.test(nickname)) item.role = '主持人'

      this.setCharInfo(charInfo, item)
      items.push(item)
    }
    return { items, charInfo, startText: '' }
  }
}

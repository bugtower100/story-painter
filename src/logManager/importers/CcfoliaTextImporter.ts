import { LogImporter, TextInfo } from './_logImpoter'
import type { CharItem, LogItem } from '../types'

const HEADER = /^CCFOLIA-LOG$/m
const LINE = /^\[(.+?)\]\s*<(.+?)>\s*:(.*)$/

export class CcfoliaTextImporter extends LogImporter {
  get name() { return 'CCfolia 文本' }
  check(text: string): boolean {
    return HEADER.test(text)
  }
  parse(text: string): TextInfo {
    const charInfo = new Map<string, CharItem>()
    const items: LogItem[] = []
    const lines = text.split(/\n/)
    for (const line of lines) {
      const m = line.match(LINE)
      if (!m) continue
      const item = {} as LogItem
      item.nickname = m[2]
      item.IMUserId = this.getAutoIMUserId(items.length, item.nickname)
      const [t, tt] = this.parseTime(m[1])
      item.time = t
      item.timeText = tt
      item.message = (m[3] || '') + '\n'
      items.push(item)
      this.setCharInfo(charInfo, item)
    }
    return { items, charInfo, startText: '' }
  }
}


import { LogImporter, TextInfo } from './_logImpoter'
import type { CharItem, LogItem } from '../types'

function normalizeBr(html: string) {
  return html.replaceAll('<br>', '<br />')
}

function parseColorFromStyle(style: string): string | undefined {
  const mHex = style.match(/color:\s*(#[0-9a-fA-F]{6})/)
  if (mHex) return mHex[1]
  const mRgb = style.match(/color:\s*rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i)
  if (mRgb) {
    const r = Number(mRgb[1]), g = Number(mRgb[2]), b = Number(mRgb[3])
    const toHex = (n: number) => n.toString(16).padStart(2, '0')
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`
  }
  return undefined
}

function isDiceMessage(msg: string): boolean {
  if (/\b\d+[dD]\d+\b/.test(msg)) return true
  if (/CCB\s*<=/i.test(msg)) return true
  if (/＞\s*\d+/.test(msg)) return true
  return false
}

export class CcfoliaHtmlImporter extends LogImporter {
  get name() { return 'CCFolia 原始HTML' }
  check(text: string): boolean {
    if (!text) return false
    const hasP = text.includes('<p')
    const hasTag = /\[\s*(main|other)\s*\]/i.test(text)
    return hasP && hasTag
  }
  parse(text: string): TextInfo {
    const parser = new DOMParser()
    const doc = parser.parseFromString(text, 'text/html')
    const charInfo = new Map<string, CharItem>()
    const items: LogItem[] = []
    const ps = Array.from(doc.querySelectorAll('p'))
    for (const p of ps) {
      const spans = Array.from(p.querySelectorAll('span'))
      if (spans.length < 3) continue
      const chRaw = spans[0].textContent?.trim() || ''
      const chMatch = chRaw.match(/\[(.*?)\]/)
      const channel = (chMatch?.[1] || 'main').toLowerCase()

      let nickname = spans[1].textContent?.trim() || ''
      nickname = nickname.replace(/[：:]$/u, '') || '不明'

      const lastSpan = spans[spans.length - 1]
      let message = lastSpan.innerHTML?.trim() || ''
      message = normalizeBr(message)

      const style = p.getAttribute('style') || ''
      const color = parseColorFromStyle(style)

      const item = {} as LogItem
      item.id = items.length
      item.nickname = nickname
      item.IMUserId = this.getAutoIMUserId(items.length, nickname)
      item.time = 0
      item.message = message
      item.isDice = isDiceMessage(message)
      item.commandId = 0
      item.color = color
      item.commandInfo = { channel }
      if (/^\s*kp\s*$/i.test(nickname)) item.role = '主持人'

      this.setCharInfo(charInfo, item)
      const key = `${nickname}-${item.IMUserId}`
      const ci = charInfo.get(key)
      if (ci && color) { ci.color = color; charInfo.set(key, ci) }

      items.push(item)
    }
    return { items, charInfo, startText: '' }
  }
}

import { strFromU8 } from 'fflate'
import { LogImporter, TextInfo } from './_logImpoter'
import { CharItem, CharacterAssets, LogItem, characterAssetKey, packNameId } from '../types'
import { readZip, safeImageUrl } from '~/utils/logStyle'

// Standard SealChat export schema: service/export_formatter.go and export_viewer_renderer.go.
// Parse the embedded JSON only; never execute the viewer's scripts.
interface SealChatMessage {
  sender_id: string; sender_identity_id?: string; sender_name: string; sender_avatar?: string
  sender_color?: string; content: string; content_html?: string; created_at: string; is_bot?: boolean
  channel_name?: string
}
interface SealChatPayload {
  channel_name: string; messages: SealChatMessage[]; inline_assets?: Record<string, string>
}

export function readSealChatPayload(text: string): SealChatPayload | undefined {
  try {
    let json = text
    if (text.includes('window.__EXPORT_DATA__')) {
      const doc = new DOMParser().parseFromString(text, 'text/html')
      const script = Array.from(doc.scripts).find(el => /^\s*window\.__EXPORT_DATA__\s*=/.test(el.textContent || ''))
      if (!script) return
      json = (script.textContent || '').replace(/^\s*window\.__EXPORT_DATA__\s*=\s*/, '').trim().replace(/;$/, '')
    }
    const data = JSON.parse(json)
    if (!Array.isArray(data.messages) || !data.messages.every((m: SealChatMessage) => typeof m.sender_name === 'string' && typeof m.sender_id === 'string' && typeof m.content === 'string')) return
    return data
  } catch { return }
}

function resolveAsset(url: string, assets: Record<string, string>) {
  return safeImageUrl(url.startsWith('scasset:') ? assets[url.slice(8)] || '' : url)
}

function bodyText(html: string, assets: Record<string, string>) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script,style,iframe,object,embed').forEach(el => el.remove())
  doc.querySelectorAll('img').forEach(el => {
    const url = resolveAsset(el.getAttribute('src') || '', assets)
    el.replaceWith(doc.createTextNode(url ? `[CQ:image,file=sealchat,url=${url}]` : '[图片资源缺失]'))
  })
  doc.querySelectorAll('br').forEach(el => el.replaceWith('\n'))
  doc.querySelectorAll('p,div,li,blockquote,h1,h2,h3,h4').forEach(el => el.append('\n'))
  return (doc.body.textContent || '').trim()
}

function avatarTag(url: string) {
  let hash = 2166136261
  for (let i = 0; i < url.length; i++) hash = Math.imul(hash ^ url.charCodeAt(i), 16777619)
  return `sc-${(hash >>> 0).toString(16)}`
}

export class SealChatLogImporter extends LogImporter {
  get name() { return 'SealChat HTML 日志' }
  check(text: string) { return !!readSealChatPayload(text) }
  parse(text: string): TextInfo {
    const data = readSealChatPayload(text)!
    const charInfo = new Map<string, CharItem>()
    const characterAssets: Record<string, CharacterAssets> = {}
    const items: LogItem[] = []
    for (const msg of data.messages) {
      const name = msg.sender_name.replace(/[\r\n]+/g, ' ') || '未命名'
      // The identity ID distinguishes two characters played by the same account.
      const account = msg.sender_identity_id || msg.sender_id
      const key = characterAssetKey(name, account)
      const assets = characterAssets[key] ||= { expressions: {} }
      const avatar = resolveAsset(msg.sender_avatar || '', data.inline_assets || {})
      let expressionTag: string | undefined
      if (avatar) {
        expressionTag = avatarTag(avatar)
        while (assets.expressions[expressionTag] && assets.expressions[expressionTag] !== avatar) expressionTag += '-1'
        assets.expressions[expressionTag] = avatar
        assets.avatar ||= avatar
      }
      const item: LogItem = {
        id: items.length, nickname: name, IMUserId: account, time: Math.floor(Date.parse(msg.created_at) / 1000) || 0,
        message: msg.content_html ? bodyText(msg.content_html, data.inline_assets || {}) : msg.content.replace(/scasset:[\w-]+/g, url => resolveAsset(url, data.inline_assets || {})),
        isDice: !!msg.is_bot, commandId: 0, expressionTag,
        groupName: msg.channel_name || data.channel_name || 'main'
      }
      this.setCharInfo(charInfo, item)
      const pc = charInfo.get(packNameId(item))!
      pc.avatar = assets.avatar
      if (/^#[\da-f]{6}$/i.test(msg.sender_color || '')) pc.color = msg.sender_color!
      items.push(item)
    }
    return { items, charInfo, startText: '', characterAssets }
  }
}

export async function readLogFile(file: File): Promise<string> {
  if (!/\.zip$/i.test(file.name)) return file.text()
  const files = readZip(new Uint8Array(await file.arrayBuffer()))
  const metaBytes = files['manifest/meta.json']
  if (!metaBytes) throw new Error('这不是 SealChat HTML 日志包；样式 ZIP 请在头像与差分工作台导入')
  const meta = JSON.parse(strFromU8(metaBytes))
  if (!Array.isArray(meta.parts)) throw new Error('日志包缺少分片列表')
  const messages: SealChatMessage[] = []
  for (const part of [...meta.parts].sort((a, b) => a.part_index - b.part_index)) {
    if (!files[part.file]) throw new Error(`日志包缺少分片 ${part.file}`)
    const payload = readSealChatPayload(strFromU8(files[part.file]))
    if (!payload) throw new Error(`无法读取分片 ${part.file}`)
    for (const msg of payload.messages) messages.push({ ...msg,
      channel_name: payload.channel_name,
      sender_avatar: resolveAsset(msg.sender_avatar || '', payload.inline_assets || {}),
      // Resolve each part's private asset table before combining parts.
      content: msg.content_html ? bodyText(msg.content_html, payload.inline_assets || {}) : msg.content.replace(/scasset:[\w-]+/g, url => resolveAsset(url, payload.inline_assets || {})),
      content_html: undefined
    })
  }
  return JSON.stringify({ channel_name: meta.channel_name, messages })
}

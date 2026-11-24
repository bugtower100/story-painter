import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'

// SealChat style-package v1 protocol (MIT):
// https://github.com/kagangtuya-star/sealchat/blob/master/doc/log-layout-style-authoring.md
export interface LogStylePackage {
  schemaVersion: number
  id: string
  name: string
  version: string
  license: string
  minRendererVersion: string
  tokens: Record<string, string | number | boolean>
  templates: Record<string, string>
  css: string
  rules: { messageType?: string; identityKey?: string; variantKey?: string; templateId: string }[]
  settingsSchema: Record<string, unknown>
  assets: { id: string; path: string; mime: string; sha256: string }[]
  // Local asset bytes, stored as data URLs; omitted from exported SealChat manifests.
  assetData?: Record<string, string>
}

export function starterStyle(): LogStylePackage {
  return {
    schemaVersion: 1, id: 'story-painter-custom', name: '自定义样式', version: '1.0.0', license: 'MIT', minRendererVersion: '1.0.0',
    tokens: { ink: '#44364f', accent: '#8763a4', paper: '#fbf8ff', showTime: true },
    templates: { message: '<article class="message"><img class="avatar" data-log-bind-src="speaker.avatarUrl" /><div class="bubble"><header><strong data-log-text="speaker.name"></strong><span class="time" data-log-text="createdAt"></span></header><div data-log-slot="body"></div></div></article>' },
    css: 'body { color: var(--log-ink); }\n.message { display: flex; gap: 16px; align-items: flex-start; }\n.avatar { width: var(--log-avatar-size); height: var(--log-avatar-size); border-radius: var(--log-avatar-radius); object-fit: cover; }\n.bubble { min-width: 0; flex: 1; padding: 16px 20px; border: 1px solid #d8c8e7; border-radius: 12px; background: var(--log-bubble-bg, var(--log-paper)); }\nheader { color: var(--log-speaker-color, var(--log-accent)); margin-bottom: 8px; }\n.time { margin-left: 12px; font-size: .8em; opacity: .65; }\n:root[data-log-showtime="false"] .time { display: none; }',
    rules: [{ templateId: 'message' }], settingsSchema: {}, assets: [], assetData: {}
  }
}

const tags = new Set('div span p section article header footer main aside figure figcaption img h1 h2 h3 h4 h5 h6 blockquote strong em b i br hr ul ol li table thead tbody tr td th'.split(' '))
const attrs = new Set(['class', 'title', 'alt', 'role', 'data-log-text', 'data-log-if', 'data-log-bind-src', 'data-log-slot', 'data-log-part'])
const safePath = (path: string) => !!path && !/[\\:\0]/.test(path) && path.split('/').every(p => !!p && p !== '.' && p !== '..')

export function expandTemplate(pkg: LogStylePackage, id: string, chain: string[] = []): DocumentFragment {
  if (chain.includes(id) || chain.length >= 8) throw new Error(`模板 ${id} 存在循环引用或嵌套超过 8 层`)
  const source = pkg.templates[id]
  if (typeof source !== 'string') throw new Error(`找不到模板：${id}`)
  const template = document.createElement('template')
  template.innerHTML = source
  for (const el of Array.from(template.content.querySelectorAll('*'))) {
    if (!tags.has(el.localName)) throw new Error(`模板不支持 <${el.localName}> 标签`)
    for (const attr of Array.from(el.attributes)) {
      if (!attrs.has(attr.name)) throw new Error(`模板不支持 ${attr.name} 属性；外观请写在 CSS 中`)
    }
    if (el.hasAttribute('data-log-bind-src') && (el.localName !== 'img' || !['speaker.avatarUrl', 'assetUrl', 'content.assetUrl'].includes(el.getAttribute('data-log-bind-src')!))) throw new Error('图片绑定应使用 data-log-bind-src="speaker.avatarUrl"')
    if (el.hasAttribute('data-log-slot') && (!['div', 'section'].includes(el.localName) || el.getAttribute('data-log-slot') !== 'body')) throw new Error('正文插槽应为 div 或 section 的 data-log-slot="body"')
    const part = el.getAttribute('data-log-part')
    if (part) {
      el.replaceChildren(expandTemplate(pkg, part, [...chain, id]))
      el.removeAttribute('data-log-part')
    }
  }
  if (template.content.querySelectorAll('*').length > 4096) throw new Error('模板展开后的元素过多')
  return template.content
}

export function validateStyle(value: unknown): LogStylePackage {
  const pkg = value as LogStylePackage
  if (!pkg || pkg.schemaVersion !== 1 || !pkg.templates || typeof pkg.templates !== 'object' || typeof pkg.css !== 'string' || !Array.isArray(pkg.rules) || !pkg.tokens || typeof pkg.tokens !== 'object' || !Array.isArray(pkg.assets)) throw new Error('不是 SealChat v1 样式包：需要 templates、css、tokens、rules 和 assets')
  for (const [id, source] of Object.entries(pkg.templates)) {
    if (!/^[\w-]+$/.test(id) || typeof source !== 'string' || source.length > 512 * 1024) throw new Error(`模板 ${id} 无效或过大`)
    expandTemplate(pkg, id)
  }
  if (!Object.keys(pkg.templates).length) throw new Error('样式包没有模板')
  for (const rule of pkg.rules) {
    if (!rule || typeof rule.templateId !== 'string') throw new Error('模板规则需要 templateId')
    if (expandTemplate(pkg, rule.templateId).querySelectorAll('[data-log-slot="body"]').length !== 1) throw new Error(`消息模板 ${rule.templateId} 必须恰好包含一个正文插槽`)
  }
  for (const [key, value] of Object.entries(pkg.tokens)) {
    if (!/^[\w-]+$/.test(key) || !['string', 'number', 'boolean'].includes(typeof value)) throw new Error(`设计变量 ${key} 无效`)
  }
  for (const asset of pkg.assets) {
    if (!safePath(asset.path) || !asset.path.startsWith('assets/') || !pkg.assetData?.[asset.id]) throw new Error(`缺少资源 ${asset.path}；含图片或字体的样式请导入完整 ZIP 包`)
  }
  return pkg
}

export function readZip(bytes: Uint8Array): Record<string, Uint8Array> {
  if (bytes.length > 20 * 1024 * 1024) throw new Error('ZIP 文件不能超过 20 MB')
  let count = 0, total = 0
  return unzipSync(bytes, { filter: file => {
    if (file.name.endsWith('/')) return false
    total += file.originalSize
    if (!safePath(file.name) || ++count > 200 || total > 50 * 1024 * 1024) throw new Error('ZIP 路径无效或解压内容超过限制（200 个文件 / 50 MB）')
    return true
  } })
}

function asDataUrl(bytes: Uint8Array, mime: string) {
  let binary = ''
  for (let n = 0; n < bytes.length; n += 8192) binary += String.fromCharCode(...bytes.subarray(n, n + 8192))
  return `data:${mime};base64,${btoa(binary)}`
}

export async function importStyle(file: File, current = starterStyle()): Promise<LogStylePackage> {
  let pkg: LogStylePackage
  if (/\.zip$/i.test(file.name)) {
    const files = readZip(new Uint8Array(await file.arrayBuffer()))
    const read = (name: string) => { if (!files[name]) throw new Error(`样式包缺少 ${name}`); return strFromU8(files[name]) }
    pkg = { ...JSON.parse(read('manifest.json')), tokens: JSON.parse(read('tokens.json')), settingsSchema: JSON.parse(read('settings.schema.json')), css: read('styles/main.css'), templates: {}, assetData: {} }
    for (const [path, data] of Object.entries(files)) {
      const match = /^templates\/([\w-]+)\.html$/.exec(path)
      if (match) pkg.templates[match[1]] = strFromU8(data)
    }
    for (const asset of pkg.assets || []) {
      if (!files[asset.path] || !/^(image\/(png|jpeg|webp|gif)|font\/(ttf|otf))$/.test(asset.mime)) throw new Error(`资源 ${asset.path} 缺失或格式不支持`)
      pkg.assetData![asset.id] = asDataUrl(files[asset.path], asset.mime)
    }
  } else if (/\.json$/i.test(file.name)) pkg = JSON.parse(await file.text())
  else if (/\.css$/i.test(file.name)) pkg = { ...current, css: await file.text() }
  else {
    const doc = new DOMParser().parseFromString(await file.text(), 'text/html')
    const css = Array.from(doc.querySelectorAll('style')).map(el => el.textContent).join('\n')
    doc.querySelectorAll('style').forEach(el => el.remove())
    pkg = { ...starterStyle(), name: file.name, templates: { message: doc.body.innerHTML }, css: css || current.css }
  }
  return validateStyle(pkg)
}

export function exportStyleZip(pkg: LogStylePackage): Uint8Array {
  validateStyle(pkg)
  const { tokens, templates, css, settingsSchema, assetData, ...manifest } = pkg
  const files: Record<string, Uint8Array> = {
    'manifest.json': strToU8(JSON.stringify(manifest, null, 2)), 'tokens.json': strToU8(JSON.stringify(tokens, null, 2)),
    'settings.schema.json': strToU8(JSON.stringify(settingsSchema || {})), 'styles/main.css': strToU8(css)
  }
  for (const [id, html] of Object.entries(templates)) files[`templates/${id}.html`] = strToU8(html)
  for (const asset of pkg.assets) files[asset.path] = Uint8Array.from(atob(assetData![asset.id].split(',')[1]), c => c.charCodeAt(0))
  return zipSync(files)
}

export interface StyledMessage {
  name: string; identityKey: string; variantKey?: string; avatar: string; color: string
  body: string; time: string; channel: string; messageType: string
}

export function safeImageUrl(value: string) {
  // These URLs also pass through the existing CQ-image serializer.
  if (/[\s"'<>`\u0000-\u001f]/.test(value)) return ''
  return /^(https?:\/\/|data:image\/(png|jpeg|gif|webp);base64,|\/[^/])/i.test(value) ? value.replace(/\[/g, '%5B').replace(/\]/g, '%5D') : ''
}

export function renderStyledLog(pkg: LogStylePackage, messages: StyledMessage[], title: string, baseCss: string): string {
  validateStyle(pkg)
  const doc = document.implementation.createHTMLDocument(title)
  const root = doc.documentElement
  root.lang = 'zh-CN'
  for (const [key, value] of Object.entries(pkg.tokens)) {
    if (typeof value === 'boolean') root.setAttribute(`data-log-${key.toLowerCase()}`, String(value))
    else root.style.setProperty(`--log-${key}`, String(value))
  }
  const meta = doc.createElement('meta')
  meta.httpEquiv = 'Content-Security-Policy'
  meta.content = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data: https: http:; font-src data:; base-uri 'none'; form-action 'none'"
  doc.head.prepend(meta)
  doc.head.insertAdjacentHTML('afterbegin', '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">')
  const css = pkg.css.replace(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/gi, (match, path) => {
    const asset = pkg.assets.find(a => a.path === path)
    return asset ? `url("${pkg.assetData![asset.id]}")` : match
  })
  const style = doc.createElement('style')
  style.textContent = (baseCss + '\n' + css).replace(/</g, '\\3c ')
  doc.head.append(style)
  doc.body.className = 'export-body'
  const container = doc.createElement('main')
  container.className = 'log-export-container'
  const heading = doc.createElement('h1'); heading.textContent = title; container.append(heading)
  for (const message of messages) {
    const rule = pkg.rules.find(r => (!r.messageType || r.messageType === message.messageType) && (!r.identityKey || r.identityKey === message.identityKey) && (!r.variantKey || r.variantKey === message.variantKey))
    const fragment = rule ? expandTemplate(pkg, rule.templateId) : expandTemplate(starterStyle(), 'message')
    const plain = doc.createElement('div'); plain.innerHTML = message.body
    const fields: Record<string, string> = { 'speaker.name': message.name, 'speaker.color': message.color, 'speaker.avatarUrl': safeImageUrl(message.avatar), plainText: plain.textContent || '', createdAt: message.time, title, 'section.title': message.channel }
    fragment.querySelectorAll('[data-log-if]').forEach(el => { if (!fields[el.getAttribute('data-log-if')!]) el.remove() })
    fragment.querySelectorAll('[data-log-text]').forEach(el => { el.textContent = fields[el.getAttribute('data-log-text')!] || '' })
    fragment.querySelectorAll('[data-log-bind-src]').forEach(el => { const src = fields[el.getAttribute('data-log-bind-src')!]; if (src) el.setAttribute('src', src); else el.remove() })
    fragment.querySelector('[data-log-slot="body"]')!.innerHTML = message.body
    const node = doc.createElement('section')
    node.className = 'log-node log-node--message'
    node.dataset.logType = message.messageType; node.dataset.logSpeaker = message.identityKey; node.dataset.logChannel = message.channel
    if (message.variantKey) node.dataset.logVariant = message.variantKey
    node.style.setProperty('--log-speaker-color', message.color)
    node.append(fragment); container.append(node)
  }
  doc.body.append(container)
  return '<!DOCTYPE html>\n' + root.outerHTML
}

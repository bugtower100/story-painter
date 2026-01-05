import dayjs from "dayjs";
import { saveAs } from 'file-saver';
import { CharItem, LogItem, packNameId } from "~/logManager/types";
import { useStore } from "~/store";
import { h, render } from 'vue'
import PreviewItemNoavatar from '~/components/previews/preview-main-item-noavatar.vue'
import { zipSync, strToU8 } from 'fflate'
// TODO: 移植到logMan/exporters

function safeFilePart(v: string) {
  return v.replace(/[^a-zA-Z0-9_-]/g, '_')
}

function pickAvatar(store: ReturnType<typeof useStore>, item: LogItem) {
  const id = packNameId(item)
  const info = store.pcMap.get(id)
  if (item.overrideAvatar) return item.overrideAvatar

  const name = info?.name || item.nickname
  if (item.expressionTag) {
    const m = store.workbench.pcNameExpressionsMap.get(name) || {}
    const exp = m[item.expressionTag]
    if (exp) return exp
  }
  return info?.avatar
}
export function exportFileQQ(results: LogItem[], options: any = undefined) {
  const store = useStore();
  const map = store.pcMap;

  let text = ''
  for (let i of results) {
    if (i.isRaw) continue;
    const id = packNameId(i);
    if (map.get(id)?.role === '隐藏') continue;

    let timeText = i.time.toString()
    if (typeof i.time === 'number') {
      timeText = dayjs.unix(i.time).format(options.yearHide ? 'HH:mm:ss' : 'YYYY/MM/DD HH:mm:ss')
    }
    if (options.timeHide) {
      timeText = ''
    }
    let userid = '(' + i.IMUserId + ')'
    if (options.userIdHide) {
      userid = ''
    }
    text += `${i.nickname}${userid} ${timeText}\n${i.message.replaceAll('<br />', '\n')}`
  }

  const title = store.workbench?.title || '跑团记录'
  saveAs(new Blob([text],  {type: "text/plain;charset=utf-8"}), `${title}(QQ风格).txt`)
  return text
}

export function exportFileIRC(results: LogItem[], options: any = undefined) {
  const store = useStore();
  const map = store.pcMap;

  let text = ''
  for (let i of results) {
    if (i.isRaw) continue;
    const id = packNameId(i);
    if (map.get(id)?.role === '隐藏') continue;

    let timeText = i.time.toString()
    if (typeof i.time === 'number') {
      timeText = dayjs.unix(i.time).format(options.yearHide ? 'HH:mm:ss' : 'YYYY/MM/DD HH:mm:ss')
    }
    if (options.timeHide) {
      timeText = ''
    }
    let userid = '(' + i.IMUserId + ')'
    if (options.userIdHide) {
      userid = ''
    }
    text += `${timeText}<${i.nickname}${userid}>:${i.message.replaceAll('<br />', '\n')}`
  }

  const title = store.workbench?.title || '跑团记录'
  saveAs(new Blob([text],  {type: "text/plain;charset=utf-8"}), `${title}(主流风格).txt`)
  return text
}

export function exportFileRaw(doc: string) {
  const store = useStore();
  const title = store.workbench?.title || '跑团记录'
  saveAs(new Blob([doc],  {type: "text/plain;charset=utf-8"}), `${title}(未处理).txt`)
}

export function exportFileDoc(html: string, options: any = undefined) {
  const store = useStore();
  const title = store.workbench?.title || '跑团记录'
  const text = `MIME-Version: 1.0
Content-Type: multipart/related; boundary="----=_NextPart_WritingBug"

此文档为“单个文件网页”，也称为“Web 档案”文件。如果您看到此消息，但是您的浏览器或编辑器不支持“Web 档案”文件。请下载支持“Web 档案”的浏览器。

------=_NextPart_WritingBug
Content-Type: text/html; charset="utf-8"

<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${title}</title></head>
<body>
` + html +
`
</body>
</html>
------=_NextPart_WritingBug
Content-Transfer-Encoding: quoted-printable
Content-Type: text/xml; charset="utf-8"

<xml xmlns:o=3D"urn:schemas-microsoft-com:office:office">
 <o:MainFile HRef=3D"../file4969.htm"/>
 <o:File HRef=3D"themedata.thmx"/>
 <o:File HRef=3D"colorschememapping.xml"/>
 <o:File HRef=3D"header.htm"/>
 <o:File HRef=3D"filelist.xml"/>
</xml>
------=_NextPart_WritingBug--`

  saveAs(new Blob([text],  {type: "application/msword"}), `${title}.doc`)
  return text
}

export function exportFileHtmlSingle(results: LogItem[], options: any = undefined) {
  const store = useStore();
  const map = store.pcMap;
  const el = document.createElement('span');
  const items: string[] = []

  for (let i of results) {
    if (i.isRaw) continue;
    const id = packNameId(i);
    if (map.get(id)?.role === '隐藏') continue;
    const vnode = h(PreviewItemNoavatar, { source: i })
    render(vnode, el)
    items.push(el.innerHTML)
  }
  console.log(items)

  const title = store.workbench?.title || '跑团记录'
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${items.join('\n')}</body></html>`
  saveAs(new Blob([html], { type: 'text/html;charset=utf-8' }), `${title}.html`)
  return html
}

export function exportFileHtmlZip(results: LogItem[], options: any = undefined) {
  const store = useStore();
  const map = store.pcMap;
  const el = document.createElement('span');
  const items: string[] = []
  const files: Record<string, Uint8Array> = {}

  const avatarCache = new Map<string, string>()

  const addDataUrl = async (path: string, dataUrl: string) => {
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    const ab = await blob.arrayBuffer()
    files[path] = new Uint8Array(ab)
  }

  const tasks: Promise<any>[] = []

  for (let i of results) {
    if (i.isRaw) continue;
    const id = packNameId(i);
    if (map.get(id)?.role === '隐藏') continue;

    const avatar = pickAvatar(store, i)
    if (avatar) {
      const avatarKey = `${id}#${i.expressionTag || ''}`
      const avatarPath = `images/avatar_${safeFilePart(avatarKey)}.png`
      if (!avatarCache.has(avatarKey)) {
        avatarCache.set(avatarKey, avatarPath)
        tasks.push(addDataUrl(avatarPath, avatar))
      }
    }

    const vnode = h(PreviewItemNoavatar, { source: i })
    render(vnode, el)
    items.push(el.innerHTML)
  }

  const title = store.workbench?.title || '跑团记录'
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${items.join('\n')}</body></html>`
  files['index.html'] = strToU8(html)

  const doZip = async () => {
    await Promise.all(tasks)
    const zipped = zipSync(files)
    const zippedCopy = new Uint8Array(zipped.length)
    zippedCopy.set(zipped)
    saveAs(new Blob([zippedCopy], { type: 'application/zip' }), `${title}.zip`)
    return zipped
  }
  return doZip()
}

const bubbleCss = `.hidden{display:none!important}:root{--bubble-max-width:80%;--bubble-bg-color:#ffffff;--bubble-arrow-color:#ffffff;--bubble-right-bg-color:#dcf8c6;--bubble-right-arrow-color:#dcf8c6;--icon-size:64px;--base-text-color:#333333;--text-edge-color:#ffffff;--avatar-border-color:#333333}body.export-body{margin:0;padding:0;background-color:#f3f4f6;font-size:16px;line-height:1.7;color:var(--base-text-color)}.log-export-container{max-width:900px;margin:20px auto;padding:20px 25px;background-color:rgb(243,244,246);border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.1)}#log-display{--bubble-max-width:80%;--bubble-bg-color:#ffffff;--bubble-right-bg-color:#dcf8c6;--bubble-arrow-color:#ffffff;--bubble-right-arrow-color:#dcf8c6;--icon-size:64px}.filter-controls{background-color:#f8f9fa;padding:10px 15px;border-radius:6px;margin-bottom:12px;border:1px solid #dee2e6}.filter-controls .control-row{display:flex;gap:12px;margin-top:6px;font-size:12px;color:#495057}.tab-nav{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.tab-button{background-color:#e9ecef;border:1px solid #ced4da;color:#495057;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:12px}.tab-button.active{background-color:#0d6efd;border-color:#0d6efd;color:#fff}.channel-title{font-size:12px;color:#888;border-bottom:2px solid #cfcfcf;margin:12px 0 8px}.channel-section{margin-bottom:12px}.message-item{display:block;margin:12px 0}.message-container{display:flex;gap:12px;align-items:flex-start}.message-container.align-right{flex-direction:row-reverse}.icon-container{width:var(--icon-size);height:var(--icon-size);flex-shrink:0}.icon{width:100%;height:100%;border-radius:50%;border:2px solid var(--avatar-border-color);background:#ffffff;object-fit:cover}.icon.placeholder{width:100%;height:100%;border-radius:50%;border:2px solid var(--avatar-border-color);background:#ffffff;color:#000000;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:20px}.content-container{max-width:var(--bubble-max-width)}.speaker-name-default{font-weight:bold;margin-bottom:6px}.speaker-name-default .channel-name{margin-left:6px;font-size:12px;color:#888}.speaker-name-default .imuid{margin-left:6px;font-size:12px;color:#888}.bubble{position:relative;padding:10px 12px;border-radius:8px;background-color:var(--bubble-bg-color)}.message-container.align-right .bubble{background-color:var(--bubble-right-bg-color)}.bubble::before{content:"";position:absolute;top:12px;left:-8px;border-width:8px;border-style:solid;border-color:transparent var(--bubble-arrow-color) transparent transparent}.message-container.align-right .bubble::before{left:auto;right:-8px;border-color:transparent transparent transparent var(--bubble-right-arrow-color)}.bubble p{margin:0 0 6px 0}.hide-images .bubble img{display:none}.hide-time .bubble ._time{display:none}.hide-userid .speaker-name-default .imuid{display:none}.tab-separator{border:0;border-top:1px dashed #ccc;margin:24px 0;position:relative}.tab-separator::after{content:"";position:absolute;top:-8px;left:50%;transform:translateX(-50%);background:#f3f4f6;padding:0 8px;color:#999;font-size:12px}`

function getDefaultFilename() {
  const store = useStore()
  const title = store.workbench?.title
  if (title && title.trim()) return `${title.trim()}.html`
  const txt = store.editor?.state?.doc?.toString() || ''
  const line1 = txt.split(/\n/)[0] || '跑团记录'
  return `${line1 || '跑团记录'}.html`
}

export async function exportFileHtmlBubbleSingle(results: LogItem[]) {
  const store = useStore();
  const map = store.pcMap;
  const el = document.createElement('span');
  const items: string[] = []
  const chSet = new Set<string>()

  let lastChannel = ''
  console.log(results)
  const output = []
  // Helper to convert image URL to Base64
  const getBase64Image = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error('Failed to load image for export:', url, e);
      return url; // Fallback to original URL
    }
  };

  // Pre-process all avatars
  const avatarMap = new Map<string, string>();
  const avatarTasks = [];

  for (let i of results) {
    if (i.isRaw) continue;
    const id = packNameId(i);
    const avatar = pickAvatar(store, i)
    if (avatar && !avatarMap.has(avatar)) {
      // If it's a local path (not starting with data: or http), or just needs embedding
      // Actually for single HTML file, we generally want everything embedded as Data URL
      // unless it's already a Data URL.
      if (!avatar.startsWith('data:')) {
          avatarTasks.push(getBase64Image(avatar).then(base64 => avatarMap.set(avatar, base64)));
      } else {
          avatarMap.set(avatar, avatar);
      }
    }
  }
  
  // Wait for all images to be converted
  await Promise.all(avatarTasks);

  for (let i of results) {
    if (i.isRaw) continue;
    const id = packNameId(i);
    if (map.get(id)?.role === '隐藏') continue;
    const vnode = h(PreviewItemNoavatar, { source: i })
    render(vnode, el)
    let inner = el.innerHTML
    if (store.exportOptions.timeHide) {
      inner = inner.replace(/<span[^>]*class="_time"[^>]*>[^<]*<\/span>\s*/g, '')
    }
    const res = /<\/span><div[^>]*?>([\s\S]*?)<\/div><\/div>$/.exec(inner)
    if (res){
      inner = res[1]
    }
    const originalAvatar = pickAvatar(store, i)
    const avatar = avatarMap.get(originalAvatar!) || originalAvatar

    const initial = i.nickname?.trim()?.charAt(0) || '?'
    const iconHtml = avatar ? `<img class="icon" src="${avatar}" />` : `<div class="icon placeholder">${initial}</div>`
    const alignRight = false
    const borderColor = map.get(id)?.color || '#333333'
    console.log(i.commandInfo)
    output.push({
      time: i.time,
      "tab": (i as any).commandInfo?.channel || "main",
      "speaker": i.nickname,
      "displayMode": "bubble",
      "iconUrl": avatar,
      "borderColor": borderColor,
      "textColor": borderColor,
      "placeholderChar": i.nickname.charAt(0),
      "iconDisplayStyle": "none",
      "message":inner,
      "bubbleBgColor": store.workbench.bubbleColor || "#ffffff",
      "bubbleArrowColor": store.workbench.bubbleColor || "#ffffff",
      "showSeparator": true
    })
    const ch = ((i as any).commandInfo?.channel || 'main').toLowerCase()
    chSet.add(ch)

    if (lastChannel && lastChannel !== ch) {
      items.push(`<hr class="tab-separator export">`)
    }
    lastChannel = ch

    const block = `<div class="message-item" data-tab="${ch}"><div class="message-container${alignRight ? ' align-right' : ''}" style="--avatar-border-color:${borderColor}"><div class="icon-container">${iconHtml}</div><div class="content-container"><div class="speaker-name-default">${i.nickname}<span class="imuid">(${i.IMUserId})</span><span class="channel-name">[${ch}]</span></div><div class="bubble">${inner}</div></div></div></div>`
    items.push(block)
  }

  // const bg = store.workbench.backgroundImage
  // const styleVars = `style="--bubble-max-width:${store.workbench.bubbleMaxWidth}%;--bubble-bg-color:${store.workbench.bubbleColor};--bubble-right-bg-color:${store.workbench.rightBubbleColor};--icon-size:${store.workbench.iconSize}px;--text-edge-color:${store.workbench.textEdgeColor};"`
  // const title = store.workbench.title || '跑团记录'
  // const bodyClass = bg ? 'export-body has-background-image' : 'export-body'
  // const chKeys = Array.from(chSet)
  
  // const nav = `<div class="filter-controls"><div class="tab-nav">${['all',...chKeys].map(k => `<span class="tab-button${k==='all'?' active':''}" data-tab="${k}">${k}</span>`).join('')}</div><div class="control-row">${chKeys.map(k => `<label><input type="checkbox" class="channel-filter" data-channel="${k}" checked> ${k}</label>`).join('')}</div></div>`
  
  // const script = `<script>(function(){const root=document.getElementById('log-display');const btns=document.querySelectorAll('.tab-button');const chFilters=document.querySelectorAll('.channel-filter');let currentTab='all';function update(){document.querySelectorAll('.message-item').forEach(item=>{const itemTab=item.getAttribute('data-tab');let visible=false;if(currentTab==='all'){const cb=document.querySelector('.channel-filter[data-channel="'+itemTab+'"]');visible=cb&&cb.checked;}else{visible=itemTab===currentTab;}item.classList.toggle('hidden',!visible);});document.querySelectorAll('.tab-separator').forEach(sep=>{sep.classList.toggle('hidden',currentTab!=='all')});}btns.forEach(b=>b.addEventListener('click',function(){btns.forEach(x=>x.classList.remove('active'));this.classList.add('active');currentTab=this.getAttribute('data-tab');update();}));chFilters.forEach(cb=>cb.addEventListener('change',update));function markOffTopic(){document.querySelectorAll('.bubble p').forEach(p=>{const t=(p.textContent||'').trim();if(/^\(?[（(]/.test(t)){p.classList.add('offtopic');}});}markOffTopic();})();</script>`
  // const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${bubbleCss}</style></head><body class="${bodyClass}"><div class="log-export-container"><h1>${title}</h1>${nav}<div id="log-display" ${styleVars}>${items.join('\n')}</div></div>${script}</body></html>`
  // const name = getDefaultFilename()  
  let html = store.templateHTML.replace('$$replace',JSON.stringify(output))

  // Inject Title
  const title = store.workbench.title || '跑团记录'
  html = html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
  html = html.replace(/<h1>.*?<\/h1>/, `<h1>${title}</h1>`)

  // Inject CSS Variables and Styles
  const bgImg = store.workbench.backgroundImage ? `url('${store.workbench.backgroundImage}')` : 'none';
  const bubbleBgImg = store.workbench.bubbleBackgroundImage ? `url('${store.workbench.bubbleBackgroundImage}')` : 'none';
  const containerBgImg = store.workbench.containerBackgroundImage ? `url('${store.workbench.containerBackgroundImage}')` : 'none';
  
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 };
  }
  const cColor = hexToRgb(store.workbench.containerColor || '#ffffff');
  const cOpacity = (store.workbench.containerOpacity !== undefined ? store.workbench.containerOpacity : 90) / 100;
  const containerRgba = `rgba(${cColor.r}, ${cColor.g}, ${cColor.b}, ${cOpacity})`;
  const containerBgLayer = store.workbench.containerBackgroundImage
    ? `linear-gradient(${containerRgba}, ${containerRgba}), ${containerBgImg}`
    : `linear-gradient(${containerRgba}, ${containerRgba})`;
  const pageBgColor = store.workbench.globalBackgroundColor || '#f3f4f6';

  const customCss = `
  <style>
    :root {
      --bubble-max-width: ${store.workbench.bubbleMaxWidth}%;
      --bubble-bg-color: ${store.workbench.bubbleColor};
      --bubble-arrow-color: ${store.workbench.bubbleColor};
      --icon-size: ${store.workbench.iconSize}px;
      --bubble-bg-image: ${bubbleBgImg};
    }
    body.export-body {
      background-color: ${pageBgColor} !important;
    }
    body.export-body.has-background-image::before {
      background-image: ${bgImg};
    }
    body.export-body.has-background-image {
      background-color: transparent !important;
    }
    .log-export-container {
      position: relative;
    }
    .log-export-container::before {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: 8px;
      background-image: ${containerBgLayer};
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      z-index: 0;
      pointer-events: none;
    }
    .log-export-container > * {
      position: relative;
      z-index: 1;
    }
    .bubble.export {
      background-image: var(--bubble-bg-image);
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
    }
  </style>
  `
  html = html.replace('</body>', `${customCss}</body>`)

  // Add has-background-image class if needed
  if (store.workbench.backgroundImage) {
    html = html.replace('body class="', 'body class="has-background-image ')
  }

  const name = getDefaultFilename()
  saveAs(new Blob([html], { type: 'text/html;charset=utf-8' }), name)
  return html
}

export function exportFileHtmlBubbleZip(results: LogItem[]) {
  const store = useStore();
  const map = store.pcMap;
  const el = document.createElement('span');
  const files: Record<string, Uint8Array> = {}

  const avatarCache = new Map<string, string>()

  const addDataUrl = async (path: string, dataUrl: string) => {
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    const ab = await blob.arrayBuffer()
    files[path] = new Uint8Array(ab)
  }

  const tasks: Promise<any>[] = []

  const output = []
  for (let i of results) {
    if (i.isRaw) continue;
    const id = packNameId(i);
    if (map.get(id)?.role === '隐藏') continue;
    const vnode = h(PreviewItemNoavatar, { source: i })
    render(vnode, el)
    let inner = el.innerHTML
    if (store.exportOptions.timeHide) {
      inner = inner.replace(/<span[^>]*class="_time"[^>]*>[^<]*<\/span>\s*/g, '')
    }
    const res = /<\/span><div[^>]*?>([\s\S]*?)<\/div><\/div>$/.exec(inner)
    if (res){
      inner = res[1]
    }

    const avatar = pickAvatar(store, i)
    let avatarPath = ''
    if (avatar) {
      const avatarKey = `${id}#${i.expressionTag || ''}`
      avatarPath = `images/avatar_${safeFilePart(avatarKey)}.png`
      if (!avatarCache.has(avatarKey)) {
        avatarCache.set(avatarKey, avatarPath)
        tasks.push(addDataUrl(avatarPath, avatar))
      }
    }

    const borderColor = map.get(id)?.color || '#333333'
    
    output.push({
      time: i.time,
      "tab": (i as any).commandInfo?.channel || "main",
      "speaker": i.nickname,
      "displayMode": "bubble",
      "iconUrl": avatarPath, // Use relative path for ZIP
      "borderColor": borderColor,
      "textColor": borderColor,
      "placeholderChar": i.nickname.charAt(0),
      "iconDisplayStyle": "none",
      "message":inner,
      "bubbleBgColor": store.workbench.bubbleColor || "#ffffff",
      "bubbleArrowColor": store.workbench.bubbleColor || "#ffffff",
      "showSeparator": true
    })
  }

  let html = store.templateHTML.replace('$$replace',JSON.stringify(output))

  // Inject Title
  const title = store.workbench.title || '跑团记录'
  html = html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
  html = html.replace(/<h1>.*?<\/h1>/, `<h1>${title}</h1>`)

  // Inject CSS Variables and Styles
  const bgImg = store.workbench.backgroundImage ? `url('${store.workbench.backgroundImage}')` : 'none';
  const bubbleBgImg = store.workbench.bubbleBackgroundImage ? `url('${store.workbench.bubbleBackgroundImage}')` : 'none';
  const containerBgImg = store.workbench.containerBackgroundImage ? `url('${store.workbench.containerBackgroundImage}')` : 'none';
  
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 };
  }
  const cColor = hexToRgb(store.workbench.containerColor || '#ffffff');
  const cOpacity = (store.workbench.containerOpacity !== undefined ? store.workbench.containerOpacity : 90) / 100;
  const containerRgba = `rgba(${cColor.r}, ${cColor.g}, ${cColor.b}, ${cOpacity})`;
  const containerBgLayer = store.workbench.containerBackgroundImage
    ? `linear-gradient(${containerRgba}, ${containerRgba}), ${containerBgImg}`
    : `linear-gradient(${containerRgba}, ${containerRgba})`;
  const pageBgColor = store.workbench.globalBackgroundColor || '#f3f4f6';

  const customCss = `
  <style>
    :root {
      --bubble-max-width: ${store.workbench.bubbleMaxWidth}%;
      --bubble-bg-color: ${store.workbench.bubbleColor};
      --bubble-arrow-color: ${store.workbench.bubbleColor};
      --icon-size: ${store.workbench.iconSize}px;
      --bubble-bg-image: ${bubbleBgImg};
    }
    body.export-body {
      background-color: ${pageBgColor} !important;
    }
    body.export-body.has-background-image::before {
      background-image: ${bgImg};
    }
    body.export-body.has-background-image {
      background-color: transparent !important;
    }
    .log-export-container {
      position: relative;
    }
    .log-export-container::before {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: 8px;
      background-image: ${containerBgLayer};
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      z-index: 0;
      pointer-events: none;
    }
    .log-export-container > * {
      position: relative;
      z-index: 1;
    }
    .bubble.export {
      background-image: var(--bubble-bg-image);
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
    }
  </style>
  `
  html = html.replace('</body>', `${customCss}</body>`)

  // Add has-background-image class if needed
  if (store.workbench.backgroundImage) {
    html = html.replace('body class="', 'body class="has-background-image ')
  }

  files['index.html'] = strToU8(html)
  // No need to manually add style.css as the template likely handles it or embeds it. 
  // If the template expects external CSS, we need to know. 
  // Assuming templateHTML is self-contained or refers to resources we need to bundle.
  // Based on single file export, it seems templateHTML handles everything including scripts.
  // However, for ZIP, we might need to handle images (already done) and potentially other assets.
  // The original ZIP export added style.css manually. 
  // But if we switch to templateHTML, the template is designed to work as a single file or with JSON data.
  // Let's assume the templateHTML contains the necessary JS/CSS to render the JSON data `output`.
  
  // Wait, if templateHTML refers to external assets, we need them.
  // But typically "templateHTML" suggests a self-contained HTML structure that consumes the JSON.
  // Let's check if the previous single file export added any extra files? No, it just saved the HTML.
  // So the templateHTML + JSON data should be sufficient for the logic.
  // The only difference for ZIP is that images are external files instead of base64/URLs.
  // I have updated `iconUrl` to use `avatarPath`.

  const doZip = async () => {
    await Promise.all(tasks)
    const zipped = zipSync(files)
    const name = (store.workbench.title && store.workbench.title.trim()) ? `${store.workbench.title.trim()}.zip` : '跑团记录.zip'
    const zippedCopy = new Uint8Array(zipped.length)
    zippedCopy.set(zipped)
    saveAs(new Blob([zippedCopy], { type: 'application/zip' }), name)
    return zipped
  }
  return doZip()
}

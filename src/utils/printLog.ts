// Use the same HTML as export so PDF retains selectable text, original CSS and print rules.
export async function printLog(html: string) {
  const frame = document.createElement('iframe')
  frame.title = 'PDF 打印文档'
  frame.setAttribute('sandbox', 'allow-same-origin allow-modals')
  frame.style.cssText = 'position:fixed;width:1px;height:1px;left:-10000px;top:0;border:0'
  const loaded = new Promise<void>(resolve => { frame.onload = () => resolve() })
  frame.srcdoc = html
  document.body.append(frame)
  try {
    await loaded
    const doc = frame.contentDocument!, win = frame.contentWindow!
    await Promise.all([doc.fonts.ready, ...Array.from(doc.images).map(img => img.decode().catch(() => {}))])
    win.addEventListener('afterprint', () => frame.remove(), { once: true })
    win.focus(); win.print()
  } catch (error) { frame.remove(); throw error }
}

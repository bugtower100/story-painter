<template>
  <div class="wb">
    <header class="wb-header"><div><h2>头像与差分工作台</h2><p>调整排版、管理差分，自定义 HTML 导出样式。</p></div><n-space><n-button @click="guide = true">使用说明</n-button><n-button @click="back">返回主界面</n-button></n-space></header>
    <div class="wb-layout">
      <aside class="wb-controls">
        <n-tabs type="segment" animated>
          <n-tab-pane name="layout" tab="基础排版">
            <div class="wb-form">
              <label>导出标题<n-input v-model:value="w.title" placeholder="跑团记录" /></label>
              <div class="wb-grid">
                <label>字号（px）<input v-model.number="w.fontSize" type="number" min="12" max="48" @change="clampSettings" /></label>
                <label>行距<input v-model.number="w.lineHeight" type="number" min="1" max="3" step="0.1" @change="clampSettings" /></label>
                <label>内容宽度（px）<input v-model.number="w.contentWidth" type="number" min="320" max="1600" step="20" @change="clampSettings" /></label>
                <label>发言间距（px）<input v-model.number="w.messageGap" type="number" min="0" max="80" @change="clampSettings" /></label>
                <label>头像尺寸（px）<input v-model.number="w.iconSize" type="number" min="24" max="160" @change="clampSettings" /></label>
                <label>头像圆角（px）<input v-model.number="w.avatarRadius" type="number" min="0" max="80" @change="clampSettings" /></label>
                <label>气泡颜色<n-color-picker v-model:value="w.bubbleColor" :show-alpha="false" /></label>
                <label>纸张底色<n-color-picker v-model:value="w.containerColor" :show-alpha="false" /></label>
                <label>全局背景色<n-color-picker v-model:value="w.globalBackgroundColor" :show-alpha="false" /></label>
                <label>纸张透明度 {{ w.containerOpacity }}%<n-slider v-model:value="w.containerOpacity" :min="0" :max="100" /></label>
              </div>
              <div v-for="bg in backgrounds" :key="bg.key" class="wb-background"><span>{{ bg.label }}</span><label class="wb-upload">选择图片<input type="file" accept="image/*" :aria-label="bg.label" @change="event => uploadBackground(event, bg.key)" /></label><n-button size="tiny" :disabled="!w[bg.key]" @click="w[bg.key] = ''">移除</n-button></div>
              <p class="wb-note">这些设置用于 HTML 单文件和 ZIP 导出；自定义 CSS 可以覆盖基础排版。</p>
            </div>
          </n-tab-pane>
          <n-tab-pane name="style" tab="HTML 样式">
            <div class="wb-form">
              <n-checkbox v-model:checked="w.useCustomStyle" :disabled="!w.stylePackage">使用自定义样式导出</n-checkbox>
              <label class="wb-upload wb-import">导入 HTML / CSS / SealChat 样式包<input type="file" accept=".html,.htm,.css,.json,.zip" aria-label="导入自定义样式" @change="onStyleFile" /></label>
              <p class="wb-note">HTML 模板须有正文插槽；SealChat 样式支持 JSON 或包含资源的 ZIP。导入后可继续编辑。</p>
              <label>样式名称<input v-model="draft.name" /></label>
              <label>模板<select v-model="templateId" aria-label="选择 HTML 模板"><option v-for="id in Object.keys(draft.templates)" :key="id" :value="id">{{ id }}</option></select></label>
              <label>HTML 模板<textarea v-model="draft.templates[templateId]" aria-label="HTML 模板代码" rows="9" spellcheck="false" /></label>
              <label>CSS<textarea v-model="draft.css" aria-label="CSS 样式代码" rows="9" spellcheck="false" /></label>
              <details><summary>设计变量与模板规则</summary><label>设计变量（JSON）<textarea v-model="tokenText" aria-label="设计变量 JSON" rows="6" spellcheck="false" /></label><label>模板规则（JSON）<textarea v-model="ruleText" aria-label="模板规则 JSON" rows="6" spellcheck="false" /></label></details>
              <p v-if="styleError" role="alert" class="wb-error">{{ styleError }}</p>
              <n-space><n-button type="primary" @click="applyStyle">应用样式</n-button><n-button @click="saveStyle">下载样式包</n-button><n-button @click="loadDraft(starterStyle())">载入示例模板</n-button></n-space>
              <small class="wb-note">编辑后点击「应用样式」更新预览。取消勾选可回到原有气泡样式。</small>
            </div>
          </n-tab-pane>
          <n-tab-pane name="characters" tab="头像与差分">
            <div class="wb-form">
              <input v-model="search" placeholder="搜索角色名字或 ID" aria-label="搜索差分角色" />
              <select v-model="selectedKey" aria-label="选择差分角色"><option value="">选择角色（{{ filteredPcs.length }}）</option><option v-for="pc in filteredPcs" :key="keyOf(pc)" :value="keyOf(pc)">{{ pc.name }} · {{ pc.IMUserId }}</option></select>
              <template v-if="selectedPc">
                <div class="wb-identity"><n-avatar :src="selectedPc.avatar" :size="56" /><div><strong>{{ selectedPc.name }}</strong><small>{{ selectedPc.IMUserId }}</small></div><label class="wb-upload">更换头像<input type="file" accept="image/*" aria-label="上传默认头像" @change="onAvatarFile" /></label></div>
                <label>差分标签<input v-model="newTag" placeholder="如：微笑；多选图片时使用文件名" aria-label="新差分标签" /></label>
                <label class="wb-upload wb-import">添加差分图片（可多选）<input type="file" accept="image/*" multiple aria-label="上传角色差分" @change="onExpressionFiles" /></label>
                <div class="wb-expressions"><article v-for="(url, tag) in expressions" :key="tag" class="wb-expression"><img :src="url" :alt="tag" /><strong :title="tag">{{ tag }}</strong><small>{{ expressionUses(tag) }} 条发言使用</small><div><label class="wb-upload">替换<input type="file" accept="image/*" :aria-label="`替换差分 ${tag}`" @change="event => replaceExpression(event, tag)" /></label><n-button size="tiny" :disabled="expressionUses(tag) > 0" @click="removeExpression(tag)">删除</n-button></div></article></div>
                <p v-if="!Object.keys(expressions).length" class="wb-note">还没有差分。上传图片后，在列表编辑中填写对应的差分标签即可使用。</p>
                <p class="wb-note">正在使用的差分可替换图片；先清除发言中的标签后才能删除。不同 ID 的同名角色分别管理。</p>
              </template>
              <p v-else class="wb-note">先导入日志，再选择要编辑的角色。</p>
            </div>
          </n-tab-pane>
        </n-tabs>
      </aside>
      <section class="wb-preview">
        <div class="wb-preview-head"><div><h3>导出预览</h3><small>{{ w.useCustomStyle && w.stylePackage ? w.stylePackage.name : '默认气泡样式' }} · 预览前 {{ previewCount }} 条发言</small></div><n-space><n-button size="small" @click="exportHtml">导出 HTML</n-button><n-button size="small" @click="exportZip">导出 ZIP</n-button></n-space></div>
        <p v-if="previewError" role="alert" class="wb-error">{{ previewError }}</p>
        <iframe v-else :srcdoc="previewHtml" sandbox="allow-scripts" title="导出样式实时预览" />
        <small class="wb-note">预览与导出使用相同排版。导出包含全部发言，并遵循主界面的过滤设置。</small>
      </section>
    </div>
    <n-modal v-model:show="guide" preset="card" title="工作台使用说明" style="width:min(720px,92vw)"><div class="wb-guide">
      <p><strong>1. 导入日志。</strong>主界面支持 SealChat 标准 JSON、HTML 分片和完整 HTML ZIP 日志包。想保留头像差分，请在 SealChat 导出时包含图片，再导入 HTML 或 ZIP。JSON 没有头像和差分数据。</p>
      <p><strong>2. 管理差分。</strong>在「头像与差分」中按名字或 ID 查找角色，上传默认头像或差分图片。在列表编辑的差分栏填写标签，也可在文本头使用 <code>名字(ID)#微笑 时间</code>。SealChat HTML 没有保存原差分名称或编号，导入时按每条发言的头像生成 <code>sc-…</code> 标签；同一头像复用同一标签。</p>
      <p><strong>3. 自定义样式。</strong>载入示例模板后修改 HTML 和 CSS，点击「应用样式」。<code>data-log-text="speaker.name"</code> 显示名字，<code>data-log-bind-src="speaker.avatarUrl"</code> 显示当前差分，<code>data-log-slot="body"</code> 插入正文；每个消息模板必须恰好有一个正文插槽。</p>
      <p><strong>4. 导入 SealChat 样式。</strong>支持消息模板、CSS、设计变量、模板片段和按消息类型／角色 ID／差分标签匹配的规则。含图片和字体的样式请导入完整 ZIP。SealChat 的分页、封面和工程元素不作为日志消息导入；HTML 头像快照无法还原原差分编号，引用原编号的规则需改成当前标签。</p>
      <p><strong>5. 保存与导出。</strong>设置和图片保存在当前浏览器；使用「下载样式包」可备份样式。HTML 与 ZIP 导出采用已应用的样式，TXT、论坛代码和 Word 保持各自格式。自定义 HTML 导出为静态阅读页；原有气泡页的窗口筛选保留在默认样式中。</p>
    </div></n-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useMessage } from 'naive-ui'
import { saveAs } from 'file-saver'
import { useStore } from '~/store'
import { characterAssetKey, type CharItem, type LogItem } from '~/logManager/types'
import { exportStyleZip, importStyle, starterStyle, validateStyle, type LogStylePackage } from '~/utils/logStyle'
import { exportFileHtmlBubbleSingle, exportFileHtmlBubbleZip } from '~/utils/exporter'
import { msgImageFormat, msgAtFormat, msgOffTopicFormat, msgCommandFormat, msgIMUseridFormat } from '~/utils'

const props = defineProps<{ items: LogItem[] }>()
const emit = defineEmits(['close'])
const store = useStore(), message = useMessage(), w = store.workbench
const guide = ref(false), search = ref(''), selectedKey = ref(''), newTag = ref('')
const keyOf = (pc: CharItem) => characterAssetKey(pc.name, pc.IMUserId)
const filteredPcs = computed(() => store.pcList.filter(pc => `${pc.name} ${pc.IMUserId}`.toLowerCase().includes(search.value.toLowerCase())))
const selectedPc = computed(() => store.pcList.find(pc => keyOf(pc) === selectedKey.value))
watch(filteredPcs, pcs => { if (!pcs.some(pc => keyOf(pc) === selectedKey.value)) selectedKey.value = pcs[0] ? keyOf(pcs[0]) : '' }, { immediate: true })
const expressions = computed(() => selectedPc.value ? store.getExpressions(selectedPc.value.name, selectedPc.value.IMUserId) : {})
const expressionUses = (tag: string) => props.items.filter(item => item.nickname === selectedPc.value?.name && item.IMUserId === selectedPc.value?.IMUserId && item.expressionTag === tag).length
const backgrounds = [{ key: 'backgroundImage', label: '全局背景图' }, { key: 'containerBackgroundImage', label: '纸张背景图' }, { key: 'bubbleBackgroundImage', label: '气泡背景图' }] as const
const readImage = (file: File) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file) })
const getFiles = (event: Event) => { const input = event.target as HTMLInputElement; const files = Array.from(input.files || []); input.value = ''; return files }
async function uploadBackground(event: Event, key: typeof backgrounds[number]['key']) { const file = getFiles(event)[0]; if (file) w[key] = await readImage(file) }
async function onAvatarFile(event: Event) { const pc = selectedPc.value, file = getFiles(event)[0]; if (pc && file) store.setAvatar(pc.name, await readImage(file), pc.IMUserId) }
async function onExpressionFiles(event: Event) {
  const pc = selectedPc.value, files = getFiles(event)
  if (!pc) return
  const tag = newTag.value.trim()
  if (tag && /[\s\[\]]/.test(tag)) { message.error('差分标签不能包含空格或方括号'); return }
  for (const file of files) {
    const name = files.length === 1 && tag ? tag : file.name.replace(/\.[^.]+$/, '').replace(/[\s\[\]]/g, '-')
    store.setExpression(pc.name, name, await readImage(file), pc.IMUserId)
  }
  newTag.value = ''
}
async function replaceExpression(event: Event, tag: string) { const pc = selectedPc.value, file = getFiles(event)[0]; if (pc && file) store.setExpression(pc.name, tag, await readImage(file), pc.IMUserId) }
function removeExpression(tag: string) { const pc = selectedPc.value; if (pc) store.removeExpression(pc.name, tag, pc.IMUserId) }
function clampSettings() {
  const ranges = { fontSize: [12, 48, 16], lineHeight: [1, 3, 1.8], contentWidth: [320, 1600, 960], messageGap: [0, 80, 20], iconSize: [24, 160, 64], avatarRadius: [0, 80, 12] }
  for (const key of Object.keys(ranges) as (keyof typeof ranges)[]) { const [min, max, fallback] = ranges[key]; w[key] = typeof w[key] === 'number' ? Math.max(min, Math.min(max, w[key])) : fallback }
}
const draft = ref<LogStylePackage>(starterStyle()), templateId = ref('message'), tokenText = ref(''), ruleText = ref(''), styleError = ref('')
function loadDraft(pkg: LogStylePackage) { draft.value = JSON.parse(JSON.stringify(pkg)); templateId.value = Object.keys(pkg.templates)[0]; tokenText.value = JSON.stringify(pkg.tokens, null, 2); ruleText.value = JSON.stringify(pkg.rules, null, 2); styleError.value = '' }
loadDraft(w.stylePackage || starterStyle())
function checkedDraft() { return validateStyle({ ...draft.value, tokens: JSON.parse(tokenText.value), rules: JSON.parse(ruleText.value) }) }
function applyStyle() {
  try { w.stylePackage = JSON.parse(JSON.stringify(checkedDraft())); w.useCustomStyle = true; styleError.value = ''; message.success('样式已应用') }
  catch (error) { styleError.value = (error as Error).message }
}
async function onStyleFile(event: Event) {
  const file = getFiles(event)[0]; if (!file) return
  try { const pkg = await importStyle(file, draft.value); loadDraft(pkg); applyStyle() }
  catch (error) { styleError.value = (error as Error).message }
}
function saveStyle() {
  try { const pkg = checkedDraft(); saveAs(new Blob([new Uint8Array(exportStyleZip(pkg))], { type: 'application/zip' }), `${pkg.id || 'log-style'}.zip`); styleError.value = '' }
  catch (error) { styleError.value = (error as Error).message }
}
const previewHtml = ref(''), previewError = ref('')
const exportItems = computed(() => props.items.filter(item => {
  if (item.isRaw || store.pcMap.get(`${item.nickname}-${item.IMUserId}`)?.role === '隐藏') return false
  let text = msgImageFormat(item.message, store.exportOptions)
  text = msgAtFormat(text, store.pcList)
  text = msgOffTopicFormat(text, store.exportOptions, item.isDice)
  text = msgCommandFormat(text, store.exportOptions)
  text = msgIMUseridFormat(text, store.exportOptions, item.isDice)
  return msgOffTopicFormat(text, store.exportOptions, item.isDice).trim() !== ''
}))
const previewItems = computed(() => exportItems.value.slice(0, 100))
const previewCount = computed(() => previewItems.value.length)
let timer: ReturnType<typeof setTimeout>, generation = 0
watch([() => store.workbench, () => store.pcList, () => store.exportOptions, () => store.templateHTML, () => props.items], () => {
  clearTimeout(timer); const version = ++generation
  timer = setTimeout(async () => {
    store.workbenchSave()
    try { const html = await exportFileHtmlBubbleSingle(previewItems.value, false); if (version === generation) { previewHtml.value = html; previewError.value = '' } }
    catch (error) { if (version === generation) previewError.value = (error as Error).message }
  }, 250)
}, { deep: true, immediate: true })
onBeforeUnmount(() => { clearTimeout(timer); generation++; store.workbenchSave() })
async function exportHtml() { try { await exportFileHtmlBubbleSingle(exportItems.value) } catch (error) { message.error((error as Error).message) } }
async function exportZip() { try { await exportFileHtmlBubbleZip(exportItems.value) } catch (error) { message.error((error as Error).message) } }
function back() { location.hash = ''; emit('close') }
</script>

<style scoped>
.wb { color:var(--sp-text); padding:8px; }
.wb-header,.wb-preview-head { display:flex; justify-content:space-between; gap:16px; align-items:center; margin-bottom:20px; flex-wrap:wrap; }
.wb h2 { margin:0; font-size:22px; } .wb h3 { margin:0 0 4px; font-size:16px; }
.wb p { margin:6px 0; } .wb-header p,.wb-note,.wb-preview small { color:var(--sp-muted); font-size:13px; line-height:1.7; }
.wb-layout { display:grid; grid-template-columns:minmax(320px,400px) minmax(0,1fr); gap:24px; align-items:start; }
.wb-controls { min-width:0; padding:16px; border:1px solid var(--sp-border); border-radius:14px; background:var(--sp-inset); }
.wb-form { display:grid; gap:16px; padding-top:12px; }
.wb-form label { display:grid; gap:6px; font-size:13px; } .wb-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px 12px; }
.wb input:not([type=file]),.wb select,.wb textarea { box-sizing:border-box; width:100%; min-width:0; color:var(--sp-text); background:var(--sp-surface); border:1px solid var(--sp-border); border-radius:6px; padding:8px; }
.wb textarea { font:12px/1.6 ui-monospace,monospace; resize:vertical; } .wb details label { margin-top:12px; }
.wb summary { cursor:pointer; color:var(--sp-primary); }
.wb .wb-upload { position:relative; cursor:pointer; color:var(--sp-primary); border:1px solid var(--sp-border); border-radius:6px; padding:6px 10px; display:inline-flex; justify-content:center; font-size:12px; }
.wb-upload input { position:absolute; width:100%; height:100%; opacity:0; inset:0; cursor:pointer; }
.wb-upload:focus-within { outline:2px solid var(--sp-primary); outline-offset:2px; }
.wb .wb-import { padding:13px 8px; background:var(--sp-primary-soft); font-weight:600; }
.wb-background { display:flex; align-items:center; gap:8px; font-size:13px; } .wb-background > span { margin-right:auto; }
.wb-identity { display:flex; align-items:center; gap:10px; }.wb-identity > div { min-width:0; flex:1; overflow-wrap:anywhere; } .wb-identity small { display:block; color:var(--sp-muted); }
.wb-expressions { display:grid; grid-template-columns:1fr 1fr; gap:10px; max-height:460px; overflow:auto; }
.wb-expression { display:grid; justify-items:center; gap:6px; padding:12px 6px; border:1px solid var(--sp-border); border-radius:8px; background:var(--sp-surface); min-width:0; }
.wb-expression img { width:64px; height:64px; object-fit:contain; } .wb-expression strong { max-width:100%; overflow:hidden; text-overflow:ellipsis; font-size:12px; }
.wb-expression small { font-size:11px; color:var(--sp-muted); } .wb-expression > div { display:flex; align-items:center; gap:8px; }
.wb-preview { position:sticky; top:20px; min-width:0; } .wb-preview-head { margin-bottom:12px; }
.wb-preview iframe { display:block; width:100%; height:calc(100vh - 230px); min-height:480px; border:1px solid var(--sp-border); border-radius:12px; background:#f4eef8; margin-bottom:10px; }
.wb-error { color:#d75272; font-size:13px; overflow-wrap:anywhere; } .wb-guide p { margin:0 0 18px; line-height:1.9; } .wb-guide code { overflow-wrap:anywhere; }
@media(max-width:900px) { .wb-layout { grid-template-columns:1fr; } .wb-preview { position:static; } .wb-preview iframe { height:540px; } }
@media(max-width:480px) { .wb { padding:0; } .wb-controls { padding:10px; } .wb-identity { flex-wrap:wrap; } .wb h2 { font-size:19px; } }
</style>

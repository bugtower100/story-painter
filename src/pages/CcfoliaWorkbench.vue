<template>
  <section class="wb-studio" :class="{ 'wb-panel-closed': !panel }" aria-label="跑团工作台">
    <header class="wb-topbar" :inert="arranging">
      <button aria-label="返回主界面" @click="back">←</button><strong>跑团工作台</strong>
      <input v-model="w.title" class="wb-title" aria-label="导出标题" placeholder="跑团记录" />
      <button @click="openArrangement()">频道与编排</button>
      <div class="wb-segment"><button :aria-pressed="design" @click="design = true">编辑</button><button :aria-pressed="!design" @click="design = false">阅读</button></div>
      <button @click="emit('undo')">撤销</button><button @click="emit('redo')">重做</button>
      <div class="wb-find"><input v-model="query" aria-label="工作台搜索" placeholder="搜索正文或角色…" @keydown.enter="findNext" /><button :disabled="!query.trim()" @click="findNext">定位</button></div>
      <span class="wb-spacer"></span><span class="wb-live">{{ updating ? '更新预览…' : '实时预览' }}</span>
      <button @click="guide = true">说明</button><button :disabled="exporting" @click="exportHtml">导出 HTML</button><button class="wb-primary" :disabled="exporting" @click="exportPdf">PDF</button>
    </header>
    <div class="wb-studio-body" :inert="arranging">
      <section class="wb-canvas">
        <div v-if="previewError" role="alert" class="wb-error">{{ previewError }}</div>
        <iframe ref="previewFrame" :srcdoc="previewHtml" sandbox="allow-same-origin allow-modals" title="日志排版实时预览" @load="frameReady" />
        <div class="wb-canvas-tools">
          <button :disabled="selectedIndex < 0" @click="editSelected">编辑选中发言</button>
          <button @click="setZoom(zoom - 10)" aria-label="缩小预览">−</button>
          <select :value="zoom" aria-label="预览缩放" @change="setZoom(Number(($event.target as HTMLSelectElement).value))"><option v-for="v in [40,50,60,70,80,90,100,110,120,130,140,150]" :key="v" :value="v">{{ v }}%</option></select>
          <button @click="setZoom(zoom + 10)" aria-label="放大预览">＋</button>
        </div>
      </section>
      <aside v-show="panel" class="wb-inspector">
        <header class="wb-inspector-head"><div><h2>{{ panels.find(p => p.id === panel)?.label }}</h2><small>{{ panel === 'content' ? '按频道浏览，点击画布中的发言进行编辑' : panel === 'styles' ? '点击样式卡片立即切换' : panel === 'characters' ? '头像与差分修改实时生效' : '纸张、字号与导出排版' }}</small></div><button aria-label="收起设置面板" @click="panel = ''">×</button></header>
        <div v-if="panel === 'content'" class="wb-content-panel">
          <div class="wb-segment"><button :aria-pressed="contentTab === 'channels'" @click="contentTab = 'channels'">频道</button><button :aria-pressed="contentTab === 'outline'" @click="contentTab = 'outline'">编排大纲</button></div>
          <div v-if="contentTab === 'channels'" class="wb-channel-nav" aria-label="日志频道">
            <button :aria-pressed="!activeChannel" @click="chooseChannel('')"><span>全部编排</span><b>{{ exportItems.length }}</b></button>
            <button v-for="channel in channels" :key="channel.name" :aria-pressed="activeChannel === channel.name" @click="chooseChannel(channel.name)"><span># {{ channel.name }}</span><b>{{ channel.count }}</b></button>
            <small>频道只切换查看范围；导出始终使用全部编排。</small>
          </div>
          <div v-else class="wb-outline" aria-label="最终编排大纲">
            <small>按最终阅读顺序排列；拖动整块或点击 ↑ ↓ 调整。</small>
            <article v-for="(unit, index) in outline.slice(0, outlineLimit)" :key="unit.id" :data-outline-id="unit.id" @dragover.prevent @drop.prevent="dropOutline($event, unit.id)">
              <button class="wb-outline-handle" draggable="true" aria-label="拖动编排项" @dragstart="startOutlineDrag($event, unit.id)">⠿</button>
              <button class="wb-outline-title" @click="focusIndex(unit.index)"><strong>{{ index + 1 }} · {{ unit.name }}</strong><small>{{ unit.channel }} · {{ unit.block ? unit.count + ' 条 · 内容块' : '单条发言' }}</small><span>{{ unit.preview }}</span></button>
              <span class="wb-outline-move"><button :disabled="index === 0" aria-label="上移编排项" @click="emit('reorder-outline', unit.id, outline[index - 1].id, false)">↑</button><button :disabled="index === outline.length - 1" aria-label="下移编排项" @click="emit('reorder-outline', unit.id, outline[index + 1].id, true)">↓</button></span>
            </article>
            <button v-if="outlineLimit < outline.length" @click="outlineLimit += 200">显示更多编排项</button>
          </div>
          <button class="wb-manage" @click="openArrangement(activeChannel)">管理频道、导入与内容块 ↗</button>
          <section v-if="activeMessage" class="wb-message-editor">
            <header><strong>{{ activeMessage.nickname }}</strong><small>{{ activeMessage.IMUserId }}</small></header>
            <label>发言正文<textarea ref="messageInput" v-model="messageText" aria-label="选中发言正文" rows="7" @input="emit('update-text', selectedIndex, ($event.target as HTMLTextAreaElement).value)" @blur="emit('finish-edit')" /></label>
            <label>所属频道<select :value="channelOf(activeMessage)" aria-label="选中发言频道" @change="emit('set-window', selectedIndex, ($event.target as HTMLSelectElement).value)"><option v-for="channel in channels" :key="channel.name" :value="channel.name">{{ channel.name }}</option></select></label>
            <div class="wb-message-actions"><button @click="panel = 'characters'">头像与差分</button><button @click="openSelectedInArrangement">在编排中定位</button></div>
          </section>
          <p v-else class="wb-note">点击画布中的一条发言，在这里编辑正文和频道；双击正文可直接开始编辑。</p>
        </div>
        <div v-if="panel === 'styles'" class="wb-form">
          <div class="wb-current"><span>当前样式</span><strong>{{ w.stylePackage?.name }}</strong></div>
          <details class="wb-settings"><summary>样式参数</summary>
            <div class="wb-token-grid"><label v-for="(value, key) in draft.tokens" :key="key"><span>{{ key }}</span>
              <input v-if="typeof value === 'boolean'" :checked="value" type="checkbox" :aria-label="'样式参数 ' + key" @change="setToken(key, ($event.target as HTMLInputElement).checked)" />
              <input v-else :value="value" :type="typeof value === 'number' ? 'number' : /^#[a-f\d]{6}$/i.test(String(value)) ? 'color' : 'text'" step="any" :aria-label="'样式参数 ' + key" @input="setToken(key, typeof value === 'number' ? Number(($event.target as HTMLInputElement).value) : ($event.target as HTMLInputElement).value)" />
            </label></div>
          </details>
          <div class="wb-style-library">
            <button v-for="preset in logStylePresets" :key="preset.id" class="wb-style-card" :class="{ 'is-active': w.stylePackage?.id === preset.id }" :aria-pressed="w.stylePackage?.id === preset.id" :aria-label="'使用' + preset.name + '样式'" @click="usePreset(preset)">
              <LogStyleSketch :kind="builtinStyleInfo(preset.id)?.sketch || 'generic'" />
              <span class="wb-style-info"><span><strong>{{ preset.name }}</strong><small class="wb-category">{{ builtinStyleInfo(preset.id)?.category }}</small></span><span>{{ builtinStyleInfo(preset.id)?.summary }}</span><small>适合：{{ builtinStyleInfo(preset.id)?.scenes.join(' · ') }}</small><span class="wb-style-meta"><small>v{{ preset.version }}</small><b>{{ w.stylePackage?.id === preset.id ? '使用中' : '使用' }}</b></span></span>
            </button>
          </div>
          <details class="wb-advanced"><summary>高级编辑 · HTML / CSS / 导入</summary>
            <div class="wb-form">
              <label class="wb-upload wb-import">导入 HTML / CSS / 样式 ZIP<input type="file" accept=".html,.htm,.css,.json,.zip" aria-label="导入自定义样式" @change="onStyleFile" /></label>
              <label>样式名称<input v-model="draft.name" /></label>
              <label>消息模板<select v-model="templateId" aria-label="选择 HTML 模板"><option v-for="id in Object.keys(draft.templates)" :key="id" :value="id">{{ id }}</option></select></label>
              <label>HTML<textarea v-model="draft.templates[templateId]" aria-label="HTML 模板代码" rows="8" spellcheck="false" /></label>
              <label>CSS<textarea v-model="draft.css" aria-label="CSS 样式代码" rows="8" spellcheck="false" /></label>
              <label>设计变量（JSON）<textarea v-model="tokenText" aria-label="设计变量 JSON" rows="5" /></label>
              <label>模板规则（JSON）<textarea v-model="ruleText" aria-label="模板规则 JSON" rows="5" /></label>
              <button @click="saveStyle">下载样式包</button><small>有效修改会自动更新预览；输入未完成时保留上一次效果。</small>
            </div>
          </details>
          <p v-if="styleError" class="wb-error" role="alert">{{ styleError }}</p>
        </div>
        <div v-if="panel === 'page'" class="wb-form">
          <label>纸张<select v-model="w.pageSize" aria-label="纸张"><option value="a4">A4</option><option value="letter">Letter</option><option value="flow">连续网页</option></select></label>
          <div class="wb-grid">
            <label>页边距（mm）<input v-model.number="w.pageMargin" type="number" min="8" max="40" @change="clampSettings" /></label>
            <label>分栏<select v-model.number="w.columns" aria-label="导出分栏"><option :value="1">单栏</option><option :value="2">双栏</option></select></label>
            <label>字号（px）<input v-model.number="w.fontSize" type="number" min="12" max="48" @change="clampSettings" /></label>
            <label>行距<input v-model.number="w.lineHeight" type="number" min="1" max="3" step=".1" @change="clampSettings" /></label>
          </div>
          <label>字体<select v-model="w.fontFamily"><option value="sans-serif">黑体 / 无衬线</option><option value="serif">宋体 / 衬线</option></select></label>
          <label class="wb-check"><input v-model="w.mergeNeighbors" type="checkbox" aria-label="合并连续发言外观" /> 连续同角色发言分组显示</label>
          <small>保留独立发言，头像差分、窗口或发言类型变化时另起一组。模板可使用自己的字体。</small>
          <label>纸张底色<n-color-picker v-model:value="w.containerColor" :show-alpha="false" /></label>
          <details><summary>背景与尺寸</summary><div class="wb-form">
            <label>网页宽度（px）<input v-model.number="w.contentWidth" type="number" min="320" max="1600" @change="clampSettings" /></label>
            <label>默认发言间距（px）<input v-model.number="w.messageGap" type="number" min="0" max="80" @change="clampSettings" /></label>
            <label>头像尺寸（px）<input v-model.number="w.iconSize" type="number" min="24" max="160" @change="clampSettings" /></label>
            <label>头像圆角（px）<input v-model.number="w.avatarRadius" type="number" min="0" max="80" @change="clampSettings" /></label>
            <div v-for="bg in backgrounds" :key="bg.key" class="wb-background"><span>{{ bg.label }}</span><label class="wb-upload">选择图片<input type="file" accept="image/*" :aria-label="bg.label" @change="event => uploadBackground(event, bg.key)" /></label><button :disabled="!w[bg.key]" @click="w[bg.key] = ''">移除</button></div>
            <small>原版样式的头像、消息间距由「样式参数」控制。</small>
          </div></details>
          <p class="wb-note">PDF 将打开浏览器打印窗口，选择「另存为 PDF」。纸张和页边距沿用这里的设置；打印时自动分页。</p>
        </div>
        <div v-if="panel === 'characters'">
          <div v-if="activeMessage" class="wb-selected-message"><strong>已选发言 · {{ activeMessage.nickname }}</strong><p>{{ activeMessage.message.slice(0, 100) }}</p><label>本条差分<select :value="activeMessage.expressionTag || ''" aria-label="当前发言差分" @change="emit('set-expression', selectedIndex, ($event.target as HTMLSelectElement).value)"><option value="">默认头像</option><option v-for="(_, tag) in store.getExpressions(activeMessage.nickname, activeMessage.IMUserId)" :key="tag" :value="tag">{{ tag }}</option></select></label></div>
          <p v-else class="wb-note">先点击预览中的发言，可为该条记录选择差分。</p>
          <div class="wb-form">
              <input v-model="search" placeholder="搜索角色名字或 ID" aria-label="搜索差分角色" />
              <select v-model="selectedKey" aria-label="选择差分角色"><option value="">选择角色（{{ filteredPcs.length }}）</option><option v-for="pc in filteredPcs" :key="keyOf(pc)" :value="keyOf(pc)">{{ pc.name }} · {{ pc.IMUserId }}</option></select>
              <template v-if="selectedPc">
                <div class="wb-identity"><n-avatar :src="selectedPc.avatar" :size="56" /><div><strong>{{ selectedPc.name }}</strong><small>{{ selectedPc.IMUserId }}</small></div><label class="wb-upload">更换头像<input type="file" accept="image/*" aria-label="上传默认头像" @change="onAvatarFile" /></label></div>
                <label>差分标签<input v-model="newTag" placeholder="如：微笑；多选图片时使用文件名" aria-label="新差分标签" /></label>
                <label class="wb-upload wb-import">添加差分图片（可多选）<input type="file" accept="image/*" multiple aria-label="上传角色差分" @change="onExpressionFiles" /></label>
                <div class="wb-expressions"><article v-for="(url, tag) in expressions" :key="tag" class="wb-expression"><img :src="url" :alt="tag" /><strong :title="tag">{{ tag }}</strong><small>{{ expressionUses(tag) }} 条发言使用</small><div><label class="wb-upload">替换<input type="file" accept="image/*" :aria-label="`替换差分 ${tag}`" @change="event => replaceExpression(event, tag)" /></label><n-button size="tiny" :disabled="expressionUses(tag) > 0" @click="removeExpression(tag)">删除</n-button></div></article></div>
                <p v-if="!Object.keys(expressions).length" class="wb-note">还没有差分。上传图片后，点击预览中的发言，在上方选择本条差分。</p>
                <p class="wb-note">正在使用的差分可替换图片；先清除发言中的标签后才能删除。不同 ID 的同名角色分别管理。</p>
              </template>
              <p v-else class="wb-note">先导入日志，再选择要编辑的角色。</p>
            </div>
        </div>
      </aside>
      <nav class="wb-rail" aria-label="工作台设置"><button v-for="p in panels" :key="p.id" :aria-pressed="panel === p.id" @click="panel = panel === p.id ? '' : p.id"><span aria-hidden="true">{{ p.icon }}</span>{{ p.label }}</button></nav>
    </div>
    <footer class="wb-status"><span>{{ activeChannel ? '# ' + activeChannel + ' · ' + viewItems.length + ' 条' : '全部编排 · ' + exportItems.length + ' 条' }} · {{ w.columns === 2 ? '双栏' : '单栏' }} · {{ w.pageSize === 'flow' ? '连续网页' : w.pageSize.toUpperCase() }} · {{ design ? '点击选中，双击编辑，拖拽排序' : '阅读模式' }}</span><button v-if="previewCount < viewItems.length" @click="previewLimit = viewItems.length">显示全部 {{ viewItems.length }} 条</button><span v-else>当前范围已全部显示</span></footer>
    <div v-show="arranging" class="wb-arrangement-backdrop" @keydown.esc.stop="closeArrangement">
      <section class="wb-arrangement" role="dialog" aria-modal="true" aria-labelledby="arrangement-title">
        <header><div><h2 id="arrangement-title">频道与编排</h2><small>频道对应 main、HO1、HO2；内容块可跨频道穿插，按编排顺序导出。</small></div><button aria-label="关闭频道与编排" @click="closeArrangement">完成编排 ×</button></header>
        <div class="wb-arrangement-body">
          <nav class="wb-channel-nav" aria-label="编排频道"><strong>{{ w.title || '当前日志' }}</strong><button :aria-pressed="!arrangeChannel" @click="browseArrangement('')"><span>全部编排</span><b>{{ allMessages.length }}</b></button><button v-for="channel in channels" :key="channel.name" :aria-pressed="arrangeChannel === channel.name" @click="browseArrangement(channel.name)"><span># {{ channel.name }}</span><b>{{ channel.total }}</b></button></nav>
          <div id="workbench-list-editor"></div>
        </div>
      </section>
    </div>
    <n-modal v-model:show="guide" preset="card" title="工作台使用说明" style="width:min(720px,92vw)">
      <div class="wb-guide"><p>点击右侧样式卡片立即切换。「样式参数」可以直接调整配色、间距等；HTML / CSS 放在默认折叠的高级编辑中，有效修改实时应用。</p><p>「内容 → 频道」切换 main、HO1、HO2 等频道，仅改变查看范围；「全部编排」显示最终阅读顺序。点击发言在右侧编辑，双击直接聚焦正文。「编排大纲」可拖动整块和单条发言，同频道的多个内容块保持独立。</p><p>顶部「频道与编排」打开宽幅整理面板：左边选频道，右边导入、分块、管理窗口及调整顺序。它与主界面列表共用同一份内容块和撤销记录。关闭面板后继续在纸张画布预览。</p><p>点击头像或打开「头像差分」上传图片。选中预览发言后，可单独修改该条的差分；连续发言不会跨差分或窗口合并。小说和剧本原样式不显示头像。</p><p>「页面」调整纸张、页边距和单双栏。画布为连续排版预览；PDF 在浏览器打印窗口中分页，选择「另存为 PDF」，建议关闭浏览器页眉页脚。HTML/PDF 均导出全部有效发言。</p><p>样式与头像保存在浏览器。日志顺序、内容块和撤销记录与主界面共用；刷新页面不恢复整理历史，请及时导出日志。</p></div>
    </n-modal>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useMessage } from 'naive-ui'
import { saveAs } from 'file-saver'
import { useStore } from '~/store'
import { characterAssetKey, type CharItem, type LogItem } from '~/logManager/types'
import { exportStyleZip, importStyle, starterStyle, validateStyle, type LogStylePackage } from '~/utils/logStyle'
import { logStylePresets } from '~/utils/logStylePresets'
import { builtinStyleInfo } from '~/utils/logStyleCatalog'
import LogStyleSketch from '~/components/LogStyleSketch.vue'
import { exportFileHtmlBubbleSingle } from '~/utils/exporter'
import { printLog } from '~/utils/printLog'
import { msgImageFormat, msgAtFormat, msgOffTopicFormat, msgCommandFormat, msgIMUseridFormat } from '~/utils'

const props = defineProps<{ items: LogItem[]; channelNames: string[]; outline: { id: string; block: boolean; name: string; preview: string; count: number; channel: string; index: number }[] }>()
const emit = defineEmits<{
  close: []; flush: []; undo: []; redo: [];
  'edit-entry': [index: number]; reorder: [from: number, to: number, after: boolean];
  'set-expression': [index: number, tag: string];
  'update-text': [index: number, text: string]; 'set-window': [index: number, channel: string];
  'browse-channel': [channel: string]; 'reorder-outline': [id: string, target: string, after: boolean]; 'finish-edit': [];
}>()
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
  const ranges = { pageMargin: [8, 40, 20], fontSize: [12, 48, 16], lineHeight: [1, 3, 1.8], contentWidth: [320, 1600, 960], messageGap: [0, 80, 20], iconSize: [24, 160, 64], avatarRadius: [0, 80, 12] }
  for (const key of Object.keys(ranges) as (keyof typeof ranges)[]) { const [min, max, fallback] = ranges[key]; w[key] = typeof w[key] === 'number' ? Math.max(min, Math.min(max, w[key])) : fallback }
}
const draft = ref<LogStylePackage>(starterStyle()), templateId = ref('message'), tokenText = ref(''), ruleText = ref(''), styleError = ref('')
function loadDraft(pkg: LogStylePackage) { draft.value = JSON.parse(JSON.stringify(pkg)); templateId.value = Object.keys(pkg.templates)[0]; tokenText.value = JSON.stringify(pkg.tokens, null, 2); ruleText.value = JSON.stringify(pkg.rules, null, 2); styleError.value = '' }
loadDraft(w.stylePackage || logStylePresets[0])
if (!w.stylePackage) w.stylePackage = JSON.parse(JSON.stringify(logStylePresets[0]))
w.useCustomStyle = true
let appliedPackage = w.stylePackage
function checkedDraft() { return validateStyle({ ...draft.value, tokens: JSON.parse(tokenText.value), rules: JSON.parse(ruleText.value) }) }
function applyStyle() {
  try { w.stylePackage = JSON.parse(JSON.stringify(checkedDraft())); appliedPackage = w.stylePackage; w.useCustomStyle = true; styleError.value = '' }
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

const panels = [{ id: 'content', label: '内容', icon: '▤' }, { id: 'page', label: '页面', icon: '▯' }, { id: 'styles', label: '样式', icon: '◈' }, { id: 'characters', label: '头像差分', icon: '♙' }] as const
type Panel = typeof panels[number]['id']
const panel = ref<Panel | ''>('styles'), design = ref(true), zoom = ref(window.innerWidth < 700 ? 40 : 100)
const previewFrame = ref<HTMLIFrameElement>(), previewHtml = ref(''), previewError = ref(''), updating = ref(false), exporting = ref(false)
const previewLimit = ref(200), selectedIndex = ref(-1), query = ref('')
const contentTab = ref<'channels' | 'outline'>('channels'), activeChannel = ref(''), outlineLimit = ref(200)
const arranging = ref(false), arrangeChannel = ref(''), messageInput = ref<HTMLTextAreaElement>()
const channelOf = (item: LogItem) => item.groupName || item.commandInfo?.channel || 'main'
const allMessages = computed(() => props.items.filter(item => !item.isRaw))
const activeMessage = computed(() => allMessages.value[selectedIndex.value])
const messageText = ref('')
watch(activeMessage, item => { messageText.value = item?.message.replace(/\n+$/, '') || '' }, { immediate: true })
const exportItems = computed(() => props.items.filter(item => {
  if (item.isRaw || store.pcMap.get(`${item.nickname}-${item.IMUserId}`)?.role === '隐藏') return false
  let text = msgImageFormat(item.message, store.exportOptions)
  text = msgAtFormat(text, store.pcList)
  text = msgOffTopicFormat(text, store.exportOptions, item.isDice)
  text = msgCommandFormat(text, store.exportOptions)
  text = msgIMUseridFormat(text, store.exportOptions, item.isDice)
  return msgOffTopicFormat(text, store.exportOptions, item.isDice).trim() !== ''
}))
const channels = computed(() => {
  const counts = new Map<string, { name: string; count: number; total: number }>()
  for (const name of props.channelNames) counts.set(name, { name, count: 0, total: 0 })
  const effective = new Set(exportItems.value)
  for (const item of allMessages.value) {
    const name = channelOf(item), channel = counts.get(name) || { name, count: 0, total: 0 }
    channel.total++; if (effective.has(item)) channel.count++
    counts.set(name, channel)
  }
  return [...counts.values()]
})
const viewItems = computed(() => activeChannel.value ? exportItems.value.filter(item => channelOf(item) === activeChannel.value) : exportItems.value)
const previewCount = computed(() => Math.min(previewLimit.value, viewItems.value.length))
watch(channels, list => { if (!list.some(channel => channel.name === activeChannel.value)) activeChannel.value = '' })
let renderedItems: LogItem[] = [], previewScroll = 0, dragging: LogItem | undefined, pendingHit: number | undefined
function chooseChannel(channel: string) { emit('flush'); activeChannel.value = channel; selectedIndex.value = -1; previewLimit.value = 200; previewScroll = 0 }
function browseArrangement(channel: string) { arrangeChannel.value = channel; emit('browse-channel', channel) }
async function openArrangement(channel = '') { emit('finish-edit'); arranging.value = true; await nextTick(); browseArrangement(channel); document.querySelector<HTMLElement>('.wb-arrangement button')?.focus() }
function closeArrangement() { emit('finish-edit'); arranging.value = false }
async function openSelectedInArrangement() { await openArrangement(); emit('edit-entry', selectedIndex.value) }
function startOutlineDrag(event: DragEvent, id: string) { event.dataTransfer?.setData('application/x-story-painter-outline', id); if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move' }
function dropOutline(event: DragEvent, target: string) {
  const id = event.dataTransfer?.getData('application/x-story-painter-outline')
  if (!id || id === target || !props.outline.some(unit => unit.id === id)) return
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  emit('reorder-outline', id, target, event.clientY > rect.top + rect.height / 2)
}
function focusIndex(index: number) {
  const item = allMessages.value[index], position = exportItems.value.indexOf(item)
  if (position < 0) { message.info('该发言被当前导出过滤设置隐藏，可在频道与编排中编辑'); return }
  const changedChannel = !!activeChannel.value
  activeChannel.value = ''; selectMessage(item)
  if (changedChannel || position >= renderedItems.length || updating.value) {
    pendingHit = position; previewLimit.value = Math.max(previewLimit.value, position + 50)
  } else previewFrame.value?.contentDocument?.querySelector(`[data-log-index="${position}"]`)?.scrollIntoView({ block: 'center' })
}
function usePreset(pkg: LogStylePackage) { loadDraft(pkg); applyStyle() }
function setToken(key: string, value: string | number | boolean) {
  draft.value.tokens[key] = value; tokenText.value = JSON.stringify(draft.value.tokens, null, 2); applyStyle()
}
let styleTimer: ReturnType<typeof setTimeout>
watch([draft, tokenText, ruleText], () => { clearTimeout(styleTimer); styleTimer = setTimeout(applyStyle, 350) }, { deep: true })
watch(() => w.stylePackage, pkg => { if (pkg && pkg !== appliedPackage) { appliedPackage = pkg; loadDraft(pkg) } })
function selectMessage(item: LogItem) {
  selectedIndex.value = allMessages.value.indexOf(item)
  selectedKey.value = characterAssetKey(item.nickname, item.IMUserId)
  frameAppearance()
}
async function editSelected() {
  if (selectedIndex.value < 0) return
  panel.value = 'content'; contentTab.value = 'channels'; await nextTick(); messageInput.value?.focus()
}
function frameAppearance() {
  const doc = previewFrame.value?.contentDocument
  if (!doc) return
  doc.documentElement.style.zoom = String(zoom.value / 100)
  doc.querySelectorAll<HTMLElement>('.log-node').forEach(node => {
    const item = renderedItems[Number(node.dataset.logIndex)]
    node.draggable = design.value
    node.classList.toggle('wb-selected', item === activeMessage.value)
    node.style.cursor = design.value ? 'grab' : 'auto'
  })
}
function setZoom(value: number) { zoom.value = Math.max(40, Math.min(150, value)); frameAppearance() }
watch(design, frameAppearance)
function frameReady() {
  const doc = previewFrame.value?.contentDocument
  if (!doc) return
  const style = doc.createElement('style')
  style.textContent = `@media screen { ${w.backgroundImage ? '' : 'body { background-color:#e9e7ed; background-image:radial-gradient(#d3cddc 1px,transparent 1px); background-size:18px 18px; }'} .log-export-container { max-width:none; box-shadow:0 2px 12px #33204418; } .log-node:focus-visible,.wb-selected { outline:2px solid #9062b4; outline-offset:4px; } .wb-drop { outline:2px dashed #9062b4; } }`
  doc.head.append(style)
  for (const node of Array.from(doc.querySelectorAll<HTMLElement>('.log-node'))) {
    const getItem = () => renderedItems[Number(node.dataset.logIndex)]
    if (!getItem()) continue
    node.tabIndex = 0
    node.addEventListener('click', event => { if (design.value) { selectMessage(getItem()); if ((event.target as Element).closest('[data-log-bind-src="speaker.avatarUrl"]')) panel.value = 'characters' } })
    node.addEventListener('dblclick', () => { if (design.value) { selectMessage(getItem()); void editSelected() } })
    node.addEventListener('keydown', event => { if (event.key === 'Enter' && design.value) { selectMessage(getItem()); void editSelected() } })
    node.addEventListener('dragstart', event => {
      if (!design.value) { event.preventDefault(); return }
      dragging = getItem(); event.dataTransfer?.setData('text/plain', 'story-painter-message')
    })
    node.addEventListener('dragover', event => { if (dragging) { event.preventDefault(); node.classList.add('wb-drop') } })
    node.addEventListener('dragleave', () => node.classList.remove('wb-drop'))
    node.addEventListener('dragend', () => { dragging = undefined; doc.querySelectorAll('.wb-drop').forEach(el => el.classList.remove('wb-drop')) })
    node.addEventListener('drop', event => {
      event.preventDefault(); node.classList.remove('wb-drop')
      const item = getItem()
      if (dragging && dragging !== item) {
        const from = allMessages.value.indexOf(dragging), to = allMessages.value.indexOf(item)
        if (from >= 0 && to >= 0) emit('reorder', from, to, event.clientY > node.getBoundingClientRect().top + node.getBoundingClientRect().height / 2)
      }
      dragging = undefined
    })
  }
  frameAppearance()
  previewFrame.value?.contentWindow?.scrollTo(0, previewScroll)
  if (pendingHit !== undefined) {
    doc.querySelector(`[data-log-index="${pendingHit}"]`)?.scrollIntoView({ block: 'center' })
    pendingHit = undefined
  }
}
let renderTimer: ReturnType<typeof setTimeout>, generation = 0
watch([() => store.workbench, () => store.pcList, () => store.exportOptions, () => props.items, previewLimit, activeChannel], () => {
  clearTimeout(renderTimer); const version = ++generation; updating.value = true
  renderTimer = setTimeout(async () => {
    store.workbenchSave()
    const items = viewItems.value.slice(0, previewLimit.value)
    try {
      const html = await exportFileHtmlBubbleSingle(items, false)
      if (version === generation) {
        previewScroll = previewFrame.value?.contentWindow?.scrollY || 0
        renderedItems = items; previewHtml.value = html; previewError.value = ''
      }
    } catch (error) { if (version === generation) previewError.value = (error as Error).message }
    finally { if (version === generation) updating.value = false }
  }, 200)
}, { deep: true, immediate: true })
let lastHit = -1
function findNext() {
  const needle = query.value.trim().toLocaleLowerCase()
  if (!needle) return
  const hits = exportItems.value.map((item, index) => ({ item, index })).filter(({ item }) => (item.nickname + ' ' + item.message).toLocaleLowerCase().includes(needle))
  if (!hits.length) { message.info('没有匹配的发言'); return }
  const hit = hits.find(hit => hit.index > lastHit) || hits[0]; lastHit = hit.index
  focusIndex(allMessages.value.indexOf(hit.item))
}
watch(query, () => { lastHit = -1 })
async function exportHtml() {
  clearTimeout(styleTimer); applyStyle(); emit('flush'); await nextTick(); exporting.value = true
  try { await exportFileHtmlBubbleSingle(exportItems.value) } catch (error) { message.error((error as Error).message) }
  finally { exporting.value = false }
}
async function exportPdf() {
  clearTimeout(styleTimer); applyStyle(); emit('flush'); await nextTick(); exporting.value = true
  try { await printLog(await exportFileHtmlBubbleSingle(exportItems.value, false)) } catch (error) { message.error((error as Error).message) }
  finally { exporting.value = false }
}
function back() { clearTimeout(styleTimer); applyStyle(); emit('flush'); location.hash = ''; emit('close') }
onBeforeUnmount(() => { clearTimeout(renderTimer); clearTimeout(styleTimer); applyStyle(); generation++; store.workbenchSave() })
</script>
<style src="../styles/studio.scss" lang="scss"></style>

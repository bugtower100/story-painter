<template>
  <section ref="root" class="sp-log-workspace" tabindex="0" aria-label="日志整理工作区" @keydown="handleKeydown">
    <div class="lw-toolbar">
      <div class="lw-segment"><button :aria-pressed="layout === 'list'" @click="layout = 'list'">顺序列表</button><button :aria-pressed="layout === 'board'" @click="layout = 'board'">多窗整理</button></div>
      <span class="lw-spacer"></span>
      <button :disabled="!history.past.length" title="Ctrl / ⌘ Z" @click="undo">撤销</button><button :disabled="!history.future.length" title="Ctrl / ⌘ Shift Z" @click="redo">重做</button><button @click="openWindow()">＋ 新建窗口</button>
    </div>
    <details class="lw-import" @dragover.prevent @drop.prevent="dropFiles">
      <summary>追加导入多个文件 <span>选择或拖入 TXT / LOG · 保留来源文件名</span></summary>
      <input ref="fileInput" type="file" multiple accept=".txt,.log" aria-label="追加日志文件" @change="chooseFiles" />
      <div v-for="(file, index) in files" :key="index" class="lw-file-row"><span>{{ file.name }}</span><label>导入窗口 <input v-model="fileWindows[index]" aria-label="导入窗口" /></label></div>
      <div v-if="files.length" class="lw-toolbar"><label><input v-model="importPending" type="checkbox" /> 先放入待分拣</label><label><input v-model="importByTime" type="checkbox" /> 合并后按时间排序</label><button :disabled="processing" @click="importFiles">{{ processing ? '正在导入…' : '追加合并' }}</button></div>
    </details>
    <div class="lw-search">
      <input ref="searchInput" v-model="query" type="search" aria-label="搜索日志" placeholder="搜索正文、角色、场景或来源…" @keydown.enter.prevent="jumpSearch($event.shiftKey ? -1 : 1)" />
      <span aria-live="polite">{{ query ? `${hitPosition} / ${hits.length}` : `${state.entries.length} 条发言` }}</span>
      <button :disabled="!hits.length" aria-label="上一个搜索结果" @click="jumpSearch(-1)">↑</button><button :disabled="!hits.length" aria-label="下一个搜索结果" @click="jumpSearch(1)">↓</button>
      <select v-model="sourceFilter" aria-label="筛选来源"><option value="">全部来源</option><option v-for="source in sources" :key="source">{{ source }}</option></select>
      <select v-model="windowFilter" aria-label="筛选窗口"><option value="">全部窗口</option><option v-for="window in allWindows" :key="window">{{ window }}</option></select>
    </div>
    <div class="lw-batch">
      <label><input type="checkbox" :checked="allSelected" @change="selectVisible(($event.target as HTMLInputElement).checked)" /> 选择当前可见</label><span>已选 {{ selectedIds.length }}</span>
      <select v-model="moveTo" aria-label="移动到窗口"><option value="" disabled>移动到窗口…</option><option v-for="window in allWindows" :key="window">{{ window }}</option></select>
      <button :disabled="!selectedIds.length || !moveTo" @click="move(selectedIds, moveTo)">移动</button><button :disabled="!selectedIds.length" @click="openScene">设置场景</button><button :disabled="selectedIds.length < 2" @click="mergeSelected">合并段落</button><button :disabled="!selectedIds.length" @click="remove(selectedIds)">删除选中</button>
    </div>
    <p class="lw-help">{{ layout === 'board' ? '拖动发言到另一窗口，或勾选后批量移动。聚焦此工作区时，按 1–9 将首条待分拣记录送入对应窗口。' : '按最终文本顺序显示。勾选发言可整理场景；双击正文可编辑，空行可拆分为独立段落。' }}</p>
    <div v-if="layout === 'list'" class="lw-list-layout">
      <div class="lw-list-main">
        <VirtualList ref="listRef" class="lw-scroll" data-key="id" :data-sources="visibleEntries" :data-component="LogListEditorItem" :extra-props="itemProps" :estimate-size="210" :keeps="25" />
        <p v-if="!visibleEntries.length" class="lw-empty">{{ state.entries.length ? '当前筛选下没有发言。' : '暂无可整理的发言，请导入日志。原有文本仍保留在文本编辑中。' }}</p>
      </div>
      <aside class="lw-outline" aria-label="窗口与场景概览"><h3>窗口与场景</h3><button :aria-pressed="!windowFilter" @click="windowFilter = ''">全部窗口 <b>{{ state.entries.length }}</b></button>
        <div v-for="window in allWindows" :key="window" class="lw-outline-group"><button :aria-pressed="windowFilter === window" @click="windowFilter = window"><i :style="{ background: getColor(window) }"></i>{{ window }}<b>{{ countWindow(window) }}</b></button><button v-for="scene in scenes(window)" :key="scene" class="lw-scene-link" @click="selectScene(window, scene)">{{ scene || '未分场景' }}<small>{{ countScene(window, scene) }}</small></button></div>
      </aside>
    </div>
    <div v-else class="lw-board" aria-label="多窗口分拣">
      <section v-for="window in boardWindows" :key="window" class="lw-column" :data-window="window" :style="{ '--window-color': getColor(window) }" @dragover.prevent @drop.prevent="dropWindow($event, window)">
        <header class="lw-column-head"><div><span class="lw-window-number">{{ windowNumber(window) }}</span><strong>{{ window }}</strong><b>{{ countWindow(window) }}</b></div><div class="lw-column-actions"><button v-if="window !== PENDING_WINDOW" :aria-label="'重命名窗口 ' + window" @click="openWindow(window)">重命名</button><button :disabled="!countWindow(window)" :aria-label="'导出窗口 ' + window" @click="exportWindow(window)">导出 TXT</button><button v-if="window !== PENDING_WINDOW" :aria-label="'移除窗口 ' + window" @click="removeWindow(window)">移回待分拣</button></div></header>
        <div class="lw-column-scenes"><button v-for="scene in scenes(window)" :key="scene" @click="selectScene(window, scene)">{{ scene || '未分场景' }} · {{ countScene(window, scene) }}</button></div>
        <VirtualList :ref="(el: any) => { if (el) boardRefs[window] = el }" class="lw-scroll" data-key="id" :data-sources="visibleEntries.filter(e => e.window === window)" :data-component="LogListEditorItem" :extra-props="itemProps" :estimate-size="220" :keeps="15" />
        <p v-if="!visibleEntries.some(e => e.window === window)" class="lw-empty">{{ countWindow(window) ? '记录已被筛选隐藏' : '拖到此处，或勾选后移动' }}</p>
      </section>
    </div>
    <p class="lw-help">窗口和场景会随日志保存；来源文件标记与最近 20 步撤销记录保留在本次打开的页面中。</p>
    <n-modal v-model:show="showWindow" preset="card" :title="renaming ? '重命名窗口' : '新建窗口'" style="width: min(460px, 92vw)"><div class="lw-dialog"><label>窗口名称<input v-model="windowName" aria-label="窗口名称" @keydown.enter="saveWindow" /></label><p>使用已有窗口名会合并两个窗口的记录。</p><button @click="saveWindow">保存窗口</button></div></n-modal>
    <n-modal v-model:show="showScene" preset="card" title="设置场景" style="width: min(460px, 92vw)"><div class="lw-dialog"><label>场景名称<input v-model="sceneName" aria-label="场景名称" list="workspace-scenes" @keydown.enter="saveScene" /><datalist id="workspace-scenes"><option v-for="scene in sceneChoices" :key="scene" :value="scene" /></datalist></label><p>给选中的 {{ selectedIds.length }} 条发言设置场景；同名即合并，留空移出场景。</p><button @click="saveScene">保存场景</button></div></n-modal>
    <n-modal v-model:show="showInsert" preset="card" title="插入新发言" style="width: min(500px, 92vw)"><div class="lw-dialog"><label>发言人<input v-model="insertForm.name" aria-label="发言人" /></label><label>账号<input v-model="insertForm.account" aria-label="账号" placeholder="可留空" /></label><label>差分<input v-model="insertForm.expression" aria-label="差分" /></label><label>正文<textarea v-model="insertForm.text" aria-label="新发言正文" rows="5" /></label><button @click="saveInsert">确认插入</button></div></n-modal>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useMessage } from 'naive-ui'
import { saveAs } from 'file-saver'
// @ts-ignore The package does not publish TypeScript declarations.
import VirtualList from 'vue3-virtual-scroll-list'
import LogListEditorItem from '../components/LogListEditorItem.vue'
import { PENDING_WINDOW, WorkspaceHistory, chronologicalEntries, entryId, mergeParagraphs, moveEntries, parseWorkspace, reconcileWorkspace, renameWindow, reorderEntries, serializeWorkspace, splitParagraphs, validGroupName } from '../editor/listWorkspace'
import type { WorkspaceEntry, WorkspaceState } from '../editor/listWorkspace'
import { LogManager } from '../logManager/logManager'
import '../styles/workspace.scss'

const props = defineProps<{ initialContent: string; active: boolean; sourceName: string; documentVersion: number }>()
const emit = defineEmits<{ 'update:content': [text: string] }>()
const message = useMessage()
const state = ref(parseWorkspace(props.initialContent, props.sourceName))
const history = reactive(new WorkspaceHistory())
const layout = ref<'list' | 'board'>('list')
const root = ref<HTMLElement>()
const listRef = ref<any>()
const boardRefs: Record<string, any> = Object.create(null)
const searchInput = ref<HTMLInputElement>()
const selectedIds = ref<string[]>([])
const query = ref(''), sourceFilter = ref(''), windowFilter = ref(''), moveTo = ref('')
const highlightedId = ref('')
const allWindows = computed(() => [PENDING_WINDOW, ...state.value.windows])
const boardWindows = computed(() => windowFilter.value ? allWindows.value.filter(w => w === windowFilter.value) : allWindows.value)
const windowNumber = (window: string) => { const index = allWindows.value.indexOf(window); return index > 0 && index <= 9 ? index : '·' }
const sources = computed(() => [...new Set(state.value.entries.map(e => e.source))])
watch([sources, allWindows], () => {
  if (!sources.value.includes(sourceFilter.value)) sourceFilter.value = ''
  if (!allWindows.value.includes(windowFilter.value)) windowFilter.value = ''
})
const visibleEntries = computed(() => state.value.entries.filter(e => (!sourceFilter.value || e.source === sourceFilter.value) && (!windowFilter.value || e.window === windowFilter.value)))
const hits = computed(() => query.value.trim() ? visibleEntries.value.filter(e => [e.name, e.account, e.text, e.source, e.window, e.scene].some(value => value.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase()))) : [])
const hitPosition = computed(() => Math.max(0, hits.value.findIndex(e => e.id === highlightedId.value) + 1))
const allSelected = computed(() => !!visibleEntries.value.length && visibleEntries.value.every(e => selectedIds.value.includes(e.id)))
const countWindow = (window: string) => state.value.entries.filter(e => e.window === window).length
const scenes = (window: string) => [...new Set(state.value.entries.filter(e => e.window === window).map(e => e.scene))]
const countScene = (window: string, scene: string) => state.value.entries.filter(e => e.window === window && e.scene === scene).length
const colors = ['#a691af', '#a58bcc', '#78aaa9', '#c18c9f', '#b69c69', '#809bc4']
const getColor = (window: string) => colors[Math.max(0, allWindows.value.indexOf(window)) % colors.length]
let syncTimer: ReturnType<typeof setTimeout> | undefined
let typing = false
let dirty = false
let lastPublished: string | null = null
const flushPendingChanges = () => {
  clearTimeout(syncTimer)
  if (!dirty) return
  dirty = false
  lastPublished = serializeWorkspace(state.value)
  emit('update:content', lastPublished)
}
const scheduleSync = () => { dirty = true; clearTimeout(syncTimer); syncTimer = setTimeout(flushPendingChanges, 350) }
const finishEdit = () => { typing = false; flushPendingChanges() }
const change = (next: WorkspaceState, inTyping = false) => {
  if (next === state.value) return
  if (!inTyping || !typing) history.record(state.value)
  typing = inTyping
  state.value = next
  selectedIds.value = selectedIds.value.filter(id => next.entries.some(e => e.id === id))
  scheduleSync()
}
watch(() => [props.initialContent, props.documentVersion] as const, ([text, version], [, previousVersion]) => {
  const parsed = parseWorkspace(text, props.sourceName)
  const normalized = serializeWorkspace(parsed)
  // A pending echo of our last edit must not replace a newer undo/redo state.
  if (version === previousVersion && normalized === lastPublished) { lastPublished = null; return }
  if (version === previousVersion && normalized === serializeWorkspace(state.value)) return
  clearTimeout(syncTimer); dirty = false; typing = false
  lastPublished = null
  state.value = version === previousVersion ? reconcileWorkspace(state.value, parsed) : parsed
  history.clear(); selectedIds.value = []; highlightedId.value = ''
  if (version !== previousVersion) { sourceFilter.value = ''; windowFilter.value = '' }
})
onBeforeUnmount(() => clearTimeout(syncTimer))
const undo = () => { finishEdit(); state.value = history.undo(state.value); selectedIds.value = []; scheduleSync() }
const redo = () => { finishEdit(); state.value = history.redo(state.value); selectedIds.value = []; scheduleSync() }
const select = (id: string, checked: boolean) => { selectedIds.value = checked ? [...new Set([...selectedIds.value, id])] : selectedIds.value.filter(i => i !== id) }
const selectVisible = (checked: boolean) => { selectedIds.value = checked ? visibleEntries.value.map(e => e.id) : [] }
const edit = (id: string, patch: Partial<WorkspaceEntry>, inTyping = false) => {
  if (patch.expression && /[\s\[]/.test(patch.expression)) { message.warning('差分标签不能包含空白或方括号。'); return }
  change({ ...state.value, entries: state.value.entries.map(e => e.id === id ? { ...e, ...patch } : e) }, inTyping)
}
const remove = (ids: string[]) => change({ ...state.value, entries: state.value.entries.filter(e => !ids.includes(e.id)) })
const move = (ids: string[], window: string, target?: string, after = false) => change(moveEntries(state.value, ids, window, target, after))
const moveCards = (ids: string[], window: string, target: string, after: boolean) => layout.value === 'board' ? move(ids, window, target, after) : change(reorderEntries(state.value, ids, target, after))
const step = (id: string, direction: number) => {
  const entry = state.value.entries.find(e => e.id === id)!
  const rows = layout.value === 'board' ? visibleEntries.value.filter(e => e.window === entry.window) : visibleEntries.value
  const target = rows[rows.findIndex(e => e.id === id) + direction]
  if (target) change(reorderEntries(state.value, [id], target.id, direction > 0))
}
const split = (id: string) => { try { change(splitParagraphs(state.value, id)) } catch (error) { message.warning((error as Error).message) } }
const mergeSelected = () => { try { change(mergeParagraphs(state.value, selectedIds.value)) } catch (error) { message.warning((error as Error).message) } }
const itemProps = computed(() => ({ selectedIds: selectedIds.value, highlightedId: highlightedId.value, getColor, onSelect: select, onEdit: edit, onFinishEdit: finishEdit, onDelete: (id: string) => remove([id]), onInsert: openInsert, onSplit: split, onStep: step, onMove: moveCards }))
const reveal = async (id: string) => {
  highlightedId.value = id
  await nextTick()
  const entry = state.value.entries.find(e => e.id === id)
  if (!entry) return
  const rows = layout.value === 'board' ? visibleEntries.value.filter(e => e.window === entry.window) : visibleEntries.value
  const index = rows.findIndex(e => e.id === id)
  if (index < 0) return
  const list = layout.value === 'board' ? boardRefs[entry.window] : listRef.value
  list?.scrollToIndex(index)
  await nextTick()
  root.value?.querySelector(`[data-entry-id="${id}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}
const jumpSearch = (direction: number) => { if (hits.value.length) { const index = hits.value.findIndex(e => e.id === highlightedId.value); reveal(hits.value[(index + direction + hits.value.length) % hits.value.length].id) } }
watch([query, sourceFilter, windowFilter], () => { highlightedId.value = ''; if (hits.value.length) reveal(hits.value[0].id) })
const selectScene = (window: string, scene: string) => {
  sourceFilter.value = ''; windowFilter.value = window
  selectedIds.value = state.value.entries.filter(e => e.window === window && e.scene === scene).map(e => e.id)
  nextTick(() => { if (selectedIds.value.length) reveal(selectedIds.value[0]) })
}
const dropWindow = (event: DragEvent, window: string) => {
  const data = event.dataTransfer?.getData('application/x-story-painter-entries')
  if (!data) return
  try { const ids = JSON.parse(data); if (Array.isArray(ids) && ids.every(id => typeof id === 'string')) move(ids, window) } catch { /* Ignore external drag formats. */ }
}
const handleKeydown = (event: KeyboardEvent) => {
  if (!props.active || showWindow.value || showScene.value || showInsert.value) return
  const target = event.target as HTMLElement
  if (target.closest('input, textarea, select, [contenteditable="true"]')) return
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') { event.preventDefault(); searchInput.value?.focus(); return }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return }
  if (layout.value !== 'board' || event.ctrlKey || event.metaKey || event.altKey || !/^[1-9]$/.test(event.key)) return
  const window = state.value.windows[Number(event.key) - 1]
  const pending = visibleEntries.value.find(e => e.window === PENDING_WINDOW)
  if (window && pending) { event.preventDefault(); move([pending.id], window) }
}
const showWindow = ref(false), windowName = ref(''), renaming = ref('')
const openWindow = (name = '') => { renaming.value = name; windowName.value = name; showWindow.value = true }
const saveWindow = () => {
  const name = windowName.value.trim()
  if (!validGroupName(name) || name === PENDING_WINDOW) { message.warning('请输入有效窗口名，不使用方括号、换行、场景分隔符或“待分拣”。'); return }
  change(renaming.value ? renameWindow(state.value, renaming.value, name) : { ...state.value, windows: [...new Set([...state.value.windows, name])] })
  if (renaming.value && windowFilter.value === renaming.value) windowFilter.value = name
  showWindow.value = false
}
const removeWindow = (window: string) => {
  const next = moveEntries(state.value, state.value.entries.filter(e => e.window === window).map(e => e.id), PENDING_WINDOW)
  change({ ...next, windows: next.windows.filter(w => w !== window) })
  if (windowFilter.value === window) windowFilter.value = ''
}
const exportWindow = (window: string) => {
  finishEdit()
  const text = serializeWorkspace({ ...state.value, preamble: '', entries: state.value.entries.filter(e => e.window === window) })
  saveAs(new Blob([text], { type: 'text/plain;charset=utf-8' }), window.replace(/[<>:"/\\|?*]/g, '_') + '.txt')
}
const showScene = ref(false), sceneName = ref('')
const sceneChoices = computed(() => { const first = state.value.entries.find(e => selectedIds.value.includes(e.id)); return first ? scenes(first.window).filter(Boolean) : [] })
const openScene = () => {
  const rows = state.value.entries.filter(e => selectedIds.value.includes(e.id))
  if (new Set(rows.map(e => e.window)).size !== 1) { message.warning('请先选择同一窗口内的发言。'); return }
  sceneName.value = rows.every(e => e.scene === rows[0].scene) ? rows[0].scene : ''; showScene.value = true
}
const saveScene = () => {
  const scene = sceneName.value.trim()
  if (scene && !validGroupName(scene)) { message.warning('场景名称不能包含方括号、换行或场景分隔符。'); return }
  change({ ...state.value, entries: state.value.entries.map(e => selectedIds.value.includes(e.id) ? { ...e, scene } : e) }); showScene.value = false
}
const showInsert = ref(false), insertAfter = ref('')
const insertForm = reactive({ name: '', account: '', expression: '', text: '' })
function openInsert(id: string) {
  const entry = state.value.entries.find(e => e.id === id)!
  insertAfter.value = id; Object.assign(insertForm, { name: entry.name, account: entry.account, expression: '', text: '' }); showInsert.value = true
}
const saveInsert = () => {
  const name = insertForm.name.trim(), expression = insertForm.expression.trim()
  const account = insertForm.account.trim() || state.value.entries.find(e => e.name === name)?.account || String(Math.max(1000, ...state.value.entries.map(e => Number(e.account) || 0)) + 1)
  if (!name || /[\r\n]/.test(name) || /[()\r\n]/.test(account) || /[\s\[]/.test(expression)) { message.warning('请填写有效发言人；账号不能包含括号或换行，差分不能包含空白或方括号。'); return }
  const entries = [...state.value.entries], index = entries.findIndex(e => e.id === insertAfter.value)
  if (index < 0) return
  entries.splice(index + 1, 0, { ...entries[index], ...insertForm, name, account, expression, id: entryId(), source: '手动添加' })
  change({ ...state.value, entries }); showInsert.value = false
}
const files = ref<File[]>([]), fileWindows = ref<string[]>([]), processing = ref(false), importPending = ref(false), importByTime = ref(false)
const fileInput = ref<HTMLInputElement>()
const setFiles = (chosen: File[]) => {
  files.value = chosen
  fileWindows.value = files.value.map(f => f.name.replace(/\.[^.]+$/, '').replace(/[\[\]\r\n]/g, '_').replaceAll(' › ', '_'))
}
const chooseFiles = (event: Event) => setFiles(Array.from((event.target as HTMLInputElement).files || []))
const dropFiles = (event: DragEvent) => {
  const dropped = Array.from(event.dataTransfer?.files || [])
  if (!dropped.length) return
  setFiles(dropped)
  ;(event.currentTarget as HTMLDetailsElement).open = true
}
const importFiles = async () => {
  if (processing.value || !files.value.length) return
  const chosenFiles = [...files.value], labels = [...fileWindows.value], pending = importPending.value, byTime = importByTime.value
  if (!pending && labels.some(label => !validGroupName(label) || label.trim() === PENDING_WINDOW)) { message.warning('请为每个文件填写有效窗口名。'); return }
  processing.value = true
  try {
    const imported = await Promise.all(chosenFiles.map(async (file, index) => {
      const manager = new LogManager()
      const text = await file.text()
      const result = manager.parse(text)
      if (!result?.items.length) throw new Error(`${file.name} 未识别到日志发言，请先在文本编辑中导入并转换格式。`)
      const normalized = (result.startText || '') + manager.exporters.editLog.doExport(result.items)!.text
      const parsed = parseWorkspace(normalized, file.name)
      return { ...parsed, entries: parsed.entries.map(e => ({ ...e, window: pending ? PENDING_WINDOW : labels[index].trim(), scene: pending ? '' : e.scene })) }
    }))
    const entries = [...state.value.entries, ...imported.flatMap(s => s.entries)]
    let ordered = entries
    if (byTime) { try { ordered = chronologicalEntries(entries) } catch (error) { message.warning((error as Error).message) } }
    change({ entries: ordered, windows: [...new Set([...state.value.windows, ...ordered.map(e => e.window)])].filter(w => w !== PENDING_WINDOW), preamble: state.value.preamble + imported.map(s => s.preamble).join('') })
    files.value = []; fileWindows.value = []; if (fileInput.value) fileInput.value.value = ''
    sourceFilter.value = ''; windowFilter.value = ''; layout.value = 'board'; message.success(`已追加 ${imported.reduce((sum, s) => sum + s.entries.length, 0)} 条发言`)
  } catch (error) { message.error((error as Error).message) }
  finally { processing.value = false }
}
defineExpose({ flushPendingChanges })
</script>

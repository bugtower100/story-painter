<template>
  <section ref="root" class="sp-log-workspace" tabindex="0" aria-label="日志整理工作区" @keydown="handleKeydown">
    <div class="lw-toolbar">
      <div class="lw-segment"><button :aria-pressed="layout === 'list'" @click="layout = 'list'">顺序列表</button><button :aria-pressed="layout === 'blocks'" @click="layout = 'blocks'">内容块编排</button><button :aria-pressed="layout === 'board'" @click="layout = 'board'">窗口对照</button></div>
      <span class="lw-spacer"></span>
      <button :disabled="!history.past.length" title="Ctrl / ⌘ Z" @click="undo">撤销</button><button :disabled="!history.future.length" title="Ctrl / ⌘ Shift Z" @click="redo">重做</button><button @click="openWindow()">＋ 新建窗口</button><button class="lw-guide-button" @click="showGuide = true">使用说明</button>
    </div>
    <details class="lw-import" @dragover.prevent @drop.prevent="dropFiles">
      <summary>追加导入多个文件 <span>选择或拖入 TXT / LOG · 保留来源文件名</span></summary>
      <input ref="fileInput" type="file" multiple accept=".txt,.log" aria-label="追加日志文件" @change="chooseFiles" />
      <div v-for="(file, index) in files" :key="index" class="lw-file-row"><span>{{ file.name }}</span><label>导入窗口 <input v-model="fileWindows[index]" aria-label="导入窗口" /></label></div>
      <div v-if="files.length" class="lw-toolbar"><label><input v-model="importPending" type="checkbox" /> 先放入待分拣</label><label><input v-model="importByTime" type="checkbox" :disabled="!!state.blocks.length" /> 合并后按时间排序</label><button :disabled="processing" @click="importFiles">{{ processing ? '正在导入…' : '追加合并' }}</button><span v-if="state.blocks.length">已有内容块，追加记录将接在末尾，保留当前编排。</span></div>
    </details>
    <div class="lw-search">
      <input ref="searchInput" v-model="query" type="search" aria-label="搜索日志" placeholder="搜索正文、角色、内容块或来源…" @keydown.enter.prevent="jumpSearch($event.shiftKey ? -1 : 1)" />
      <span aria-live="polite">{{ query ? `${hitPosition} / ${hits.length}` : `${state.entries.length} 条发言` }}</span>
      <button :disabled="!hits.length" aria-label="上一个搜索结果" @click="jumpSearch(-1)">↑</button><button :disabled="!hits.length" aria-label="下一个搜索结果" @click="jumpSearch(1)">↓</button>
      <select v-model="sourceFilter" aria-label="筛选来源"><option value="">全部来源</option><option v-for="source in sources" :key="source">{{ source }}</option></select>
      <select v-model="windowFilter" aria-label="筛选窗口"><option value="">全部窗口</option><option v-for="window in allWindows" :key="window">{{ window }}</option></select>
    </div>
    <div class="lw-batch">
      <label><input type="checkbox" :checked="allSelected" @change="selectVisible(($event.target as HTMLInputElement).checked)" /> 选择筛选内发言</label><span>已选 {{ selectedIds.length }} 条</span>
      <button :disabled="!selectedIds.length" @click="openBlock('create')">组成内容块</button><button :disabled="!selectedIds.some(id => blockNames.has(id))" @click="change(extractBlockEntries(state, selectedIds))">移出内容块</button><button :disabled="selectedIds.length < 2" @click="mergeSelected">合并发言</button><button :disabled="!selectedIds.length" @click="remove(selectedIds)">删除选中</button>
      <template v-if="layout === 'board'"><select v-model="moveTo" aria-label="修改窗口归属"><option value="" disabled>修改窗口归属…</option><option v-for="window in allWindows" :key="window">{{ window }}</option></select><button :disabled="!selectedIds.length || !moveTo" @click="move(selectedIds, moveTo)">确认改窗</button></template>
    </div>
    <div v-if="layout === 'blocks'" class="lw-toolbar lw-block-toolbar"><span>{{ state.blocks.length }} 个内容块 · 已选 {{ selectedBlockIds.length }} 块</span><button :disabled="selectedBlockIds.length < 2" @click="openBlock('merge')">合并选中块</button><button :disabled="!selectedBlockIds.length" @click="change(dissolveContentBlocks(state, selectedBlockIds))">解除选中块</button></div>
    <p class="lw-help">{{ layout === 'board' ? '按窗口对照内容；最终阅读顺序请看「顺序列表」或「内容块编排」。拖动只调整顺序，修改窗口归属请用「确认改窗」。' : layout === 'blocks' ? '按最终阅读顺序排列。拖动块头的 ⠿ 或使用 ↑ ↓ 穿插内容；同一窗口的块始终独立，勾选块后才会合并。' : '勾选几条发言，点击「组成内容块」即可一起移动；无需分块的内容仍可逐条整理。双击正文可编辑。' }}</p>
    <p v-if="layout === 'blocks' && (windowFilter || sourceFilter)" class="lw-help">筛选显示包含匹配发言的完整内容块；整块移动包含其中全部发言。</p>
    <div v-if="layout !== 'board'" class="lw-list-layout">
      <div class="lw-list-main">
        <VirtualList v-if="layout === 'list'" ref="listRef" class="lw-scroll" data-key="id" :data-sources="visibleEntries" :data-component="LogListEditorItem" :extra-props="itemProps" :estimate-size="210" :keeps="25" />
        <VirtualList v-else ref="blocksRef" class="lw-scroll" data-key="id" :data-sources="visibleUnits" :data-component="ContentBlockItem" :extra-props="blockProps" :estimate-size="200" :keeps="20" />
        <p v-if="!visibleEntries.length" class="lw-empty">{{ state.entries.length ? '当前筛选下没有发言。' : '暂无可整理的发言，请导入日志。原有文本仍保留在文本编辑中。' }}</p>
      </div>
      <aside class="lw-outline" aria-label="窗口统计"><h3>窗口统计</h3><button :aria-pressed="!windowFilter" @click="windowFilter = ''">全部窗口 <b>{{ state.entries.length }}</b></button>
        <div v-for="window in displayedWindows" :key="window" class="lw-outline-group"><button :aria-pressed="windowFilter === window" @click="windowFilter = window"><i :style="{ background: getColor(window) }"></i>{{ window }}<b>{{ countWindow(window) }}</b></button></div>
      </aside>
    </div>
    <div v-else class="lw-board" aria-label="窗口对照">
      <section v-for="window in boardWindows" :key="window" class="lw-column" :data-window="window" :style="{ '--window-color': getColor(window) }">
        <header class="lw-column-head"><div><span class="lw-window-number">{{ windowNumber(window) }}</span><strong>{{ window }}</strong><b>{{ countWindow(window) }}</b></div><div class="lw-column-actions"><button v-if="window !== PENDING_WINDOW" :aria-label="'重命名窗口 ' + window" @click="openWindow(window)">重命名</button><button :disabled="!countWindow(window)" :aria-label="'导出窗口 ' + window" @click="exportWindow(window)">导出 TXT</button><button v-if="window !== PENDING_WINDOW" :aria-label="'移除窗口 ' + window" @click="removeWindow(window)">移回待分拣</button></div></header>
        <VirtualList :ref="(el: any) => { if (el) boardRefs[window] = el }" class="lw-scroll" data-key="id" :data-sources="visibleEntries.filter(e => e.window === window)" :data-component="LogListEditorItem" :extra-props="itemProps" :estimate-size="220" :keeps="15" />
        <p v-if="!visibleEntries.some(e => e.window === window)" class="lw-empty">{{ countWindow(window) ? '记录已被筛选隐藏' : '暂无发言，可在导入时指定此窗口' }}</p>
      </section>
    </div>
    <p class="lw-help">导出使用当前编排顺序，保留窗口和时间；内容块名称不写入正文。分块、来源标记与最近 20 步撤销仅保留在当前页面，刷新后不会恢复。</p>
    <n-modal v-model:show="showWindow" preset="card" :title="renaming ? '重命名窗口' : '新建窗口'" style="width: min(460px, 92vw)"><div class="lw-dialog"><label>窗口名称<input v-model="windowName" aria-label="窗口名称" @keydown.enter="saveWindow" /></label><p>使用已有窗口名会合并两个窗口的记录。</p><button @click="saveWindow">保存窗口</button></div></n-modal>
    <n-modal v-model:show="showBlock" preset="card" :title="blockAction === 'rename' ? '重命名内容块' : blockAction === 'merge' ? '合并选中块' : '组成内容块'" style="width: min(460px, 92vw)"><div class="lw-dialog"><label>内容块名称（可选）<input v-model="blockName" aria-label="内容块名称" placeholder="例如：HO1 · 发现线索" maxlength="80" @keydown.enter="saveBlock" /></label><p v-if="blockAction !== 'rename'">{{ blockAction === 'merge' ? '选中块内的全部发言' : `选中的 ${selectedIds.length} 条发言` }}将按当前先后顺序聚拢到最早选中位置；其他发言的相对顺序不变。</p><p>名称仅供整理，不写入导出正文。同名内容块仍保持独立。</p><button @click="saveBlock">{{ blockAction === 'rename' ? '保存名称' : blockAction === 'merge' ? '确认合并' : '确认组成' }}</button></div></n-modal>
    <n-modal v-model:show="showGuide" preset="card" title="内容块编排 · 使用说明" style="width: min(680px, 92vw)"><div class="lw-dialog lw-guide">
      <p><strong>窗口表示发言归属，内容块表示一起移动的一段内容。</strong>上传时标记为 HO1 的记录就属于 HO1，不需要再分场景。同一个窗口可以有多个独立的块，也可以不分块。</p>
      <ol><li><strong>导入并查看。</strong>追加多个文件，分别设置 main、HO1、HO2 等窗口。需要时勾选「合并后按时间排序」；已有内容块后，追加文件会接在末尾。</li><li><strong>选中发言，组成内容块。</strong>在顺序列表或窗口对照中勾选发言，点击「组成内容块」，可填一个便于识别的名称。选中不连续的发言时，会按当前顺序聚拢到最早选中位置。</li><li><strong>拖动穿插。</strong>进入「内容块编排」，拖动块头的 ⠿ 到目标卡片上半部（放在前面）或下半部（放在后面）。也可点击 ↑ ↓ 移动；窗口、来源、时间保持不变。</li><li><strong>按需调整。</strong>展开块可编辑发言。勾选发言后「移出内容块」会让它留在原位、独立编排；从块中间移出时，前后部分会成为独立块。「解除分块」保留所有发言和顺序。勾选两个以上块，再点「合并选中块」才会合并。</li><li><strong>预览并导出。</strong>阅读预览和导出使用最终顺序。块名不出现在正文里；同为 HO1 的相邻块也不会自动合并。</li></ol>
      <div class="lw-guide-example"><strong>穿插示例（顺序由你决定）</strong><p>原顺序：main A → HO1 A → main B → HO2 A → HO1 B</p><p>可调整为：main A → HO1 A → HO2 A → main B → HO1 B</p></div>
      <p><strong>搜索与撤销：</strong>搜索正文、角色、块名或来源，按 Enter / Shift Enter 跳到下一个 / 上一个结果；折叠块会自动展开定位。聚焦工作区时，Ctrl / ⌘ Z 撤销，Ctrl / ⌘ Shift Z 重做，最多保留 20 步。输入框中仍使用原生文本快捷键。</p>
      <p><strong>保存范围：</strong>分块和来源标记仅保留在当前页面，切换预览不会丢失，刷新或重新打开不会恢复；重新导入整份日志会清空分块。在文本模式修改内容会重置整理历史；若打断原块，剩余的连续部分会成为独立块。</p>
      <button @click="showGuide = false">知道了</button>
    </div></n-modal>
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
import ContentBlockItem from '../components/ContentBlockItem.vue'
import { PENDING_WINDOW, WorkspaceHistory, chronologicalEntries, contentUnits, createContentBlock, dissolveContentBlocks, entryId, extractBlockEntries, mergeContentBlocks, mergeParagraphs, moveEntries, normalizeBlocks, parseWorkspace, reconcileWorkspace, renameWindow, reorderContentUnits, reorderEntries, serializeWorkspace, splitParagraphs, validGroupName } from '../editor/listWorkspace'
import type { WorkspaceEntry, WorkspaceState } from '../editor/listWorkspace'
import { LogManager } from '../logManager/logManager'
import '../styles/workspace.scss'

const props = defineProps<{ initialContent: string; active: boolean; sourceName: string; documentVersion: number }>()
const emit = defineEmits<{ 'update:content': [text: string] }>()
const message = useMessage()
const state = ref(parseWorkspace(props.initialContent, props.sourceName))
const history = reactive(new WorkspaceHistory())
const layout = ref<'list' | 'blocks' | 'board'>('list')
const root = ref<HTMLElement>()
const listRef = ref<any>()
const blocksRef = ref<any>()
const boardRefs: Record<string, any> = Object.create(null)
const searchInput = ref<HTMLInputElement>()
const selectedIds = ref<string[]>([])
const selectedBlockIds = ref<string[]>([]), expandedIds = ref<string[]>([])
const showGuide = ref(false)
const query = ref(''), sourceFilter = ref(''), windowFilter = ref(''), moveTo = ref('')
const highlightedId = ref('')
const allWindows = computed(() => [PENDING_WINDOW, ...state.value.windows])
const displayedWindows = computed(() => allWindows.value.filter(w => w !== PENDING_WINDOW || state.value.entries.some(e => e.window === w)))
const boardWindows = computed(() => windowFilter.value ? displayedWindows.value.filter(w => w === windowFilter.value) : displayedWindows.value)
const windowNumber = (window: string) => { const index = allWindows.value.indexOf(window); return index > 0 && index <= 9 ? index : '·' }
const sources = computed(() => [...new Set(state.value.entries.map(e => e.source))])
watch([sources, allWindows], () => {
  if (!sources.value.includes(sourceFilter.value)) sourceFilter.value = ''
  if (!allWindows.value.includes(windowFilter.value)) windowFilter.value = ''
})
const visibleEntries = computed(() => state.value.entries.filter(e => (!sourceFilter.value || e.source === sourceFilter.value) && (!windowFilter.value || e.window === windowFilter.value)))
const units = computed(() => contentUnits(state.value))
const visibleUnits = computed(() => { const ids = new Set(visibleEntries.value.map(e => e.id)); return units.value.filter(unit => unit.entries.some(e => ids.has(e.id))) })
const blockNames = computed(() => new Map(state.value.blocks.flatMap(block => block.entryIds.map(id => [id, block.name] as const))))
watch(() => state.value.blocks, blocks => {
  const ids = new Set(blocks.map(block => block.id))
  selectedBlockIds.value = selectedBlockIds.value.filter(id => ids.has(id))
  expandedIds.value = expandedIds.value.filter(id => ids.has(id))
})
const hits = computed(() => query.value.trim() ? visibleEntries.value.filter(e => [e.name, e.account, e.text, e.source, e.window, e.scene, blockNames.value.get(e.id) || ''].some(value => value.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase()))) : [])
const hitPosition = computed(() => Math.max(0, hits.value.findIndex(e => e.id === highlightedId.value) + 1))
const allSelected = computed(() => !!visibleEntries.value.length && visibleEntries.value.every(e => selectedIds.value.includes(e.id)))
const countWindow = (window: string) => state.value.entries.filter(e => e.window === window).length
const colors = ['#8b907e', '#ac8abc', '#98a76d', '#bd9299', '#b9a683', '#919ba3']
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
  state.value = normalizeBlocks(next)
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
  history.clear(); selectedIds.value = []; selectedBlockIds.value = []; highlightedId.value = ''
  if (version !== previousVersion) { sourceFilter.value = ''; windowFilter.value = '' }
})
onBeforeUnmount(() => clearTimeout(syncTimer))
const undo = () => { finishEdit(); state.value = history.undo(state.value); selectedIds.value = []; selectedBlockIds.value = []; scheduleSync() }
const redo = () => { finishEdit(); state.value = history.redo(state.value); selectedIds.value = []; selectedBlockIds.value = []; scheduleSync() }
const select = (id: string, checked: boolean) => { selectedIds.value = checked ? [...new Set([...selectedIds.value, id])] : selectedIds.value.filter(i => i !== id) }
const selectVisible = (checked: boolean) => { selectedIds.value = checked ? visibleEntries.value.map(e => e.id) : [] }
const edit = (id: string, patch: Partial<WorkspaceEntry>, inTyping = false) => {
  if (patch.expression && /[\s\[]/.test(patch.expression)) { message.warning('差分标签不能包含空白或方括号。'); return }
  change({ ...state.value, entries: state.value.entries.map(e => e.id === id ? { ...e, ...patch } : e) }, inTyping)
}
const remove = (ids: string[]) => change({ ...state.value, entries: state.value.entries.filter(e => !ids.includes(e.id)) })
const move = (ids: string[], window: string, target?: string, after = false) => change(moveEntries(state.value, ids, window, target, after))
const moveCards = (ids: string[], _window: string, target: string, after: boolean) => change(reorderEntries(state.value, ids, target, after))
const step = (id: string, direction: number) => {
  const entry = state.value.entries.find(e => e.id === id)!
  const unit = units.value.find(unit => unit.entries.some(e => e.id === id))
  if (layout.value === 'blocks' && !unit?.blockId) { stepUnit(id, direction); return }
  const rows = layout.value === 'board' ? visibleEntries.value.filter(e => e.window === entry.window) : layout.value === 'blocks' && unit ? unit.entries : visibleEntries.value
  const target = rows[rows.findIndex(e => e.id === id) + direction]
  if (target) change(reorderEntries(state.value, [id], target.id, direction > 0))
}
const split = (id: string) => { try { change(splitParagraphs(state.value, id)) } catch (error) { message.warning((error as Error).message) } }
const mergeSelected = () => { try { change(mergeParagraphs(state.value, selectedIds.value)) } catch (error) { message.warning((error as Error).message) } }
const itemProps = computed(() => ({ selectedIds: selectedIds.value, highlightedId: highlightedId.value, getColor, getBlockName: (id: string) => blockNames.value.get(id), onSelect: select, onEdit: edit, onFinishEdit: finishEdit, onDelete: (id: string) => remove([id]), onInsert: openInsert, onSplit: split, onStep: step, onMove: moveCards }))
const moveUnits = (ids: string[], target: string, after: boolean) => change(reorderContentUnits(state.value, ids, target, after))
const stepUnit = (id: string, direction: number) => {
  const target = visibleUnits.value[visibleUnits.value.findIndex(unit => unit.id === id) + direction]
  if (target) moveUnits([id], target.id, direction > 0)
}
const blockProps = computed(() => ({
  itemProps: itemProps.value, selectedBlockIds: selectedBlockIds.value, expandedIds: expandedIds.value,
  onSelect: (id: string, checked: boolean) => { selectedBlockIds.value = checked ? [...new Set([...selectedBlockIds.value, id])] : selectedBlockIds.value.filter(i => i !== id) },
  onExpand: (id: string) => { expandedIds.value = expandedIds.value.includes(id) ? expandedIds.value.filter(i => i !== id) : [...expandedIds.value, id] },
  onRename: (id: string) => openBlock('rename', id), onDissolve: (id: string) => change(dissolveContentBlocks(state.value, [id])),
  onStep: stepUnit, onMove: moveUnits,
}))
const reveal = async (id: string) => {
  highlightedId.value = id
  await nextTick()
  const entry = state.value.entries.find(e => e.id === id)
  if (!entry) return
  if (layout.value === 'blocks') {
    const unit = visibleUnits.value.find(unit => unit.entries.some(e => e.id === id))
    if (!unit) return
    if (unit.blockId && !expandedIds.value.includes(unit.id)) expandedIds.value.push(unit.id)
    await nextTick()
    blocksRef.value?.scrollToIndex(visibleUnits.value.indexOf(unit))
    return
  }
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
const handleKeydown = (event: KeyboardEvent) => {
  if (!props.active || showWindow.value || showBlock.value || showInsert.value || showGuide.value) return
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
const showBlock = ref(false), blockName = ref(''), renamingBlock = ref('')
const blockAction = ref<'create' | 'merge' | 'rename'>('create')
const openBlock = (action: 'create' | 'merge' | 'rename', id = '') => {
  blockAction.value = action; renamingBlock.value = id
  blockName.value = action === 'rename' ? state.value.blocks.find(block => block.id === id)?.name || '' : ''
  showBlock.value = true
}
const saveBlock = () => {
  try {
    if (blockAction.value === 'rename') change({ ...state.value, blocks: state.value.blocks.map(block => block.id === renamingBlock.value ? { ...block, name: blockName.value.trim() || '内容块' } : block) })
    else {
      const next = blockAction.value === 'merge' ? mergeContentBlocks(state.value, selectedBlockIds.value, blockName.value) : createContentBlock(state.value, selectedIds.value, blockName.value)
      change(next); selectedIds.value = []; selectedBlockIds.value = []
      sourceFilter.value = ''; windowFilter.value = ''; layout.value = 'blocks'
    }
    showBlock.value = false
  } catch (error) { message.warning((error as Error).message) }
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
  const id = entryId()
  entries.splice(index + 1, 0, { ...entries[index], ...insertForm, name, account, expression, id, source: '手动添加' })
  const blocks = state.value.blocks.map(block => ({ ...block, entryIds: block.entryIds.flatMap(entryId => entryId === insertAfter.value ? [entryId, id] : [entryId]) }))
  change({ ...state.value, entries, blocks }); showInsert.value = false
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
  const chosenFiles = [...files.value], labels = [...fileWindows.value], pending = importPending.value, byTime = importByTime.value && !state.value.blocks.length
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
    change({ ...state.value, entries: ordered, windows: [...new Set([...state.value.windows, ...ordered.map(e => e.window)])].filter(w => w !== PENDING_WINDOW), preamble: state.value.preamble + imported.map(s => s.preamble).join('') })
    files.value = []; fileWindows.value = []; if (fileInput.value) fileInput.value.value = ''
    sourceFilter.value = ''; windowFilter.value = ''; layout.value = 'board'; message.success(`已追加 ${imported.reduce((sum, s) => sum + s.entries.length, 0)} 条发言`)
  } catch (error) { message.error((error as Error).message) }
  finally { processing.value = false }
}
defineExpose({ flushPendingChanges })
</script>

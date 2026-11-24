<template>
  <article class="log-entry" :class="{ 'is-selected': selectedIds.includes(source.id), 'is-drag-over': dragOver, 'is-search-hit': highlightedId === source.id }"
    :data-entry-id="source.id" :style="{ '--window-color': getColor(source.window) }"
    @dragover.prevent.stop="dragOver = true" @dragleave="dragOver = false" @drop.prevent.stop="drop">
    <header class="log-entry-head">
      <button class="drag-handle" draggable="true" aria-label="拖动发言" @dragstart="startDrag" @dragend="dragOver = false">⠿</button>
      <input type="checkbox" :checked="selectedIds.includes(source.id)" :aria-label="'选择 ' + source.name + ' 的发言'" @change="onSelect(source.id, ($event.target as HTMLInputElement).checked)" />
      <strong>{{ source.name }}<small v-if="source.account">({{ source.account }})</small></strong>
      <time>{{ source.time }}</time>
    </header>
    <div class="log-entry-labels"><span class="source-label" :title="source.source">来源：{{ source.source }}</span><span>{{ source.window }}<template v-if="source.scene"> / {{ source.scene }}</template></span><span v-if="getBlockName(source.id)">块：{{ getBlockName(source.id) }}</span><span v-if="source.expression">#{{ source.expression }}</span></div>
    <textarea v-if="editing" ref="textArea" class="log-entry-textarea" :value="source.text" aria-label="发言正文" rows="4" @input="onEdit(source.id, { text: ($event.target as HTMLTextAreaElement).value }, true)" @blur="onFinishEdit" @keydown.stop />
    <div v-else class="log-content-preview" @dblclick="beginEdit">{{ source.text || '（空发言）' }}</div>
    <div v-if="editing" class="log-entry-expression"><label>差分 <input :value="source.expression" placeholder="差分" @change="onEdit(source.id, { expression: ($event.target as HTMLInputElement).value.trim() })" /></label></div>
    <footer class="log-entry-actions">
      <button @click="editing ? finishEdit() : beginEdit()">{{ editing ? '完成' : '编辑' }}</button>
      <button @click="onSplit(source.id)">拆分段落</button>
      <button @click="onInsert(source.id)">插入</button>
      <span class="log-action-spacer"></span>
      <button :aria-label="'上移 ' + source.name + ' 的发言'" @click="onStep(source.id, -1)">↑</button>
      <button :aria-label="'下移 ' + source.name + ' 的发言'" @click="onStep(source.id, 1)">↓</button>
      <button @click="onDelete(source.id)">删除</button>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue'
import type { WorkspaceEntry } from '../editor/listWorkspace'
const props = defineProps<{
  source: WorkspaceEntry
  index: number
  selectedIds: string[]
  highlightedId: string
  getColor: (window: string) => string
  getBlockName: (id: string) => string | undefined
  onSelect: (id: string, checked: boolean) => void
  onEdit: (id: string, patch: Partial<WorkspaceEntry>, typing?: boolean) => void
  onFinishEdit: () => void
  onDelete: (id: string) => void
  onInsert: (id: string) => void
  onSplit: (id: string) => void
  onStep: (id: string, direction: number) => void
  onMove: (ids: string[], window: string, target: string, after: boolean) => void
}>()
const editing = ref(false)
const textArea = ref<HTMLTextAreaElement>()
const dragOver = ref(false)
const beginEdit = () => { editing.value = true; nextTick(() => textArea.value?.focus()) }
const finishEdit = () => { editing.value = false; props.onFinishEdit() }
const startDrag = (event: DragEvent) => {
  if (!event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'move'
  const ids = props.selectedIds.includes(props.source.id) ? props.selectedIds : [props.source.id]
  event.dataTransfer.setData('application/x-story-painter-entries', JSON.stringify(ids))
}
const drop = (event: DragEvent) => {
  dragOver.value = false
  const data = event.dataTransfer?.getData('application/x-story-painter-entries')
  if (!data) return
  try {
    const ids = JSON.parse(data)
    if (!Array.isArray(ids) || !ids.every(id => typeof id === 'string')) return
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    props.onMove(ids, props.source.window, props.source.id, event.clientY > rect.top + rect.height / 2)
  } catch { /* Other applications can put non-JSON data on the drag clipboard. */ }
}
</script>

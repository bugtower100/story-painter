<template>
  <div class="lw-unit" :data-unit-id="source.id" :class="{ 'is-drop-before': dropSide === 'before', 'is-drop-after': dropSide === 'after' }" @dragover.capture="dragOver" @dragleave="dropSide = ''" @drop.capture="drop">
    <LogListEditorItem v-if="!source.blockId" v-bind="itemProps" :source="source.entries[0]" :index="index" />
    <article v-else class="lw-block" :class="{ 'is-selected': selectedBlockIds.includes(source.id) }">
      <header class="lw-block-head">
        <button class="drag-handle" draggable="true" :aria-label="'拖动内容块 ' + source.name" @dragstart="startDrag" @dragend="dropSide = ''">⠿</button>
        <input type="checkbox" :checked="selectedBlockIds.includes(source.id)" :aria-label="'选择内容块 ' + source.name" @change="onSelect(source.id, ($event.target as HTMLInputElement).checked)" />
        <span class="lw-block-order">{{ source.order }}</span><strong>{{ source.name }}</strong><span>{{ source.entries.length }} 条</span>
      </header>
      <div class="log-entry-labels"><span v-for="window in windows" :key="window" :style="{ borderLeft: '3px solid ' + itemProps.getColor(window) }">{{ window }}</span><span>{{ source.entries[0].time }} → {{ source.entries[source.entries.length - 1].time }}</span></div>
      <p v-if="!expanded" class="lw-block-preview">{{ source.entries[0].name }}：{{ source.entries[0].text || '（空发言）' }}</p>
      <div class="lw-block-actions"><button :aria-expanded="expanded" @click="onExpand(source.id)">{{ expanded ? '收起发言' : '展开发言' }}</button><button @click="onRename(source.id)">重命名</button><button @click="onDissolve(source.id)">解除分块</button><span class="lw-spacer"></span><button :aria-label="'上移内容块 ' + source.name" @click="onStep(source.id, -1)">↑</button><button :aria-label="'下移内容块 ' + source.name" @click="onStep(source.id, 1)">↓</button></div>
      <VirtualList v-if="expanded" ref="entriesRef" class="lw-block-entries" :style="{ height: Math.min(440, source.entries.length * 240) + 'px' }" data-key="id" :data-sources="source.entries" :data-component="LogListEditorItem" :extra-props="itemProps" :estimate-size="210" :keeps="15" />
    </article>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
// @ts-ignore The package does not publish TypeScript declarations.
import VirtualList from 'vue3-virtual-scroll-list'
import LogListEditorItem from './LogListEditorItem.vue'
import type { ContentUnit } from '../editor/listWorkspace'

const props = defineProps<{
  source: ContentUnit
  index: number
  itemProps: Omit<InstanceType<typeof LogListEditorItem>['$props'], 'source' | 'index'>
  selectedBlockIds: string[]
  expandedIds: string[]
  onSelect: (id: string, checked: boolean) => void
  onExpand: (id: string) => void
  onRename: (id: string) => void
  onDissolve: (id: string) => void
  onStep: (id: string, direction: number) => void
  onMove: (ids: string[], target: string, after: boolean) => void
}>()
const expanded = computed(() => props.expandedIds.includes(props.source.id))
const windows = computed(() => [...new Set(props.source.entries.map(e => e.window))])
const entriesRef = ref<any>()
const dropSide = ref('')
watch(() => [props.itemProps.highlightedId, expanded.value, props.source.id], async () => {
  if (!expanded.value) return
  const index = props.source.entries.findIndex(e => e.id === props.itemProps.highlightedId)
  if (index < 0) return
  await nextTick()
  entriesRef.value?.scrollToIndex(index)
}, { immediate: true, flush: 'post' })
const startDrag = (event: DragEvent) => {
  if (!event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'move'
  const ids = props.selectedBlockIds.includes(props.source.id) ? props.selectedBlockIds : [props.source.id]
  event.dataTransfer.setData('application/x-story-painter-units', JSON.stringify(ids))
}
const acceptsDrag = (event: DragEvent) => event.dataTransfer?.types.includes('application/x-story-painter-units') || (props.source.blockId && !(event.target as HTMLElement).closest('.log-entry') && event.dataTransfer?.types.includes('application/x-story-painter-entries'))
const isAfter = (event: DragEvent) => { const rect = (event.currentTarget as HTMLElement).getBoundingClientRect(); return event.clientY > rect.top + rect.height / 2 }
const dragOver = (event: DragEvent) => {
  if (!acceptsDrag(event)) return
  event.preventDefault(); event.stopPropagation()
  dropSide.value = isAfter(event) ? 'after' : 'before'
}
const drop = (event: DragEvent) => {
  dropSide.value = ''
  if (!acceptsDrag(event)) return
  event.preventDefault(); event.stopPropagation()
  const units = event.dataTransfer?.getData('application/x-story-painter-units')
  const data = units || event.dataTransfer?.getData('application/x-story-painter-entries')
  if (!data) return
  try {
    const ids = JSON.parse(data)
    if (!Array.isArray(ids) || !ids.every(id => typeof id === 'string')) return
    const after = isAfter(event)
    if (units) props.onMove(ids, props.source.id, after)
    else {
      const target = props.source.entries[after ? props.source.entries.length - 1 : 0]
      props.itemProps.onMove(ids, target.window, target.id, after)
    }
  } catch { /* Ignore drag formats from other applications. */ }
}
</script>

<template>
  <div class="log-entry" :class="{ 'is-drag-over': isDragOver }" :style="itemStyle" :id="'log-item-' + index" @dragenter.prevent="onDragEnter" @dragleave="onDragLeave" @dragover.prevent="onDragOver" @drop.prevent="onDrop">
      <n-flex align="center" class="mb-1">
          <span class="drag-handle" draggable="true" @dragstart="onDragStart" @dragend="onDragEnd">
            <n-icon size="18" style="color: #9ca3af;">
              <svg viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 4a1.25 1.25 0 1 1-2.5 0A1.25 1.25 0 0 1 7 4Zm0 6a1.25 1.25 0 1 1-2.5 0A1.25 1.25 0 0 1 7 10Zm0 6a1.25 1.25 0 1 1-2.5 0A1.25 1.25 0 0 1 7 16Zm8-12a1.25 1.25 0 1 1-2.5 0A1.25 1.25 0 0 1 15 4Zm0 6a1.25 1.25 0 1 1-2.5 0A1.25 1.25 0 0 1 15 10Zm0 6a1.25 1.25 0 1 1-2.5 0A1.25 1.25 0 0 1 15 16Z"/>
              </svg>
            </n-icon>
          </span>
          <n-checkbox v-model:checked="source._selected" />
          <n-text class="font-bold text-purple-700">{{ source.nameAndId }}</n-text>
          <n-input v-model:value="source.diffName" placeholder="差分" size="tiny" style="width: 80px" @change="onChange" />
          <n-text>(</n-text>
          <n-input v-model:value="source.groupName" placeholder="组名" size="tiny" style="width: 80px" @change="onChange" />
          <n-text>)</n-text>
          <n-text class="text-gray-400 text-xs ml-auto">{{ source.dateTimeStr }}</n-text>
          <n-button size="tiny" secondary type="info" @click="toggleEdit">{{ source._editing ? '完成' : '编辑' }}</n-button>
          <n-button size="tiny" type="error" @click="onDelete(index)">删除</n-button>
      </n-flex>
      
      <!-- Content Area -->
      <div v-if="source._editing">
         <n-input type="textarea" v-model:value="source.contentStr" :autosize="{ minRows: 2 }" @update:value="onContentUpdate" @blur="source._editing = false" autofocus />
      </div>
      <div v-else class="log-content-preview" @dblclick="toggleEdit">
         {{ source.contentStr }}
      </div>
      
      <!-- Insert Divider -->
      <div class="insert-divider" @click="onInsert(index + 1)">
          <div class="insert-btn-small">+ 插入条目</div>
      </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { NFlex, NCheckbox, NText, NInput, NButton, NIcon } from 'naive-ui'

const props = defineProps<{
  source: any
  index: number
  getColor: (key: string) => string
  onDelete: (index: number) => void
  onInsert: (index: number) => void
  onChange: () => void
  onMove: (dragId: string, targetId: string, placeAfter: boolean) => void
}>()

const itemStyle = computed(() => {
   const key = String(props.source.groupName || 'main').trim() || 'main'
   return {
      borderLeft: `4px solid ${props.getColor(key)}`
   }
})

const toggleEdit = () => {
   props.source._editing = !props.source._editing
}

const onContentUpdate = (val: string) => {
   props.source.content = val.split('\n')
   props.onChange()
}

const isDragOver = ref(false)

const onDragStart = (e: DragEvent) => {
  if (!e.dataTransfer) return
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', String(props.source._id))
}

const onDragEnd = () => {
  isDragOver.value = false
}

const onDragEnter = () => {
  isDragOver.value = true
}

const onDragLeave = (e: DragEvent) => {
  const cur = e.currentTarget as HTMLElement | null
  const rel = e.relatedTarget as Node | null
  if (cur && rel && cur.contains(rel)) return
  isDragOver.value = false
}

const onDragOver = () => {
  isDragOver.value = true
}

const onDrop = (e: DragEvent) => {
  isDragOver.value = false
  const dragId = e.dataTransfer?.getData('text/plain')
  if (!dragId) return
  const targetId = String(props.source._id)
  if (dragId === targetId) return
  const el = e.currentTarget as HTMLElement | null
  if (!el) return
  const rect = el.getBoundingClientRect()
  const placeAfter = e.clientY - rect.top > rect.height / 2
  props.onMove(String(dragId), targetId, placeAfter)
}
</script>

<style scoped>
.log-entry {
   padding: 10px;
   border-bottom: 1px solid #eee;
   background: #fff;
   position: relative;
}
.log-entry:hover {
   background: #f9f9f9;
}
.log-entry.is-drag-over {
   outline: 2px solid #c084fc;
   outline-offset: -2px;
   background: #faf5ff;
}
.drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-right: 6px;
  cursor: grab;
  user-select: none;
}
.drag-handle:active {
  cursor: grabbing;
}
.insert-divider {
   height: 10px;
   position: relative;
   margin-top: 5px;
   cursor: pointer;
   opacity: 0;
   transition: opacity 0.2s;
}
.insert-divider:hover {
   opacity: 1;
}
.insert-divider::before {
   content: '';
   position: absolute;
   top: 50%;
   left: 0;
   right: 0;
   border-top: 1px dashed #d1c4e9;
}
.insert-btn-small {
   position: absolute;
   left: 50%;
   top: 50%;
   transform: translate(-50%, -50%);
   background: #fff;
   border: 1px solid #ce93d8;
   color: #9c27b0;
   font-size: 10px;
   padding: 2px 8px;
   border-radius: 10px;
   z-index: 1;
}
.log-content-preview {
   white-space: pre-wrap;
   font-size: 14px;
   color: #333;
   cursor: text;
   min-height: 24px;
}
.log-content-preview:hover {
   background-color: #f0f8ff;
}
</style>

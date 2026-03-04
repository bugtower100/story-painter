<template>
  <div class="log-list-editor flex-layout">
    <div class="top-section">
      <n-alert type="info" show-icon class="mb-3" closable>
        列表编辑模式：您可以像在表格中一样编辑每一条Log。修改会自动同步回主编辑器。
        <br>
        您也可以在此处追加导入更多TXT文件。
      </n-alert>

      <!-- File Import (Collapsible) -->
      <n-collapse class="mb-3">
        <n-collapse-item title="追加导入/合并 TXT 文件" name="1">
           <div class="file-input-section" @click="triggerFileInput" @drop.prevent="handleDrop" @dragover.prevent>
              <div v-if="selectedFiles.length === 0" class="placeholder">
                 <n-icon size="32" color="#d1c4e9">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M288 109.3V352c0 17.7-14.3 32-32 32s-32-14.3-32-32V109.3l-73.4 73.4c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l128-128c12.5-12.5 32.8-12.5 45.3 0l128 128c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L288 109.3zM64 352H192c0 35.3 28.7 64 64 64s64-28.7 64-64H448c35.3 0 64 28.7 64 64v32c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V416c0-35.3 28.7-64 64-64zM432 456a24 24 0 1 0 0-48 24 24 0 1 0 0 48z"/></svg>
                 </n-icon>
                 <p>点击或拖拽TXT文件到此处追加</p>
              </div>
              <div v-else>
                 <p>已选择 {{ selectedFiles.length }} 个文件</p>
              </div>
              <input type="file" ref="fileInputRef" multiple accept=".txt" style="display: none" @change="handleFileChange">
           </div>

           <div v-if="selectedFiles.length > 0" class="mt-2">
              <n-list bordered class="rounded-lg bg-white">
                 <n-list-item v-for="(file, index) in selectedFiles" :key="index">
                    <n-flex align="center" :wrap="false" justify="space-between" class="px-2">
                       <n-text class="flex-1 truncate mr-4" :title="file.name">{{ file.name }}</n-text>
                       <n-input v-model:value="fileGroupNames[index]" placeholder="组名" size="small" style="width: 150px" />
                    </n-flex>
                 </n-list-item>
              </n-list>
              <n-flex justify="center" class="mt-2">
                 <n-button type="primary" size="small" @click="processFiles" :loading="processing">追加合并</n-button>
              </n-flex>
           </div>
        </n-collapse-item>
      </n-collapse>
    </div>

    <n-grid x-gap="12" :cols="4" class="mb-4 main-grid" item-responsive>
      <n-gi :span="3" class="h-full">
          <div class="editor-box h-full flex flex-col">
             <!-- Batch Operations -->
             <n-card size="small" class="mb-2 bg-slate-50 flex-shrink-0" title="批量操作">
                <n-flex align="center" wrap>
                   <n-checkbox v-model:checked="isAllSelected" @update:checked="handleSelectAll">全选</n-checkbox>
                   <n-text>已选: {{ selectedLogsCount }}</n-text>
                   <n-divider vertical />
                   <n-input v-model:value="batchGroup" placeholder="修改组名" size="tiny" style="width: 100px"/>
                   <n-button size="tiny" type="warning" @click="applyBatchEdit">应用修改</n-button>
                   <n-divider vertical />
                   <n-button size="tiny" type="error" @click="deleteSelected">删除选中</n-button>
                </n-flex>
             </n-card>

             <!-- Log List -->
             <div class="log-list-wrapper" :style="{ height: listHeightPx }">
                <VirtualList
                  ref="listContainer"
                  class="log-list"
                  style="height: 100%; overflow-y: auto"
                  :data-key="'_id'"
                  :data-sources="filteredLogs"
                  :data-component="LogListEditorItem"
                  :extra-props="extraProps"
                  :estimate-size="80"
                  @scroll="onScroll"
                />
                <div v-if="filteredLogs.length === 0" class="text-center text-gray-400 mt-10">
                   暂无内容，或被筛选器隐藏
                </div>
             </div>
          </div>
      </n-gi>
      <n-gi class="h-full flex flex-col">
         <n-card title="过滤组别" size="small" class="mb-2 flex-shrink-0">
            <div style="max-height: 200px; overflow-y: auto;">
               <n-checkbox-group v-model:value="filterGroups">
                  <n-grid :cols="1" :y-gap="4">
                     <n-gi v-for="option in groupOptions" :key="option.value">
                        <n-checkbox :value="option.value" class="w-full">
                           <n-flex align="center" size="small" :wrap="false">
                              <div :style="{ width: '12px', height: '12px', backgroundColor: getColor(option.value), borderRadius: '2px', flexShrink: 0 }"></div>
                              <n-text class="truncate">{{ option.label }}</n-text>
                           </n-flex>
                        </n-checkbox>
                     </n-gi>
                  </n-grid>
               </n-checkbox-group>
            </div>
         </n-card>
         
         <div class="timeline-container" :style="{ height: listHeightPx }" ref="timelineRef" @click="handleTimelineClick" @wheel.prevent="handleTimelineWheel" @mousedown="handleTimelineMouseDown">
             <canvas ref="timelineCanvas" style="width: 100%; height: 100%"></canvas>
             <!-- 使用 overflow: hidden 容器包裹 viewport 指示器 -->
             <div class="viewport-container">
                <div class="timeline-viewport" :style="viewportStyle"></div>
             </div>
          </div>
       </n-gi>
     </n-grid>

    <!-- Insert Modal -->
    <n-modal v-model:show="showInsertModal" preset="card" title="插入新条目" style="width: 500px">
       <n-form label-placement="left" label-width="80">
          <n-form-item label="发言人">
             <n-input v-model:value="insertForm.name" placeholder="例如: 调查员" />
          </n-form-item>
          <n-form-item label="ID">
             <n-input v-model:value="insertForm.id" placeholder="留空自动生成 (1001起)" />
          </n-form-item>
          <n-form-item label="差分">
             <n-input v-model:value="insertForm.diff" placeholder="可选" />
          </n-form-item>
          <n-form-item label="组名">
             <n-input v-model:value="insertForm.group" placeholder="例如: 大群" />
          </n-form-item>
          <n-form-item label="内容">
             <n-input type="textarea" v-model:value="insertForm.content" />
          </n-form-item>
       </n-form>
       <template #footer>
          <n-flex justify="end">
             <n-button @click="showInsertModal = false">取消</n-button>
             <n-button type="primary" @click="confirmInsert">确认插入</n-button>
          </n-flex>
       </template>
    </n-modal>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch, nextTick } from 'vue'
import { NFlex, NText, NButton, NCard, NAlert, NIcon, NList, NListItem, NInput, NGrid, NGi, NCheckbox, NDivider, NModal, NForm, NFormItem, useMessage, NCollapse, NCollapseItem, NSelect, NCheckboxGroup } from 'naive-ui'
import { debounce } from 'lodash-es'
import randomColor from 'randomcolor'
// @ts-ignore
import VirtualList from 'vue3-virtual-scroll-list'
import LogListEditorItem from '../components/LogListEditorItem.vue'

const props = defineProps<{
  initialContent: string
}>()

const emit = defineEmits(['update:content'])
const message = useMessage()

// --- State ---
const selectedFiles = ref<File[]>([])
const fileGroupNames = ref<string[]>([])
const processing = ref(false)
const mergedLogs = ref<any[]>([])
const lastSyncedContent = ref('')

const fileInputRef = ref<HTMLInputElement | null>(null)

// Batch Edit State
const batchGroup = ref('')
const isAllSelected = ref(false)

// Timeline & Filter State
const filterGroups = ref<string[]>([])
const timelineCanvas = ref<HTMLCanvasElement | null>(null)
const timelineRef = ref<HTMLDivElement | null>(null)
const listContainer = ref<any>(null)
const viewportStyle = ref({})
const timelineScale = ref(1)
const timelineOffset = ref(0)
const isDraggingTimeline = ref(false)
const lastMouseY = ref(0)

// Colors
const colorMap = reactive(new Map<string, string>())

// Insert Modal State
const showInsertModal = ref(false)
const insertIndex = ref(-1)
const insertForm = reactive({
   name: '',
   id: '',
   diff: '',
   group: '',
   content: ''
})

// --- Computed ---
const stats = computed(() => {
   const s: Record<string, number> = {}
   mergedLogs.value.forEach(log => {
      const match = log.nameAndId.match(/^(.+)\(\d+\)$/)
      const name = match ? match[1].trim() : log.nameAndId.trim()
      s[name] = (s[name] || 0) + 1
   })
   const sorted = Object.entries(s).sort((a, b) => b[1] - a[1])
   return Object.fromEntries(sorted)
})

const selectedLogsCount = computed(() => mergedLogs.value.filter(l => l._selected).length)

// Unique Groups and Diffs for Select Options
const groupOptions = computed(() => {
   const groups = new Set<string>()
   mergedLogs.value.forEach(l => groups.add(l.groupName || 'main'))
   return Array.from(groups).map(g => ({ label: g, value: g }))
})

// Filtered Logs
const filteredLogs = computed(() => {
   return mergedLogs.value.filter(item => {
      // 过滤逻辑：如果选中了组别，则只显示选中的组别
      // 如果没有选中任何组别，则显示所有
      if (filterGroups.value.length > 0) {
         return filterGroups.value.includes(item.groupName || 'main')
      }
      return true
   })
})

const listHeightPx = computed(() => {
   return '500px'
})

const extraProps = computed(() => ({
   getColor,
   onDelete: deleteLog,
   onInsert: (idx: number) => openInsertModal(idx),
   onChange: onLogChange,
   onMove: moveLog
}))

// --- Initialization ---

onMounted(() => {
   if (props.initialContent) {
      parseInitialContent(props.initialContent)
      lastSyncedContent.value = props.initialContent
   }
   const onResize = () => {
      drawTimeline()
      nextTick(() => onScroll())
   }
   window.addEventListener('resize', onResize)
   nextTick(() => {
      drawTimeline()
      onScroll()
   })
})

watch([mergedLogs, filteredLogs, filterGroups], () => {
   nextTick(() => {
      drawTimeline()
      onScroll()
   })
}, { deep: true })

watch(() => props.initialContent, (text) => {
   const v = text || ''
   if (v === lastSyncedContent.value) return
   parseInitialContent(v)
   lastSyncedContent.value = v
})

const parseInitialContent = (text: string) => {
   const result = doProcessFiles([{ text, groupName: '' }])
   mergedLogs.value = result.logs.map((log, idx) => ({
      ...log,
      _id: idx,
      _selected: false,
      _editing: false,
      contentStr: log.content.join('\n')
   }))
}

// --- Sync to Parent ---

function normalizeDateTimeText(input: string): string {
   const s = String(input ?? '').trim()
   const m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/)
   if (m) {
      const y = m[1]
      const mm = m[2].padStart(2, '0')
      const dd = m[3].padStart(2, '0')
      const hh = m[4].padStart(2, '0')
      const mi = m[5].padStart(2, '0')
      const ss = m[6].padStart(2, '0')
      return `${y}/${mm}/${dd} ${hh}:${mi}:${ss}`
   }
   const t = s.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2})$/)
   if (t) {
      const hh = t[1].padStart(2, '0')
      const mi = t[2].padStart(2, '0')
      const ss = t[3].padStart(2, '0')
      return `${hh}:${mi}:${ss}`
   }
   return s
}

function parseTimestamp(dateTimeStr: string): number {
   const normalized = normalizeDateTimeText(dateTimeStr)
   const full = normalized.match(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/)
   if (full) {
      const y = Number(full[1])
      const mo = Number(full[2]) - 1
      const d = Number(full[3])
      const hh = Number(full[4])
      const mi = Number(full[5])
      const ss = Number(full[6])
      const t = new Date(y, mo, d, hh, mi, ss).getTime()
      return Number.isFinite(t) ? t : Date.now()
   }

   const timeOnly = normalized.match(/^(\d{2}):(\d{2}):(\d{2})$/)
   if (timeOnly) {
      const hh = Number(timeOnly[1])
      const mi = Number(timeOnly[2])
      const ss = Number(timeOnly[3])
      const t = new Date(1970, 0, 1, hh, mi, ss).getTime()
      return Number.isFinite(t) ? t : Date.now()
   }

   const t = new Date(dateTimeStr).getTime()
   return Number.isFinite(t) ? t : Date.now()
}

function buildHeaderLine(log: any): string {
   const nameAndId = String(log?.nameAndId ?? '').trim()
   const diffName = String(log?.diffName ?? '').trim()
   const groupName = String(log?.groupName ?? '').trim()
   const dateTimeStr = normalizeDateTimeText(String(log?.dateTimeStr ?? '').trim())

   let header = nameAndId
   if (diffName) header += ` #${diffName}`
   if (dateTimeStr) header += ` ${dateTimeStr}`
   header += ` [${groupName || 'main'}]`
   return header
}

const generateContent = () => {
   let out = ''
   for (const log of mergedLogs.value) {
      const header = buildHeaderLine(log)
      const lines = Array.isArray(log?.content) ? [...log.content] : []
      const normalizedLines = lines
         .map((l: any) => String(l ?? ''))
         .filter((l: string) => l.trim() !== '')
      const body = normalizedLines.join('\n').trimEnd()
      if (body) out += `${header}\n${body}\n\n`
      else out += `${header}\n\n`
   }
   return out
}

const emitUpdate = debounce(() => {
   const v = generateContent()
   lastSyncedContent.value = v
   emit('update:content', v)
}, 500)

const onLogChange = () => {
   emitUpdate()
}

// --- Methods ---

const triggerFileInput = () => {
   fileInputRef.value?.click()
}

const handleFileChange = (e: Event) => {
   const files = (e.target as HTMLInputElement).files
   if (files) {
      selectedFiles.value = Array.from(files)
      fileGroupNames.value = new Array(files.length).fill('')
   }
}

const handleDrop = (e: DragEvent) => {
   const files = e.dataTransfer?.files
   if (files) {
      selectedFiles.value = Array.from(files).filter(f => f.name.endsWith('.txt'))
      fileGroupNames.value = new Array(selectedFiles.value.length).fill('')
   }
}

const readFile = (file: File): Promise<string> => {
   return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as string)
      reader.onerror = reject
      reader.readAsText(file)
   })
}

const processFiles = async () => {
   if (selectedFiles.value.length === 0) return
   processing.value = true
   
   const fileData = []
   try {
      for (let i = 0; i < selectedFiles.value.length; i++) {
         const file = selectedFiles.value[i]
         const groupName = fileGroupNames.value[i].trim()
         const text = await readFile(file)
         fileData.push({ text, groupName })
      }
      
      const result = doProcessFiles(fileData)
      
      // Merge logic: Append new logs to existing ones
      const newLogs = result.logs.map((log, idx) => ({
         ...log,
         _id: Date.now() + idx, // Unique key
         _selected: false,
         _editing: false,
         contentStr: log.content.join('\n')
      }))
      
      mergedLogs.value = [...mergedLogs.value, ...newLogs]
      
      // Re-sort by time
      mergedLogs.value.sort((a, b) => a.timestamp - b.timestamp)
      
      emitUpdate()
      
      if (result.hasNoDateLog) {
         message.warning('检测到部分日志仅包含时间而无日期。合并时将单纯按照24小时制时间排序。')
      } else {
         message.success('追加合并完成！')
      }
      
      // Clear selection
      selectedFiles.value = []
      fileGroupNames.value = []
      
   } catch (e) {
      console.error(e)
      message.error('处理出错')
   } finally {
      processing.value = false
   }
}

const doProcessFiles = (fileData: { text: string, groupName: string }[]) => {
   let allLogs: any[] = []
   let hasNoDateLog = false
   
   const regex = /^(.+?)\((\d+)\)(?:\s*#([^\s\[]+))?\s+(\d{4}\/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{1,2}:\d{1,2})(?:\s+\[([^\]]+)\])?(.*)$/
   const timeOnlyRegex = /^(.+?)\((\d+)\)(?:\s*#([^\s\[]+))?\s+(\d{1,2}:\d{1,2}:\d{1,2})(?:\s+\[([^\]]+)\])?(.*)$/
   
   fileData.forEach(({ text, groupName: fileGroupName }) => {
      const lines = text.split(/\r?\n/)
      let currentLog: any = null
      
      lines.forEach(line => {
         const match = line.match(regex)
         const matchTimeOnly = line.match(timeOnlyRegex)
         
         if (match) {
            if (currentLog) allLogs.push(currentLog)
            
            const nameAndId = match[1] + '(' + match[2] + ')'
            const diffTag = match[3] || ''
            const dateTimeStr = normalizeDateTimeText(match[4])
            const groupTag = String(match[5] || fileGroupName || 'main').trim()
            const sameLineContent = match[6] ? match[6].trim() : ''
            
            const timestamp = parseTimestamp(dateTimeStr)
            
            currentLog = {
               timestamp,
               nameAndId,
               diffName: diffTag,
               dateTimeStr,
               groupName: groupTag,
               content: []
            }
            if (sameLineContent) currentLog.content.push(sameLineContent)
            
         } else if (matchTimeOnly) {
            if (currentLog) allLogs.push(currentLog)
            
            hasNoDateLog = true
            const nameAndId = matchTimeOnly[1] + '(' + matchTimeOnly[2] + ')'
            const diffTag = matchTimeOnly[3] || ''
            const timeStr = normalizeDateTimeText(matchTimeOnly[4])
            const groupTag = String(matchTimeOnly[5] || fileGroupName || 'main').trim()
            const sameLineContent = matchTimeOnly[6] ? matchTimeOnly[6].trim() : ''
            
            // Dummy date for sorting
            const timestamp = parseTimestamp(timeStr)
            
            currentLog = {
               timestamp,
               nameAndId,
               diffName: diffTag,
               dateTimeStr: timeStr,
               groupName: groupTag,
               content: []
            }
            if (sameLineContent) currentLog.content.push(sameLineContent)
         } else {
            if (currentLog && line.trim()) {
               currentLog.content.push(line.trim())
            }
         }
      })
      if (currentLog) allLogs.push(currentLog)
   })
   
   allLogs.sort((a, b) => a.timestamp - b.timestamp)
   return { logs: allLogs, hasNoDateLog }
}

// --- Editing ---

const deleteLog = (index: number) => {
   mergedLogs.value.splice(index, 1)
   emitUpdate()
}

const moveLog = (dragId: string, targetId: string, placeAfter: boolean) => {
   const fromIndex = mergedLogs.value.findIndex(l => String(l?._id) === String(dragId))
   const targetIndexBeforeRemove = mergedLogs.value.findIndex(l => String(l?._id) === String(targetId))
   if (fromIndex < 0 || targetIndexBeforeRemove < 0) return
   if (fromIndex === targetIndexBeforeRemove) return

   const moved = mergedLogs.value.splice(fromIndex, 1)[0]
   let targetIndex = targetIndexBeforeRemove
   if (fromIndex < targetIndex) targetIndex -= 1

   let insertIndex = placeAfter ? targetIndex + 1 : targetIndex
   if (insertIndex < 0) insertIndex = 0
   if (insertIndex > mergedLogs.value.length) insertIndex = mergedLogs.value.length

   mergedLogs.value.splice(insertIndex, 0, moved)
   emitUpdate()
}

const handleSelectAll = (checked: boolean) => {
   mergedLogs.value.forEach(l => l._selected = checked)
}

const deleteSelected = () => {
   mergedLogs.value = mergedLogs.value.filter(l => !l._selected)
   isAllSelected.value = false
   emitUpdate()
}

const applyBatchEdit = () => {
   mergedLogs.value.forEach(l => {
      if (l._selected) {
         if (batchGroup.value) l.groupName = batchGroup.value
      }
   })
   message.success('批量修改已应用')
   emitUpdate()
}

// --- Insert ---

const openInsertModal = (index: number) => {
   insertIndex.value = index
   let timeStr = ''
   if (index > 0 && mergedLogs.value[index - 1]) {
      timeStr = mergedLogs.value[index - 1].dateTimeStr
   } else {
      timeStr = new Date().toLocaleString()
   }
   
   let prev = index > 0 ? mergedLogs.value[index - 1] : null
   
   insertForm.name = ''
   insertForm.id = ''
   insertForm.diff = ''
   insertForm.group = prev ? prev.groupName : ''
   insertForm.content = ''
   
   showInsertModal.value = true
}

const confirmInsert = () => {
   const base = mergedLogs.value[insertIndex.value > 0 ? insertIndex.value - 1 : 0]?.dateTimeStr || '2000/01/01 00:00:00'
   const dateTimeStr = normalizeDateTimeText(base)
   
   let id = insertForm.id
   if (!id) {
      id = '1001'
   }
   
   const newLog = {
      _id: Date.now() + Math.random(),
      timestamp: parseTimestamp(dateTimeStr),
      nameAndId: `${insertForm.name}(${id})`,
      diffName: insertForm.diff,
      dateTimeStr: dateTimeStr,
      groupName: String(insertForm.group || 'main').trim() || 'main',
      content: insertForm.content.split('\n').filter(l => l.trim() !== ''),
      contentStr: insertForm.content,
      _selected: false
   }
   
   mergedLogs.value.splice(insertIndex.value, 0, newLog)
   showInsertModal.value = false
   message.success('已插入')
   emitUpdate()
}

// --- Methods for View & Timeline ---

const palette = [
   '#ff0000',
   '#008000',
   '#0000ff',
   '#ffa500',
   '#800080',
   '#00ced1',
   '#ffd700',
   '#ff1493',
   '#8b4513',
   '#708090',
   '#adff2f',
   '#4682b4',
   '#d2691e',
   '#000080',
   '#006400',
   '#800000',
   '#4b0082',
   '#a9a9a9',
   '#00ff7f',
   '#dc143c'
]

const getColor = (key: string) => {
   const normalized = String(key || 'main').trim() || 'main'
   if (!colorMap.has(normalized)) {
      const index = colorMap.size
      if (index < palette.length) {
         colorMap.set(normalized, palette[index])
      } else {
         // 使用确定性种子生成颜色，确保同名组别颜色一致且不同
         colorMap.set(normalized, randomColor({ 
            luminosity: 'dark', // 使用较深的颜色以保证在白色背景下可见
            seed: normalized,
            format: 'hex'
         }))
      }
   }
   return colorMap.get(normalized) ?? '#cccccc'
}

const getTimelineRange = () => {
   const logs = filteredLogs.value
   if (logs.length === 0) return null
   let minTs = Number.POSITIVE_INFINITY
   let maxTs = Number.NEGATIVE_INFINITY
   const tsList: number[] = []
   for (const l of logs) {
      const t = Number(l.timestamp)
      if (!Number.isFinite(t)) continue
      if (t < minTs) minTs = t
      if (t > maxTs) maxTs = t
      tsList.push(t)
   }
   if (!Number.isFinite(minTs) || !Number.isFinite(maxTs)) return null
   tsList.sort((a, b) => a - b)
   const diffs: number[] = []
   for (let i = 1; i < tsList.length; i++) {
      const d = tsList[i] - tsList[i - 1]
      if (Number.isFinite(d) && d > 0) diffs.push(d)
   }
   diffs.sort((a, b) => a - b)
   const mid = Math.floor(diffs.length / 2)
   const medianGap = diffs.length ? diffs[mid] : 60_000
   const tailGap = Math.max(1, medianGap)
   const endTs = maxTs + tailGap
   return { minTs, maxTs, endTs }
}

const buildTimelineSegments = () => {
   const range = getTimelineRange()
   if (!range) return []
   const logs = filteredLogs.value
   if (logs.length === 0) return []

   const segments: Array<{ startTs: number; endTs: number; groupKey: string; startIndex: number; endIndex: number }> = []
   for (let i = 0; i < logs.length; i++) {
      const cur = logs[i]
      const next = logs[i + 1]
      const startTs = Number(cur.timestamp)
      const endTs = next ? Number(next.timestamp) : range.endTs
      if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) continue
      const groupKey = String(cur.groupName || 'main').trim() || 'main'
      const last = segments[segments.length - 1]
      if (last && last.groupKey === groupKey) {
         last.endTs = Math.max(last.endTs, endTs)
         last.endIndex = i
      } else {
         segments.push({ startTs, endTs, groupKey, startIndex: i, endIndex: i })
      }
   }
   return segments
}

const buildTimelineSegmentsByIndex = () => {
   const logs = filteredLogs.value
   if (logs.length === 0) return []
   const segments: Array<{ startIndex: number; endIndex: number; groupKey: string }> = []
   for (let i = 0; i < logs.length; i++) {
      const groupKey = String(logs[i].groupName || 'main').trim() || 'main'
      const last = segments[segments.length - 1]
      if (last && last.groupKey === groupKey) {
         last.endIndex = i
      } else {
         segments.push({ startIndex: i, endIndex: i, groupKey })
      }
   }
   return segments
}

const pickTickStepMs = (spanMs: number) => {
   const minute = 60_000
   const hour = 60 * minute
   const day = 24 * hour
   const candidates = [
      1 * minute,
      5 * minute,
      10 * minute,
      15 * minute,
      30 * minute,
      1 * hour,
      2 * hour,
      3 * hour,
      6 * hour,
      12 * hour,
      1 * day,
      2 * day,
      3 * day,
      7 * day
   ]
   const targetTicks = 8
   const target = spanMs / targetTicks
   let best = candidates[0]
   let bestDiff = Math.abs(best - target)
   for (const c of candidates) {
      const d = Math.abs(c - target)
      if (d < bestDiff) {
         bestDiff = d
         best = c
      }
   }
   return best
}

const formatTickLabel = (ts: number, spanMs: number) => {
   const d = new Date(ts)
   const m = d.getMonth() + 1
   const day = d.getDate()
   const hh = String(d.getHours()).padStart(2, '0')
   const mm = String(d.getMinutes()).padStart(2, '0')
   const showDate = spanMs >= 36 * 60 * 60_000
   return showDate ? `${m}/${day} ${hh}:${mm}` : `${hh}:${mm}`
}

const drawTimeline = () => {
   const canvas = timelineCanvas.value
   if (!canvas) return
   const ctx = canvas.getContext('2d')
   if (!ctx) return
   
   // Resize canvas to match display size for sharpness
   const dpr = window.devicePixelRatio || 1
   const rect = canvas.getBoundingClientRect()
   canvas.width = rect.width * dpr
   canvas.height = rect.height * dpr
   
   // 应用缩放和平移
   ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
   ctx.translate(0, timelineOffset.value)
   ctx.scale(1, timelineScale.value)
   
   const width = rect.width
   const height = rect.height
   
   // 清除背景 (考虑到缩放和平移，需要清除足够大的区域)
   // 简单起见，重置变换后清除
   ctx.save()
   ctx.setTransform(1, 0, 0, 1, 0, 0)
   ctx.clearRect(0, 0, canvas.width, canvas.height)
   ctx.restore()
   
   const range = getTimelineRange()
   if (!range) return
   const { minTs, maxTs, endTs } = range
   const spanMs = endTs - minTs
   
      // 1. Draw Base Line Background
   const lineX = 14
   const lineWidth = 12
   
   ctx.fillStyle = '#f0f0f0'
   ctx.fillRect(lineX - lineWidth/2, 0, lineWidth, height)

   const totalLogs = filteredLogs.value.length
   // 强制使用 Index 映射 (Timeline根据长度分段)
   const indexToY = (idx: number) => (idx / Math.max(totalLogs, 1)) * height

   // 2. Draw Group Segments (By Index)
   // 即使组别相同，也要根据时间分段绘制，确保点击跳转准确
   const logs = filteredLogs.value
   if (logs.length > 0) {
       // 为了性能，我们按像素行来聚合，或者逐条绘制
       // 既然用户要求“一段红一段绿”，我们按连续组别聚合
       const segments = buildTimelineSegmentsByIndex()
       for (const seg of segments) {
          const top = Math.floor(indexToY(seg.startIndex))
          const bottom = Math.ceil(indexToY(seg.endIndex + 1))
          const h = Math.max(bottom - top, 1)
          
          ctx.fillStyle = getColor(seg.groupKey)
          ctx.fillRect(lineX - lineWidth / 2, top, lineWidth, h)
       }
   }
   
   // 3. Draw Time Labels (Index-based distribution)
   // 我们需要在Y轴均匀分布时间标签，或者寻找时间突变点
   // 这里采用简单的均匀分布策略，并在右侧显示
   
   // 在缩放模式下，标签密度应该保持一致，所以根据缩放比例调整步长
   const scaledHeight = height * timelineScale.value
   const labelCount = Math.floor(scaledHeight / 40) // 每40px一个标签
   
   if (labelCount > 1) {
       const step = Math.max(1, Math.ceil(totalLogs / labelCount))
       let lastLabelY = -200 // 宽松一点
       
       // 为了不让标签随缩放变形，我们需要逆向缩放绘制
       // 或者更简单：在循环中计算坐标，但绘制时不应用Y轴缩放？
       // 不行，那样位置会对不上。
       // 方案：绘制文字时 reset transform，手动计算坐标
       
       // 先绘制刻度线（随缩放）
       for (let i = 0; i < totalLogs; i += step) {
           const y = indexToY(i)
           
           ctx.beginPath()
           ctx.moveTo(lineX + lineWidth / 2, y)
           ctx.lineTo(lineX + lineWidth / 2 + 6, y)
           ctx.strokeStyle = '#999'
           ctx.lineWidth = 1 / timelineScale.value // 保持线宽一致
           ctx.stroke()
       }
       
       // 绘制文字（不随缩放变形，位置手动计算）
       ctx.save()
       ctx.setTransform(dpr, 0, 0, dpr, 0, 0) // 重置为屏幕坐标系
       
       for (let i = 0; i < totalLogs; i += step) {
           const log = logs[i]
           // 计算屏幕坐标 Y
           const originalY = indexToY(i)
           const screenY = originalY * timelineScale.value + timelineOffset.value
           
           // 视口裁剪优化
           if (screenY < -20 || screenY > height + 20) continue
           if (screenY - lastLabelY < 20) continue
           
           // Format time
           const t = log.timestamp
           const d = new Date(t)
           const m = d.getMonth() + 1
           const day = d.getDate()
           const hh = String(d.getHours()).padStart(2, '0')
           const mm = String(d.getMinutes()).padStart(2, '0')
           const label = spanMs > 86400000 ? `${m}/${day} ${hh}:${mm}` : `${hh}:${mm}`
           
           ctx.textAlign = 'left'
           ctx.textBaseline = 'middle'
           ctx.font = '10px sans-serif'
           ctx.fillStyle = '#666'
           ctx.fillText(label, lineX + lineWidth / 2 + 10, screenY)
           
           lastLabelY = screenY
       }
       ctx.restore()
   }
}

const onScroll = (e?: Event) => {
   if (!timelineRef.value) return

   let scrollTop = 0
   let scrollHeight = 0
   let clientHeight = 0

   if (e && e.target) {
       const target = e.target as HTMLElement
       scrollTop = target.scrollTop
       scrollHeight = target.scrollHeight
       clientHeight = target.clientHeight
   } else if (listContainer.value) {
       const el = listContainer.value.$el || listContainer.value
       if (el && el.scrollTop !== undefined) {
           scrollTop = el.scrollTop
           scrollHeight = el.scrollHeight
           clientHeight = el.clientHeight
       }
   }

   const timelineHeight = timelineRef.value.clientHeight
   
   // Map scroll position to viewport indicator
   // 在缩放模式下，viewport indicator 需要映射到缩放后的坐标系
   
   const safeScrollHeight = Math.max(scrollHeight, 1)
   const safeScrollable = Math.max(scrollHeight - clientHeight, 1)
   
   // 原始Y坐标 (不含缩放)
   const originalY = (scrollTop / safeScrollHeight) * timelineHeight
   const originalH = (clientHeight / safeScrollHeight) * timelineHeight
   
   // 映射到当前缩放视图
   const screenY = originalY * timelineScale.value + timelineOffset.value
   const screenH = originalH * timelineScale.value
   
   viewportStyle.value = {
      top: `${screenY}px`,
      height: `${screenH}px`
   }
}

const handleTimelineClick = (e: MouseEvent) => {
   // 如果正在拖拽，不触发点击跳转
   if (isDraggingTimeline.value) return
   
   if (!timelineRef.value) return
   const rect = timelineRef.value.getBoundingClientRect()
   const clickY = e.clientY - rect.top
   
   // 逆向映射：屏幕坐标 -> 原始坐标 -> Index
   // screenY = originalY * scale + offset
   // originalY = (screenY - offset) / scale
   
   const originalY = (clickY - timelineOffset.value) / timelineScale.value
   const percentage = Math.max(0, Math.min(1, originalY / rect.height))
   
   const logs = filteredLogs.value
   if (logs.length === 0) return

   // 强制使用 Index 映射
   const index = Math.floor(percentage * (logs.length - 1))
   
   if (listContainer.value) {
      listContainer.value.scrollToIndex(index)
   }
}

const handleTimelineWheel = (e: WheelEvent) => {
   if (!timelineRef.value) return
   const rect = timelineRef.value.getBoundingClientRect()
   const mouseY = e.clientY - rect.top
   
   // 滚轮缩放
   const zoomFactor = 1.1
   const direction = e.deltaY > 0 ? -1 : 1
   const newScale = direction > 0 ? timelineScale.value * zoomFactor : timelineScale.value / zoomFactor
   
   // 限制缩放范围
   const clampedScale = Math.max(1, Math.min(newScale, 20))
   
   // 以鼠标位置为中心缩放
   // mouseWorldY = (mouseY - offset) / scale
   // newOffset = mouseY - mouseWorldY * newScale
   const mouseWorldY = (mouseY - timelineOffset.value) / timelineScale.value
   const newOffset = mouseY - mouseWorldY * clampedScale
   
   // 边界检查 (不允许拖出边界太远)
   const minOffset = rect.height - rect.height * clampedScale
   const maxOffset = 0
   
   timelineScale.value = clampedScale
   timelineOffset.value = Math.min(maxOffset, Math.max(minOffset, newOffset))
   
   drawTimeline()
   onScroll() // Update viewport rect
}

const handleTimelineMouseDown = (e: MouseEvent) => {
   isDraggingTimeline.value = false
   lastMouseY.value = e.clientY
   
   const onMouseMove = (ev: MouseEvent) => {
      isDraggingTimeline.value = true
      const deltaY = ev.clientY - lastMouseY.value
      lastMouseY.value = ev.clientY
      
      const newOffset = timelineOffset.value + deltaY
      
      if (!timelineRef.value) return
      const rect = timelineRef.value.getBoundingClientRect()
      const minOffset = rect.height - rect.height * timelineScale.value
      const maxOffset = 0
      
      timelineOffset.value = Math.min(maxOffset, Math.max(minOffset, newOffset))
      drawTimeline()
      onScroll()
   }
   
   const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      // 小位移不算拖拽
      setTimeout(() => { isDraggingTimeline.value = false }, 0)
   }
   
   window.addEventListener('mousemove', onMouseMove)
   window.addEventListener('mouseup', onMouseUp)
}

</script>

<style scoped>
.timeline-container {
   position: relative;
   width: 100%;
   background: #f0f0f0;
   cursor: pointer;
}
.viewport-container {
   position: absolute;
   top: 0;
   left: 0;
   width: 100%;
   height: 100%;
   overflow: hidden;
   pointer-events: none;
}
.timeline-viewport {
   position: absolute;
   left: 0;
   right: 0;
   background: rgba(0, 0, 0, 0.1);
   border: 1px solid rgba(0, 0, 0, 0.3);
   pointer-events: none; 
   /* Let clicks pass through to container */
}
.file-input-section {
   padding: 15px;
   border: 1px dashed #d1c4e9;
   border-radius: 8px;
   background-color: #f3e5f5;
   text-align: center;
   cursor: pointer;
   transition: all 0.3s ease;
}
.file-input-section:hover {
   background-color: #ede7f6;
   border-color: #b39ddb;
}
.placeholder {
   color: #9e9e9e;
   display: flex;
   flex-direction: column;
   align-items: center;
   gap: 5px;
}
.stat-item {
   display: flex;
   justify-content: space-between;
   padding: 4px 0;
   font-size: 12px;
}
.stat-count {
   background: #f3e5f5;
   padding: 1px 6px;
   border-radius: 8px;
   color: #6a1b9a;
}
.flex-layout {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 20px);
}
.top-section {
  flex-shrink: 0;
}
.main-grid {
  flex: none;
}
.h-full {
  height: 100%;
}
.flex {
  display: flex;
}
.flex-col {
  flex-direction: column;
}
.flex-1 {
  flex: 1;
}
.min-h-0 {
  min-height: 0;
}
.flex-shrink-0 {
  flex-shrink: 0;
}
</style>

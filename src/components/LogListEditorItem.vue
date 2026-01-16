<template>
  <div class="log-entry" :style="itemStyle" :id="'log-item-' + index">
      <n-flex align="center" class="mb-1">
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
import { computed } from 'vue'
import { NFlex, NCheckbox, NText, NInput, NButton } from 'naive-ui'

const props = defineProps<{
  source: any
  index: number
  getColor: (key: string) => string
  onDelete: (index: number) => void
  onInsert: (index: number) => void
  onChange: () => void
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

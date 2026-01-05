<template>
  <div style="width: 1000px; margin: 0 auto; max-width: 100%; padding-bottom: 3rem">
    <n-flex size="small" justify="space-between" align="center" class="my-2">
      <n-text>海豹染色器 工作台</n-text>
      <n-button size="small" @click="back">返回主界面</n-button>
    </n-flex>

    <n-card title="导出设置" size="small" class="mb-3">
      <n-space vertical>
        <n-input v-model:value="title" placeholder="导出标题（同时作为默认文件名）" />
        <n-space align="center">
          <n-text>气泡颜色:</n-text>
          <n-color-picker v-model:value="bubbleColor" :show-alpha="false" style="width: 150px" />
          <n-input v-model:value="iconSizeStr" placeholder="头像尺寸（px）" style="width: 12rem" />
        </n-space>
        <n-space align="center">
          <n-text>纸张底色:</n-text>
          <n-color-picker v-model:value="containerColor" :show-alpha="false" style="width: 150px" />
          <n-text>透明度:</n-text>
          <n-slider v-model:value="containerOpacity" :step="1" :min="0" :max="100" style="width: 150px" />
          <n-text>{{ containerOpacity }}%</n-text>
        </n-space>
        <n-space align="center">
          <n-text>全局背景色:</n-text>
          <n-color-picker v-model:value="globalBackgroundColor" :show-alpha="false" style="width: 150px" />
        </n-space>
        <n-space>
          <n-button @click="() => bgInput?.click()">设置全局背景图</n-button>
          <input ref="bgInput" type="file" accept="image/*" style="display:none" @change="onBgChange" />
          
          <n-button @click="() => containerBgInput?.click()">设置纸张背景</n-button>
          <input ref="containerBgInput" type="file" accept="image/*" style="display:none" @change="onContainerBgChange" />

          <n-button @click="() => bubbleBgInput?.click()">设置气泡背景图</n-button>
          <input ref="bubbleBgInput" type="file" accept="image/*" style="display:none" @change="onBubbleBgChange" />
        </n-space>
      </n-space>
    </n-card>

    <n-card title="角色差分管理" size="small">
      <n-space vertical>
        <div v-for="pc in pcs" :key="pc.IMUserId">
          <n-space>
            <n-avatar :src="pc.avatar" :size="48" />
            <n-text>{{ pc.name }}（{{ pc.IMUserId }}）</n-text>
            <n-button size="small" @click="() => avatarInputs[pc.IMUserId]?.click()">上传默认头像</n-button>
            <input :ref="
            el => avatarInputs[pc.IMUserId] = el as HTMLInputElement
            " type="file" accept="image/*" style="display:none" @change="(e) => onAvatarChange(e, pc.name)" />
          </n-space>
          <n-space class="mt-1">
            <n-input v-model:value="newExpTag[pc.name]" placeholder="差分标签" style="width: 12rem" />
            <n-button size="small" @click="() => expInputs[pc.name]?.click()">上传差分</n-button>
            <input :ref="
            el => expInputs[pc.name] = el as HTMLInputElement
            " type="file" accept="image/*" style="display:none" @change="(e) => onExpChange(e, pc.name)" />
          </n-space>
          <n-space wrap>
            <n-tag v-for="(url, tag) in expressionsMap[pc.name]" :key="tag" closable @close="() => removeExp(pc.name, tag)">{{ tag }}</n-tag>
          </n-space>
          <n-divider />
        </div>
      </n-space>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { NFlex, NText, NButton, NSpace, NCard, NInput, NColorPicker, NAvatar, NTag, NDivider, useMessage, NSlider } from 'naive-ui'
import { useStore } from '~/store'

const emit = defineEmits(['close'])
const store = useStore()
const message = useMessage()
store.workbenchLoad()
const title = ref(store.workbench.title)
// const bubbleMaxWidthStr = ref(String(store.workbench.bubbleMaxWidth))
const bubbleColor = ref(store.workbench.bubbleColor)
const containerColor = ref(store.workbench.containerColor)
const containerOpacity = ref(store.workbench.containerOpacity)
const globalBackgroundColor = ref(store.workbench.globalBackgroundColor)
const iconSizeStr = ref(String(store.workbench.iconSize))

// Watchers for auto-save
watch(title, (v) => { store.workbench.title = v; store.workbenchSave() })
// watch(bubbleMaxWidthStr, (v) => { 
//   const n = parseInt(v); 
//   if(!isNaN(n)) { store.workbench.bubbleMaxWidth = n; store.workbenchSave() } 
// })
watch(bubbleColor, (v) => { store.workbench.bubbleColor = v; store.workbenchSave() })
watch(containerColor, (v) => { store.workbench.containerColor = v; store.workbenchSave() })
watch(containerOpacity, (v) => { store.workbench.containerOpacity = v; store.workbenchSave() })
watch(globalBackgroundColor, (v) => { store.workbench.globalBackgroundColor = v; store.workbenchSave() })
watch(iconSizeStr, (v) => {
    const n = parseInt(v); 
    if(!isNaN(n)) { store.workbench.iconSize = n; store.workbenchSave() } 
})

const bgInput = ref<HTMLInputElement | null>(null)
// let bgInput: HTMLInputElement | null = null
// function setBgInputRef(el: any) { bgInput = el as HTMLInputElement }
async function onBgChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files && input.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => { 
    store.workbench.backgroundImage = reader.result as string; 
    store.workbenchSave(); 
    input.value = '';
    message.success('全局背景图已上传')
  }
  reader.readAsDataURL(file)
}

const containerBgInput = ref<HTMLInputElement | null>(null)
async function onContainerBgChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files && input.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => { 
    store.workbench.containerBackgroundImage = reader.result as string; 
    store.workbenchSave(); 
    input.value = '';
    message.success('纸张背景已上传')
  }
  reader.readAsDataURL(file)
}

const bubbleBgInput = ref<HTMLInputElement | null>(null)
// let bubbleBgInput: HTMLInputElement | null = null
// function setBubbleBgInputRef(el: any) { bubbleBgInput = el as HTMLInputElement }
async function onBubbleBgChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files && input.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => { 
    store.workbench.bubbleBackgroundImage = reader.result as string; 
    store.workbenchSave(); 
    input.value = '';
    message.success('气泡背景图已上传')
  }
  reader.readAsDataURL(file)
}

const pcs = computed(() => store.pcList)
const expressionsMap = computed(() => {
  const m: Record<string, Record<string,string>> = {}
  for (const pc of pcs.value) m[pc.name] = store.workbench.pcNameExpressionsMap.get(pc.name) || {}
  return m
})

const newExpTag = ref<Record<string,string>>({})
const avatarInputs: Record<string, HTMLInputElement | null> = {}
const expInputs: Record<string, HTMLInputElement | null> = {}

function onAvatarChange(e: Event, name: string) {
  const input = e.target as HTMLInputElement
  const file = input.files && input.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => { store.setAvatar(name, reader.result as string); input.value = '' }
  reader.readAsDataURL(file)
}

function onExpChange(e: Event, name: string) {
  const input = e.target as HTMLInputElement
  const file = input.files && input.files[0]
  const tag = newExpTag.value[name]
  if (!file || !tag) return
  const reader = new FileReader()
  reader.onload = () => { store.setExpression(name, tag, reader.result as string); input.value = ''; newExpTag.value[name] = '' }
  reader.readAsDataURL(file)
}

function removeExp(name: string, tag: string) { store.removeExpression(name, tag) }
function back() { location.hash = ''; emit('close'); }
</script>

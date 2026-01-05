<template>
  <div id="bubble-preview" v-show="isShow" class="preview list-dynamic" :style="varsStyle">
    <div class="list-dynamic">
      <preview-bubble-item v-for="i in previewItems" :key="i.index" :source="i" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PreviewBubbleItem from './preview-bubble-item.vue'
import { useStore } from '~/store'
const props = defineProps<{ isShow: boolean, previewItems: any[] }>()
const store = useStore()
const varsStyle = computed(() => ({
  '--bubble-max-width': store.workbench.bubbleMaxWidth + '%',
  '--bubble-bg-color': store.workbench.bubbleColor,
  '--bubble-right-bg-color': store.workbench.rightBubbleColor,
  '--bubble-arrow-color': store.workbench.bubbleColor,
  '--bubble-right-arrow-color': store.workbench.rightBubbleColor,
  '--icon-size': store.workbench.iconSize + 'px',
  '--text-edge-color': store.workbench.textEdgeColor
}))
</script>


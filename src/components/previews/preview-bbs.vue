<template>


  <div class="preview" ref="preview" id="preview" v-show="isShow">
      <BbsList 
      :data="previewItems" 
      :containerHeight="400"
      :buffer="10"
      >
        <template #item="{ item, index }">
          <BBSItem :key="`${item.index}-${optionsKey}`" :source="item" :global-index="index" />
        </template>
      </BbsList>          
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed, h, nextTick, onMounted, render, watch } from 'vue';
import { useStore } from '~/store';
import { LogItem, packNameId } from '~/logManager/types';
// @ts-ignore
import VirtualList from 'vue3-virtual-scroll-list';
import BbsList from './bbs-list.vue'
import BBSItem from '~/components/previews/preview-bubble-item.vue'
import { useMessage } from 'naive-ui';

const props = defineProps<{
  isShow: boolean,
  previewItems: LogItem[],
}>();

const store = useStore();
const message = useMessage();

const optionsKey = computed(() => {
  const o = store.exportOptions
  return [
    o.commandHide ? '1' : '0',
    o.imageHide ? '1' : '0',
    o.offTopicHide ? '1' : '0',
    o.timeHide ? '1' : '0',
    o.yearHide ? '1' : '0',
    o.userIdHide ? '1' : '0',
    o.textIndentFirst ? '1' : '0',
  ].join('')
})

onMounted(() => {
  console.log(props)
})

</script>
<style scoped>
/* .preview{
  height: 400px
} */
</style> 

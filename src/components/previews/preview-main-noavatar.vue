<template>
  <div id="preview" v-show="isShow" class="preview list-dynamic">
    <div>
      <div class="list-dynamic">
        <div class="list-item-dynamic" v-for="i of previewItems" :key="i.index">
          <preview-main-item-noavatar :source="i" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { LogItem } from '~/logManager/types'
import PreviewMainItemNoavatar from './preview-main-item-noavatar.vue'

defineProps<{ isShow: boolean, previewItems: LogItem[] }>()
</script>


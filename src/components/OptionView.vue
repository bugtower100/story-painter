<script setup lang="ts">
import { NSwitch } from 'naive-ui';
import { useStore } from '~/store';

const option_store = useStore().exportOptions

interface Option {
  label: string
  desc: string
  key: keyof typeof option_store
}

const list: Option[] = [
  {
    label: "骰子指令过滤",
    desc: "开启后，不显示pc指令，正常显示指令结果",
    key: 'commandHide',
  },
  {
    label: "表情图片过滤",
    desc: "开启后，文本内所有的表情包和图片将被豹豹藏起来不显示",
    key: 'imageHide',
  },
  {
    label: "场外发言过滤",
    desc: "开启后，所有以(和（为开头的发言将被豹豹吃掉不显示",
    key: 'offTopicHide',
  },
  {
    label: "时间显示过滤",
    desc: "开启后，日期和时间会被豹豹丢入海里不显示",
    key: 'timeHide',
  },
  {
    label: "平台帐号隐藏",
    desc: "开启后，IM 平台账号（如 QQ 号）将在导出结果中不显示",
    key: 'userIdHide',
  },
  {
    label: "年月日不展示",
    desc: "开启后，导出结果的日期将只显示几点几分(如果可能)",
    key: 'yearHide',
  },
  {
    label: "首行缩进对齐",
    desc: "开启后，缩进将以名字为基准进行对齐",
    key: 'textIndentFirst',
  },
]
</script>

<template>
  <div class="sp-options">
    <label v-for="opt in list" :key="opt.key" class="sp-option" :title="opt.desc">
      <span>{{ opt.label }}</span>
      <n-switch v-model:value="option_store[opt.key]" size="small" :aria-label="opt.label" />
    </label>
  </div>
</template>

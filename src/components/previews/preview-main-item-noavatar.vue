<template>
  <div class="list-item-dynamic">
    <span style="color: #aaa" class="_time" v-if="!store.exportOptions.timeHide">{{ timeSolve(source) }}</span>
    <span :style="{ 'color': colorByName(source) }" class="_nickname">{{ nicknameSolve(source) }}</span>
    <div :style="{ 'color': colorByName(source) }" v-html="previewMessageSolve(source)"></div>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { LogItem, packNameId } from '~/logManager/types';
import { useStore } from '~/store';
import { escapeHTML, getCanvasFontSize, getTextWidth, msgCommandFormat, msgImageFormat, msgIMUseridFormat, msgOffTopicFormat, msgAtFormat } from '~/utils';

const store = useStore();

defineProps({
  source: {
    type: Object as () => LogItem,
    default: () => { },
  },
});

const colorByName = (i: LogItem) => {
  const info = store.pcMap.get(packNameId(i));
  return info?.color;
}

const nicknameSolve = (i: LogItem) => {
  let userid = '(' + i.IMUserId + ')'
  const options = store.exportOptions
  if (options.userIdHide) {
    userid = ''
  }
  return `<${i.nickname}${userid}>:`
}

const timeSolve = (i: LogItem) => {
  let timeText = i.time.toString()
  const options = store.exportOptions
  if (options.timeHide) {
    timeText = ''
  } else {
    if (typeof i.time === 'number' && i.time !== 0) {
      timeText = dayjs.unix(i.time).format(options.yearHide ? 'HH:mm:ss' : 'YYYY/MM/DD HH:mm:ss')
    } else {
      if (i.timeText) {
        timeText = i.timeText
      } else {
        timeText = dayjs.unix(i.time).format(options.yearHide ? 'HH:mm:ss' : 'YYYY/MM/DD HH:mm:ss')
      }
    }
  }
  return timeText
}

const nameReplace = (msg: string) => {
  for (let i of store.pcList) {
    msg = msg.replaceAll(`<${i.name}>`, `${i.name}`)
  }
  return msg
}

let canvasFontSize = ''

const previewMessageSolve = (i: LogItem) => {
  const id = packNameId(i);
  if (store.pcMap.get(id)?.role === '隐藏') return '';

  const rawMessage = (i.message || '').replaceAll(/<br\s*\/?>/gi, '\n')
  let msg = msgImageFormat(escapeHTML(rawMessage), store.exportOptions, true);
  msg = msgAtFormat(msg, store.pcList);
  msg = msgOffTopicFormat(msg, store.exportOptions, i.isDice);
  msg = msgCommandFormat(msg, store.exportOptions);
  msg = msgIMUseridFormat(msg, store.exportOptions, i.isDice);
  msg = msgOffTopicFormat(msg, store.exportOptions, i.isDice);

  const prefix = (!store.exportOptions.timeHide ? `${timeSolve(i)}` : '') + nicknameSolve(i)
  if (i.isDice) {
    msg = nameReplace(msg)
  }

  let length = 0;
  if (store.exportOptions.textIndentFirst) {
    if (canvasFontSize === '') {
      const el = document.getElementById('preview');
      if (el) {
        canvasFontSize = getCanvasFontSize(el);
      } else {
        canvasFontSize = getCanvasFontSize(document.body); 
      }
    }
    length = getTextWidth(prefix, canvasFontSize);
    const lines = msg.split('\n')
    if (lines.length <= 1) return msg
    return lines
      .map((line, idx) => {
        if (idx === 0) return line
        if (!line) return '<p style="margin-top: 0; margin-bottom: 0">&nbsp;</p>'
        return `<p style="text-indent: ${length}px; margin-top: 0; margin-bottom: 0">${line}</p>`
      })
      .join('')
  }
  return msg.replaceAll('\n', '<br />')
}
</script>

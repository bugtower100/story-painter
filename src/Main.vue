<template>
  <div class="sp-app" :class="{ 'is-workbench': showWorkbench }">
    <a class="sp-skip" href="#story-editor">跳到日志编辑区</a>
    <header v-show="!showWorkbench" class="sp-header">
      <div class="sp-brand">
        <OrbitMark class="sp-brand-mark" />
        <div><strong>Story Painter</strong></div>
        <span class="sp-version">v2.5.5</span>
      </div>
      <nav class="sp-header-actions" aria-label="站点导航">
        <a href="https://github.com/bugtower100/story-painter" target="_blank" rel="noopener noreferrer" aria-label="GitHub 源码" class="sp-icon-button"><n-icon :size="20"><logo-github /></n-icon></a>
        <button class="sp-icon-button" :aria-label="isDark ? '切换浅色模式' : '切换深色模式'" :title="isDark ? '切换浅色模式' : '切换深色模式'" @click="toggleDark()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path v-if="!isDark" d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z"/><g v-else><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></g></svg>
        </button>
        <a class="sp-header-link" href="https://dice.weizaima.com" target="_blank" rel="noopener noreferrer">海豹官网 ↗</a>
      </nav>
    </header>

    <main class="sp-page">
      <section v-show="!showWorkbench" class="sp-intro" aria-labelledby="page-title">
        <div class="sp-intro-copy">
          <h1 id="page-title">跑团log染色器-pry改版</h1>
          <p>导入日志 · 角色染色 · 编辑预览 · 多格式导出</p>
        </div>
        <div class="sp-intro-art" aria-hidden="true"><OrbitMark /><span class="sp-star sp-star-one">✦</span><span class="sp-star sp-star-two">✧</span><span class="sp-star sp-star-three">·</span></div>
        <WisteriaDecoration />
      </section>

      <div v-show="!showWorkbench" class="sp-workspace">
        <aside class="sp-sidebar" aria-label="日志设置">
          <nav v-if="store.pcList.length > 5" class="sp-settings-nav" aria-label="设置快捷跳转"><a href="#character-settings">角色</a><a href="#layout-settings">过滤排版</a><a href="#export-settings">导出log</a></nav>
          <details id="character-settings" class="sp-panel" open>
            <summary class="sp-section-heading"><span><span class="sp-section-number">01</span>角色与配色</span><span class="sp-count">{{ store.pcList.length }} 位角色</span></summary>
            <div class="sp-panel-body">
              <div class="sp-section-note"><button class="sp-text-button" @click="refreshColors">刷新色板 ↻</button></div>
              <p class="sp-hint sp-identity-hint">修改后点保存；同名、同 ID 的角色会合并。</p>
              <n-input v-if="store.pcList.length > 5" v-model:value="characterQuery" size="small" clearable placeholder="搜索名字或 ID" :input-props="{ 'aria-label': '搜索角色' }" class="sp-character-search" />
              <div id="character-list" class="sp-character-list" :class="{ 'is-expanded': charactersExpanded }" tabindex="0" role="region" aria-label="角色列表，可在此区域滚动">
                <div v-for="{ character: i, index } in visibleCharacters" :key="i.IMUserId + ':' + index" class="sp-character">
                  <span class="sp-avatar" :style="{ '--character-color': i.color }">
                    <img v-if="i.avatar" :src="i.avatar" alt="" /><span v-else>{{ i.name.slice(0, 1) }}</span>
                  </span>
                  <div class="sp-character-info">
                    <CharacterIdentityEditor :character="i" @save="(name, account) => saveCharacterIdentity(i, name, account)" />
                  </div>
                  <n-color-picker v-model:value="i.color" class="sp-character-color" :show-alpha="false" :swatches="colors" :on-update:value="(v) => colorChanged(v, i)" :aria-label="i.name + ' 的颜色'">
                    <template #label><span class="sr-only">{{ i.color }}</span></template>
                  </n-color-picker>
                  <div class="sp-character-bottom">
                    <n-select v-model:value="i.role" size="small" :options="roleOptions" :aria-label="i.name + ' 的身份'" />
                    <button class="sp-icon-button sp-delete" :disabled="previewActive" :aria-label="'删除角色 ' + i.name" @click="deletePc(index, i)"><n-icon :size="16"><icon-delete /></n-icon></button>
                  </div>
                </div>
                <p v-if="!store.pcList.length" class="sp-empty">导入或粘贴日志后，角色会出现在这里。</p>
                <p v-else-if="!visibleCharacters.length" class="sp-empty">没有匹配的角色。</p>
              </div>
              <div v-if="visibleCharacters.length > 4" class="sp-character-list-controls">
                <button class="sp-text-button" :aria-expanded="charactersExpanded" aria-controls="character-list" @click="charactersExpanded = !charactersExpanded">{{ charactersExpanded ? '收起角色列表' : '展开更多角色' }}</button>
                <span v-if="visibleCharacters.length > (charactersExpanded ? 8 : 4)" class="sp-hint">↕ 可在列表内滚动</span>
              </div>
              <button class="sp-workbench-link" @click="openWorkbenchFromButton"><span>跑团工作台<small>编辑排版 · 头像差分 · HTML / PDF</small></span><span aria-hidden="true">↗</span></button>
            </div>
          </details>

          <details id="layout-settings" class="sp-panel" open>
            <summary class="sp-section-heading"><span><span class="sp-section-number">02</span>过滤与排版</span><span class="sp-chevron" aria-hidden="true">⌄</span></summary>
            <div class="sp-panel-body"><option-view /></div>
          </details>

          <details id="export-settings" class="sp-panel" open>
            <summary class="sp-section-heading"><span><span class="sp-section-number">03</span>导出log</span><span class="sp-chevron" aria-hidden="true">⌄</span></summary>
            <div class="sp-panel-body sp-export-actions" @click.capture="flushListChanges">
              <button class="sp-button sp-button-primary" @click="exportRecordHTMLSingle"><span>导出 HTML 单文件</span><span class="sp-button-icon" aria-hidden="true">↗</span></button>
              <div class="sp-export-grid">
                <button class="sp-button" @click="exportRecordHTMLZip">HTML 资源包</button>
                <button class="sp-button" @click="exportRecordRaw">原始日志</button>
                <button class="sp-button" @click="exportRecordDOC">Word 文档</button>
                <button class="sp-button" @click="exportRecordTalkDOC">对话 Word</button>
              </div>
              <p class="sp-hint">HTML 导出包含头像、差分和背景。</p>
            </div>
          </details>
        </aside>

        <section id="story-editor" ref="editorPanel" class="sp-editor-panel sp-panel" :style="{ '--sp-editor-min-height': editorMinHeight + 'px' }" aria-labelledby="editor-title" tabindex="-1">
          <div class="sp-editor-heading"><div><h2 id="editor-title">日志编辑与预览</h2></div><span class="sp-status"><i></i>{{ loading ? '正在载入日志' : '准备就绪' }}</span></div>
          <div class="sp-view-tabs" role="group" aria-label="日志视图">
            <button v-for="view in views" :key="view.id" :aria-pressed="activeView === view.id" :class="{ 'is-active': activeView === view.id }" @click="setView(view.id)">{{ view.label }}</button>
          </div>
          <div class="sp-editor-toolbar">
            <div class="sp-toolbar-actions">
              <div class="sp-import-entry"><button class="sp-button sp-import-button" @click="ccfInput?.click()"><span aria-hidden="true">↥</span> 选择文件导入日志</button><small>TXT / LOG / TRPGLOG / JSON / HTML / SealChat ZIP · 替换当前日志</small></div>
              <button class="sp-button sp-button-small" @click="openAppendImport">追加多个文件</button>
              <button class="sp-text-button" @click="clearText">清空</button>
              <button class="sp-text-button" @click="doFlush">刷新</button>
            </div>
            <n-checkbox v-model:checked="store.doEditorHighlight" @click="doEditorHighlightClick($event)">编辑器染色</n-checkbox>
            <input :ref="setCcfInputRef" type="file" accept=".txt,.log,.trpglog,.json,.html,.zip,text/plain,text/html,application/json" hidden @change="onCcfFileChange" />
          </div>
          <n-spin :show="loading" class="sp-editor-body">
            <template #description>正在载入远程日志……</template>
            <div class="sp-editor-content">
              <code-mirror v-show="!previewActive && editorMode === 'text'" ref="editor" @change="onChange" />
              <Teleport v-if="listVisited || showWorkbench" defer :to="showWorkbench ? '#workbench-list-editor' : 'body'" :disabled="!showWorkbench">
                <log-list-editor v-show="showWorkbench || (editorMode === 'list' && !previewActive)" ref="listEditor" :initial-content="editorText" :active="showWorkbench || (editorMode === 'list' && !previewActive)" :source-name="sourceName" :document-version="documentVersion" @update:content="onListEditorUpdate" />
              </Teleport>
              <preview-main-noavatar :is-show="isShowPreview" :preview-items="previewItems" />
              <preview-bbs :is-show="isShowPreviewBBS" :preview-items="previewItems" />
              <preview-trg :is-show="isShowPreviewTRG" :preview-items="previewItems" />
            </div>
          </n-spin>
          <div class="sp-editor-footer"><span>{{ store.pcList.length }} 位角色<span class="sp-footer-dot">·</span>{{ editorText.length.toLocaleString() }} 字符</span><span>本地导入：海豹、青果、溯洄、QQ、CCF、SealChat</span></div>
        </section>
      </div>
      <ccfolia-workbench v-if="showWorkbench" :items="logMan.curItems" :outline="listEditor?.outline || []" :channel-names="listEditor?.channelNames || []" @close="closeWorkbench" @edit-entry="index => listEditor?.revealIndex(index)" @reorder="(from, to, after) => listEditor?.reorderByIndex(from, to, after)" @set-expression="(index, tag) => listEditor?.setExpressionByIndex(index, tag)" @update-text="(index, text) => listEditor?.updateTextByIndex(index, text)" @set-window="(index, channel) => listEditor?.setWindowByIndex(index, channel)" @browse-channel="channel => listEditor?.browseChannel(channel)" @reorder-outline="(id, target, after) => listEditor?.reorderOutline(id, target, after)" @finish-edit="listEditor?.finishEdit()" @flush="flushListChanges" @undo="listEditor?.undo()" @redo="listEditor?.redo()" />
      <footer v-show="!showWorkbench" class="sp-footer"><span>跑团log染色器-pry改版</span><span>Story Painter</span></footer>
    </main>
  </div>
</template>


<script setup lang="ts">
import { nextTick, ref, onMounted, onBeforeUnmount, watch, h, render, renderList, computed } from "vue";
import { useStore } from './store'
import CodeMirror from './components/CodeMirror.vue'
import { debounce, delay } from 'lodash-es'
import { exportFileRaw, exportFileQQ, exportFileIRC, exportFileDoc, exportFileHtmlBubbleSingle, exportFileHtmlBubbleZip } from "./utils/exporter";
import { strFromU8, unzlibSync } from 'fflate';
import { unzipSync } from 'fflate'
import uaParser from 'ua-parser-js'

import { logMan } from './logManager/logManager'
import { ViewUpdate } from "@codemirror/view";
import { TextInfo } from "./logManager/importers/_logImpoter";
import previewMain from "./components/previews/preview-main.vue";
import previewMainNoavatar from "./components/previews/preview-main-noavatar.vue";
import previewBbs from "./components/previews/preview-bbs.vue";
import previewTrg from "./components/previews/preview-trg.vue";
import PreviewItem from './components/previews/preview-main-item.vue'
import PreviewItemNoavatar from './components/previews/preview-main-item-noavatar.vue'
import PreviewTableTR from './components/previews/preview-table-tr.vue'
import PreviewTableTRNoavatar from './components/previews/preview-table-tr-noavatar.vue'
import { LogItem, CharItem, packNameId } from "./logManager/types";
import { setCharInfo } from './logManager/importers/_logImpoter'
import { applyQQImageRKeyReplacement, shouldApplyQQImageRKeyReplacement, msgCommandFormat, msgImageFormat, msgIMUseridFormat, msgOffTopicFormat, msgAtFormat } from "./utils";
import { NButton, useMessage, useModal, useNotification } from "naive-ui";
import { LogoGithub, Delete as IconDelete } from '@vicons/carbon'
import { useDark, useToggle } from '@vueuse/core'
import OptionView from "./components/OptionView.vue";
import randomColor from "randomcolor";

import { parquetReadObjects } from 'hyparquet'
import { asyncBufferFrom } from 'hyperparam'
import { compressors } from 'hyparquet-compressors'
import CcfoliaWorkbench from './pages/CcfoliaWorkbench.vue'
import { readLogFile } from './logManager/importers/SealChatLogImporter'
import OrbitMark from './components/OrbitMark.vue'
import WisteriaDecoration from './components/WisteriaDecoration.vue'
import LogListEditor from './pages/LogListEditor.vue'
import CharacterIdentityEditor from './components/CharacterIdentityEditor.vue'

const listEditor = ref<InstanceType<typeof LogListEditor> | null>(null)
const listVisited = ref(false)
const sourceName = ref('当前日志')
const documentVersion = ref(0)
let syncingList = false
const flushListChanges = () => listEditor.value?.flushPendingChanges()
const openAppendImport = async () => { setView('list'); await nextTick(); listEditor.value?.openImport() }
const characterQuery = ref('')
const charactersExpanded = ref(false)
const editorPanel = ref<HTMLElement>()
const editorMinHeight = ref(0)
let editorSizeObserver: ResizeObserver | undefined
onMounted(() => {
  // Keep the desktop editing area at its expanded size when sidebar sections close.
  editorSizeObserver = new ResizeObserver(() => {
    if (window.innerWidth > 800 && editorPanel.value) {
      editorMinHeight.value = Math.max(editorMinHeight.value, editorPanel.value.offsetHeight)
    }
  })
  if (editorPanel.value) editorSizeObserver.observe(editorPanel.value)
})
onBeforeUnmount(() => editorSizeObserver?.disconnect())
const visibleCharacters = computed(() => store.pcList.map((character, index) => ({ character, index })).filter(({ character }) => !characterQuery.value.trim() || `${character.name} ${character.IMUserId}`.toLocaleLowerCase().includes(characterQuery.value.trim().toLocaleLowerCase())))
watch(() => store.pcList.length, count => { if (count <= 5) characterQuery.value = '' })
const roleOptions = ['主持人', '角色', '骰子', '隐藏'].map(role => ({ value: role, label: role }))
const views = [
  { id: 'text', label: '文本编辑' }, { id: 'list', label: '列表编辑' },
  { id: 'preview', label: '阅读预览' }, { id: 'workbench', label: '跑团工作台' },
  { id: 'bbs', label: '论坛代码' }, { id: 'trg', label: '回声工坊' },
] as const
type StoryView = typeof views[number]['id']
const previewActive = computed(() => isShowPreview.value || isShowPreviewBBS.value || isShowPreviewTRG.value)
const activeView = computed<StoryView>(() => isShowPreview.value ? 'preview' : isShowPreviewBBS.value ? 'bbs' : isShowPreviewTRG.value ? 'trg' : editorMode.value)
const setView = (view: StoryView) => {
  if (view === 'workbench') { openWorkbenchFromButton(); return }
  flushListChanges()
  if (view === 'list') listVisited.value = true
  isShowPreview.value = view === 'preview'
  isShowPreviewBBS.value = view === 'bbs'
  isShowPreviewTRG.value = view === 'trg'
  if (view === 'text' || view === 'list') editorMode.value = view
  else {
    if (view === 'bbs' || view === 'trg') store.exportOptions.imageHide = true
    showPreview()
  }
}

const showWorkbench = ref(false)
watch(showWorkbench, visible => { if (visible) listVisited.value = true })
const editorMode = ref<'text' | 'list'>('text')
const openWorkbench = () => { flushListChanges(); listVisited.value = true; showWorkbench.value = true }
const closeWorkbench = () => { flushListChanges(); showWorkbench.value = false }
const openWorkbenchFromButton = () => {
  openWorkbench()
  window.location.hash = '#workbench'
}
window.addEventListener('hashchange', () => {
  showWorkbench.value = location.hash === '#workbench'
})

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 255, g: 255, b: 255 };
}

const contentStyle = computed(() => {
  const style: any = {}
  if (store.workbench.globalBackgroundColor) style.backgroundColor = store.workbench.globalBackgroundColor
  if (store.workbench.backgroundImage) {
    style.backgroundImage = `url(${store.workbench.backgroundImage})`
    style.backgroundSize = 'cover'
    style.backgroundAttachment = 'fixed'
  }
  return style
})

const containerStyle = computed(() => {
   const rgb = hexToRgb(store.workbench.containerColor || '#ffffff')
   const rgba = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${(store.workbench.containerOpacity !== undefined ? store.workbench.containerOpacity : 90) / 100})`
   const style: any = {
     width: '1000px',
     margin: '0 auto',
     maxWidth: '100%',
     paddingBottom: '3rem',
     backgroundColor: rgba
   }
   if (store.workbench.containerBackgroundImage) {
     style.backgroundImage = `url(${store.workbench.containerBackgroundImage})`
     style.backgroundSize = 'cover'
     style.backgroundRepeat = 'no-repeat'
   }
   return style
})

const isDark = useDark()
const toggleDark = useToggle(isDark)

// import { ColorPicker } from 'vue-color-kit'
// import 'vue-color-kit/dist/vue-color-kit.css'

const message = useMessage()
const modal = useModal()
const notification = useNotification()

const loading = ref<boolean>(false)

const isMobile = ref(false)
const downloadUsableRank = ref(0)

const isShowPreview = ref(false)
const isShowPreviewBBS = ref(false)
const isShowPreviewTRG = ref(false)

const colors = ref<string[]>([])
const refreshColors = () => {
  colors.value = randomColor({ count: 16 })
  message.success("色板刷新成功！", { duration: 800 })
}

const colorChanged = debounce((v: string, i: CharItem) => {
  i.color = v
  store.pcNameColorMap.set(i.name, v)
  store.colorMapSave();
}, 300)


let ccfInput: HTMLInputElement | null = null
function setCcfInputRef(el: any) { ccfInput = el as HTMLInputElement }
async function onCcfFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files && input.files[0]
  if (!file) return
  let text: string
  try { text = await readLogFile(file) }
  catch (error) { message.error((error as Error).message); input.value = ''; return }
  setView('text')
  sourceName.value = file.name
  documentVersion.value++
  store.pcList.length = 0
  logMan.lastText = ''
  logMan.syncChange(text, [0, store.editor.state.doc.length], [0, text.length])
  input.value = ''
}

// 清空文本
const clearText = () => {
  setView('text')
  sourceName.value = '当前日志'
  documentVersion.value++
  store.editor.dispatch({
    changes: { from: 0, to: store.editor.state.doc.length, insert: '' }
  })
}

const doFlush = () => {
  flushListChanges()
  console.log('flush')
  logMan.flush();
}

function setupUA() {
  const parser = new uaParser.UAParser()
  parser.setUA(navigator.userAgent)
  const deviceType = parser.getDevice()

  const browser = parser.getBrowser().name
  downloadUsableRank.value = 1

  isMobile.value = deviceType.type === 'mobile'
  if (deviceType.type === 'mobile') {
    // 经测可以使用的
    switch (browser) {
        // case '360 Browser': // 手机360 但是手机360无特征，自己是Chrome WebView
        // 手机:X浏览器 Chrome WebView无特征
      case 'Edge':
      case 'Chrome':
      case 'Chromium':
      case 'Firefox':
      case 'MIUI Browser':
      case 'Opera':
        downloadUsableRank.value = 2
    }

    // 经测无法使用的
    switch (browser) {
      case 'baiduboxapp': // 手机:百度浏览器
      case 'QQBrowser': // 手机:搜狗浏览器极速版，手机:QQ浏览器
        // 手机:万能浏览器，Chrome WebView无特征，会直接崩溃
      case 'UCBrowser': // 手机:UC浏览器
      case 'Quark': // 手机:夸克
        // 手机:Via浏览器，Chrome WebView无特征，会直接崩溃
      case 'QQ': // 手机:QQ
      case 'WeChat':
        downloadUsableRank.value = 0
    }
  }
}

setupUA()

const applyQQImageRKey = async (text: string) => {
  if (!shouldApplyQQImageRKeyReplacement(text)) {
    return text
  }

  try {
    const payload = await store.tryFetchRKey()
    return applyQQImageRKeyReplacement(text, payload)
  } catch (e) {
    console.log(e)
    return text
  }
}

const browserAlert = () => {
  if (downloadUsableRank.value === 0) {
    message.warning('你目前所使用的浏览器无法下载文件，请更换对标准支持较好的浏览器。建议使用Chrome/Firefox/Edge')
  }
  if (downloadUsableRank.value === 1) {
    if (isMobile.value) {
      message.warning('你目前所使用的浏览器可能在下载文件时遇到乱码，或无法下载文件，最好更换对标准支持较好的浏览器。建议使用Chrome/Firefox/Edge')
    }
  }
  // 2 不做提示 因为兼容良好
}




onMounted(async () => {
  if (location.hash === '#workbench') showWorkbench.value = true
  const params = new Proxy(new URLSearchParams(window.location.search), {
    get: (searchParams, prop) => searchParams.get(prop as any)
  })
  const key = (params as any).key
  const password = location.hash.slice(1)

  const showHl = () => {
    setTimeout(() => {
      if (!isMobile.value) {
        store.doEditorHighlight = true
        store.reloadEditor()
      }
    }, 1000)
  }

  if (key && password) {
    loading.value = true
    try {
      const record = await store.tryFetchLog(key, password) as {
        client: 'SealDice' | 'Parquet',
        created_at: string,
        data: string,
        name: string,
        note: string,
        updated_at: string,
      }

      switch(record.client) {
        case 'Parquet' : {
          const uint8 = Uint8Array.from(atob(record.data), c => c.charCodeAt(0))
          const asyncBuffer = await asyncBufferFrom({file: new File([uint8],'default'),byteLength:uint8.byteLength})
          const res = await parquetReadObjects({
            file:asyncBuffer,
            compressors,
          })
          const items = res.map(v => {
            v.id = Number(v.id)
            v.time = Number(v.time)
            v.commandId = Number(v.commandId)
            return v
          })
          const rawText = JSON.stringify({
            items,
            version: 105
          })
          const text = await applyQQImageRKey(rawText)
          nextTick(() => {
            store.pcList.length = 0
    
            logMan.lastText = '';
            logMan.syncChange(text, [0, store.editor.state.doc.length], [0, text.length])
          });
        }
        break
        case 'SealDice': 
        default:
        {
          const log = unzlibSync(Uint8Array.from(atob(record.data), c => c.charCodeAt(0)));

          const rawText = strFromU8(log)
          const text = await applyQQImageRKey(rawText)
          nextTick(() => {
            store.pcList.length = 0

            logMan.lastText = '';
            logMan.syncChange(text, [0, store.editor.state.doc.length], [0, text.length])

          });
        }
        break
      }


      loading.value = false
      showHl()
    } catch (e) {
      console.log(e)
      notification['error']({
        content: '错误',
        meta: '加载日志失败，可能是序号或密码不正确',
        duration: 5000
      })
      loading.value = false
      browserAlert()
      return true
    }
  } else {
    store.editor.dispatch({
      changes: { from: 0, to: store.editor.state.doc.length, insert: store.editor.state.doc.toString() }
    })
    showHl()
  }

  // cminstance.value = cmRefDom.value?.cminstance;
  // cminstance.value?.focus();
  // console.log(cminstance.value)
  colors.value = randomColor({ count: 16 })
  browserAlert()
  await nextTick(() => {
    setTimeout(() => {
      doFlush()
    }, 3000)
  })
});

function exportRecordRaw() {
  browserAlert()
  exportFileRaw(store.editor.state.doc.toString())
}

function exportRecordQQ() {
  browserAlert()
  showPreview()
  exportFileQQ(previewItems.value, store.exportOptions)
}

function exportRecordIRC() {
  browserAlert()
  showPreview()
  exportFileIRC(previewItems.value, store.exportOptions)
}

function exportRecordDOC() {
  browserAlert()
  if (isMobile.value) {
    message.warning('你当前处于移动端环境，已知只有WPS能够查看生成的Word文件，且无法看图！使用PC打开可以查看图片。')
  }

  const solveImg = (el: Element) => {
    if (el.tagName === 'IMG') {
      let width = el.clientWidth;
      let height = el.clientHeight;
      if (width === 0) {
        width = 300;
        height = 300;
      }
      el.setAttribute('width', `${width}`)
      el.setAttribute('height', `${height}`)
    }
    for (let i = 0; i < el.children.length; i += 1) {
      solveImg(el.children[i])
    }
  }

  const map = store.pcMap;
  const el = document.createElement('span');
  const elRoot = document.createElement('div');
  const items = [];
  let lastGroup = '';

  showPreview()
  for (let i of previewItems.value) {
    if (i.isRaw) continue;
    const id = packNameId(i);
    if (map.get(id)?.role === '隐藏') continue;

    if (i.groupName && i.groupName !== lastGroup) {
      items.push(`<div style="width: 100%; background-color: #e6f7ff; color: #000; font-family: 'SimSun', serif; font-size: 12pt; text-align: center; padding: 5px 0; margin: 5px 0;">${i.groupName}</div>`);
      lastGroup = i.groupName;
    }

    const html = h(PreviewItemNoavatar, { source: i });
    render(html, el);

    const c = el;
    solveImg(c);
    items.push(c.innerHTML);
  }

  exportFileDoc(items.join('\n'));
}

function exportRecordHTMLSingle() {
  browserAlert()
  showPreview()
  exportFileHtmlBubbleSingle(previewItems.value)
}

function exportRecordHTMLZip() {
  browserAlert()
  showPreview()
  exportFileHtmlBubbleZip(previewItems.value)
}

function exportRecordTalkDOC() {
  browserAlert()
  if (isMobile.value) {
    message.warning('你当前处于移动端环境，已知只有WPS能够查看生成的Word文件，且无法看图！使用PC打开可以查看图片。')
  }

  const solveImg = (el: Element) => {
    if (el.tagName === 'IMG') {
      let width = el.clientWidth;
      let height = el.clientHeight;
      if (width === 0) {
        width = 300;
        height = 300;
      }
      el.setAttribute('width', `${width}`)
      el.setAttribute('height', `${height}`)
    }
    for (let i = 0; i < el.children.length; i += 1) {
      solveImg(el.children[i])
    }
  }

  const map = store.pcMap;
  const el = document.createElement('span');
  const elRoot = document.createElement('div');
  const items = [];
  let lastGroup = '';

  showPreview()
  for (let i of previewItems.value) {
    if (i.isRaw) continue;
    const id = packNameId(i);
    if (map.get(id)?.role === '隐藏') continue;

    if (i.groupName && i.groupName !== lastGroup) {
      items.push(`<tr><td colspan="2" style="background-color: #e6f7ff; color: #000; font-family: 'SimSun', serif; font-size: 12pt; text-align: center; padding: 5px 0;">${i.groupName}</td></tr>`);
      lastGroup = i.groupName;
    }

    const html = h(PreviewTableTRNoavatar, { source: i });
    render(html, el);

    const c = el;
    solveImg(c);
    items.push(c.innerHTML);
  }
  exportFileDoc(`<table style="border-collapse: collapse;"><tbody>${items.join('\n')}</tbody></table>`);
}


const previewItems = ref<LogItem[]>([])

function showPreview() {
  let tmp = []
  let index = 0;
  const offTopicHide = store.exportOptions.offTopicHide;
  console.log('当前日志条目数量: ', logMan.curItems.length)

  for (let i of logMan.curItems) {
    if (i.isRaw) continue;

    // // 处理ot
    // if (offTopicHide && !i.isDice) {
    //   const msg = i.message.replaceAll(/^[(（].+?$/gm, '') // 【
    //   if (msg.trim() === '') continue;
    // }
    let msg = msgImageFormat(i.message, store.exportOptions);
    msg = msgAtFormat(msg, store.pcList);
    msg = msgOffTopicFormat(msg, store.exportOptions, i.isDice);
    msg = msgCommandFormat(msg, store.exportOptions);
    msg = msgIMUseridFormat(msg, store.exportOptions, i.isDice);
    msg = msgOffTopicFormat(msg, store.exportOptions, i.isDice); // 再过滤一次
    if (msg.trim() === '') continue;

    i.index = index;
    tmp.push(i);
    index += 1;
  }
  previewItems.value = tmp;
}

const store = useStore()
store.colorMapLoad();
store.avatarMapLoad();
store.workbenchLoad();

const editorText = ref('')
watch(() => store.editor, (ed) => {
  editorText.value = ed?.state?.doc?.toString() || ''
}, { immediate: true })

// 修改ot选项后重建items
watch(() => store.exportOptions.offTopicHide, showPreview)

const editor = ref()
watch(isDark, () => {
  console.log('dark watch')
  store.reloadEditor()
})

const deletePc = (index: number, i: CharItem) => {
  const now = Date.now();
  if (now - lastNameChange < 100) return;
  lastNameChange = now;

  const m = modal.create({
    title: '删除角色',
    preset: 'card',
    style: {
      width: '30rem',
    },
    content: `即将删除角色「${i.name}」及其全部发言，确定吗？`,
    footer: () => [
      h(
          NButton,
          { type: 'default', onClick: () => m.destroy(), style: { marginRight: '1rem' } },
          () => '取消',
      ),
      h(
          NButton,
          {
            type: 'primary', onClick: () => {
              try {
                store.pcList.splice(index, 1);
                logMan.deleteByCharItem(i);
              } finally {
                m.destroy()
              }
            }
          },
          () => '确定'
      ),
    ]
  })
}

let lastNameChange = 0;
const saveCharacterIdentity = (character: CharItem, rawName: string, rawAccount: string) => {
  const name = rawName.trim(), account = rawAccount.trim()
  if (!name || /[\r\n]/.test(name) || !account || /[()\r\n]/.test(account)) {
    message.warning('名字和 ID 不能为空；名字不能换行，ID 不能包含括号或换行。')
    return
  }
  if (name === character.name && account === character.IMUserId) return
  flushListChanges()
  const previous = { name: character.name, IMUserId: character.IMUserId }
  const target = store.pcList.find(pc => pc !== character && pc.name === name && pc.IMUserId === account)
  const keepOldName = store.pcList.some(pc => pc !== character && pc.name === previous.name)
  store.renamePcName(previous.name, name, keepOldName)
  store.moveCharacterAssets(previous, name, account)
  if (target) store.pcList = store.pcList.filter(pc => pc !== character)
  else { character.name = name; character.IMUserId = account }
  listEditor.value?.updateCharacterIdentity(previous, name, account)
  // Keep the current role, color and avatar while the editor receives new headers.
  syncingList = true
  try { logMan.changeIdentity(previous, name, account) }
  finally { syncingList = false }
  if (previewActive.value) showPreview()
  message.success(target ? '已合并同名同 ID 的角色，保留目标角色的配色、身份和头像。' : '角色名字和 ID 已更新。')
}


logMan.ev.on('textSet', (text) => {
  editorText.value = text || ''
  store.editor.dispatch({
    changes: { from: 0, to: store.editor.state.doc.length, insert: text }
  });

  let m = new Map<string, CharItem>();
  for (let i of logMan.curItems) {
    if (i.isRaw) continue;
    setCharInfo(m, i);
  }
  store.updatePcList(m);
});

logMan.ev.on('parsed', (ti: TextInfo) => {
  store.importCharacterAssets(ti.characterAssets);
  store.updatePcList(ti.charInfo);
})

const onChange = (v: ViewUpdate) => {
  let payloadText = '';
  if (v) {
    if (v.docChanged) {
      editorText.value = store.editor?.state?.doc?.toString() || ''
      // 有一种我不太清楚的特殊情况会导致二次调用，从而使得pclist清零
      // 看不出明显变化，只是一个隐藏参数flags为0
      // 破案了，是flush
      if (!v.viewportChanged && (v as any).flags === 0) {
        return;
      }

      const ranges = (v as any).changedRanges;
      if (ranges.length) {
        for (let i = ranges.length - 1; i >= 0; i--) {
          const payloadText = store.editor.state.doc.toString()

          const r1 = [ranges[i].fromA, ranges[i].toA];
          const r2 = [ranges[i].fromB, ranges[i].toB];

          console.log('XXX', v, r1, r2);
          if (!syncingList && r1[0] === 0 && r1[1] === logMan.lastText.length) {
            console.log('全部文本被删除，清除pc列表');
            store.pcList = [];
          }
          logMan.syncChange(payloadText, r1, r2);
        }
      }
    }
  }

  // payloadText = store.editor.state.doc.toString()
  // let isLog = false
}

const doEditorHighlightClick = (e: any) => {
  // 因为原生click事件会执行两次，第一次在label标签上，第二次在input标签上，故此处理
  if (e.target.tagName === 'INPUT') return;

  const doHl = () => {
    // 编辑器染色
    setTimeout(() => {
      store.reloadEditor()
    }, 500)
  }

  if (store.doEditorHighlight) {
    // 如果要开启
    if (isMobile.value) {
      const m = modal.create({
        title: '开启编辑器染色？',
        preset: 'card',
        style: {
          width: '30rem',
        },
        content: '部分移动设备上的特定浏览器可能会因为兼容性问题而卡死，继续吗？',
        footer: () => [
          h(
              NButton,
              {
                type: 'default',
                onClick: () => {
                  store.doEditorHighlight = false
                  m.destroy()
                  setTimeout(() => {
                    doFlush()
                  }, 3000)
                },
                style: { marginRight: '1rem' }
              },
              () => '取消',
          ),
          h(
              NButton,
              {
                type: 'primary', onClick: () => {
                  try {
                    doHl()
                  } catch (_e) {
                    // 重新关闭
                    setTimeout(() => {
                      store.doEditorHighlight = false
                      store.reloadEditor()
                    }, 500)
                  } finally {
                    m.destroy()
                  }
                }
              },
              () => '确定'
          ),
        ]
      })

      return
    }
  }

  doHl()
}

const reloadFunc = () => {
  store.reloadEditor()
}
const pcList = computed(() => store.pcList)
watch(pcList, reloadFunc, { deep: true })

const exportOptions = computed(() => store.exportOptions)
watch(exportOptions, reloadFunc, { deep: true })

const code = ref("")

const onListEditorUpdate = (text: string) => {
  editorText.value = text || ''
  if (store.editor) {
    syncingList = true
    try {
      store.editor.dispatch({
        changes: { from: 0, to: store.editor.state.doc.length, insert: text }
      })
    } finally { syncingList = false }
  }
}

fetch('/template.html').then(res => res.text()).then(res => {
  store.templateHTML = res
})
</script>

<style lang="scss">
.element-plus-logo {
  width: 50%;
}

.options > div {
  width: 30rem;
  max-width: 30rem;
  margin-bottom: 2rem;
}

.options > div > .switch {
  display: flex;
  align-items: center;
  justify-content: center;

  & > h4 {
    margin-top: 0rem;
    margin-bottom: 0rem;
    margin-left: 1rem;
  }
}

.myLineDecoration {
  // background: lightblue;
  margin-bottom: 20px;
  font-size: large;
}

.pc-list {
  display: flex;
  align-items: center;
  flex-direction: column;
}

#app {
  overflow-y: auto;
}

.preview {
  word-break: break-all;
  padding: 10px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.12), 0 0 6px rgba(0, 0, 0, 0.04);
  position: relative;
  // font-family: monospace;
}


.list-dynamic {
  width: 100%;

  overflow-y: auto;
}

.list-item-dynamic {
  // display: flex;
  // align-items: center;
  padding: 0.5em 0;
  border-color: lightgray;
}

.scroller {
  height: 95vh;
}
</style>

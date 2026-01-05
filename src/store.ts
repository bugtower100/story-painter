
import { defineStore } from 'pinia'
import { EditorView } from '@codemirror/view';
import axios from 'axios';
import { CharItem, LogItem, packNameId } from './logManager/types';
import { random } from 'lodash-es';
import * as twColors from 'tailwindcss/colors';

const ASSET_DB_NAME = 'story-painter'
const ASSET_DB_VERSION = 1
const ASSET_STORE_NAME = 'workbench-assets'

const canUseIndexedDb = typeof indexedDB !== 'undefined'

function openAssetDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(ASSET_DB_NAME, ASSET_DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(ASSET_STORE_NAME)) {
        db.createObjectStore(ASSET_STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

const assetDbPromise: Promise<IDBDatabase> | null = canUseIndexedDb ? openAssetDb() : null

async function idbSetAsset(key: string, value: string) {
  if (!assetDbPromise) return
  const db = await assetDbPromise
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(ASSET_STORE_NAME, 'readwrite')
    const store = tx.objectStore(ASSET_STORE_NAME)
    const req = store.put(value, key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

async function idbGetAsset(key: string): Promise<string | undefined> {
  if (!assetDbPromise) return undefined
  const db = await assetDbPromise
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(ASSET_STORE_NAME, 'readonly')
    const store = tx.objectStore(ASSET_STORE_NAME)
    const req = store.get(key)
    req.onsuccess = () => resolve(req.result as string | undefined)
    req.onerror = () => reject(req.error)
  })
}

export const useStore = defineStore('main', {
  state: () => {
    return {
      templateHTML: '',
      index: 0,
      editor: null as any as EditorView,
      pcList: [] as CharItem[],
      pcNameColorMap: new Map<string, string>(), // 只以名字记录
      pcNameAvatarMap: new Map<string, string>(),
      palette: [twColors.pink['600'], twColors.orange['600'], twColors.pink['400'], twColors.purple['400'], twColors.sky['600'], twColors.slate['400'], twColors.gray['600']],
      paletteStack: [] as string[],
      items: [] as LogItem[],
      doEditorHighlight: false,

      workbench: {
        title: '',
        backgroundImage: '' as any as string,
        bubbleBackgroundImage: '' as any as string,
        globalBackgroundColor: '',
        containerBackgroundImage: '' as any as string,
        containerColor: '#ffffff',
        containerOpacity: 90,
        textEdgeColor: '#ffffff',
        bubbleMaxWidth: 80,
        rightBubbleColor: '#dcf8c6',
        bubbleColor: '#ffffff',
        iconSize: 64,
        pcNameExpressionsMap: new Map<string, Record<string, string>>()
      },

      // 仅用于论坛代码
      randomBBSColorNames: ["skyblue", "royalblue", "darkblue", "orangered", "red", "firebrick", "darkred", "green", "limegreen", "seagreen", "tomato", "coral", "indigo", "burlywood", "sandybrown", "chocolate"],
      randomBBSColorNamesMap: new Map<string, string>(),

      bbsUseSpaceWithMultiLine: false,
      bbsUseColorName: false,

      trgIsAddVoiceMark: false,

      previewElement: HTMLElement,
      _reloadEditor: null as any as (highlight: boolean) => void,

      exportOptions: {
        commandHide: false,
        imageHide: false,
        offTopicHide: false,
        timeHide: false,
        userIdHide: true,
        yearHide: true,
        textIndentAll: false,
        textIndentFirst: true,
      }
    }
  },
  getters: {
    pcMap() {
      let m = new Map<string, CharItem>();
      for (let i of this.pcList) {
        m.set(packNameId(i), i);
      }
      return m;
    }
  },
  actions: {
    colorHexToName(color: string) {
      // nga全部可用颜色
      // "skyblue", "royalblue", "blue", "darkblue", "orange", "orangered", "crimson", "red", "firebrick", "darkred", "green", "limegreen", "seagreen", "teal", "deeppink", "tomato", "coral", "purple", "indigo", "burlywood", "sandybrown", "sienna", "chocolate", "silver"
      switch (color) {
        case twColors.amber['600']:
          // 深棕色
          return 'sienna';
        case twColors.pink['600']:
          // 深粉色，没有类似的，用深红色替代了
          return 'crimson';
        case twColors.orange['600']:
          // 棕色 / 橙色
          return 'orange';
        case twColors.pink['400']:
          // 淡粉色
          return 'deeppink';
        case twColors.purple['400']:
          // 紫色
          return 'purple';
        case twColors.sky['600']:
          // 靛蓝色
          return 'blue';
        case twColors.slate['400']:
          // 青绿色
          return 'teal';
        case twColors.gray['600']: case twColors.gray['400']:
          // 深灰色
          return 'silver';
      }

      if (this.randomBBSColorNamesMap.get(color)) {
        return this.randomBBSColorNamesMap.get(color)
      }

      if (this.randomBBSColorNames.length === 0) {
        return 'red';
      }

      const randomIndex = random(0, this.randomBBSColorNames.length - 1);
      const colorName = this.randomBBSColorNames.splice(randomIndex, 1)[0];

      this.randomBBSColorNamesMap.set(color, colorName);
      return colorName;
    },
    
    reloadEditor () {
      this._reloadEditor(this.doEditorHighlight)
    },

    colorMapSave() {
      localStorage.setItem('pcNameColorMap', JSON.stringify([...this.pcNameColorMap]))
    },

    colorMapLoad() {
      const lst = JSON.parse(localStorage.getItem('pcNameColorMap') || '[]');
      this.pcNameColorMap = new Map(lst)
    },

    avatarMapSave() {
      localStorage.setItem('pcNameAvatarMap', JSON.stringify([...this.pcNameAvatarMap]))
    },

    avatarMapLoad() {
      const lst = JSON.parse(localStorage.getItem('pcNameAvatarMap') || '[]');
      this.pcNameAvatarMap = new Map(lst)
    },

    workbenchSave() {
      const wb = this.workbench
      const expObj: Record<string, Record<string, string>> = {}
      for (const [name, exps] of wb.pcNameExpressionsMap) expObj[name] = exps

      const isLargeDataUrl = (v: string) => typeof v === 'string' && v.startsWith('data:') && v.length > 50_000
      const backgroundImageKey = isLargeDataUrl(wb.backgroundImage) ? 'workbench:backgroundImage' : ''
      const bubbleBackgroundImageKey = isLargeDataUrl(wb.bubbleBackgroundImage) ? 'workbench:bubbleBackgroundImage' : ''
      const containerBackgroundImageKey = isLargeDataUrl(wb.containerBackgroundImage) ? 'workbench:containerBackgroundImage' : ''

      if (backgroundImageKey) void idbSetAsset(backgroundImageKey, wb.backgroundImage)
      if (bubbleBackgroundImageKey) void idbSetAsset(bubbleBackgroundImageKey, wb.bubbleBackgroundImage)
      if (containerBackgroundImageKey) void idbSetAsset(containerBackgroundImageKey, wb.containerBackgroundImage)

      const payload = {
        title: wb.title,
        backgroundImage: backgroundImageKey ? '' : wb.backgroundImage,
        bubbleBackgroundImage: bubbleBackgroundImageKey ? '' : wb.bubbleBackgroundImage,
        containerBackgroundImage: containerBackgroundImageKey ? '' : wb.containerBackgroundImage,
        backgroundImageKey,
        bubbleBackgroundImageKey,
        containerBackgroundImageKey,
        globalBackgroundColor: wb.globalBackgroundColor,
        containerColor: wb.containerColor,
        containerOpacity: wb.containerOpacity,
        textEdgeColor: wb.textEdgeColor,
        bubbleMaxWidth: wb.bubbleMaxWidth,
        rightBubbleColor: wb.rightBubbleColor,
        bubbleColor: wb.bubbleColor,
        iconSize: wb.iconSize,
        pcNameExpressionsMap: expObj
      }

      try {
        localStorage.setItem('workbench', JSON.stringify(payload))
      } catch (e) {
        if (e instanceof DOMException && e.name === 'QuotaExceededError') {
          try {
            localStorage.removeItem('workbench')
            localStorage.setItem('workbench', JSON.stringify({
              ...payload,
              pcNameExpressionsMap: {}
            }))
          } catch (_e2) {
          }
          return
        }
        throw e
      }
    },

    workbenchLoad() {
      const data = JSON.parse(localStorage.getItem('workbench') || '{}')
      if (!data) return
      this.workbench.title = data.title || ''
      this.workbench.backgroundImage = data.backgroundImage || ''
      this.workbench.bubbleBackgroundImage = data.bubbleBackgroundImage || ''
      this.workbench.globalBackgroundColor = data.globalBackgroundColor || ''
      this.workbench.containerBackgroundImage = data.containerBackgroundImage || ''
      this.workbench.textEdgeColor = data.textEdgeColor || '#ffffff'
      this.workbench.bubbleMaxWidth = data.bubbleMaxWidth || 80
      this.workbench.rightBubbleColor = data.rightBubbleColor || '#dcf8c6'
      this.workbench.bubbleColor = data.bubbleColor || '#ffffff'
      this.workbench.containerColor = data.containerColor || '#ffffff'
      this.workbench.containerOpacity = data.containerOpacity !== undefined ? data.containerOpacity : 90
      this.workbench.iconSize = data.iconSize || 64
      const expObj = data.pcNameExpressionsMap || {}
      this.workbench.pcNameExpressionsMap = new Map<string, Record<string,string>>()
      for (const name of Object.keys(expObj)) this.workbench.pcNameExpressionsMap.set(name, expObj[name])

      const backgroundImageKey = data.backgroundImageKey || ''
      const bubbleBackgroundImageKey = data.bubbleBackgroundImageKey || ''
      const containerBackgroundImageKey = data.containerBackgroundImageKey || ''

      if (!this.workbench.backgroundImage && backgroundImageKey) {
        void idbGetAsset(backgroundImageKey).then(v => {
          if (typeof v === 'string') this.workbench.backgroundImage = v
        })
      }
      if (!this.workbench.bubbleBackgroundImage && bubbleBackgroundImageKey) {
        void idbGetAsset(bubbleBackgroundImageKey).then(v => {
          if (typeof v === 'string') this.workbench.bubbleBackgroundImage = v
        })
      }
      if (!this.workbench.containerBackgroundImage && containerBackgroundImageKey) {
        void idbGetAsset(containerBackgroundImageKey).then(v => {
          if (typeof v === 'string') this.workbench.containerBackgroundImage = v
        })
      }
    },

    getColor(): string {
      if (this.paletteStack.length === 0) {
        this.paletteStack = [...this.palette]
      }
      return this.paletteStack.shift() as string
    },

    async tryFetchLog(key: string, password: string) {
      // https://weizaima.com/dice
      const resp = await axios.get('https://pryandcoolseal.bugtower.top/dice/api/load_data', {
        params: { key, password }
      })
      return resp.data
    },

    /** 移除不使用的pc名字 */
    async pcNameRefresh() {
      const names = new Set();
      const namesAll = new Set();
      const namesToDelete = new Set();
    
      for (let i of this.pcList) {
        namesAll.add(i.name)
      }
    
      for (let i of this.items) {
        names.add(i.nickname)
      }
    
      for (let i of namesAll) {
        if (!names.has(i)) {
          namesToDelete.add(i)
        }
      }
    
      for (let i of namesToDelete) {
        this.tryRemovePC(i as any)
      }
    },

    /** 更新pc列表 */
    async updatePcList(charInfo: Map<string, CharItem>) {
      const exists = new Set();
      for (let i of this.pcList) {
        exists.add(packNameId(i));
      }
    
      for (let [k, v] of charInfo) {
        const id = packNameId(v);
        if (!exists.has(id)) {
          let c = this.pcNameColorMap.get(v.name);
          if (!c) {
            c = this.getColor();
            this.pcNameColorMap.set(v.name, c);
            this.colorMapSave()
          }
          v.color = c;
          const a = this.pcNameAvatarMap.get(v.name)
          if (a && !v.avatar) v.avatar = a
          this.pcList.push(v);
          exists.add(id);
        }
      }
    },

    async tryRemovePC(name: string) {
      let index = 0
      for (let i of this.pcList) {
        if (i.name === name) {
          this.pcList.splice(index, 1)
          break
        }
        index += 1
      }
    },
    setAvatar(name: string, dataUrl: string) {
      this.pcNameAvatarMap.set(name, dataUrl)
      this.avatarMapSave()
      for (const pc of this.pcList) {
        if (pc.name === name) pc.avatar = dataUrl
      }
    },
    setExpression(name: string, tag: string, dataUrl: string) {
      const m = this.workbench.pcNameExpressionsMap.get(name) || {}
      m[tag] = dataUrl
      this.workbench.pcNameExpressionsMap.set(name, m)
      this.workbenchSave()
    },
    removeExpression(name: string, tag: string) {
      const m = this.workbench.pcNameExpressionsMap.get(name) || {}
      delete m[tag]
      this.workbench.pcNameExpressionsMap.set(name, m)
      this.workbenchSave()
    }
  }
})


import { defineStore } from 'pinia'
import { EditorView } from '@codemirror/view';
import axios from 'axios';
import { CharItem, CharacterAssets, LogItem, characterAssetKey, packNameId } from './logManager/types';
import type { LogStylePackage } from './utils/logStyle';
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

function getCurrentLogKeyFromUrl(): string {
  if (typeof location === 'undefined') return ''
  try {
    return (new URLSearchParams(location.search).get('key') || '').trim()
  } catch {
    return ''
  }
}

function getWorkbenchStorageKey(): string {
  const k = getCurrentLogKeyFromUrl()
  return k ? `workbench:${k}` : 'workbench'
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
        fontSize: 16,
        lineHeight: 1.8,
        contentWidth: 960,
        messageGap: 20,
        avatarRadius: 12,
        pageSize: 'a4',
        pageMargin: 20,
        columns: 1,
        fontFamily: 'sans-serif',
        mergeNeighbors: true,
        useCustomStyle: false,
        stylePackage: null as LogStylePackage | null,
        characterAssets: {} as Record<string, CharacterAssets>,
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
      const storageKey = getWorkbenchStorageKey()
      const wb = this.workbench
      const expObj: Record<string, Record<string, string>> = {}
      const expObjKeys: Record<string, Record<string, string>> = {}
      const isLargeDataUrl = (v: string) => typeof v === 'string' && v.startsWith('data:') && v.length > 50_000

      for (const [name, exps] of wb.pcNameExpressionsMap) {
        const record: Record<string, string> = {}
        const recordKeys: Record<string, string> = {}
        for (const tag of Object.keys(exps || {})) {
          const url = exps[tag]
          if (isLargeDataUrl(url)) {
            const assetKey = `${storageKey}:expression:${encodeURIComponent(name)}:${encodeURIComponent(tag)}`
            record[tag] = ''
            recordKeys[tag] = assetKey
            void idbSetAsset(assetKey, url)
          } else {
            record[tag] = url
          }
        }
        expObj[name] = record
        if (Object.keys(recordKeys).length) expObjKeys[name] = recordKeys
      }

      const backgroundImageKey = isLargeDataUrl(wb.backgroundImage) ? `${storageKey}:backgroundImage` : ''
      const bubbleBackgroundImageKey = isLargeDataUrl(wb.bubbleBackgroundImage) ? `${storageKey}:bubbleBackgroundImage` : ''
      const containerBackgroundImageKey = isLargeDataUrl(wb.containerBackgroundImage) ? `${storageKey}:containerBackgroundImage` : ''

      if (backgroundImageKey) void idbSetAsset(backgroundImageKey, wb.backgroundImage)
      if (bubbleBackgroundImageKey) void idbSetAsset(bubbleBackgroundImageKey, wb.bubbleBackgroundImage)
      if (containerBackgroundImageKey) void idbSetAsset(containerBackgroundImageKey, wb.containerBackgroundImage)

      const packed = { stylePackage: wb.stylePackage, characterAssets: wb.characterAssets }
      const packedJson = JSON.stringify(packed)
      const packedKey = canUseIndexedDb && packedJson.length > 50_000 ? `${storageKey}:style-and-characters` : ''
      if (packedKey) void idbSetAsset(packedKey, packedJson)

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
        fontSize: wb.fontSize, lineHeight: wb.lineHeight, contentWidth: wb.contentWidth,
        messageGap: wb.messageGap, avatarRadius: wb.avatarRadius, useCustomStyle: wb.useCustomStyle,
        pageSize: wb.pageSize, pageMargin: wb.pageMargin, columns: wb.columns, fontFamily: wb.fontFamily, mergeNeighbors: wb.mergeNeighbors,
        packed: packedKey ? undefined : packed, packedKey,
        pcNameExpressionsMap: expObj,
        pcNameExpressionsMapKeys: expObjKeys
      }

      try {
        localStorage.setItem(storageKey, JSON.stringify(payload))
      } catch (e) {
        if (e instanceof DOMException && e.name === 'QuotaExceededError') {
          try {
            localStorage.removeItem(storageKey)
            localStorage.setItem(storageKey, JSON.stringify({
              ...payload,
              pcNameExpressionsMap: {},
              pcNameExpressionsMapKeys: {}
            }))
          } catch (_e2) {
          }
          return
        }
        throw e
      }
    },

    workbenchLoad() {
      const storageKey = getWorkbenchStorageKey()
      let raw = localStorage.getItem(storageKey)
      const urlKey = getCurrentLogKeyFromUrl()
      if (!raw && urlKey) {
        const legacy = localStorage.getItem('workbench')
        if (legacy) {
          raw = legacy
          try {
            localStorage.setItem(storageKey, legacy)
            localStorage.removeItem('workbench')
          } catch {
          }
        }
      }

      const data = JSON.parse(raw || '{}')
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
      this.workbench.fontSize = data.fontSize || 16
      this.workbench.lineHeight = data.lineHeight || 1.8
      this.workbench.contentWidth = data.contentWidth || 960
      this.workbench.messageGap = data.messageGap ?? 20
      this.workbench.avatarRadius = data.avatarRadius ?? 12
      this.workbench.pageSize = ['a4', 'letter', 'flow'].includes(data.pageSize) ? data.pageSize : 'a4'
      this.workbench.pageMargin = Math.max(8, Math.min(40, Number(data.pageMargin) || 20))
      this.workbench.columns = data.columns === 2 ? 2 : 1
      this.workbench.fontFamily = data.fontFamily === 'serif' ? 'serif' : 'sans-serif'
      this.workbench.mergeNeighbors = data.mergeNeighbors !== false
      this.workbench.useCustomStyle = data.useCustomStyle || false
      const restore = (packed: { stylePackage?: LogStylePackage; characterAssets?: Record<string, CharacterAssets> }) => {
        this.workbench.stylePackage = packed.stylePackage || null
        this.workbench.characterAssets = packed.characterAssets || {}
        for (const pc of this.pcList) {
          const avatar = this.workbench.characterAssets[characterAssetKey(pc.name, pc.IMUserId)]?.avatar
          if (avatar) pc.avatar = avatar
        }
      }
      restore(data.packed || {})
      const initialAssets = this.workbench.characterAssets
      if (data.packedKey) void idbGetAsset(data.packedKey).then(value => {
        if (value && this.workbench.characterAssets === initialAssets) restore(JSON.parse(value))
      })
      const expObj = data.pcNameExpressionsMap || {}
      const expObjKeys = data.pcNameExpressionsMapKeys || {}
      this.workbench.pcNameExpressionsMap = new Map<string, Record<string,string>>()
      const names = new Set<string>([...Object.keys(expObj), ...Object.keys(expObjKeys)])
      for (const name of names) {
        const record: Record<string, string> = { ...(expObj[name] || {}) }
        const recordKeys: Record<string, string> = expObjKeys[name] || {}
        for (const tag of Object.keys(recordKeys)) {
          if (!record[tag]) record[tag] = ''
          const key = recordKeys[tag]
          if (key) {
            void idbGetAsset(key).then(v => {
              if (typeof v !== 'string') return
              const cur = this.workbench.pcNameExpressionsMap.get(name) || {}
              this.workbench.pcNameExpressionsMap.set(name, { ...cur, [tag]: v })
            })
          }
        }
        this.workbench.pcNameExpressionsMap.set(name, record)
      }

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

    async tryFetchRKey() {
      const resp = await axios.get('https://dice-api.weizaima.com/api/v1/rkey')
      return resp.data as {
        private_rkey?: string
        group_rkey?: string
        expired_time?: number
      }
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
          let c = v.color || this.pcNameColorMap.get(v.name);
          if (!c) {
            c = this.getColor();
            this.pcNameColorMap.set(v.name, c);
            this.colorMapSave()
          }
          v.color = c;
          const a = this.workbench.characterAssets[characterAssetKey(v.name, v.IMUserId)]?.avatar || this.pcNameAvatarMap.get(v.name)
          if (a && !v.avatar) v.avatar = a
          this.pcList.push(v);
          exists.add(id);
        }
      }
    },

    renamePcName(oldName: string, newName: string, keepOldName = false) {
      if (!oldName || !newName) return
      if (oldName === newName) return

      const color = this.pcNameColorMap.get(oldName)
      if (color && !this.pcNameColorMap.has(newName)) {
        this.pcNameColorMap.set(newName, color)
      }
      if (!keepOldName) this.pcNameColorMap.delete(oldName)
      this.colorMapSave()

      const avatar = this.pcNameAvatarMap.get(oldName)
      if (avatar && !this.pcNameAvatarMap.has(newName)) {
        this.pcNameAvatarMap.set(newName, avatar)
      }
      if (!keepOldName) this.pcNameAvatarMap.delete(oldName)
      this.avatarMapSave()

      const exps = this.workbench.pcNameExpressionsMap.get(oldName)
      if (exps) {
        const cur = this.workbench.pcNameExpressionsMap.get(newName) || {}
        this.workbench.pcNameExpressionsMap.set(newName, { ...exps, ...cur })
        if (!keepOldName) this.workbench.pcNameExpressionsMap.delete(oldName)
      }

      try {
        const storageKey = getWorkbenchStorageKey()
        const raw = localStorage.getItem(storageKey)
        if (!raw) return
        const data = JSON.parse(raw || '{}')
        if (!data || typeof data !== 'object') return

        const mapObj = (data.pcNameExpressionsMap || {}) as Record<string, Record<string, string>>
        const mapKeysObj = (data.pcNameExpressionsMapKeys || {}) as Record<string, Record<string, string>>

        if (mapObj[oldName]) {
          mapObj[newName] = { ...(mapObj[oldName] || {}), ...(mapObj[newName] || {}) }
          if (!keepOldName) delete mapObj[oldName]
          data.pcNameExpressionsMap = mapObj
        }

        if (mapKeysObj[oldName]) {
          mapKeysObj[newName] = { ...(mapKeysObj[oldName] || {}), ...(mapKeysObj[newName] || {}) }
          if (!keepOldName) delete mapKeysObj[oldName]
          data.pcNameExpressionsMapKeys = mapKeysObj
        }

        localStorage.setItem(storageKey, JSON.stringify(data))
      } catch {
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
    getExpressions(name: string, account: string): Record<string, string> {
      return this.workbench.characterAssets[characterAssetKey(name, account)]?.expressions || this.workbench.pcNameExpressionsMap.get(name) || {}
    },
    getAvatar(item: LogItem): string {
      const assets = this.workbench.characterAssets[characterAssetKey(item.nickname, item.IMUserId)]
      return item.overrideAvatar || (item.expressionTag && this.getExpressions(item.nickname, item.IMUserId)[item.expressionTag]) || assets?.avatar || this.pcMap.get(packNameId(item))?.avatar || ''
    },
    importCharacterAssets(assets?: Record<string, CharacterAssets>) {
      if (!assets) return
      this.workbench.characterAssets = { ...this.workbench.characterAssets }
      for (const [key, value] of Object.entries(assets)) {
        const old = this.workbench.characterAssets[key]
        this.workbench.characterAssets[key] = { avatar: old?.avatar || value.avatar, expressions: { ...value.expressions, ...old?.expressions } }
      }
      this.workbenchSave()
    },
    moveCharacterAssets(previous: Pick<CharItem, 'name' | 'IMUserId'>, name: string, account: string) {
      const oldKey = characterAssetKey(previous.name, previous.IMUserId), newKey = characterAssetKey(name, account)
      const old = this.workbench.characterAssets[oldKey], target = this.workbench.characterAssets[newKey]
      const targetPc = this.pcList.find(pc => pc.name === name && pc.IMUserId === account)
      if (old && oldKey !== newKey) {
        this.workbench.characterAssets[newKey] = { avatar: target?.avatar || targetPc?.avatar || old.avatar, expressions: { ...old.expressions, ...target?.expressions } }
        delete this.workbench.characterAssets[oldKey]
        this.workbenchSave()
      }
    },
    setAvatar(name: string, dataUrl: string, account?: string) {
      if (account !== undefined) {
        const key = characterAssetKey(name, account)
        this.workbench.characterAssets[key] = { expressions: { ...this.getExpressions(name, account) }, avatar: dataUrl }
        const pc = this.pcList.find(pc => pc.name === name && pc.IMUserId === account)
        if (pc) pc.avatar = dataUrl
        this.workbenchSave()
        return
      }
      this.pcNameAvatarMap.set(name, dataUrl)
      this.avatarMapSave()
      for (const pc of this.pcList) {
        if (pc.name === name) pc.avatar = dataUrl
      }
    },
    setExpression(name: string, tag: string, dataUrl: string, account?: string) {
      if (account !== undefined) {
        const key = characterAssetKey(name, account)
        this.workbench.characterAssets[key] = { ...this.workbench.characterAssets[key], expressions: { ...this.getExpressions(name, account), [tag]: dataUrl } }
        this.workbenchSave()
        return
      }
      const m = this.workbench.pcNameExpressionsMap.get(name) || {}
      m[tag] = dataUrl
      this.workbench.pcNameExpressionsMap.set(name, m)
      this.workbenchSave()
    },
    removeExpression(name: string, tag: string, account?: string) {
      if (account !== undefined) {
        const key = characterAssetKey(name, account)
        const expressions = { ...this.getExpressions(name, account) }
        delete expressions[tag]
        this.workbench.characterAssets[key] = { ...this.workbench.characterAssets[key], expressions }
        this.workbenchSave()
        return
      }
      const m = this.workbench.pcNameExpressionsMap.get(name) || {}
      delete m[tag]
      this.workbench.pcNameExpressionsMap.set(name, m)
      this.workbenchSave()
    }
  }
})

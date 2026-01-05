import { LogImporter, TextInfo } from './_logImpoter'
import type { CharItem, LogItem } from '../types'

interface CcfoliaProjectData {
  displayLogData: Array<{
    id: number
    time?: number | string
    nickname: string
    IMUserId?: string
    message: string
    isDice?: boolean
    overrideAvatarKey?: string
    images?: string[]
  }>
  characters?: Record<string, { avatarDataUrl?: string }>
  charactersByName?: Record<string, { avatarDataUrl?: string }>
}

export class CcfoliaProjectImporter extends LogImporter {
  get name() { return 'CCfolia 项目' }

  check(text: string): boolean {
    try {
      const obj = JSON.parse(text)
      return !!(obj && obj.__ccfolia_project__ === true && obj.displayLogData && Array.isArray(obj.displayLogData))
    } catch { return false }
  }

  parse(text: string): TextInfo {
    const data = JSON.parse(text) as CcfoliaProjectData & { __ccfolia_project__: true }
    const charInfo = new Map<string, CharItem>()
    const items: LogItem[] = []

    for (const row of data.displayLogData) {
      const item = {} as LogItem
      item.id = row.id
      item.nickname = row.nickname
      item.IMUserId = row.IMUserId || this.getAutoIMUserId(items.length, item.nickname)
      item.isDice = !!row.isDice
      if (typeof row.time === 'number') {
        item.time = row.time
      } else if (typeof row.time === 'string') {
        const [t, tt] = this.parseTime(row.time)
        item.time = t
        item.timeText = tt
      } else {
        item.time = 0
      }
      item.message = row.message || ''
      items.push(item)

      this.setCharInfo(charInfo, item)
    }

    // 附加角色头像（可选）
    if (data.characters) {
      for (const [imUserId, info] of Object.entries(data.characters)) {
        for (const [k, v] of charInfo) {
          if (v.IMUserId === imUserId && info.avatarDataUrl) {
            (v as any).avatar = info.avatarDataUrl
            charInfo.set(k, v)
          }
        }
      }
    }
    if (data.charactersByName) {
      for (const [nickname, info] of Object.entries(data.charactersByName)) {
        for (const [k, v] of charInfo) {
          if (v.name === nickname && info.avatarDataUrl) {
            (v as any).avatar = info.avatarDataUrl
            charInfo.set(k, v)
          }
        }
      }
    }

    return { items, charInfo, startText: '', exporter: 'editLog' }
  }
}

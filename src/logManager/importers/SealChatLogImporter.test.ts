import { describe, expect, it, vi } from 'vitest'
import { LogManager } from '../logManager'
import { characterAssetKey } from '../types'
import { readSealChatPayload } from './SealChatLogImporter'
import { readZip } from '~/utils/logStyle'
import { strToU8, zipSync } from 'fflate'
vi.mock('~/store', () => ({ useStore: () => ({ pcList: [] }) }))

const a = 'data:image/png;base64,YQ==', b = 'data:image/png;base64,Yg=='
const message = (identity: string, avatar: string) => ({ sender_id: 'user-1', sender_identity_id: identity, sender_name: '同名角色', sender_avatar: avatar, sender_color: '#985ac0', content: '一段发言', created_at: '2026-11-24T10:00:00Z' })
describe('SealChat export compatibility', () => {
  it('retains identity-specific avatars, color and per-message expressions through editor round trips', () => {
    const manager = new LogManager()
    const result = manager.parse(JSON.stringify({ channel_name: 'HO1', inline_assets: { a, b }, messages: [message('pc-1', 'scasset:a'), message('pc-1', 'scasset:b'), message('pc-1', 'scasset:a'), message('pc-2', 'scasset:b')] }))!
    expect(result.charInfo.size).toBe(2)
    expect(result.charInfo.get('同名角色-pc-1')).toMatchObject({ avatar: a, color: '#985ac0' })
    expect(Object.values(result.characterAssets![characterAssetKey('同名角色', 'pc-1')].expressions)).toEqual([a, b])
    expect(result.items[0].expressionTag).toBe(result.items[2].expressionTag)
    expect(result.items[0].expressionTag).not.toBe(result.items[1].expressionTag)
    const text = manager.exporters.editLog.doExport(result.items)!.text
    const reparsed = manager.parse(text)!
    expect(reparsed.items.map(i => [i.nickname, i.IMUserId, i.expressionTag, i.groupName])).toEqual(result.items.map(i => [i.nickname, i.IMUserId, i.expressionTag, i.groupName]))
  })
  it('imports the real standard JSON imUserId spelling without assigning every character an empty ID', () => {
    const result = new LogManager().parse(JSON.stringify({ version: 105, items: [
      { nickname: '玩家', imUserId: 'a', time: 1795514400, message: '开始', isDice: false },
      { nickname: '玩家', imUserId: 'b', time: 1795514401, message: '回答', isDice: false }
    ] }))!
    expect(result.items.map(i => i.IMUserId)).toEqual(['a', 'b'])
    expect(result.charInfo.size).toBe(2)
  })
  it('does not treat style packages or arbitrary JSON as log data', () => {
    expect(readSealChatPayload('{"templates":{},"schemaVersion":1}')).toBeUndefined()
    expect(readSealChatPayload('{"messages":[{"content":"text"}]}')).toBeUndefined()
    expect(readSealChatPayload('not json')).toBeUndefined()
  })
  it('does not restore unsafe or unavailable attachment URLs as avatars', () => {
    const result = new LogManager().parse(JSON.stringify({ messages: [message('a', 'javascript:alert(1)'), message('b', 'scasset:missing'), message('c', 'https://example.test/" onerror="alert(1)')] }))!
    expect(result.items.every(i => !i.expressionTag)).toBe(true)
    expect([...result.charInfo.values()].every(pc => !pc.avatar)).toBe(true)
  })
  it('rejects unsafe ZIP paths and oversized expanded data before allocating it', () => {
    expect(() => readZip(zipSync({ '../outside.txt': strToU8('x') }))).toThrow('ZIP')
    expect(() => readZip(zipSync({ 'big.txt': new Uint8Array(51 * 1024 * 1024) }))).toThrow('ZIP')
  })
})

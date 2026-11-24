import { describe, expect, it } from 'vitest'
import { canMergeStyledMessages, type StyledMessage } from './logStyle'
const base: StyledMessage = { name:'KP', identityKey:'1', variantKey:'smile', avatar:'a.png', color:'#112233', body:'<p>正文</p>', time:'20:00', channel:'main', messageType:'ic' }
describe('SealChat neighboring message layout', () => {
  it('groups consecutive messages without combining their editable bodies', () => {
    expect(canMergeStyledMessages(base, { ...base, time:'20:01', body:'<p>下一条</p>' })).toBe(true)
    expect(canMergeStyledMessages(undefined, base)).toBe(false)
  })
  it.each([{ name:'玩家' }, { identityKey:'2' }, { variantKey:'angry' }, { avatar:'b.png' }, { channel:'HO1' }, { messageType:'ooc' }])('starts a new group when identity, expression, channel or type changes: %j', patch => {
    expect(canMergeStyledMessages(base, { ...base, ...patch })).toBe(false)
  })
})

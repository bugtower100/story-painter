import { describe, expect, it } from 'vitest';
import { applyQQImageRKeyReplacement as replace } from './rkey';
describe('QQ image refresh', () => {
  it.each([['1406', 'private'], ['1407', 'group']])('refreshes appid %s', (appid, key) => {
    const raw = JSON.stringify({ items: [{ message: `[CQ:image,url=https://gchat.qpic.cn/download?appid=${appid}&rkey=old]`, nickname: '角色' }] });
    const result = JSON.parse(replace(raw, { private_rkey: 'private', group_rkey: 'group' }));
    expect(result.items[0].message).toContain(`https://multimedia.nt.qq.com.cn/download?appid=${appid}&rkey=${key}`);
    expect(result.items[0].nickname).toBe('角色');
  });
  it('preserves invalid input and missing keys', () => {
    expect(replace('not json', { group_rkey: 'new' })).toBe('not json');
    const text = '{"items":[{"message":"正文"}]}';
    expect(replace(text, {})).toBe(text);
  });
});

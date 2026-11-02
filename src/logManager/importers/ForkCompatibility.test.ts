import { describe, expect, it, vi } from 'vitest';
import { LogManager } from '../logManager';
import { EditLogImporter } from './EditLogImporter';
import { TwoLineChannelTextImporter } from './TwoLineChannelTextImporter';
import { reNameLine } from '~/utils/highlight';
vi.mock('~/store', () => ({ useStore: () => ({ pcList: [] }) }));
describe('fork header compatibility', () => {
  it('keeps the channel importer from intercepting ordinary editor logs', () => {
    const importer = new TwoLineChannelTextImporter(new LogManager());
    expect(importer.check('玩家(QQ:123) 2026/09/03 01:02:03\n正文')).toBe(false);
  });
  it('routes channel logs with nested nicknames without losing speakers', () => {
    const text = '- 玩家(外层(内层))(QQ:123)#微笑 2026/09/03 01:02:03 [大厅]\r\n正文\r\n\r\n另一人（456） 2026/09/03 01:03:03 [大厅]\r\n回复';
    const result = new LogManager().parse(text)!;
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({ nickname: '玩家(外层(内层))', IMUserId: 'QQ:123', expressionTag: '微笑', groupName: '大厅', message: '正文' });
    expect(result.items[1]).toMatchObject({ nickname: '另一人', IMUserId: '456', message: '回复' });
  });
  it.each([
    ['玩家（备注）(QQ:123)#微笑 2026/9/3 1:2:03 [大厅] ', '玩家（备注）', 'QQ:123'],
    ['玩家（123）#微笑 2026/9/3 1:2:03 [大厅] ', '玩家', '123'],
    ['玩家(外层(内层))(QQ:123)#微笑 2026/9/3 1:2:03 [大厅] ', '玩家(外层(内层))', 'QQ:123'],
  ])('retains expression, group and CRLF: %s', (header, nickname, IMUserId) => {
    const importer = new EditLogImporter(new LogManager());
    const item = importer.parse(`${header}\r\n正文`).items[0];
    expect(item).toMatchObject({ nickname, IMUserId, expressionTag: '微笑', groupName: '大厅', message: '正文' });
    expect(item.time).toBeGreaterThan(0);
    expect(reNameLine.exec(header)?.[1]).toBe(nickname);
  });
});

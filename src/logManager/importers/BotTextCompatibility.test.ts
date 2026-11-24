import { describe, expect, it, vi } from 'vitest';
import dayjs from 'dayjs';
import { LogManager } from '../logManager';
import { reNameLine } from '~/utils/highlight';

vi.mock('~/store', () => ({ useStore: () => ({ pcList: [] }) }));

describe('OlivaDice and Dice! local text logs', () => {
  // OlivaDiceLogger releaseLogFile writes name(id) YYYY-MM-DD HH:mm:ss\nmessage\n.
  // https://github.com/OlivOS-Team/OlivaDiceLogger/blob/main/OlivaDiceLogger/logger.py
  it('imports consecutive Qingguo TRPGLOG messages without losing IDs or paragraphs', () => {
    const text = '青果(QQ:10001) 2026-11-24 16:59:42\n记录开始\n玩家（备注）(20002) 2026-11-24 17:00:00\n第一段\n\n第二段\n[CQ:image,file=https://example.com/map.png]\n';
    const manager = new LogManager();
    const result = manager.parse(text)!;
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({ nickname: '青果', IMUserId: 'QQ:10001', time: dayjs('2026-11-24T16:59:42').unix() });
    expect(result.items[1]).toMatchObject({ nickname: '玩家（备注）', IMUserId: '20002', message: '第一段\n\n第二段\n[CQ:image,file=https://example.com/map.png]\n' });
    const exported = manager.exporters.editLog.doExport(result.items)!.text;
    const again = manager.parse(exported)!.items;
    expect(again.map(({ nickname, IMUserId, time }) => ({ nickname, IMUserId, time }))).toEqual(result.items.map(({ nickname, IMUserId, time }) => ({ nickname, IMUserId, time })));
    expect(again[1].message.trim()).toBe(result.items[1].message.trim());
  });

  it.each(['2026-11-24 16:59:42', '2026-1-4 6:9:42', '2026/11/24 16:59:42', '16:59:42'])('preserves Dice! identity, expression and highlighting with %s', time => {
    const header = `Keeper(外层(内层))(123)#微笑 ${time} #42`;
    const result = new LogManager().parse(`${header}\r\n第一行\r\n第二行`)!;
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ nickname: 'Keeper(外层(内层))', IMUserId: '123', expressionTag: '微笑', message: '第一行\r\n第二行' });
    expect(reNameLine.exec(header)?.[1]).toBe('Keeper(外层(内层))');
    if (time.includes('2026')) expect(result.items[0].time).toBeGreaterThan(0);
    else expect(result.items[0].timeText).toBe(time);
  });

  it('retains window labels when Qingguo and Dice! text is arranged into blocks', () => {
    const result = new LogManager().parse('玩家(123) 2026-11-24 17:00:00 [HO1]\n独处\n\n玩家(123) 2026/11/24 17:01:00 [main]\n汇合')!;
    expect(result.items.map(i => [i.nickname, i.IMUserId, i.groupName, i.message])).toEqual([['玩家', '123', 'HO1', '独处'], ['玩家', '123', 'main', '汇合']]);
  });
});

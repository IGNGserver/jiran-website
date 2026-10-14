import { expect, test } from '@playwright/test';
import { COUNTS, TOOLS } from '../src/data/product';
import { CONTENT } from '../src/i18n/content';

// 站点上的数字必须与支持矩阵自洽（产品 README「Supported tools」表）
test('支持矩阵计数与 README 一致', () => {
  expect(TOOLS).toHaveLength(COUNTS.rows);
  expect(TOOLS.filter((t) => t.u)).toHaveLength(COUNTS.usage);
  expect(TOOLS.filter((t) => t.l)).toHaveLength(COUNTS.limits);
  expect(TOOLS.filter((t) => t.s)).toHaveLength(COUNTS.sessions);
  expect(new Set(TOOLS.map((t) => t.name)).size).toBe(TOOLS.length);
});

test('首屏统计数字来自同一份计数', () => {
  for (const lang of ['zh', 'en'] as const) {
    const n = CONTENT[lang].hero.stats.map((s) => s.n);
    expect(n).toEqual([String(COUNTS.rows), String(COUNTS.usage), String(COUNTS.limits), '0']);
  }
});

test('中英文案结构一致', () => {
  const shape = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(shape) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)])) : typeof v;
  expect(shape(CONTENT.en)).toEqual(shape(CONTENT.zh));
});

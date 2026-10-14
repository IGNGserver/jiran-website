#!/usr/bin/env node
/**
 * 由 Blender 渲染母版（PNG）生成站点用的图片资产。设计期一次性运行，产物提交进仓库：
 *   src/assets/renders/instrument-{wide,tall,macro}.webp   Astro 构建时再按视口生成多尺寸
 *   public/og/og-{zh,en}.jpg                               1200×630 社交卡片（渲染图 + 标题）
 *   public/apple-touch-icon.png                            180×180
 *
 * 用法：node design/tools/media.mjs <渲染母版目录> <输出根目录>
 * 母版目录里应有 og-base.png、tall-base.png、macro-base.png（design/blender/build_instrument.py 的输出）。
 * 需要 sharp（随 astro 安装）。
 */
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const [src, out] = process.argv.slice(2);
if (!src || !out) {
  console.error('usage: node design/tools/media.mjs <masters-dir> <out-root>');
  process.exit(1);
}

const palette = JSON.parse(await readFile(new URL('../instrument.json', import.meta.url), 'utf8')).palette;

await mkdir(join(out, 'src/assets/renders'), { recursive: true });
await mkdir(join(out, 'public/og'), { recursive: true });

const renders = [
  ['og-base.png', 'instrument-wide.webp', 2400],
  ['tall-base.png', 'instrument-tall.webp', 1200],
  ['macro-base.png', 'instrument-macro.webp', 1600],
];
for (const [from, to, width] of renders) {
  const info = await sharp(join(src, from))
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 86, effort: 6, smartSubsample: true })
    .toFile(join(out, 'src/assets/renders', to));
  console.log(to, info.width, 'x', info.height, Math.round(info.size / 1024), 'KB');
}

/** 社交卡片：左侧压暗留出标题区，右侧是算仪。文字用 SVG 叠加。 */
const cards = {
  zh: { title: '计然', line1: '把 AI 编程工具的 Token、成本与额度', line2: '先在本机算清楚。', foot: 'JIRAN · 59 SOURCES · LOCAL-FIRST · NO TELEMETRY' },
  en: { title: 'Jiran', line1: 'Token, cost and quota metering', line2: 'for AI coding tools, counted locally.', foot: '计然 · 59 SOURCES · LOCAL-FIRST · NO TELEMETRY' },
};
const W = 1200;
const H = 630;
for (const [lang, c] of Object.entries(cards)) {
  const serif = lang === 'zh' ? "'Songti SC', 'Noto Serif CJK SC', serif" : "'Instrument Serif', 'Times New Roman', serif";
  const sans = "'PingFang SC', 'Helvetica Neue', Arial, sans-serif";
  const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="fade" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="${palette.ink}" stop-opacity="0.94"/>
      <stop offset="0.42" stop-color="${palette.ink}" stop-opacity="0.72"/>
      <stop offset="0.66" stop-color="${palette.ink}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#fade)"/>
  <g transform="translate(70 70) scale(1.6)">
    <circle cx="16" cy="16" r="10" fill="none" stroke="${palette.bone}" stroke-width="2" stroke-dasharray="54.8 8" transform="rotate(-69 16 16)" stroke-linecap="round"/>
    <path d="M16 7.6v5.2" stroke="${palette.bone}" stroke-width="2" stroke-linecap="round"/>
    <circle cx="8.9" cy="23.1" r="3.2" fill="${palette.cinnabar}"/>
  </g>
  <text x="68" y="${lang === 'zh' ? 330 : 340}" fill="${palette.bone}" font-family="${serif}" font-size="${lang === 'zh' ? 168 : 196}" font-weight="${lang === 'zh' ? 600 : 400}" letter-spacing="${lang === 'zh' ? 12 : -2}">${c.title}</text>
  <text x="72" y="420" fill="${palette.bone}" font-family="${sans}" font-size="30">${c.line1}</text>
  <text x="72" y="462" fill="${palette.bone}" fill-opacity="0.7" font-family="${sans}" font-size="30">${c.line2}</text>
  <rect x="72" y="532" width="28" height="2" fill="${palette.cinnabar}"/>
  <text x="114" y="539" fill="${palette.boneDim}" font-family="Menlo, monospace" font-size="15" letter-spacing="3">${c.foot}</text>
</svg>`);
  await sharp(join(src, 'og-base.png'))
    .resize(W, H, { fit: 'cover', position: 'right' })
    .composite([{ input: overlay }])
    .jpeg({ quality: 86, mozjpeg: true, chromaSubsampling: '4:4:4' })
    .toFile(join(out, `public/og/og-${lang}.jpg`));
  console.log(`og-${lang}.jpg`);
}

const icon = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="180" height="180"><rect width="32" height="32" fill="${palette.ink}"/><circle cx="16" cy="16" r="9" fill="none" stroke="${palette.bone}" stroke-width="2" stroke-dasharray="49.4 7.2" transform="rotate(-69 16 16)" stroke-linecap="round"/><path d="M16 8.6v4.6" stroke="${palette.bone}" stroke-width="2" stroke-linecap="round"/><circle cx="9.6" cy="22.4" r="3" fill="${palette.cinnabar}"/></svg>`);
await sharp(icon).png().toFile(join(out, 'public/apple-touch-icon.png'));
console.log('apple-touch-icon.png');

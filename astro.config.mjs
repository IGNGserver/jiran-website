// @ts-check
import { defineConfig } from 'astro/config';

// 正式域名未定案（见 docs/HOSTING.md）。构建时通过 SITE_URL 注入，用于 canonical / hreflang /
// og:image 的绝对地址；未设置时这些标签退化为相对地址，不写入任何猜测的域名。
const site = process.env.SITE_URL || undefined;

export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  devToolbar: { enabled: false },
  vite: {
    build: { assetsInlineLimit: 2048 },
  },
});

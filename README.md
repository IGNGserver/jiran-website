# 计然官网 · Jiran Website

计然 / Jiran 的产品官网与下载入口。本仓库只承载官网站点，产品源码与发版在独立仓库维护：

- 产品仓库（唯一事实来源）：<https://github.com/IGNGserver/jiran-monitor>
- 产品定位：为 AI coding tools 打造的本地优先 Token、成本与限额监控，支持多设备同步
- 托管目标：Cloudflare（Pages / Workers 待定，见 [`docs/HOSTING.md`](docs/HOSTING.md)）

> **状态**：首版站点已实现（中文 `/`、英文 `/en/`），尚未部署上线；托管与域名见 [`docs/HOSTING.md`](docs/HOSTING.md)。

## 仓库结构

| 路径 | 内容 |
| --- | --- |
| `src/pages/` | 路由：`/`（中文）、`/en/`、`404` |
| `src/components/` | 首屏与七个章节组件 |
| `src/scripts/hero/` | 首屏「算仪」实时场景（three.js、着色器） |
| `src/i18n/content.ts` | 中英文案 |
| `src/data/product.ts` | 引用的产品事实（支持矩阵、计数、链接），注明核对基线 |
| `design/` | 设计说明、共享几何 spec、Blender 构建脚本与 .blend、图片生成脚本 |
| `tests/` | Playwright 端到端检查与事实一致性测试 |
| [`docs/SITE.md`](docs/SITE.md) | 官网定位、范围、已定案事项与待办 |
| [`docs/HOSTING.md`](docs/HOSTING.md) | Cloudflare 托管方案、构建参数与上线检查清单 |
| [`docs/WORKSPACE.md`](docs/WORKSPACE.md) | 本机 worktree 与构建区约定 |
| [`scripts/verify-repository.sh`](scripts/verify-repository.sh) | 仓库契约检查（本地与 CI 共用） |

## 开发

```bash
pnpm install
pnpm dev          # http://localhost:4321
pnpm build        # astro check + 静态构建到 dist/
pnpm test         # Playwright（先 build；首次需 pnpm exec playwright install chromium）
```

本机工作区、构建区（依赖与产物不落在 NAS 项目卷）、分支与 PR 流程见 [`AGENTS.md`](AGENTS.md)、
[`docs/WORKSPACE.md`](docs/WORKSPACE.md) 与 [`CONTRIBUTING.md`](CONTRIBUTING.md)。

## 许可

[MIT](LICENSE)

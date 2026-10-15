# 计然官网（jiran-website）· 项目 Agent 规范

> 只写本仓库与设备级规范的**差异**。Git 纪律、worktree 路径与生命周期、基线解析、冲突处理、
> PR 流程一律见 `~/.qoder/coder-rules/global-rules.md`，不在这里重复；冲突时以设备级安全条款为准。

Collaboration: solo
Baseline: main
Release: none
Validation: `bash scripts/verify-repository.sh`、`git diff --check`（CI `verify` 作业，每次 push）；`pnpm build`（= `astro check` + `astro build`）、`pnpm test`（Playwright 端到端 + 事实一致性，需先 build）（CI `site` 作业，PR 上运行）。
Worktree: `~/项目/.wt/计然-site/<slug>`

## 这是什么

计然 / Jiran 的官网与下载入口，源码与产品仓库分离维护：

- 产品仓库（唯一事实来源）：`https://github.com/IGNGserver/jiran-monitor`（仓库已改名，`token-monitor-suite`、`jiran` 等旧地址由 GitHub 重定向）；
- 本仓库只承载站点（页面、样式、静态资源、站点文档），不得复制产品源码、安装包或发布资产。

## 技术栈（2026-10-15 定案）

- Astro 7（纯静态输出 `dist/`）+ TypeScript；首屏实时场景用 three.js（懒加载），其余交互为原生脚本；
- 包管理 pnpm（`packageManager` 已锁定），Node.js ≥ 22.13；字体全部自托管（`@fontsource`）；
- 视觉与设计源资产（共享几何 spec `design/kelou.json`、静帧与图片生成脚本）的说明见 `design/DESIGN.md`；
- 页面结构、语言策略与内容来源见 `docs/SITE.md`。

**构建不在项目卷上跑**（设备级规范第 5c 节）：`node_modules`、`dist/`、`.astro/`、Playwright 浏览器一律放在
`$BUILD_SCRATCH_ROOT/计然-site/<slug>/`（rsync 出的无 `.git` 副本）里安装与构建；依赖变更后把
`package.json` 与 `pnpm-lock.yaml` 拷回 worktree 再提交。

## 集成补充

- 无额外门槛：按设备级规范第 5 节（solo）执行；`main` 已设分支保护，必须经 PR 且 CI `verify` 通过；改动涉及站点源码时 `site` 作业也须通过。
- 站点部署（Cloudflare）不随合并自动发生，见 `docs/HOSTING.md`。

## 发布

- 无版本化 Release（`Release: none`）；站点以持续部署方式发布，未启用前不得创建 tag 或 Release。

## 项目特殊限制

- 不得提交 `node_modules`、构建产物、`.wrangler/`、`.env*` 与任何凭据；`scripts/verify-repository.sh` 会拦截。
- 站点文案引用产品事实（功能、平台、版本）时必须与产品仓库当前 `README.md` / Release 对齐，不得编造未发布能力。
  事实集中在 `src/data/product.ts`（含核对基线 commit），文案在 `src/i18n/content.ts`；演示用数字必须标注「示意 / ~」。
- 版本号与下载直链不写死：构建时读取 GitHub 上最新的非 prerelease 发布，客户端再刷新一次；失败时退回 Releases 页面。
- 域名与 Cloudflare 项目名在 `docs/HOSTING.md` 记录；未定案前不得把猜测值写入代码或文档结论。

## 环境事实

- 开发位置：NAS 共享卷 `~/项目`；仓库锚点 `~/项目/项目网站/计然-site`，任务 worktree 在 `~/项目/.wt/计然-site/<slug>`。
- 本地构建：ubuntu-dev 根盘低于 20G 闸门，只能走 CI；macos-dev / macOS-dev2 可在 `~/.build` 本地构建。
- 生产目标：Cloudflare Pages Direct Upload 项目 `jiran-website`；当前公开地址为 `https://jiran-website.pages.dev/`，正式自定义域名与自动发布流程未定；不写凭据。

# 托管方案（Cloudflare Pages）

> 目标：站点以 Cloudflare Pages 托管，正式域名为 `https://jiran.igng.net/`（2026-10-17 绑定）。
> `pages.dev` 地址只是 Cloudflare 分配的默认别名，不作为对外规范地址。

## 已确认的前提（2026-10-15 核实）

- Cloudflare 账号已就绪，Pages 可用；
- 本仓库为独立公开仓库，构建与测试走 GitHub Actions；
- Cloudflare Pages 项目 `jiran-website` 已创建，采用 **Direct Upload**；
- 正式域名 `https://jiran.igng.net/` 已绑定为 Pages 项目的自定义域名（zone `igng.net`）；`https://jiran-website.pages.dev/` 仍可访问，只是默认别名；
- `main` 合并不会自动触发生产发布，当前由 GitHub Actions 生成短期构建产物，再执行 Direct Upload。

## 构建产物（2026-10-15 定案）

站点是纯静态输出，没有边缘逻辑需求；生产构建在 GitHub Actions 执行，避免在 NAS 项目卷上安装依赖或生成产物。

| 项 | 值 |
| --- | --- |
| 安装 | `pnpm install --frozen-lockfile`（Node.js 22.13+，`packageManager: pnpm@10.33.0`） |
| 构建命令 | `pnpm build`（`astro check && astro build`） |
| 输出目录 | `dist/`（含 `404.html`，Pages 会自动作为 404 页） |
| 当前 `SITE_URL` | `https://jiran.igng.net/`；CI、Pages 项目环境变量与 `astro.config.mjs` 缺省值三处一致，改域名必须同时改这三处 |
| 可选环境变量 | `GITHUB_TOKEN`：构建时读取发布信息，避开匿名限流；`JIRAN_OFFLINE=1`：离线构建，下载链接退回 Releases 页面 |

注意：版本号与下载直链在**构建时**烘焙，浏览器端会再向 GitHub 刷新一次；产品发版后不重新部署也能显示新版本，
但无 JS 或 GitHub 限流时显示的是上次构建时的版本。

## 托管方案决策

| 方案 | 状态 | 说明 |
| --- | --- | --- |
| Cloudflare Pages（Direct Upload） | **当前方案** | GitHub Actions 构建 `dist/`，再上传到 Pages；适合当前已有的 CI 构建与测试流程 |
| Cloudflare Pages（Git 集成） | 未采用 | 当前账号的 GitHub 安装无法完成项目创建；Direct Upload 项目也不能直接转换为 Git 集成项目 |
| Workers 静态资源 | 未采用 | 当前没有边缘逻辑需求 |

如果以后需要 Cloudflare 原生的 push / PR 预览，应新建 Git 集成项目，不要在现有 Direct Upload 项目上猜测迁移。

## 当前项目配置

| 项 | 值 |
| --- | --- |
| Pages 项目 | `jiran-website` |
| 部署类型 | Direct Upload |
| 生产分支元数据 | `main` |
| 构建命令记录 | `pnpm build` |
| 构建输出记录 | `dist/` |
| 默认公开地址 | `https://jiran-website.pages.dev/`（Cloudflare 别名，保留） |
| 自定义域名 | `https://jiran.igng.net/`（2026-10-17 绑定） |
| DNS 记录 | proxied CNAME `jiran.igng.net` → `jiran-website.pages.dev`，zone `igng.net`（zone id `d3f06d3e7ef8cccf99e93ce9c4ea4f44`，record id `5948b8aaffb617d229b0d699da9615aa`） |

Direct Upload 不由 Cloudflare 重新执行仓库构建；真正上传的是 GitHub Actions 生成的 `dist/`。当前 CI 仅在手动触发 `main` 工作流时保留一个 1 天的构建 artifact，未配置长期 Cloudflare API 凭据或自动生产发布工作流。

## 上线检查清单

- [x] 前端技术栈与构建命令定案，登记到 `AGENTS.md` 并接入 CI（2026-10-15）；
- [x] 创建 Cloudflare Pages 项目 `jiran-website`，选择 Direct Upload（2026-10-15）；
- [x] 首次生产部署完成，并验证默认 Pages 地址的 HTTPS；
- [x] 验证 `/` 与 `/en/` 返回 200、未知路径返回 404；
- [x] CI 构建注入当前默认地址 `SITE_URL`，使 canonical / hreflang / og:image 生成绝对地址；
- [x] 选定正式 zone `igng.net` 与自定义域名 `jiran.igng.net`，配置 DNS、HTTPS（2026-10-17）；
- [ ] 若改为持续自动发布，配置最小权限的 `CLOUDFLARE_API_TOKEN` 与 `CLOUDFLARE_ACCOUNT_ID`；凭据不得提交；
- [x] `SITE_URL` 已切换为 `https://jiran.igng.net/`；发布到正式域名后需重新验证 SEO 社交卡片、产品仓库链接与下载直链；
- [ ] 评估是否将产品仓库 `homepageUrl`（当前指向 GitHub Pages）改为正式官网域名。

## 发布与回滚

- 生产发布：在 GitHub Actions 手动触发 `Jiran website checks` 的 `main` 工作流，下载 `site-dist-<commit-sha>` artifact，再通过 Cloudflare Pages Direct Upload 发布；构建与 artifact 只能放在 CI 或本机 scratch，不得写回项目卷；
- 正式入口：<https://jiran.igng.net/>；默认别名 <https://jiran-website.pages.dev/> 仍然可访问；
- 回滚：在 Cloudflare Pages 项目中选择上一成功部署版本恢复。发布前记录部署 ID 与对应的 `main` 提交；
- 域名变更：修改 DNS 前记录原值，回滚即恢复原记录；当前记录是 proxied CNAME `jiran.igng.net` → `jiran-website.pages.dev`，改动必须同步 Pages 自定义域名与三处 `SITE_URL`。

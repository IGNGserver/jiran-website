# 托管方案（Cloudflare）

> 目标：站点以 Cloudflare 托管（Pages / Workers 静态资源二选一，未定案）。本文记录方案边界、
> 已具备的前提与上线检查清单；**清单未完成不得上线**。

## 已确认的前提（2026-10-13 核实）

- Cloudflare 账号已就绪，zone 与 Pages/Workers 均可用；
- 本仓库为独立公开仓库，CI 走 GitHub Actions；
- 本项目对应的 Pages/Workers 项目尚未创建，域名与子域未选定。

## 构建产物（2026-10-15 定案）

站点是纯静态输出，三种方案都适用；没有边缘逻辑需求，**倾向 Cloudflare Pages（Git 集成）**，最终以创建项目时的决定为准。

| 项 | 值 |
| --- | --- |
| 安装 | `pnpm install --frozen-lockfile`（Node.js 22.13+，`packageManager: pnpm@10.33.0`） |
| 构建命令 | `pnpm build`（`astro check && astro build`） |
| 输出目录 | `dist/`（含 `404.html`，Pages 会自动作为 404 页） |
| 环境变量 | `SITE_URL`：正式域名（如 `https://<域名>/`），用于 canonical / hreflang / og:image 绝对地址；未设置时这些标签退化为相对地址 |
| 可选环境变量 | `GITHUB_TOKEN`：构建时读取发布信息，避开匿名限流；`JIRAN_OFFLINE=1`：离线构建，下载链接退回 Releases 页面 |

注意：版本号与下载直链在**构建时**烘焙，浏览器端会再向 GitHub 刷新一次；产品发版后不重新部署也能显示新版本，
但无 JS 或 GitHub 限流时显示的是上次构建时的版本。

## 候选方案（实现时二选一）

| 方案 | 说明 | 何时适用 |
| --- | --- | --- |
| Cloudflare Pages（Git 集成） | 连接本仓库，push / PR 自动构建与预览 | 静态输出，希望 PR 预览部署 |
| Cloudflare Pages（Direct Upload） | CI 构建后 `wrangler pages deploy` 上传 | 需要构建缓存或自定义流水线 |
| Workers 静态资源 | `wrangler deploy` 发布 assets | 需要边缘逻辑（重定向、API 代理等）时 |

决策点：是否需要边缘逻辑、构建时长与缓存、预览部署方式。

## 上线检查清单（后续任务执行）

- [x] 前端技术栈与构建命令定案，登记到 `AGENTS.md` 并接入 CI（2026-10-15）；
- [ ] 创建 Cloudflare 项目（建议名 `jiran-website`，与仓库同名），确定 Pages / Workers；
- [ ] 选定 zone 与子域（候选：`igng.net` 子域或独立域名），配置自定义域并验证 HTTPS；
- [ ] 若走 CI 上传：在 GitHub 仓库 Secrets 配置 `CLOUDFLARE_API_TOKEN`（最小权限：仅目标账户 Pages/Workers 编辑）与 `CLOUDFLARE_ACCOUNT_ID`；凭据不得提交；
- [ ] 部署工作流：PR 预览 + `main` 合并后自动发布（或手动发布），并记录回滚方式；
- [ ] 构建环境变量 `SITE_URL` 设为正式域名；
- [ ] 上线后验证：`/` 与 `/en/` 200、未知路径返回 404 页、HTTPS 证书、社交卡片（og:image 绝对地址）、产品仓库链接、下载直链；
- [ ] 评估是否将产品仓库 `homepageUrl`（当前指向 GitHub Pages）改为官网域名。

## 回滚

- Pages / Workers：在 Cloudflare 控制台回滚到上一个部署版本，或按对应 CLI 的 rollback 命令处理；
- 域名变更：修改 DNS 记录前记录原值，回滚即恢复原记录。

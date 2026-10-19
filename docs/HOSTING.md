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
| 响应头 | `public/_headers` 随产物发布：`/_astro/*`（文件名带内容哈希）一年 `immutable`；HTML 与其余固定文件名资源用 Pages 默认的回源校验。构建时 `src/integrations/early-hints.mjs` 再把首页字体预加载追加为 `/`、`/en/` 的 `Link` 头，供 103 Early Hints 使用（Pages 不会为带 `crossorigin` 的 `<link>` 自动生成） |
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
| 自定义域名 | `https://jiran.igng.net/`（2026-10-17 绑定，状态 active） |
| 当前生产部署 | `e254113c-79c3-49bd-883e-de616d82ef33`（提交 `7742742`，2026-10-19 发布：加载性能优化 #12～#14，字体子集、长期缓存、103 Early Hints） |
| 回滚点 | `d1f65c46-cdba-4c03-b771-ca5bebb4e0c2`（`f73f182`，同日，无 Early Hints 的 Link 头）；优化前最后一版 `314c1269-c74d-4d76-a375-00ad9415455f`（`afceaf9`，2026-10-17） |
| DNS 记录 | proxied CNAME `jiran.igng.net` → `jiran-website.pages.dev`，zone `igng.net`（zone id `d3f06d3e7ef8cccf99e93ce9c4ea4f44`，record id `5948b8aaffb617d229b0d699da9615aa`） |

Direct Upload 不由 Cloudflare 重新执行仓库构建；真正上传的是 GitHub Actions 生成的 `dist/`。当前 CI 仅在手动触发 `main` 工作流时保留一个 1 天的构建 artifact，未配置长期 Cloudflare API 凭据或自动生产发布工作流。

## 搜索收录

- Bing Webmaster Tools：站点 `https://jiran.igng.net/` **已验证所有权**（2026-10-17），方式是首页
  `<meta name="msvalidate.01" content="B411826ACAE5C5CD20EA5574C3F8A6E4">`；该值是账号级 auth code，与
  其它 `*.igng.net` 站点相同，**删掉这条 meta 会让 Bing 失去所有权记录**。已提交
  `https://jiran.igng.net/sitemap.xml`（抓取状态 Success，2 条 URL）以及 `/` 与 `/en/`。
- Google Search Console：无需为本子域单独验证，域名资源 `sc-domain:igng.net`（权限 `siteFullUser`）已覆盖。
  2026-10-17 用 URL Inspection 查询 `/`、`/en/` 均为 `URL is unknown to Google`，属新建域名的正常状态；
  Google 需要先抓 `public/robots.txt` 的 `Sitemap:` 行才会发现 `public/sitemap.xml`。
- GSC 的 sitemap 提交与 Request Indexing 只能在控制台 UI 做：公开 API 的 `sitemaps.submit` 已下线
  （`GET .../sitemaps` 仍可读，`PUT .../feedpath/...` 一律 404）。
- `public/sitemap.xml` 是**手工维护**的（项目没有 sitemap 集成，站点只有 `/` 与 `/en/`），新增页面必须同步补。

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
- 发布命令（在 artifact 解包目录上执行；自定义域名绑定在项目上，因此每次发布都直接服务 `https://jiran.igng.net/`）：
  `npx wrangler pages deploy dist --project-name jiran-website --branch main`；凭据只以环境变量 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` 注入（账号 `d08c9ec0a1765b7040866053cec24e8b`），不得写进仓库或 CI 长期 Secrets；
- 正式入口：<https://jiran.igng.net/>；默认别名 <https://jiran-website.pages.dev/> 仍然可访问；
- 本机没有 `CLOUDFLARE_API_TOKEN` 时（2026-10-19 的发布即如此）：经已授权的 Cloudflare API 网关取项目上传令牌（`GET /accounts/{account}/pages/projects/jiran-website/upload-token`，30 分钟有效），按 wrangler 相同的规则（`blake3(base64(内容) + 扩展名)` 取前 32 位十六进制）在本机 scratch 上传缺失资产（`/pages/assets/check-missing`、`upload`、`upsert-hashes`），再经网关 `POST .../deployments`（multipart：`manifest`、`branch=main`、`commit_hash`、`commit_message`、`_headers`）。`_headers` 必须随部署一起提交，否则缓存与 Early Hints 规则不生效；令牌不落盘、不入库；
- 回滚：在 Cloudflare Pages 项目中选择上一成功部署版本恢复。发布前记录部署 ID 与对应的 `main` 提交；
- 域名变更：修改 DNS 前记录原值，回滚即恢复原记录；当前记录是 proxied CNAME `jiran.igng.net` → `jiran-website.pages.dev`，改动必须同步 Pages 自定义域名与三处 `SITE_URL`。

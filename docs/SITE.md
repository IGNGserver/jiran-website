# 官网定位与范围（SITE）

> 本文为后续开发者（含 AI 会话）提供站点上下文。范围或技术决策变化时同步更新本文件。

## 是什么

计然 / Jiran 的产品官网：介绍产品、展示截图、提供下载入口与文档链接，并作为搜索引擎与
AI 工具的可引用入口。站点与产品仓库分离：

| 事项 | 归属 |
| --- | --- |
| 产品功能、版本、发布资产、产品文档 | 产品仓库 `IGNGserver/jiran-monitor` |
| 页面、样式、静态资源、SEO、站点文案 | 本仓库 |

## 当前状态（2026-10-15）

- 首版站点已实现：中文首页 `/`、英文首页 `/en/`、`404`；静态输出，可直接托管到 Cloudflare；
- 未创建 Cloudflare 项目、未绑定域名、未上线（见 `docs/HOSTING.md`）。

## 已定案

| 事项 | 结论 |
| --- | --- |
| 技术栈 | Astro 7 静态输出 + TypeScript；首屏 three.js（懒加载）；pnpm；字体自托管 |
| 页面结构 | 单页长卷：首屏 + 七章（名 / 问 / 则 / 汇 / 界 / 源 / 取），章节锚点 `#name` `#questions` `#rules` `#flow` `#privacy` `#sources` `#install` |
| 语言 | 简体中文为默认（`/`），英文 `/en/`；两份文案在 `src/i18n/content.ts`，测试保证结构一致；`hreflang` 互指 |
| 视觉方向 | 「算仪」：墨、骨白、朱砂、黄铜；标识沿用产品图标的开口刻度环几何。详见 `design/DESIGN.md` |
| 下载入口 | 构建时读取最新的非 prerelease 发布并烘焙直链；浏览器端再向 GitHub 刷新一次；失败退回 Releases 页面 |
| 隐私 | 无统计脚本、无 Cookie；唯一外部请求是 GitHub API（读版本号） |

## 待办 / 已知问题

- [ ] 域名与 Cloudflare 项目名（见 `docs/HOSTING.md`），定案后以 `SITE_URL` 注入构建；
- [ ] APT 安装片段暂不展示：产品 README 中的 `igngserver.github.io/jiran/apt` 在仓库改名后 404，
      且已发布的 `jiran.sources` 仍指向旧地址（2026-10-15 实测；新地址 `/jiran-monitor/apt` 可用）。
      产品侧修复后再在「取」一节加入 APT 片段；
- [ ] 产品真实界面截图：产品仓库目前只有 Fluent 2 概念图，没有发布版界面截图，站点暂以示意仪表代替。

## 内容原则

- 只陈述产品仓库当前支持的事实，不编造路线图；版本与平台矩阵以产品仓库 `README.md` 为准；
- 下载链接指向产品仓库的 Releases，不在本仓库托管安装包；
- 品牌名遵循产品仓库规范：zh 显示"计然"，en/ja/ko 显示"Jiran"。

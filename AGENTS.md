# 计然官网（jiran-website）· 项目 Agent 规范

> 只写本仓库与设备级规范的**差异**。Git 纪律、worktree 路径与生命周期、基线解析、冲突处理、
> PR 流程一律见 `~/.qoder/coder-rules/global-rules.md`，不在这里重复；冲突时以设备级安全条款为准。

Collaboration: solo
Baseline: main
Release: none
Validation: `bash scripts/verify-repository.sh`、`git diff --check`（两者即 CI `verify` 作业的内容）；前端技术栈落地后，把该栈的 lint/test/build 命令登记到本节并接入 CI，未登记的检查不得臆造。
Worktree: `~/项目/.wt/计然/<slug>`

## 这是什么

计然 / Jiran 的官网与下载入口，源码与产品仓库分离维护：

- 产品仓库（唯一事实来源）：`https://github.com/IGNGserver/jiran-monitor`（仓库已改名，`token-monitor-suite`、`jiran` 等旧地址由 GitHub 重定向）；
- 本仓库只承载站点（页面、样式、静态资源、站点文档），不得复制产品源码、安装包或发布资产。

**前端技术栈尚未选定**：在技术栈与页面结构定案前，不提交框架脚手架、依赖清单（如 `package.json`）、
锁文件或构建目录；定案时同步更新本文件、`docs/SITE.md`、`docs/HOSTING.md` 与 CI。

## 集成补充

- 无额外门槛：按设备级规范第 5 节（solo）执行；`main` 已设分支保护，必须经 PR 且 CI `verify` 通过。
- 站点部署（Cloudflare）不随合并自动发生，见 `docs/HOSTING.md`。

## 发布

- 无版本化 Release（`Release: none`）；站点以持续部署方式发布，未启用前不得创建 tag 或 Release。

## 项目特殊限制

- 不得提交 `node_modules`、构建产物、`.wrangler/`、`.env*` 与任何凭据；`scripts/verify-repository.sh` 会拦截。
- 站点文案引用产品事实（功能、平台、版本）时必须与产品仓库当前 `README.md` / Release 对齐，不得编造未发布能力。
- 域名与 Cloudflare 项目名在 `docs/HOSTING.md` 记录；未定案前不得把猜测值写入代码或文档结论。

## 环境事实

- 开发位置：ubuntu-dev，NAS 共享卷 `~/项目`；仓库锚点 `~/项目/项目网站/计然`，任务 worktree 在 `~/项目/.wt/计然/<slug>`。
- 生产目标：Cloudflare 边缘网络（账号与 zone 已具备，站点项目与域名未定；不写凭据）。

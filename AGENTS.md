# AIRI 项目协作指南

这份文件只记录长期有效、确实会影响代码安全或生产部署的约束。临时分支、一次性 worktree、当前提交 SHA 和历史备份位置不要写成永久规则。用户在当前任务中的明确要求优先于这里的默认流程。

## 代码基线与 Git

- 私有仓库是 `riverben-max/airi`，远端名为 `fork`；`fork/main` 是唯一正式主线。
- 开始任务前先了解当前分支和工作区状态，并同步最新 `fork/main`。保留用户已有的未提交改动，不要擅自清理或覆盖。
- 只有需要隔离的改动才创建 `codex/<short-description>` 短期分支。完成后合并回 `main`，并删除不再需要的本地和远端分支。
- 准备部署的代码必须先提交并推送到 GitHub，且能够对应到明确的 commit SHA。不要部署只存在于本机的改动。
- 提交只包含当前任务相关文件。不要强推、重写共享历史或执行破坏性 Git 命令，除非用户明确要求。
- Commit message 优先使用 Conventional Commits，例如 `fix(web): restore flux menu`。

## 修改与验证

- 改动保持聚焦，沿用仓库现有结构、组件和编码风格；不要顺手重构无关代码。
- TypeScript 避免无理由使用 `any`；Vue 使用 Composition API 和 `<script setup lang="ts">`。
- UI 文案统一放在 `packages/i18n`；通用组件优先复用 `@proj-airi/ui`，图标优先使用项目已有图标库。
- Web 代码调用 Electron-only API 前必须判断 `window.electron?.ipcRenderer`，避免网页端抛出 IPC 错误。
- 验证范围按改动风险决定，优先运行与改动直接相关的测试、类型检查或构建，不机械执行整套命令。用户明确表示已经验证或要求跳过时，不重复运行，但在交付说明中如实注明。
- 修复 bug 时应先确认根因；若适合自动化回归测试，则补充最小测试。
- 是否需要正式设计或实施计划由任务复杂度判断；一旦创建，必须登记到 `docs/superpowers/README.md`，并在完成或废弃时更新状态以及实现或替代依据（如有）。

## 本机环境

- 默认工作目录为 `D:\Tools\airi`，默认 shell 为 PowerShell 7。
- 文本统一使用 UTF-8 无 BOM 和 LF。PowerShell 写文件使用 `-Encoding utf8NoBOM`；Python 使用 `encoding='utf-8'` 和 `newline='\n'`。
- 前端生产构建使用项目专用 Node 24：`D:\Tools\airi\.node24.local\node-v24.13.0-win-x64\node.exe`。
- pnpm 使用该 Node 目录内 Corepack 提供的 `10.32.1`，不要误用 Codex runtime 的全局 pnpm。
- 常用范围：`apps/stage-web` 是 Web 入口，`apps/server` 是 API，`apps/ui-server-auth` 是认证 UI，`packages/stage-ui`、`packages/stage-layouts` 和 `packages/stage-pages` 是主要前端包，翻译位于 `packages/i18n`。

## 生产部署安全

生产站点是 `https://airi.aifamily.vip/`，通过 `ssh airi-vps` 连接。部署仅在用户要求时执行，并默认从已经推送到 `fork/main` 的明确 commit 构建。

- 服务器源码目录是 `/root/airi`，Web 静态目录是 `/www/wwwroot/airi-web`，认证 UI 位于 `/www/wwwroot/airi-web/ui`，备份放在 `/root/deploy-backups`。
- 不要把服务器 IP、密钥、token、SMTP 密码或其他 secret 写入仓库和交付说明。
- 部署前备份将被替换的内容。不要覆盖 `/root/airi/apps/server/.env` 和 `.env.local`；部署前后校验这两个文件的 SHA-256，确认没有变化。
- 本地前端构建使用 Node 24；服务器 `airi-api` 固定使用 Node.js `22.20.0`。
- PM2 只操作 `airi-api`。不要重启、删除或清理 `oai-reverse-proxy` 及其他服务。
- `apps/stage-web/.env.production` 必须设置 `VITE_SERVER_URL=https://airi.aifamily.vip`，避免前端错误请求 `api.airi.build`。
- 发布主站静态文件时必须保留 `/ui`，例如使用 `rsync --delete --exclude=/ui/***`；不要让主站同步删除认证 UI。
- 部署后按改动范围验证，至少确认 `airi-api` online、Node 版本正确、主页和相关 API 返回正常、根 HTML 引用了本次构建资源。涉及 UI 时再进行真实浏览器检查。

## 默认收尾

1. 确认改动范围和工作区状态。
2. 运行本次任务必要且未被用户免除的验证。
3. 提交并推送到 `fork`。
4. 使用短期分支时，将其合并到 `main` 后删除，避免长期堆积分支。
5. 只有用户要求发布时才部署，并记录 branch、commit SHA、部署时间和结果。

# AIRI Agent Guide

这份文件只保留本项目当前私有部署最关键的执行规则。目标是让后续线程先找准代码基线，再改、提交、部署和验证。

## 唯一可信代码基线

- 当前最新版本以 GitHub 分支为准：`riverben-max/airi` 的 `codex/dasilva-commercial-subscription`。
- 本地主 checkout：`D:\Tools\airi`。后续修复、构建和部署都从这里开始。
- 历史恢复源 worktree：`C:\Users\zheng\.config\superpowers\worktrees\airi\dasilva-commercial-subscription`；只用于本次同步来源，不再作为日常构建目录。
- 本地主 checkout 必须跟踪：`fork/codex/dasilva-commercial-subscription`。
- 最近确认的商业版源 commit：`cee66adea3b73abcb1c126c77fc2aff4925f0bff`，提交信息 `feat(commercial): migrate backend subscription flow`；后续以已 push 的最新 HEAD 为准。
- 如果 `D:\Tools\airi` 不在 `codex/dasilva-commercial-subscription` 或 HEAD 不等于 upstream，先同步代码，不要构建或部署。
- 每次开工先跑：`git status --short`、`git branch -vv`、`git rev-parse HEAD`、`git rev-parse '@{u}'`，确认本地 HEAD 和 GitHub upstream 一致。

## GitHub 保存规则

- 任何准备部署到服务器的代码，必须先提交到 GitHub，确保有可追溯 commit SHA。
- 不允许部署只存在于本机、未 commit、未 push 的代码。
- 提交只包含本次任务相关文件；不要把无关脏改动一起 stage。
- Commit message 使用 Conventional Commits，例如 `fix(web): keep hearing popover above chat input` 或 `docs: pin deployment workflow`。
- 推送目标默认是当前跟踪分支；如果需要新分支，使用 `codex/<short-description>`。
- 推送后记录并在部署说明里写清楚：GitHub remote、branch、commit SHA、构建命令、部署时间、验证结果。

## 本机环境

- 默认 shell 是 PowerShell 7，不是 Bash；命令优先写 PowerShell 语法。
- 读写文本文件统一 UTF-8 无 BOM，行尾用 LF。
- PowerShell 写文件必须带 `-Encoding utf8NoBOM`。
- Python 写文件使用 `encoding='utf-8'` 和 `newline='\n'`。
- 前端生产构建优先使用项目专用 Node 24：`D:\Tools\airi\.node24.local\node-v24.13.0-win-x64\node.exe`。
- 本项目 pnpm 版本是 `10.33.0`；用 Node 24 自带 corepack 跑 pnpm：`D:\Tools\airi\.node24.local\node-v24.13.0-win-x64\node_modules\corepack\dist\pnpm.js`。
- 不要误用 Codex runtime 的 `pnpm`，它可能触发 workspace install/postinstall，并在 mediapipe wasm 准备阶段失败。

## 项目结构速查

- `apps/stage-web`：Web 端入口，Vue 3、Vite、Pinia、UnoCSS。
- `apps/server`：后端 API、认证、计费、管理路由。
- `apps/ui-server-auth`：服务端认证 UI，部署到主站 `/ui`。
- `packages/stage-ui`：Web/Electron 共用核心 UI、stores、composables。
- `packages/stage-layouts`：主交互区、聊天框、桌面/移动布局。
- `packages/stage-pages`：设置页和页面基座。
- `packages/i18n`：翻译集中放这里。
- `packages/ui`：通用 UI primitive，基于 reka-ui。

## 代码规范

- TypeScript 优先明确类型，不要随手写 `any`。
- Vue 使用 Composition API 和 `<script setup lang="ts">`。
- 样式优先用 UnoCSS；长 class 用数组写法。
- 通用组件优先用 `@proj-airi/ui`，不要重复造 primitive。
- 图标优先用 Iconify 或已有图标库。
- 文案和翻译放 `packages/i18n`，不要散落在多个包里。
- Web 端不能因为缺少 Electron IPC 抛出 `Electron ipcRenderer is not available`。
- 调用 Electron-only API 前必须判断 `window.electron?.ipcRenderer`。
- bug 修复先复现和定位根因，再改；结束前必须有新鲜验证结果。

## 常用命令

- Web 构建：`pnpm -F @proj-airi/stage-web build`。
- Web 类型检查：`pnpm -F @proj-airi/stage-web typecheck`。
- Stage UI 类型检查：`pnpm -F @proj-airi/stage-ui typecheck`。
- 指定测试：`pnpm exec vitest run <path/to/test>`。
- 单包测试：`pnpm -F <package-name> exec vitest run`。
- 构建前端时设置：`NODE_OPTIONS=--max-old-space-size=4096`。

## 生产部署

生产环境是私有部署。不要把服务器 IP、密钥、token、SMTP 密码写进仓库。

- 连接服务器：`ssh airi-vps`。
- 线上域名：`https://airi.aifamily.vip/`。
- 服务器源码快照：`/root/airi`，注意它不是可靠 git 工作树，GitHub branch/commit 才是代码来源。
- Web 静态目录：`/www/wwwroot/airi-web`。
- Auth UI 静态目录：`/www/wwwroot/airi-web/ui`。
- 备份目录：`/root/deploy-backups`。
- 服务器 API/PM2 固定 Node 22.20.0：`/www/server/nvm/versions/node/v22.20.0/bin`。
- 本地前端构建用 Node 24；服务器 API 运行用 Node 22.20.0，两者不要混淆。

部署硬规则：

- 部署前确认要部署的 GitHub commit SHA，且该 SHA 已 push。
- 不要覆盖 `/root/airi/apps/server/.env` 和 `.env.local`。
- 部署前后都跑：`sha256sum /root/airi/apps/server/.env /root/airi/apps/server/.env.local`，确认 env 没变。
- PM2 里只动 `airi-api`；不要重启或清理 `oai-reverse-proxy`。
- 重启 `airi-api` 必须显式带 Node 22 PATH：
  `ssh airi-vps 'export PATH=/www/server/nvm/versions/node/v22.20.0/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin && /www/server/nvm/versions/node/v22.20.0/bin/pm2 restart airi-api --update-env'`
- `apps/stage-web/.env.production` 必须有 `VITE_SERVER_URL=https://airi.aifamily.vip`。
- 缺少 `VITE_SERVER_URL` 会导致前端请求 `api.airi.build`，进而出现 session、CORS 或空白页问题。
- 发布主站时保留 auth UI：`rsync -a --delete --exclude=/ui/*** <dist>/ /www/wwwroot/airi-web/`。
- 本机没有 `rsync` 时，用 `tar.gz + scp` 上传到服务器 `/tmp`，再在服务器解压并用 `rsync --delete --exclude=/ui/***` 发布。

部署后必须验证：

- `pm2 ls` 确认 `airi-api` online。
- `pm2 describe airi-api` 确认 Node.js version 是 22.20.0。
- `https://airi.aifamily.vip/` 返回 200。
- `https://airi.aifamily.vip/api/auth/get-session` 返回 200。
- `https://airi.aifamily.vip/ui/sign-in` 返回 200。
- 根 HTML 引用了本次新构建的 `/assets/index-*.js`。
- 用真实浏览器打开主站，确认页面可见、无 page error、无 `Electron ipcRenderer` 报错、无 `api.airi.build` 请求。
- 用户说“网页端”时用桌面视口截图验证；只有移动端问题才用移动视口。
- 如果服务器验证正常但用户浏览器还是旧页面，先提示 `Ctrl + F5` 或隐私窗口，因为 PWA/service worker 可能缓存旧包。

## 清理旧目录

- 不要直接删除旧目录或脏 worktree；先移到带时间戳的备份目录。
- 要替换 `D:\Tools\airi`，必须先确认最新代码已 commit 并 push 到 GitHub，再移动旧目录并重新 clone 正确分支。
- 删除前至少记录：目录路径、当前 branch、HEAD、`git status --short`、备份位置。
- 本地 Node 24 目录 `.node24.local` 是机器工具，不进 Git；替换 checkout 后可以从备份目录复制回来。

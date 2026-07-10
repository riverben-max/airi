# Web Onboarding Login Entry Design

## 目标

Web 端首次访问仍显示现有“欢迎来到 AIRI”弹窗，但点击“开始吧”后不再进入 `Get Started`、新用户/返回用户选择、服务来源或角色配置等后续新手步骤，而是通过当前 OIDC + PKCE 流程进入同域 Auth UI `/ui/sign-in`。

只有登录成功并返回 Stage Web 后才完成 onboarding。用户取消登录、登录失败或使用浏览器返回时，重新进入主站仍应显示欢迎弹窗。

## 已确认现状

- `step-welcome.vue` 的按钮调用通用 `onNext`。
- `onboarding.vue` 把 `welcome` 后的下一步固定为 `start-choice`，所以当前点击必然进入 `Get Started`。
- Web 的正确登录入口是 `authStore.requestLogin()`。它会构造 OIDC Authorization Code + PKCE 请求，服务端随后把用户带到 `/ui/sign-in`。
- 直接导航到 `/ui/sign-in` 不带完整 OIDC 上下文，登录成功后不能可靠回到 Stage Web 并签发所需 token，因此不采用。
- `onboarding/completed` 和 `onboarding/skipped` 决定欢迎弹窗是否再次出现；`airi-onboarding-state` 保存当前向导步骤。

## 设计

### 1. Web 端覆盖欢迎按钮行为

为共享 `OnboardingDialog` / `Onboarding` 增加一个可选的欢迎开始回调。只有 `apps/stage-web` 传入该回调：

1. Web 模式固定从 `welcome` 开始，不恢复旧 `airi-onboarding-state` 中的步骤。
2. 进入 Web 模式时清除已有向导进度，确保已经停在 `Get Started` 的浏览器升级后回到欢迎页。
3. 当前步骤为 `welcome` 时调用 Web 提供的回调。
4. 不执行通用 `navigateNext()`，因此 `step` 保持为 `0`。
5. 未传入回调的 Pocket、桌面或其他消费者继续恢复并使用现有完整 onboarding，不改变其行为。

展示组件 `step-welcome.vue` 保持只负责显示和发出 `onNext`，不直接依赖认证 store。

### 2. 发起登录

Stage Web 的欢迎开始处理函数执行以下操作：

1. 在 `sessionStorage` 写入一次性“登录由 Web onboarding 发起”标记。
2. 调用 `authStore.requestLogin()`。
3. 如果发起登录在离开当前页面前抛错或 Promise 被拒绝，则删除该标记，并保持 onboarding 未完成。

不在点击时写入 `onboarding/completed`，也不删除 `airi-onboarding-state`。

### 3. 登录成功后完成 onboarding

Stage Web OIDC callback 在以下条件全部成立后消费标记：

1. OIDC callback 没有返回错误。
2. token 交换成功。
3. `fetchSession()` 返回有效用户会话。
4. `sessionStorage` 中存在 onboarding 登录标记。

消费标记时：

- 调用 onboarding store 的完成逻辑，写入 `onboarding/completed=true` 并关闭弹窗。
- 删除 `airi-onboarding-state`，避免残留旧步骤。
- 删除一次性 onboarding 登录标记。
- 继续现有 `router.replace('/')` 返回主页面。

普通登录 callback 没有该标记时不改 onboarding 状态。

### 4. 取消与失败行为

- 用户从 `/ui/sign-in` 返回主站：没有成功 callback，`onboarding/completed` 仍为 `false`；由于步骤未前进，欢迎页再次显示。
- Auth UI 或 callback 报错：不完成 onboarding；用户返回主站后仍显示欢迎页。
- 登录发起失败：清除一次性标记并保留当前欢迎页。
- 标记只存于 `sessionStorage`，不会跨浏览器会话长期残留。

## 状态流

```text
欢迎页 step=0
  -> 点击“开始吧”
  -> 写 sessionStorage pending 标记
  -> authStore.requestLogin()
  -> OIDC authorize
  -> /ui/sign-in

取消/返回/失败
  -> completed 仍为 false
  -> 主站再次显示欢迎页 step=0

登录成功
  -> Stage Web callback 换取 token
  -> fetchSession() 确认有效会话
  -> 消费 pending 标记
  -> completed=true，清理 onboarding 步骤状态
  -> 返回主站，不再显示欢迎页
```

## 测试策略

### 单元与组件测试

- 点击 Web 欢迎页“开始吧”会调用欢迎开始回调，且不会进入 `start-choice`。
- Web 模式忽略并清除已保存的 `step=1` 或其他旧向导进度，始终显示欢迎页。
- 发起登录前写入 pending 标记；发起函数失败时删除标记。
- callback 只有在 token/session 成功且 pending 标记存在时才完成 onboarding。
- callback 没有 pending 标记时不修改 onboarding 状态。
- callback 出错或 session 为空时不完成 onboarding。

测试先以当前行为建立失败用例，再做最小实现。

### 浏览器验证

使用桌面视口和全新浏览器存储验证：

1. 首次打开主站只看到欢迎页。
2. 点击“开始吧”直接进入同域 `/ui/sign-in`，不出现 `Get Started`。
3. 在登录页返回主站后欢迎页再次出现。
4. 完成真实登录后回到主站，欢迎页不再出现。
5. 页面没有 `api.airi.build` 请求或 `Electron ipcRenderer is not available` 错误。

## 非目标

- 本次不删除共享 onboarding 的后续步骤文件。
- 本次不改变 Pocket、Tamagotchi 或其他客户端的 onboarding。
- 本次不恢复或修改顶栏登录按钮；该问题单独处理。
- 本次不改变 Auth UI 的表单、认证提供商、订阅或计费流程。
- 本次不直接跳转裸 `/ui/sign-in`，也不恢复旧 `/auth/login` 路径。

## 验收标准

- Stage Web 点击欢迎页“开始吧”后不会渲染 `Get Started`。
- 已保存旧 onboarding 步骤的浏览器升级后也只显示欢迎页，不恢复 `Get Started`。
- 浏览器通过 OIDC + PKCE 进入 `https://airi.aifamily.vip/ui/sign-in`。
- 取消、失败或返回时欢迎页再次显示。
- 只有成功建立 Stage Web 会话后 onboarding 才标记完成。
- 成功登录返回主站后不再显示欢迎页。
- 其他客户端的现有 onboarding 行为不变。

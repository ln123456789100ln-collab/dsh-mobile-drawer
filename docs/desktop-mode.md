# 桌面模式（可选，进阶）

默认情况下，启动器会起一个**独立的 DSH 工作区**给手机用（不会动你日常的数据）。
如果你希望手机远程操作的正是**日常桌面 DSH 实例**（历史会话、插件、项目文件都在），需要装 `desktop-bridge/`。

> 这是本机验证过的进阶用法，步骤涉及 DSH 的本地 profile，DSH 升级后可能需要重做。不熟悉的话建议先用默认的独立工作区模式。

## 原理

- `desktop-bridge` 是一个 DSH 插件，通过 `cordis.patch.yml` 插到日常 DSH 的 web server 上；
- 它读取 `%USERPROFILE%\.dsh-remote` 下的配置，并暴露 `host-auth` 和 `/dsh-mobile/api/state`；
- 桌面端会把本机回环地址 + 短期 token 写到 `%USERPROFILE%\.dsh-remote\desktop-host.json`；
- 启动器的 `desktop-runtime.mjs` 读这个文件，直接连日常实例，不再另起工作区。

## 安装步骤（Windows）

假设仓库在 `C:\dsh-remote-kit`，日常 DSH profile 在 `%USERPROFILE%\.dsh\profiles\desktop`。

1. 安装桥接依赖：

   ```powershell
   cd C:\dsh-remote-kit\desktop-bridge
   npm install
   ```

   这会把 `vendor\dsh-mobile-0.1.9-local-compat.tgz` 里的插件装进 `desktop-bridge\node_modules`。

2. 把桥接注册进 desktop profile。编辑
   `%USERPROFILE%\.dsh\profiles\desktop\package.json`，在 `dependencies` 里加一条：

   ```json
   "dsh-mobile-desktop-local": "link:C:/dsh-remote-kit/desktop-bridge"
   ```

   同时在 `dsh.profile.bundles` 数组里加 `"dsh-mobile-desktop-local"`。

3. 安装依赖并重启 DSH：

   ```powershell
   cd $env:USERPROFILE\.dsh\profiles\desktop
   pnpm install
   ```

   然后完全退出 DeepSeek Harness 再重新打开。

4. 把远程模式切到 desktop：

   编辑 `%USERPROFILE%\.dsh-remote\settings.json`，确保有：

   ```json
   { "mode": "desktop", "relay": "https://当前中转地址" }
   ```

   切之前最好先停一次启动器。

5. 重新双击 `launcher\Start-All.vbs`。启动器会用 `desktop-runtime.mjs` 连接日常实例，控制页显示运行中即可。

## 回退

把 `settings.json` 里的 `"mode": "desktop"` 改成 `"standalone"`（或删掉 `mode`），重启启动器；
需要彻底移除时，从 profile 的 `dependencies` / `bundles` 里删掉 `dsh-mobile-desktop-local`，`pnpm install` 后重启 DSH。

## 注意

- 桥接目录**不能随意移动**；移动后要重新 `npm install` 并更新 profile 里的 link 路径。
- 不要在 DSH 插件市场里更新 `@april-jk/dsh-mobile`，会覆盖本地适配版；升级请跟着本仓库走。
- desktop 模式会读写日常 DSH 的数据目录；先在普通模式下确认能正常使用再切。
- 如果更换了远程中转地址，需要同时更新 `settings.json` / `remote.json` / `local-relay.json`；用控制页的“中转连接设置”最稳。

# desktop-bridge（可选组件）

把 DSH 日常桌面实例接入远程访问的本地桥接插件。

## 它做什么

- 以 DSH 插件身份（`cordis.patch.yml`）插入日常桌面实例的 web server；
- 从 `%USERPROFILE%\.dsh-remote` 读取 `settings.json` / `remote.json` / `local-relay.json`；
- 复用 `@april-jk/dsh-mobile` 的 `RemoteAccessManager` / `RelayClient` / `LocalHostAuth`，在桌面实例上开启远程访问；
- 供启动器的 `desktop-runtime.mjs` 通过 `desktop-host.json` 连接（本机回环 + 短期 token）。

## 依赖

- `@april-jk/dsh-mobile` 来自 `../vendor/dsh-mobile-0.1.9-local-compat.tgz`（适配版，不要在插件市场里替换）。
- Node/DSH 版本同仓库其他组件。

安装与注册步骤见 [`../docs/desktop-mode.md`](../docs/desktop-mode.md)。默认的独立工作区模式**不需要**这个组件。

## 注意

- 桥接目录不要随意移动；移动后要重新 `npm install` 并更新 DSH profile 里的 `link:` 路径。
- 它只读写启动器的数据目录，不改变 Relay 的端到端加密模型。
- DSH 升级可能改动插件加载方式（`cordis.patch.yml`），届时需要重新适配。

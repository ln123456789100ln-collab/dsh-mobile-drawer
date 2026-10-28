# launcher（Windows 一键启动器）

把「打隧道 → 起 Relay → 配置地址 → 起 DSH 工作区 → 打开控制页」串成一次双击。

## 入口

| 文件 | 用途 |
| --- | --- |
| `Start-All.vbs` | 一键启动，并自动打开控制页（推荐） |
| `Start-All-Silent.vbs` | 一键启动，不打开浏览器（开机自启用） |
| `Start.vbs` | 只启动独立启动器工作区（不拉起 cloudflared/relay，供手动配置中转时使用） |

等价的手动命令：`node one-click.mjs`（在 `launcher` 目录）。

## 启动流程

1. `one-click.mjs` 读取布局：`../tools/cloudflared.exe`、`../relay/dist/server.js`、`../vendor/dsh-mobile-0.1.9-local-compat.tgz`。
2. 启动 cloudflared Quick Tunnel（或使用 `%USERPROFILE%\.dsh-remote\fixed-relay.txt` 里的固定地址），解析出公网 URL。
3. 启动 Relay（`127.0.0.1:8788`），把公网 URL 写进：
   - `%USERPROFILE%\.dsh-remote\settings.json`（`relay`）
   - `remote.json`、`local-relay.json`
4. 启动工作区进程 `main.mjs`（Electron 以 Node 模式运行），它起控制页 `127.0.0.1:30889`。
5. `ready` 后打开控制页；之后一直监管子进程，任一下退出就整体收尾。

## 控制页

- 状态：运行中/停止、桌面连接状态、当前中转地址。
- **显示配对码**：生成手机扫码用的链接（含一次性凭据）。
- 停止 / 停止并退出启动器。
- 中转连接设置（停止状态下可改 URL）。
- 撤销配对。

## 工作区模式

- `runtime.mjs`：**独立工作区**（默认）。用 `DSH_HOME=%USERPROFILE%\.dsh-remote\home` 起一个独立 DSH，安装 `vendor/` 里的插件包；不碰日常数据。
- `desktop-runtime.mjs`：**桌面模式**。读取 `%USERPROFILE%\.dsh-remote\desktop-host.json`（由 `desktop-bridge` 插件写入），连接日常 DSH 实例。见 [`../docs/desktop-mode.md`](../docs/desktop-mode.md)。

## 其他脚本

- `keep-awake.ps1`：启动器存活期间保持系统唤醒（屏幕允许关闭）。
- `Install-AutoStart.ps1`：把 `Start-All-Silent.vbs` 装到登录启动目录；`-Remove` 卸载。
- `Start-TailscaleFunnel.ps1`：Tailscale Funnel 固定地址，见 [`../docs/fixed-relay.md`](../docs/fixed-relay.md)。

## 环境变量

| 变量 | 作用 |
| --- | --- |
| `DSH_LAUNCHER_DATA` | 覆盖数据目录（默认 `%USERPROFILE%\.dsh-remote`），测试时可用 |
| `DSH_LAUNCHER_APP` | DSH 安装目录（默认 `%LOCALAPPDATA%\Programs\DeepSeek Harness`） |
| `DSH_LAUNCHER_PORT` | 控制页端口（默认 `30889`） |
| `DSH_LAUNCHER_NO_BROWSER=1` | 不自动打开浏览器 |
| `DSH_PUBLIC_RELAY_URL` | 强制使用固定公网地址（跳过 Quick Tunnel） |

## 依赖

- Windows 10/11
- Node.js LTS（默认路径 `%ProgramFiles%\nodejs\node.exe`）
- DeepSeek Harness 桌面版（默认安装路径）
- `tools\cloudflared.exe`（版本和 SHA256 见仓库 [`tools/README.md`](../tools/README.md)）
- 已构建的 `relay\dist\server.js`（`cd relay && npm ci && npm run build`）

## 注意

- 数据目录由启动器设为仅当前 Windows 用户可读写；里面含配对/密钥，不要提交或分享。
- 端口 30889/8788 被占用时启动器不会强杀未知进程，会直接报错让你处理。
- 卡住时先看控制页错误和 `%USERPROFILE%\.dsh-remote\last-start-diagnostic.txt`，排错见 [`../docs/troubleshooting.md`](../docs/troubleshooting.md)。

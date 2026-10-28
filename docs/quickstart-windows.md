# Windows 快速开始

本文按“从零到 iPhone 能用”的顺序写。假设你已经有 DSH 桌面版并能正常使用。

## 0. 前置条件

- Windows 10/11（启动器只在 Windows 上测过）
- **DeepSeek Harness 桌面版**，默认安装到 `%LOCALAPPDATA%\Programs\DeepSeek Harness`
- **Node.js LTS**（默认路径 `%ProgramFiles%\nodejs\node.exe`）
- 一台 iPhone（Safari 15.4+）
- 能访问 GitHub / Cloudflare 的网络（下载 cloudflared、打隧道）

## 1. 克隆仓库

```powershell
git clone https://github.com/ln123456789100ln-collab/dsh-remote-kit.git
cd dsh-remote-kit
```

## 2. 准备 cloudflared

版本必须匹配（启动器会校验 SHA256）：

```powershell
curl.exe -L -o tools\cloudflared.exe https://github.com/cloudflare/cloudflared/releases/download/2026.10.3/cloudflared-windows-amd64.exe
Get-FileHash tools\cloudflared.exe -Algorithm SHA256
# 期望：76B2805253D0D6FFACB092A7ACFBEE99E7AF6917835C0C5410E23F3EF5052DA2
```

## 3. 构建 Relay

```powershell
cd relay
npm ci
npm run build      # 生成 relay\dist\server.js
cd ..
```

> 如果你之后想省磁盘，可以在构建完成后执行 `npm prune --omit=dev`；启动器运行的是 `dist\server.js`，需要生产依赖。

## 4. 启动

双击：

```text
launcher\Start-All.vbs
```

（等价于 `wscript.exe launcher\Start-All.vbs`；也可以用 `Start-All-Silent.vbs` 不自动打开浏览器。）

启动器会依次：

1. 启动 cloudflared，等它拿到 `https://xxx.trycloudflare.com`；
2. 用这个地址启动本机 Relay（`127.0.0.1:8788`）并写入配置；
3. 启动 DSH 独立工作区（默认模式）；
4. 打开本机控制页 `http://127.0.0.1:30889`。

## 5. 手机配对

1. 控制页显示“运行中”后，点 **显示配对码**；
2. iPhone 相机扫码（或 Safari 输入控制页给出的链接）；
3. 首次进入后**刷新两次**：
   - 第一次：拿到 HTML 并安装新的 Service Worker；
   - 第二次：Service Worker 接管页面，注入手机抽屉 UI。
4. 之后可以把 `/app/` 收藏到主屏幕，当作 PWA 使用。

## 6. 日常使用

- **停止**：控制页“停止并退出启动器”。停止会中断正在运行的任务。
- **再次启动**：双击 `launcher\Start-All.vbs` 即可；数据在 `%USERPROFILE%\.dsh-remote`，不会丢。
- **换网络/重启后**：Quick Tunnel 域名会变，手机要重新扫码（或用固定地址，见 [`fixed-relay.md`](fixed-relay.md)）。
- **开机自启**：`powershell -ExecutionPolicy Bypass -File launcher\Install-AutoStart.ps1`
- **防休眠**：启动器运行时自动执行 `launcher/keep-awake.ps1`。

## 7. 进阶选项

- 固定地址（不再重新扫码）：[`fixed-relay.md`](fixed-relay.md)
- 远程操作日常 DSH 实例（桌面模式）：[`desktop-mode.md`](desktop-mode.md)
- 出问题：[`troubleshooting.md`](troubleshooting.md)
- 安全边界：[`security.md`](security.md)

# 架构

## 组件与端口

```text
┌─────────────────── Windows 电脑（你的） ───────────────────┐
│                                                            │
│  launcher/  ──启动并监管──▶  tools/cloudflared.exe         │
│      │                         │  Quick Tunnel（出站）    │
│      │                         ▼                          │
│      └──启动并配置──▶  relay/（node dist/server.js :8788） │
│      │                         ▲                          │
│      │                         │ 加密 WebSocket           │
│      └──启动/连接──▶  DSH 桌面端 + plugin/                 │
│                                │                          │
│                    desktop-bridge/（可选，接日常实例）      │
│                                                            │
│  控制页 http://127.0.0.1:30889（配对码、启停、中转设置）    │
└────────────────────────────────────────────────────────────┘
          ▲ 公网 HTTPS（TryCloudflare / Tailscale Funnel）
          │
   iPhone Safari（Relay 的 /app/ Web 客户端）
```

| 组件 | 端口/位置 | 说明 |
| --- | --- | --- |
| cloudflared | 出站连接 | 把 `127.0.0.1:8788` 暴露为 `https://xxx.trycloudflare.com` |
| Relay | `127.0.0.1:8788` | 设备配对、访问会话、加密隧道服务端、Web 客户端（`/app/`）、`/health` |
| 控制页 | `127.0.0.1:30889` | 启动器 UI：运行状态、配对码、启停、中转地址设置 |
| DSH | 本地随机端口 | 桌面版正常实例，或启动器创建的独立工作区 |
| 数据目录 | `%USERPROFILE%\.dsh-remote` | 所有密钥、配对、Relay 数据库、设置（仅当前用户可读） |

## 两种运行模式

### 1. 独立工作区模式（默认）

启动器用 `runtime.mjs` 起一个**独立的 DSH 工作区**（`DSH_HOME=%USERPROFILE%\.dsh-remote\home`），
把 `vendor/dsh-mobile-0.1.9-local-compat.tgz` 安装进去，远程访问的是这个工作区。
不会动你日常 DSH 的历史、插件和登录态，适合“只给手机用一套独立环境”。

### 2. 桌面模式（可选，进阶）

启动器用 `desktop-runtime.mjs` 连接**你日常的 DSH 桌面实例**：
需要把 `desktop-bridge/` 作为本地插件装进 DSH 的 desktop profile，桌面端会写 `desktop-host.json`（含本机回环地址与短期 token）。
远程访问的就是你日常的会话和文件。安装方式见 [`desktop-mode.md`](desktop-mode.md)。

## 配对与加密（上游协议）

1. 手机扫描控制页二维码，二维码是 `https://<relay>/app/#/pair?code=...&key=...` 形式；`#` 后面的内容不会发给 Relay。
2. 手机在浏览器里生成设备密钥（IndexedDB），用配对码和电脑完成握手；电脑侧把设备公钥记进 Relay 数据库。
3. 之后每次访问：手机向 Relay 申请一次性 `web-ticket`，再通过 WebSocket 建立 `sealed-tunnel-v1` 加密隧道。
4. Relay 只做密文转发和路由；HTML/JS/图片等资源也走加密隧道，由 Service Worker 解密后再交给页面。
5. 手机 UI 的 `mobile.css` / `mobile.js` 由 Service Worker 内嵌返回并注入到代理 HTML（见 [`mobile-ui.md`](mobile-ui.md)）。

> 协议细节以 `relay/` 与 `plugin/` 源码为准；这里只描述本套件的使用方式。

## 数据流（一次手机请求）

```text
手机 fetch /app/xxx
  → Relay（TLS 终止，密文管道）
  → 电脑端插件解密 → 本机 DSH HTTP
  → 响应加密回传
  → 手机 Service Worker 解密 → 页面
```

## 目录与职责

- `launcher/one-click.mjs`：编排入口（cloudflared → relay → 配置 → 工作区），持有子进程生命周期。
- `launcher/main.mjs` + `server.mjs` + `runtime.mjs` / `desktop-runtime.mjs`：控制页与 DSH 工作区管理。
- `relay/src/server.ts`：Relay 后端；`relay/web/app`：浏览器端 Web 客户端和手机 UI。
- `plugin/`：DSH 插件源码（远程访问、配对、host-auth、轻量资源）。
- `desktop-bridge/index.mjs`：把插件能力接入日常 DSH profile 的本地桥。
- `tests/`：真实 DSH 页面注入回归 + 部署检查。

## 版本与升级

- Relay `0.1.9`，手机 UI `mobile4`，启动器 `fast5` 引导版本。
- 升级 DSH 后如果手机 UI 失效，先跑 `tests/mobile-check.cjs`；CSS Module 类名变化会导致选择器失效。
- 升级 cloudflared 需要同步 `launcher/one-click.mjs` 中的 SHA256 校验值。

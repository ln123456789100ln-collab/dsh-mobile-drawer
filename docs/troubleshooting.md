# 排错

先看控制页（`http://127.0.0.1:30889`）显示的状态和错误，它比日志直观。启动器相关诊断在
`%USERPROFILE%\.dsh-remote\last-start-diagnostic.txt`。

## 启动相关

| 现象 | 排查 |
| --- | --- |
| 双击没反应 / 一闪而过 | 用 PowerShell 手动跑 `node launcher\one-click.mjs` 看报错（先确保没有另一份启动器在跑） |
| “Cloudflare 程序校验失败” | `tools\cloudflared.exe` 版本不对，按 [`../tools/README.md`](../tools/README.md) 重新下载并核对 SHA256 |
| “本机中转端口已占用，但启动器未运行” | 30889 或 8788 被别的进程占用；关掉旧启动器/残留 node 进程再试 |
| “DeepSeek Harness was not found” | DSH 没装到默认路径；或设置环境变量 `DSH_LAUNCHER_APP` 指向安装目录 |
| “本机中转未能启动” | `relay` 没有构建或依赖缺失：`cd relay && npm ci && npm run build` 后重试 |
| 控制页打不开或 401 | 用桌面快捷方式/`Start-All.vbs` 打开（会带一次性登录 URL），不要直接开 `127.0.0.1:30889` |
| 浏览器提示需重新打开 | 再次双击 `Start-All.vbs`，它会复用已运行服务并重新打开控制页 |

## 手机连不上 / 打开是旧界面

| 现象 | 原因与处理 |
| --- | --- |
| 手机 404 / 打不开 | 手机还存着旧的 Quick Tunnel 域名；重新从控制页扫码 |
| 页面能开但仍是桌面布局 | 刷新两次；仍不行就清一次该站点的网站数据（Safari：设置 → 网站数据）后再打开 |
| 显示“没有匹配的对话”但不该如此 | 搜索是**本地过滤**，只过滤当前已加载的会话；清空搜索即可 |
| 插件页顶部被顶栏压住 | 旧版手机 UI；确认 relay 里的 `sw.js` 是 `mobile4` 及以后版本 |
| 直接访问 `/app/mobile.css` 返回 426/404 | 这是预期行为：手机资源只由 Service Worker 返回 |

## Relay / 网络

- 手机和电脑都能上网才能建立隧道；公司网络/代理可能拦截 WebSocket。
- `https://<隧道域名>/health` 应返回 `{"ok":true,...}`；不返回说明本机 Relay 没起来。
- Quick Tunnel 每次重启换域名；想固定地址见 [`fixed-relay.md`](fixed-relay.md)。
- 隧道域名被 Cloudflare 限流时换一个时间重试；长期使用建议 Funnel/命名隧道。

## 桌面模式（可选）

- 控制页报“桌面连接尚未就绪”/`desktop-host.json` 不存在：桌面桥接没装好或 DSH 未重启，见 [`desktop-mode.md`](desktop-mode.md)。
- 远程看到的不是日常会话：确认 `%USERPROFILE%\.dsh-remote\settings.json` 里 `"mode": "desktop"`。
- 想回到独立工作区：把 `mode` 改回 `"standalone"`（或删掉），重启启动器。

## DSH 升级后手机 UI 坏了

手机 UI 依赖 DSH Web 的 CSS Module 类名（带哈希）。升级 DSH 后：

```powershell
cd tests
npm install
npm run test:mobile
```

失败项会指向具体选择器/结构变化，需要更新 `relay/web/app/mobile.css` 和 `mobile.js`。

## 报错时请提供

- 控制页的状态截图（**不要包含二维码/URL token**）
- `last-start-diagnostic.txt` 里与错误相关的几行（自行打码）
- 复现步骤和手机型号/iOS 版本

不要在 issue 里粘贴二维码、`controller.json`、`remote.json`、JWT 或 relay 数据库。

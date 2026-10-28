# 安全模型与隐私说明

> 这是一个个人项目，**没有做过正式安全审计**。下面写清楚它在设计上保护什么、不保护什么，方便你判断是否适合自己用。

## 数据放在哪

电脑上所有运行数据都在 `%USERPROFILE%\.dsh-remote`（启动器启动时会把它设置为仅当前用户可读写）：

| 文件/目录 | 内容 |
| --- | --- |
| `controller.json` | 控制页的一次性登录 URL（含 token） |
| `settings.json` / `remote.json` / `local-relay.json` | 当前中转地址、设备配置 |
| `cloudflare-relay/relay.sqlite` | Relay 数据库：账号、设备公钥、访问会话元数据 |
| `cloudflare-relay/jwt-secret.txt` | Relay 的 JWT 签名密钥 |
| `home/`、`projects/` | 独立工作区的 DSH 数据与文件 |
| `desktop-host.json` | 桌面模式下 DSH 本机回环地址与短期 token |

这些内容**都不在仓库里**，也不要提交、截图或发给别人。

## 端到端加密

- 手机与电脑之间的数据走 `sealed-tunnel-v1`：双方用配对时交换的密钥做加解密，Relay 只转发密文。
- Relay 能看到：访问时间、来源 IP（在其日志/反向代理层）、密文大小、目标设备 ID/路由信息。
- Relay **看不到**：对话内容、文件内容、DSH 页面 HTML/JS 明文（它们在隧道里加密）。
- 手机私钥保存在浏览器 IndexedDB；电脑侧凭据在本机数据目录。

## 公网入口

- Cloudflare Quick Tunnel / Tailscale Funnel 都会终止 TLS，但看到的仍是 Relay 密文流量。
- 入口域名本身是公开的，但需要配对凭据才能进入；不要把带 `#/pair?...` 的二维码/链接发给别人。
- 换隧道域名后旧入口失效；删掉配对可以在控制页撤销。

## 本地边界

- 控制页只监听 `127.0.0.1:30889`；Relay 只监听 `127.0.0.1:8788`，由 cloudflared 出站连接，不直接暴露局域网。
- 启动器以你的 Windows 用户身份运行，能操作 DSH 能操作的一切文件；不要在不可信的共享账号下使用。
- 桌面桥接会读取 `%USERPROFILE%\.dsh-remote` 下的配置；它不改变 Relay 的加密模型。

## 仓库卫生

本仓库发布前做过这些检查：

- 全仓扫描 API key / JWT / 私钥 / 公网 IP / 隧道域名 / 本机路径 / 邮箱：无命中；
- 截图经过脱敏（会话名、头像、余额、模型名），图片无 EXIF；
- git 提交作者使用 GitHub noreply 身份；
- 不包含 cloudflared 二进制、DSH 本体、Relay 数据库、真实会话数据。

## 建议

- 只在自有电脑上部署；不要把 Relay 部署到不受控的公共主机上。
- 给 Windows 账号设置密码和锁屏；数据目录权限保持默认（仅当前用户）。
- 定期在控制页撤销不再使用的设备配对。
- 如果暴露了二维码/链接，立即撤销配对并重启启动器（换新隧道）。
- 发现问题欢迎开 issue，但请不要在 issue 里贴二维码、token、日志中的凭据。

# tools 目录

这个目录用来放外部命令行工具，二进制文件**不入库**（见仓库 `.gitignore`）。

## cloudflared（必需）

一键启动器目前只验证过 Cloudflare 官方 `cloudflared` **2026.10.3**（Windows 64 位）：

- 下载地址：
  <https://github.com/cloudflare/cloudflared/releases/download/2026.10.3/cloudflared-windows-amd64.exe>
- 保存为：`tools\cloudflared.exe`
- SHA256（必须完全一致，启动器会校验）：
  `76b2805253d0d6ffacb092a7acfbee99e7af6917835c0c5410e23f3ef5052da2`

PowerShell 校验：

```powershell
Get-FileHash tools\cloudflared.exe -Algorithm SHA256
```

如果版本不匹配，启动器会报“Cloudflare 程序校验失败”，不会继续启动。升级 launcher 的校验值时，请同步修改 `launcher/one-click.mjs` 里的 SHA256。

## 可选工具

- **Tailscale**：想用固定地址（`https://<机器名>.<tailnet>.ts.net`）时安装，见 [`docs/fixed-relay.md`](../docs/fixed-relay.md)。
- **Node.js**：不放在这里；请安装 LTS 到默认路径 `%ProgramFiles%\nodejs`。

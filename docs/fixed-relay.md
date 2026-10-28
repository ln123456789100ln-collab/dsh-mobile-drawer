# 固定地址（Tailscale Funnel / 命名隧道）

目标：重启电脑后手机仍用同一个地址，不再因为 Quick Tunnel 换域名而重新扫码。

## 前置条件

1. 电脑和手机登录同一个 Tailscale 账号，电脑 Tailscale 状态为 `Running`。
2. 在 Tailscale 管理后台为这个 tailnet 开启 Funnel（需要 HTTPS 证书和节点权限）。
3. 当前一键启动仍在运行，本机 `127.0.0.1:8788/health` 正常。

## 建立固定地址

在仓库的 `launcher` 目录运行：

```powershell
cd launcher
powershell -ExecutionPolicy Bypass -File .\Start-TailscaleFunnel.ps1 -WriteFixedRelay
```

脚本会：

- 执行 `tailscale funnel --bg 8788`，把本机 Relay 暴露为固定的 `https://<机器名>.<tailnet>.ts.net`；
- 检查 `https://.../health`；
- 在 `%USERPROFILE%\.dsh-remote\fixed-relay.txt` 写入固定地址。

然后关闭当前一键启动窗口，重新打开 `DeepSeek 手机远程（一键启动）`。启动器检测到 `fixed-relay.txt` 后会跳过 Cloudflare Quick Tunnel，直接使用固定地址。

第一次切换时手机需要重新扫码一次；之后重启电脑地址不变。

## 开机自启

固定地址验证通过后，再安装开机自启：

```powershell
powershell -ExecutionPolicy Bypass -File .\Install-AutoStart.ps1
```

Tailscale Funnel 的配置保存在 Tailscale 服务中，登录后应自动恢复；如果 Tailscale 没有自动连接，固定地址会不可用，启动器会报“固定地址无法访问”。

## 回退

```powershell
powershell -ExecutionPolicy Bypass -File .\Start-TailscaleFunnel.ps1 -Reset
Remove-Item "$env:USERPROFILE\.dsh-remote\fixed-relay.txt" -ErrorAction SilentlyContinue
```

重新启动一键启动，会回到 Cloudflare Quick Tunnel。

## Cloudflare 命名隧道

同样的固定地址机制也适用于 Cloudflare 命名隧道：把命名隧道的 ingress 指向 `http://127.0.0.1:8788`，将 `https://你的域名` 写入 `fixed-relay.txt` 即可。启动器只要求它是 HTTPS 根地址，不限定 Tailscale。

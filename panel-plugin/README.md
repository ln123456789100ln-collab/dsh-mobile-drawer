# dsh-remote-kit-panel

DSH 设置页里的 **DSH Remote Kit 控制面板**。

它不实现远程协议，只作为本机 [DSH Remote Kit](https://github.com/ln123456789100ln-collab/dsh-remote-kit) 的配套插件：

- 显示 Kit 是否安装、Relay 地址、8788/30889 监听状态、控制页是否可用；
- 保存 Kit 目录（例如 `C:\dsh-remote-kit`）；
- 一键启动/停止 Kit 的 Windows 启动器；
- 一键打开配对控制页（手机扫码在那里）。

远程会话、配对、加密和手机 UI 全部由 Kit 本身提供，插件不读取密钥、不转发流量。

## 安装

从 GitHub Release 安装（无需 npm 账号）：

```powershell
dsh plugin --profile web add https://github.com/ln123456789100ln-collab/dsh-remote-kit/releases/download/panel-v0.1.0/dsh-remote-kit-panel-0.1.0.tgz
```

发布到 npm 后也可以直接用包名安装：

```powershell
dsh plugin --profile web add dsh-remote-kit-panel
```

安装后刷新/重启 DSH，在 **设置 → 插件配置 → 远程访问（Kit）** 里填写 Kit 目录并启动。

前提：Windows，且已安装 [DSH Remote Kit](https://github.com/ln123456789100ln-collab/dsh-remote-kit)（Node.js、cloudflared、relay 构建等按 Kit 的 README 操作）。

## 权限

- 读取 `%USERPROFILE%\.dsh-remote` 下的 `settings.json` / `controller.json` 状态（不读取 `controller.json` 里的登录 URL 内容，只在打开控制页时由本机进程使用）；
- 监听本机 HTTP 前缀 `/dsh-remote-kit`（仅允许 loopback 请求）；
- 通过 `wscript.exe` / `taskkill.exe` / PowerShell 启停 Kit 启动器、打开控制页。

## 开发

本包是仓库里的 `panel-plugin/` 目录：

```powershell
npm pack                 # 生成 dsh-remote-kit-panel-0.1.0.tgz
dsh plugin --profile web add .\dsh-remote-kit-panel-0.1.0.tgz
```

## License

MIT，见 `LICENSE`。插件里的 DSH slot 注册方式参考了 `@april-jk/dsh-mobile`（MIT）的客户端插件结构。

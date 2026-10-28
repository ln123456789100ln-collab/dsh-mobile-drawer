# NOTICE

## 上游来源与版权

本仓库包含或衍生自以下 MIT 项目，相关版权与许可证保存在对应目录：

| 目录 | 来源 | 许可证 |
| --- | --- | --- |
| `relay/` | [april-jk/dsh-relay](https://github.com/april-jk/dsh-relay)（适配版 `dsh-relay` 0.1.9，加入 gzip/版本化缓存/隧道预热/手机 UI 注入等本地改动） | MIT，见 [`relay/LICENSE`](relay/LICENSE) |
| `plugin/` | [april-jk/dsh-mobile-plugin](https://github.com/april-jk/dsh-mobile-plugin)（适配版 `@april-jk/dsh-mobile` 0.1.9 local-compat） | MIT，见 [`plugin/LICENSE`](plugin/LICENSE) |
| `relay/web/app/qr-scanner*.js` | [nimiq/qr-scanner](https://github.com/nimiq/qr-scanner)（随上游 Relay 一起分发） | MIT，见 [`relay/web/app/qr-scanner.LICENSE`](relay/web/app/qr-scanner.LICENSE) |

本地适配改动摘要见 [`relay/FORK-NOTES.md`](relay/FORK-NOTES.md) 和 [`plugin/FORK-NOTES.md`](plugin/FORK-NOTES.md)。

## 不包含的内容

本仓库刻意不包含：

- `cloudflared.exe`（用户自行从 Cloudflare 官方下载，见 [`tools/README.md`](tools/README.md)）
- DeepSeek Harness 安装包、`app.asar` 或任何 DSH 本体代码/资源
- 设备密钥、配对二维码、JWT、Relay 数据库、`~/.dsh-remote` 下的任何运行数据
- 真实会话内容或个人截图（文档截图已脱敏）

## 非官方声明

DSH Remote Kit 是个人项目，**非 DeepSeek 官方产品**，与 DeepSeek 无隶属关系。
使用前请确认你拥有所连接 DSH 实例和网络的合法使用权；本项目不提供绕过鉴权、配对或加密的能力。

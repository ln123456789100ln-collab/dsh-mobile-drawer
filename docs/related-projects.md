# 同类项目对比（截至 2026-10-28）

> 写这份文档的原因：DSH 插件市场里"手机远程访问"是一个已经很拥挤的方向。
> 以后无论是想继续做、想上架、还是想重构，先看这里，避免把别人已经做好的轮子再造一遍。
> 数据来自 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 的插件目录快照
> （2026-10-28，约 7406 个插件；名称/描述涉及 remote / relay / 手机访问的约 135 条，其中直接做
> "手机远程控制 DSH"的至少 30 个）。star 和下载量会变化，这里只作为当时的参考。

## 和本 Kit 最像的：JochenYang/dsh-remote

[**JochenYang/dsh-remote**](https://github.com/JochenYang/dsh-remote)（收录名 `dsh-remote#dsh-remote`，MIT）

它的架构和我们几乎是同一个模子：

```
手机浏览器 ──HTTPS──> relay-server ──WS 帧──> dsh-remote 桌面插件 ──HTTP/WS──> 本地 dsh web
```

| 能力 | 我们的 DSH Remote Kit | JochenYang/dsh-remote |
| --- | --- | --- |
| 自托管 relay | ✅ `relay/`（sealed-tunnel-v1，端到端加密） | ✅ `relay-server/`（HTTP 反向代理 + WS 桥接，协议文档 `docs/PROTOCOL.md`） |
| 桌面 host 插件 | ✅ `plugin/` + 可选 `desktop-bridge/` | ✅ 桌面插件，注册到 self-host relay |
| 手机端形态 | Relay 的 Web 客户端 + Service Worker 注入手机 UI | 隧道内注入移动适配层（全宽正文/设置全屏/侧栏抽屉/键盘避让） |
| 配对 | 控制页二维码 + Relay 配对码 | 6 位配对码 + HMAC-SHA256 一次性挑战响应 |
| 管理能力 | 控制页启停/配对/撤销；Relay admin 默认关闭 | 管理台：设备/令牌管理 |
| Windows 一键启动 | ✅ launcher（cloudflared + relay + 工作区 + 控制页 + 防休眠/自启） | ❌ 需要自己部署 VPS relay 再安装插件 |
| 日常桌面实例接入 | ✅ `desktop-bridge/` 可选接入日常 DSH | ✅ 桌面插件本身挂日常 DSH |
| 原生手机 App | ❌ | 🚧 `android-app/` 开发中 |
| CI / 协议文档 | 一般（有测试和中文文档） | 完整（GitHub Actions + PROTOCOL.md） |
| 市场体量（快照） | 未上架 | 已收录，stars 1 |

**他们的优势**：协议文档完整、CI 齐全、有管理台和 Android 客户端规划；移动适配"避开 DSH 构建期 hash 类名，DSH 升级时退回原生布局"的容错思路比我们更稳（我们的手机 UI 依赖 hash 类名，DSH 升级可能直接失效）。

**我们的特点**：是一套完整的 Windows 自托管 kit——一键启动、控制页、配对、防休眠/开机自启、日常桌面实例桥接、中文文档都在一个仓库里；适合"自己的电脑就是服务器"的个人用户。代价是平台绑定 Windows，手机 UI 对 DSH 版本更敏感。

## 其他相关项目

| 项目 | 形态 | 快照数据 | 和我们的关系 |
| --- | --- | --- | --- |
| [mrRisega/dsh-remote](https://github.com/mrRisega/dsh-remote)（npm `dsh-remote-web`） | 官方托管中继 + 可自建 relay；E2EE；一条命令装 bridge；设置页"远程控制"面板；扫码授权 | 41 stars / 6,929 downloads | 同架构，且同时提供托管和自建中继；产品化比我们完整 |
| [zhu1090093659/dsh-web#packages/dsh-remote-web-ui](https://github.com/zhu1090093659/dsh-web/tree/main/packages/dsh-remote-web-ui)（npm `@linxin666/dsh-remote-web-ui`） | 手机/PC 远程控制；扫码配对、令牌门控、SSE 实时同步；移动 + 桌面 GUI 两种形态 | 9,321 stars / 113,409 downloads | 这个方向体量最大的项目，基本是社区默认选择 |
| [kinderao/dsh-pocket-relay](https://github.com/kinderao/dsh-pocket-relay)（npm `dsh-pocket-relay`） | 局域网扫码，或用自建 relay 取代 cloudflared；每设备凭据可单独吊销；多机共用一个 relay | 5 stars / 974 downloads | 和我们"自建 relay 替代 Quick Tunnel"的思路最接近 |
| [WNLUO/dsh-mobile-plugin](https://github.com/WNLUO/dsh-mobile-plugin)（npm `dsh-mobile-plugin`） | 手机 App 对端插件，也可做无头宿主；经 relay/LAN 配对提供移动 API | 0 stars / 10,097 downloads | 我们 `plugin/` 的上游（MIT），适配前的基础 |
| [BotonJ/dsh-remote-link](https://github.com/BotonJ/dsh-remote-link) | 官方 Web UI 的安全远程接入：QR + HMAC 一次性配对、按设备吊销、mDNS | 6 stars | 配对/安全模型可参考 |
| [IceApriler/dsh-remote-mobile](https://github.com/IceApriler/dsh-remote-mobile)（npm `dsh-remote-mobile`） | Tailscale/局域网、扫码配对、RSA 加密、移动端样式片段 | 31 stars / 3,580 downloads | 移动端样式注入的同类做法 |
| [@restregular/dsh-pocket](https://github.com/restregular/dsh-pocket)（npm `dsh-pocket`） | 独立的窄屏移动 Web 服务，自带会话列表/聊天流，可走 LAN、cloudflared、localtunnel、SSH 反代 | 移动端体验方向不同，但解决同一个问题 | 如果以后想做"为手机重写 UI"而不是"注入桌面 UI"，可参考 |

> 注：上面只是和本 kit 相关度较高的一部分；插件目录里还有大量 Telegram/微信/飞书机器人、SSH 隧道、
> PWA 网关形态的远程方案，解决的是相邻但不同的问题。

## 结论与定位

1. **我们不是独一无二的**：自托管 relay + 桌面插件 + 扫码配对 + 移动适配，这个组合至少有 3 个项目已经做了，
   其中两个比我们更成熟、更有社区体量。
2. **不算重复造轮子的部分**：Windows 一键启动器（cloudflared + relay + 工作区 + 控制页 + 自启/防休眠）、
   日常桌面实例桥接、以及"整套源站 + 中文文档"的 kit 形态，是我们目前相对差异化的地方。
3. **所以当前定位**：自用/小范围分享的 Windows 自托管方案，而不是去和 9k stars 的项目抢市场。
4. **如果以后想上架或认真做产品**：先回答三个问题——
   - 目标用户是不是"有 Windows 常开电脑、不想部署 VPS、不想装 App"的人？
   - 能否把 relay 做进插件（去掉 native 依赖、cloudflared 自动下载），做到"装个插件就能用"？
   - DSH 升级导致手机 UI 失效时，能不能像 JochenYang 那样优雅退回原生布局？
   三个都是"是"再考虑上架，否则社区已经有更好的选择。

## 可以借鉴的点（仅参考，注意各自许可证）

- **协议文档**：我们目前只有代码和交接文档，缺少 `sealed-tunnel-v1` 的帧格式/握手/安全边界文档。
- **优雅降级**：手机 UI 不要只依赖 DSH 构建期 hash 类名；检测不到关键元素时退回原生桌面布局，而不是样式半坏。
- **管理台/设备吊销**：我们的 relay admin 默认关闭，设备管理主要靠控制页；多设备场景可以补。
- **CI + Release 流程**：JochenYang 的 CI/Release 打包方式（`pnpm pack` + GitHub Releases）值得照搬。
- **开源治理**：issue 模板、贡献指南、CHANGELOG；如果真要让别人用，这些比功能更重要。

## 维护说明

- 这份对比不是"竞品分析报告"，只是避免重复劳动的备忘录；数据会过期。
- 下次大改（比如 Phase 2 自包含插件）之前，重新拉一次 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)
  的 `data/plugins/` 看看有没有新的同构项目，特别是 `category: remote`。
- 如果发现上面某个项目已经停止维护，可以在对应条目里注明日期和状态。

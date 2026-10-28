# tests（回归测试与截图）

不要被名字骗了：这些脚本会**真实打开本机运行中的 DSH 页面**，把 `relay/web/app` 里的手机 UI 注入进去做布局断言，
不需要额外 mock。

## 前置条件

- Node.js 18+
- Microsoft Edge（Playwright 用 `channel: "msedge"`，无需下载 Chromium）
- 本机 DSH 桌面端正在运行，且存在 `~/.dsh-remote/desktop-host.json`（由 remote 插件/桌面桥接生成）

```powershell
npm install
```

## 命令

```powershell
npm run test:mobile     # 手机 393×844 + 桌面 1440/721，共 34 项断言
npm run test:live-sw    # 检查一个已部署的 Relay 域名（参数或环境变量传 URL）
npm run screenshots     # 重新生成 ../assets/screenshots（自动脱敏）
```

`test:live-sw` 需要显式给地址：

```powershell
node live-sw-check.cjs https://your-relay.example.com
# 或
$env:DSH_TUNNEL_URL="https://your-relay.example.com"; npm run test:live-sw
```

## 覆盖范围

`mobile-check.cjs`：

- 顶栏 52px 全宽、聊天页内容不被顶栏压住、无横向溢出
- 抽屉 78vw、遮罩全屏、点遮罩关闭、Escape 关闭
- 搜索过滤、无结果提示、Escape 先清空再关闭
- 选会话后抽屉关闭、顶栏标题同步、输入区在视口内
- 插件 / 插件市场 / 自动化任务：页面头从 y≥52 开始、顶栏标题正确
- 桌面 1440 / 721：手机顶栏隐藏、原侧栏 280/56px、header 可见、无横向溢出

`live-sw-check.cjs`：

- 隧道根路径 302 → `/app/`、页面引用 `/app/app.js`
- `/app/sw.js` 200 且内嵌当前手机 UI 版本
- 注册 SW 后 `mobile.css` / `mobile.js` 由 SW 返回 200、MIME 正确、含修复标记

## 维护

- 测试依赖 DSH Web 的 CSS Module 哈希类名和一个 `desktop-host.json`。DSH 升级后失败项会指出具体选择器。
- 测试只读页面，不提交任务、不改 DSH 数据；截图脚本会把会话名/头像/余额/模型名打码。
- 不要提交 `desktop-host.json` 或任何日志里的 token。

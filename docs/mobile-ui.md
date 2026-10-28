# 手机抽屉 UI：原理与二次开发

手机 UI 不是一个单独的前端项目，而是**由 Relay 的 Service Worker 注入**到被代理的 DSH Web HTML 里的小补丁。
这样做的好处：不改 DSH 本体、不需要 Relay 后端加路由、桌面端天然不受影响。

## 它是怎么工作的

1. Relay 代理 DSH 的 HTML 响应时，Service Worker 把下面两行插进 `<head>`：

   ```html
   <link rel="stylesheet" href="/app/mobile.css?v=mobile4">
   <script defer src="/app/mobile.js?v=mobile4"></script>
   ```

2. `mobile.css` / `mobile.js` 不是从 Relay 静态服务器取的（那里会 404/426），而是**内嵌在 `relay/web/app/sw.js`** 里，由 Service Worker 的 `fetch` 直接返回。
3. `mobile.js` 在页面里做四件事：注入 52px 顶栏、把侧栏变成 78vw 抽屉、给抽屉加会话搜索、同步顶栏标题；并用 `<html class="dsh-mobile-chat-route">` 区分聊天页/非聊天页，给非聊天页补顶栏高度。

## 源码位置

| 文件 | 说明 |
| --- | --- |
| `relay/web/app/mobile.css` | 全部移动端样式，包在 `@media (max-width: 720px)` 里 |
| `relay/web/app/mobile.js` | 顶栏、抽屉、搜索过滤、标题同步（`VERSION = "mobile4"`） |
| `relay/web/app/sw.template.js` | Service Worker 模板，含 `__MOBILE_CSS__` / `__MOBILE_JS__` 占位符 |
| `relay/web/build-mobile-sw.cjs` | 把 CSS/JS 内嵌进 `sw.js` 的构建脚本 |

## 修改与部署

```powershell
cd relay\web
node build-mobile-sw.cjs
node --check app\sw.js
```

然后把 `app\sw.js`、`app\mobile.css`、`app\mobile.js` 同步到实际部署的 Relay（本仓库默认就是 `relay/web/app`，启动器直接读这里）。

如果改了 `mobile.js` 逻辑：

1. 递增 `mobile.js` 顶部的 `VERSION`；
2. 同步 `sw.template.js` 里 `MOBILE_UI_TAGS` 的 `?v=` 查询参数；
3. 建议同时递增 `relay/web/app/app.js` 里的 SW 注册版本和 `index.html` 的脚本版本（当前 `0.1.9-fast5`），让手机强制检查新 SW；
4. 重新构建并部署。

## 生效顺序（为什么手机要刷两次）

1. 手机导航 → 旧 Service Worker 返回旧 HTML（旧标签）；
2. 浏览器发现 `sw.js` 变了 → 装新 Service Worker（`skipWaiting` + `clients.claim` 立即接管）；
3. 再导航一次 → 新 Service Worker 返回带新标签的 HTML → 新 UI 生效。

旧页面不会自动换样式，所以“刷新两次”是这套注入架构的正常现象。

## 测试

```powershell
cd tests
npm install
npm run test:mobile      # 34 项：顶栏/抽屉/搜索/聊天页/非聊天页/桌面端
```

测试会把 `relay/web/app` 的真实 CSS/JS 注入到本机运行中的 DSH 页面（读取 `~/.dsh-remote/desktop-host.json`），
断言布局尺寸与交互，不修改任何数据。

## 兼容性风险

`mobile.css` / `mobile.js` 依赖 DSH Web 的 CSS Module 哈希类名：

`.an3WzG_`、`.mP3x-q_`、`.wtg9ga_`、`.GRgSLq_`、`.V7pFBG_`、`.nUhMVa_`、`.olCj9W_` 以及少量 `aria-label`
（如“打开侧边栏”“收起侧边栏”“新建会话”）。

本套件适配基线：DSH 桌面版 `app.asar` 时间戳 2026-10-23 16:00。DSH 升级后这些类名可能变化，
表现通常是“顶栏还在但抽屉打不开”或“样式全丢”，此时跑 `tests/mobile-check.cjs` 即可定位。

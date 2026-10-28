# Relay 适配说明（relative to upstream dsh-relay 0.1.9）

本目录基于 [april-jk/dsh-relay](https://github.com/april-jk/dsh-relay)（MIT），在保持上游协议不变的前提下做了以下本地适配。
上游原始 `LICENSE` 保留在本目录。

## 相对上游的主要改动

1. **静态资源 gzip + 版本化缓存**
   - 对 DSH Web 的版本化静态资源（`/assets/*-<hash>.js|css|woff2`、带 `rev` 的插件资源）做按设备的 Cache Storage 缓存；
   - 只缓存版本化 GET 资源，不缓存 HTML、API、会话内容；
   - 手机（带 `x-dsh-mobile-lite` 标识）请求的版本化资源支持 gzip 解压，降低首屏传输量。

2. **隧道预热与前台恢复**（`one-click` / `init-tunnel` 配合）
   - `init-tunnel` 在隧道仍存活且创建不超过 120 秒时直接复用，避免重复握手；
   - Service Worker 在页面可见性恢复（`visibilitychange` / `pageshow(persisted)`）时重建 WebSocket 订阅，不重放应用帧、不刷新页面。

3. **手机 UI 注入**
   - `web/app/mobile.css`、`web/app/mobile.js`：抽屉布局与顶栏（`VERSION = "mobile4"`）；
   - `web/app/sw.template.js`：内嵌 CSS/JS 的模板；`web/build-mobile-sw.cjs` 生成 `web/app/sw.js`；
   - Service Worker 在代理的 HTML `<head>` 注入标签，并直接返回 `/app/mobile.css` / `/app/mobile.js`；
   - 非聊天页通过 `html.dsh-mobile-chat-route` 区分并补顶栏高度（修复插件页被顶栏遮挡）。

4. **固定地址支持**
   - 支持通过 `DSH_PUBLIC_RELAY_URL` / `fixed-relay.txt` 使用固定公网地址，此时不启动 Quick Tunnel（由启动器负责）。

5. **版本标记**
   - `web/app/app.js` Service Worker 注册参数与 `index.html` 脚本版本推进到 `0.1.9-fast5`；
   - `web/app/sw.js` 为构建产物（`node web/build-mobile-sw.cjs`）。

## 部署

```powershell
cd relay
npm ci
npm run build          # tsc → dist/server.js
```

启动器会以 `node dist/server.js` 启动它，并传入 `HOST/PORT/PUBLIC_RELAY_URL/DATABASE_PATH/JWT_SECRET` 等环境变量
（见 `one-click.mjs`）。生产环境务必使用随机 `JWT_SECRET`（≥32 字节），不要把真实值写进仓库。

## 测试

上游自带 `test/`（`npm test`，tsx + node:test）。本仓库的手机 UI 回归在根目录 `tests/`。

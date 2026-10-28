# 集成说明：把手机抽屉 UI 接到自己的 DSH Relay

本项目的运行方式是：**由 Relay 的 Service Worker 在代理 HTML 时注入 `mobile.css` / `mobile.js`，并由同一个 SW 直接返回这两个资源**。
因此集成点全在 Relay 的 `web/app/sw.js` 里（参考实现：[`app/sw.template.js`](../app/sw.template.js)），不需要改 DSH 本体、不需要改 Relay 后端。

> 参考实现基于适配版 `dsh-relay` 0.1.9 的 `web/app/sw.js`（其中还包含 gzip、版本化静态缓存等本地改动）。
> 如果你用的是上游原版 [april-jk/dsh-relay](https://github.com/april-jk/dsh-relay)，按下面的 3 个点移植即可。

## 三处改动

### 1) 内嵌资源 + 注入标签

在 `sw.js` 顶部加入（`MOBILE_CSS` / `MOBILE_JS` 由构建脚本替换为真实内容，不要手写）：

```js
const MOBILE_CSS = "__MOBILE_CSS__";
const MOBILE_JS = "__MOBILE_JS__";
const MOBILE_UI_TAGS = `<link rel="stylesheet" href="/app/mobile.css?v=mobile4"><script defer src="/app/mobile.js?v=mobile4"><\/script>`;
```

### 2) 在代理 HTML 响应里注入

在 SW 处理隧道 HTTP 响应、拿到 `text/html` 内容的那个分支（参考实现里是 `handleHttpResponse`），把标签插到 `<head>` 后面：

```js
if (pending.headers?.get("content-type")?.includes("text/html")) {
  const html = decoder
    .decode(output)
    // 参考实现会移除 CSP meta，否则注入的内联 shim 会被 CSP 拦截
    .replace(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/gi, "");
  const injected = html.includes("<head")
    ? html.replace(/<head([^>]*)>/i, `<head$1>${MOBILE_UI_TAGS}`)
    : `${MOBILE_UI_TAGS}${html}`;
  output = encoder.encode(injected);
}
```

> 注意：如果原 Relay 没有移除 CSP meta，注入的内联脚本可能被浏览器拦截；这种情况下要么去 CSP，要么把 `mobile.js` 改成符合 CSP 的外链加载方式（本仓库参考实现选择移除 meta）。

### 3) 由 SW 直接返回两个静态资源

在 `fetch` 事件处理器的最前面（早于隧道路由判断）加：

```js
if (event.request.method === "GET" && url.pathname === "/app/mobile.css") {
  event.respondWith(new Response(MOBILE_CSS, {
    headers: { "content-type": "text/css; charset=utf-8", "cache-control": "no-store" },
  }));
  return;
}
if (event.request.method === "GET" && url.pathname === "/app/mobile.js") {
  event.respondWith(new Response(MOBILE_JS, {
    headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" },
  }));
  return;
}
```

Relay 的静态服务器通常没有 `/app/mobile.css` 路由（会返回 426/404），这没关系：资源只通过 SW 返回。直接 curl 该路径失败是预期行为。

## 构建与部署

```bash
node scripts/build-mobile-sw.cjs      # 生成 app/sw.js（内嵌 mobile.css/mobile.js）
node --check app/sw.js                # 语法检查
```

然后把生成的 `app/sw.js` 放到 Relay 的 `web/app/sw.js`，并确保 `web/app/mobile.css`、`web/app/mobile.js` 也一并部署（便于排查/版本对照；SW 实际使用内嵌副本）。

如果 Relay 的浏览器壳（`index.html` / `app.js`）里写死了 SW 注册版本号或脚本查询参数，建议一起递增，方便手机强制检查新 SW：

- `app.js`：`navigator.serviceWorker.register("/app/sw.js?v=...")`
- `index.html`：`<script src="/app/app.js?v=...">`

## 版本与缓存

- 本仓库当前 UI 版本：`mobile4`（`mobile.js` 顶部 `VERSION`）。
- 修改 `mobile.css` / `mobile.js` 后：递增 `VERSION`，同步修改 `app/sw.template.js` 中 `MOBILE_UI_TAGS` 的 `?v=`，重新构建并部署。
- 浏览器更新顺序：导航拿到新 `sw.js` → 新 SW `skipWaiting` + `clients.claim` 接管 → 下一次导航才拿到注入新标签的 HTML。**手机上通常需要刷新两次**。
- 旧 SW 会继续控制已打开的页面；排查时清一次站点数据最稳。

## 验证

```bash
cd tests
npm install
node live-sw-check.cjs https://your-relay.example.com
```

也可以先在本机用 `npm run test:mobile` 做布局回归（需要本机 DSH 正在运行生成 `~/.dsh-remote/desktop-host.json`）。

## 已知兼容性依赖

`mobile.css` / `mobile.js` 依赖 DSH Web UI 的 CSS Module 哈希类名（`.an3WzG_`、`.mP3x-q_`、`.wtg9ga_`、`.GRgSLq_`、`.V7pFBG_`、`.nUhMVa_`、`.olCj9W_` 等）和少量 `aria-label`。
本项目适配基线为 DSH `app.asar` 时间戳 **2026-10-23 16:00**；DSH 升级后如果顶栏/抽屉失效，先跑 `tests/mobile-check.cjs` 定位失效选择器。

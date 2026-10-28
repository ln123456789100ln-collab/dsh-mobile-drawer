// Live-tunnel check: the deployed Service Worker must serve the current mobile4 assets
// and the /app/ shell must reference the current app.js.
//
// Usage: node live-sw-check.cjs [tunnel-url]
//   or:  DSH_TUNNEL_URL=https://xxx.trycloudflare.com node live-sw-check.cjs
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const TUNNEL = (process.argv[2] || process.env.DSH_TUNNEL_URL || "").replace(/\/+$/, "");
if (!TUNNEL) {
  console.error("Usage: node live-sw-check.cjs https://your-relay.example.com");
  process.exit(2);
}
const appDir = path.resolve(__dirname, "..", "relay", "web", "app");
const local = (name) => fs.readFileSync(path.join(appDir, name));
const localSw = local("sw.js");

const results = [];
function check(name, ok, detail) {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail === undefined ? "" : " " + JSON.stringify(detail)}`);
}

(async () => {
  // 1. Raw HTTP checks.
  const root = await fetch(`${TUNNEL}/`, { redirect: "manual" });
  check("tunnel: root redirects to /app/", root.status === 302 && root.headers.get("location") === "/app/", { status: root.status, location: root.headers.get("location") });

  const shell = await fetch(`${TUNNEL}/app/`, { cache: "no-store" });
  const shellHtml = await shell.text();
  check("tunnel: /app/ shell is 200", shell.status === 200, shell.status);
  check("tunnel: shell references app.js?v=0.1.9-fast5", shellHtml.includes("app.js?v=0.1.9-fast5"), shellHtml.match(/app\.js\?v=[^"]+/)?.[0]);

  const swRes = await fetch(`${TUNNEL}/app/sw.js`, { cache: "no-store" });
  const swBody = Buffer.from(await swRes.arrayBuffer());
  check("tunnel: /app/sw.js is 200", swRes.status === 200, swRes.status);
  check("tunnel: SW bytes match live file", swBody.length === localSw.length && swBody.equals(localSw), { served: swBody.length, local: localSw.length });
  check("tunnel: SW embeds mobile4 tags", swBody.toString("utf8").includes("/app/mobile.css?v=mobile4") && swBody.toString("utf8").includes("mobile4"));
  check("tunnel: SW embeds fixed non-chat CSS", swBody.toString("utf8").includes("dsh-mobile-chat-route"));

  const cssDirect = await fetch(`${TUNNEL}/app/mobile.css`, { redirect: "manual" });
  check("tunnel: direct static /app/mobile.css still 426 (expected)", cssDirect.status === 426, cssDirect.status);

  // 2. Service-worker controlled asset checks.
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  const page = await browser.newPage({ viewport: { width: 393, height: 844 }, isMobile: true, hasTouch: true });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${TUNNEL}/app/`, { waitUntil: "domcontentloaded", timeout: 45000 });

  const registered = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.register("/app/sw.js?v=0.1.9-fast5", { scope: "/" });
    await navigator.serviceWorker.ready;
    return { scope: reg.scope, active: reg.active?.state, controlled: !!navigator.serviceWorker.controller };
  });
  if (!registered.controlled) {
    await page.reload({ waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(1000);
  }

  const assets = await page.evaluate(async () => {
    const css = await fetch("/app/mobile.css?v=mobile4", { cache: "no-store" });
    const js = await fetch("/app/mobile.js?v=mobile4", { cache: "no-store" });
    return {
      controlled: !!navigator.serviceWorker.controller,
      cssStatus: css.status,
      cssType: css.headers.get("content-type"),
      cssHasRule: (await css.text()).includes("dsh-mobile-chat-route"),
      jsStatus: js.status,
      jsType: js.headers.get("content-type"),
      jsHasVersion: (await js.text()).includes("mobile4"),
      jsHasFix: (await (await fetch("/app/mobile.js?v=mobile4", { cache: "no-store" })).text()).includes("hasChatHeader")
    };
  });
  check("sw: page is controlled by new SW", assets.controlled, assets);
  check("sw: mobile.css?v=mobile4 served 200 text/css", assets.cssStatus === 200 && /text\/css/.test(assets.cssType || ""), { status: assets.cssStatus, type: assets.cssType });
  check("sw: mobile.css contains non-chat fix", assets.cssHasRule);
  check("sw: mobile.js?v=mobile4 served 200 js", assets.jsStatus === 200 && /javascript/.test(assets.jsType || ""), { status: assets.jsStatus, type: assets.jsType });
  check("sw: mobile.js is mobile4 + hasChatHeader", assets.jsHasVersion && assets.jsHasFix);
  check("sw: no page errors", errors.length === 0, errors.slice(0, 3));

  await browser.close();

  const passed = results.filter(Boolean).length;
  console.log(`\nSUMMARY ${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

// Live deployment check: verify that a deployed DSH relay serves the mobile drawer assets.
//
// Usage:
//   node live-sw-check.cjs https://your-relay.example.com
//   DSH_TUNNEL_URL=https://your-relay.example.com node live-sw-check.cjs
//
// Requires: Node 18+, Microsoft Edge (Playwright channel "msedge"), and the deployed relay
// must have the mobile drawer integration applied (see docs/integration.md).
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const TUNNEL = (process.argv[2] || process.env.DSH_TUNNEL_URL || "").replace(/\/+$/, "");
if (!TUNNEL) {
  console.error("Usage: node live-sw-check.cjs https://your-relay.example.com");
  process.exit(2);
}

const appDir = path.resolve(__dirname, "..", "app");
const mobileJs = fs.readFileSync(path.join(appDir, "mobile.js"), "utf8");
const version = mobileJs.match(/const VERSION = "([^"]+)"/)?.[1] || "unknown";
let localSw = null;
try {
  localSw = fs.readFileSync(path.join(appDir, "sw.js"));
} catch {
  console.log(`INFO app/sw.js not built locally; byte comparison skipped (run: node scripts/build-mobile-sw.cjs)`);
}

const results = [];
function check(name, ok, detail) {
  results.push(!!ok);
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail === undefined ? "" : " " + JSON.stringify(detail)}`);
}
function info(name, detail) {
  console.log(`INFO ${name}${detail === undefined ? "" : " " + JSON.stringify(detail)}`);
}

(async () => {
  // 1. Raw HTTP checks (no browser).
  const root = await fetch(`${TUNNEL}/`, { redirect: "manual" });
  check("tunnel: root redirects to /app/", root.status === 302 && root.headers.get("location") === "/app/", { status: root.status, location: root.headers.get("location") });

  const shell = await fetch(`${TUNNEL}/app/`, { cache: "no-store" });
  const shellHtml = await shell.text();
  check("tunnel: /app/ shell is 200", shell.status === 200, shell.status);
  check("tunnel: shell references /app/app.js", /\/app\/app\.js\?v=/.test(shellHtml), shellHtml.match(/\/app\/app\.js\?v=[^"]+/)?.[0]);

  const swRes = await fetch(`${TUNNEL}/app/sw.js`, { cache: "no-store" });
  const swBody = Buffer.from(await swRes.arrayBuffer());
  const swText = swBody.toString("utf8");
  check("tunnel: /app/sw.js is 200", swRes.status === 200, swRes.status);
  check("tunnel: SW embeds mobile assets", swText.includes("/app/mobile.css?v=" + version) && swText.includes(`mobile.js?v=${version}`), version);
  check("tunnel: SW embeds non-chat-page fix", swText.includes("dsh-mobile-chat-route"));
  if (localSw) check("tunnel: served SW equals locally built sw.js", swBody.length === localSw.length && swBody.equals(localSw), { served: swBody.length, local: localSw.length });

  const cssDirect = await fetch(`${TUNNEL}/app/mobile.css`, { redirect: "manual" });
  info("tunnel: direct GET /app/mobile.css", cssDirect.status);

  // 2. Service-worker controlled asset checks.
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  const page = await browser.newPage({ viewport: { width: 393, height: 844 }, isMobile: true, hasTouch: true });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${TUNNEL}/app/`, { waitUntil: "domcontentloaded", timeout: 45000 });

  const registered = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.register("/app/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    return { scope: reg.scope, active: reg.active?.state, controlled: !!navigator.serviceWorker.controller };
  });
  if (!registered.controlled) {
    await page.reload({ waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(1000);
  }

  const assets = await page.evaluate(async (ver) => {
    const css = await fetch(`/app/mobile.css?v=${ver}`, { cache: "no-store" });
    const js = await fetch(`/app/mobile.js?v=${ver}`, { cache: "no-store" });
    const cssText = await css.text();
    const jsText = await js.text();
    return {
      controlled: !!navigator.serviceWorker.controller,
      cssStatus: css.status,
      cssType: css.headers.get("content-type"),
      cssHasRule: cssText.includes("dsh-mobile-chat-route"),
      jsStatus: js.status,
      jsType: js.headers.get("content-type"),
      jsHasVersion: jsText.includes(ver),
      jsHasFix: jsText.includes("hasChatHeader")
    };
  }, version);

  check("sw: page is controlled by the relay SW", assets.controlled, assets.controlled);
  check("sw: mobile.css served 200 text/css", assets.cssStatus === 200 && /text\/css/.test(assets.cssType || ""), { status: assets.cssStatus, type: assets.cssType });
  check("sw: mobile.css contains drawer styles", assets.cssHasRule);
  check("sw: mobile.js served 200 javascript", assets.jsStatus === 200 && /javascript/.test(assets.jsType || ""), { status: assets.jsStatus, type: assets.jsType });
  check(`sw: mobile.js is version ${version}`, assets.jsHasVersion && assets.jsHasFix);
  check("sw: no page errors", errors.length === 0, errors.slice(0, 3));

  await browser.close();

  const passed = results.filter(Boolean).length;
  console.log(`\nSUMMARY ${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

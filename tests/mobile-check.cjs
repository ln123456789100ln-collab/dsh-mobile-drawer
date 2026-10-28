// Mobile drawer UI regression checks for the DSH remote web app.
// Injects the real web/app/mobile.css + mobile.js into a live local DSH page
// (URL comes from ~/.dsh-remote/desktop-host.json) and asserts layout invariants.
//
// Usage: node mobile-check.cjs
const { chromium } = require("playwright-core");
const fs = require("fs");
const os = require("os");
const path = require("path");

const hostFile = path.join(os.homedir(), ".dsh-remote", "desktop-host.json");
const { url } = JSON.parse(fs.readFileSync(hostFile, "utf8"));
const appDir = path.resolve(__dirname, "..", "relay", "web", "app");
const artifactDir = path.join(__dirname, "artifacts");
fs.mkdirSync(artifactDir, { recursive: true });

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail === undefined ? "" : " " + JSON.stringify(detail)}`);
}

const rectOf = (sel) =>
  // eslint-disable-next-line no-undef
  (() => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), bottom: Math.round(b.bottom) };
  })();

async function inject(page) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.addStyleTag({ path: path.join(appDir, "mobile.css") });
  await page.addScriptTag({ path: path.join(appDir, "mobile.js") });
  await page.waitForTimeout(900);
}

async function openDrawer(page) {
  await page.locator('#dsh-mobile-topbar [data-dsh-mobile-action="menu"]').first().click();
  await page.waitForTimeout(500);
}

async function gotoRow(page, label) {
  await openDrawer(page);
  const row = page.locator(`.mP3x-q_sidebarCol .wtg9ga_panelRow[aria-label="${label}"]`);
  if (!(await row.count())) return false;
  await row.first().click();
  await page.waitForTimeout(1100);
  return true;
}

async function newMobilePage(browser) {
  const page = await browser.newPage({
    viewport: { width: 393, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
  });
  page.on("pageerror", (e) => page.__errors.push(e.message));
  page.__errors = [];
  return page;
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  let failed = 0;

  // ---------- Mobile 393x844 ----------
  const page = await newMobilePage(browser);
  await inject(page);

  const welcome = await page.evaluate(() => ({
    title: document.querySelector(".dsh-mobile-title-text")?.textContent,
    topbar: (() => { const el = document.querySelector("#dsh-mobile-topbar"); if (!el) return null; const b = el.getBoundingClientRect(); return { y: Math.round(b.y), h: Math.round(b.height), w: Math.round(b.width) }; })(),
    htmlClass: document.documentElement.className,
    centerPadTop: getComputedStyle(document.querySelector(".mP3x-q_centerCol")).paddingTop,
    overflowX: `${document.documentElement.scrollWidth}/${document.documentElement.clientWidth}`
  }));
  check("chat: topbar 52px full width", welcome.topbar && welcome.topbar.h === 52 && welcome.topbar.w === 393 && welcome.topbar.y === 0, welcome.topbar);
  check("chat: root is chat route, no extra padding", welcome.htmlClass.includes("dsh-mobile-chat-route") && welcome.centerPadTop === "0px", { htmlClass: welcome.htmlClass, centerPadTop: welcome.centerPadTop });
  check("chat: no horizontal overflow", welcome.overflowX === "393/393", welcome.overflowX);
  check("chat: title is set", !!welcome.title, welcome.title);

  // Drawer.
  await openDrawer(page);
  const drawer = await page.evaluate(() => {
    const s = document.querySelector(".mP3x-q_sidebarCol");
    const b = s.getBoundingClientRect();
    const bd = document.querySelector("#dsh-mobile-backdrop");
    const bdb = bd.getBoundingClientRect();
    return {
      width: Math.round(b.width),
      x: Math.round(b.x),
      open: document.documentElement.classList.contains("dsh-mobile-drawer-open"),
      backdrop: { w: Math.round(bdb.width), h: Math.round(bdb.height) }
    };
  });
  check("drawer: opens as 78vw overlay", drawer.open && drawer.width >= 300 && drawer.width <= 340 && drawer.x === 0, drawer);
  check("drawer: backdrop covers viewport", drawer.backdrop.w === 393 && drawer.backdrop.h === 844, drawer.backdrop);
  await page.screenshot({ path: path.join(artifactDir, "01-drawer.png") });

  // Search filter + empty state.
  const input = page.locator(".dsh-mobile-search input");
  await input.fill("Received");
  await page.waitForTimeout(400);
  const filter = await page.evaluate(() => ({
    hidden: document.querySelectorAll(".mP3x-q_sidebarCol .wnFoaW_sessionRow.dsh-mobile-search-hidden").length,
    visible: [...document.querySelectorAll(".mP3x-q_sidebarCol .wnFoaW_sessionRow")].filter((r) => !r.classList.contains("dsh-mobile-search-hidden")).map((r) => r.innerText.replace(/\s+/g, " ").trim().slice(0, 40)),
    empty: document.querySelector(".dsh-mobile-search-empty")?.classList.contains("is-visible")
  }));
  check("search: filters loaded rows locally", filter.hidden > 0 && filter.visible.length > 0 && filter.visible.every((t) => t.toLowerCase().includes("received")), filter);
  await page.screenshot({ path: path.join(artifactDir, "02-filter.png") });

  await input.fill("zzz-no-match-zzz");
  await page.waitForTimeout(350);
  check("search: shows empty state", await page.evaluate(() => document.querySelector(".dsh-mobile-search-empty")?.classList.contains("is-visible")));
  await page.screenshot({ path: path.join(artifactDir, "03-no-match.png") });

  // Escape clears search first, then closes the drawer.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const afterEscape = await page.evaluate(() => ({
    value: document.querySelector(".dsh-mobile-search input")?.value,
    open: document.documentElement.classList.contains("dsh-mobile-drawer-open")
  }));
  check("search: Escape clears filter only", afterEscape.value === "" && afterEscape.open, afterEscape);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  check("drawer: Escape closes", !(await page.evaluate(() => document.documentElement.classList.contains("dsh-mobile-drawer-open"))));

  // Backdrop click closes.
  await openDrawer(page);
  await page.locator("#dsh-mobile-backdrop").click({ position: { x: 360, y: 700 } });
  await page.waitForTimeout(400);
  check("drawer: backdrop click closes", !(await page.evaluate(() => document.documentElement.classList.contains("dsh-mobile-drawer-open"))));

  // Open a chat session: drawer auto-closes, title syncs, no overflow.
  await openDrawer(page);
  const row = page.locator(".mP3x-q_sidebarCol .wnFoaW_sessionRow").filter({ hasText: "Received confirmation reply" }).first();
  const target = (await row.count()) ? row : page.locator(".mP3x-q_sidebarCol .wnFoaW_sessionRow").nth(1);
  await target.click();
  await page.waitForTimeout(1400);
  const chat = await page.evaluate(() => ({
    open: document.documentElement.classList.contains("dsh-mobile-drawer-open"),
    title: document.querySelector(".dsh-mobile-title-text")?.textContent,
    overflowX: `${document.documentElement.scrollWidth}/${document.documentElement.clientWidth}`,
    composer: (() => { const el = document.querySelector(".an3WzG_composerSeat"); if (!el) return null; const b = el.getBoundingClientRect(); return { y: Math.round(b.y), bottom: Math.round(b.bottom), w: Math.round(b.width) }; })(),
    stage: !!document.querySelector(".dsh-mobile-chat-route")
  }));
  check("chat: drawer closes on session select", !chat.open);
  check("chat: topbar title follows session", !!chat.title && chat.title !== "DeepSeek", chat.title);
  check("chat: no horizontal overflow", chat.overflowX === "393/393", chat.overflowX);
  check("chat: composer fits viewport", chat.composer && chat.composer.bottom <= 845 && chat.composer.w >= 380, chat.composer);
  await page.screenshot({ path: path.join(artifactDir, "04-chat.png") });

  // Plugin page: its own page head must clear the fixed topbar, title must switch.
  const pluginOpened = await gotoRow(page, "插件");
  const plugin = pluginOpened
    ? await page.evaluate(() => {
        const head = document.querySelector(".V7pFBG_pageHead");
        const section = document.querySelector(".V7pFBG_page");
        const h1 = head?.querySelector("h1");
        const hb = head?.getBoundingClientRect();
        const sb = section?.getBoundingClientRect();
        return {
          title: document.querySelector(".dsh-mobile-title-text")?.textContent,
          headY: hb ? Math.round(hb.y) : null,
          sectionY: sb ? Math.round(sb.y) : null,
          heading: h1?.textContent,
          chatRoute: document.documentElement.classList.contains("dsh-mobile-chat-route"),
          padTop: getComputedStyle(document.querySelector(".mP3x-q_centerCol")).paddingTop
        };
      })
    : null;
  check("plugin: row opens", pluginOpened);
  check("plugin: page head clears 52px topbar", !!plugin && plugin.headY >= 52 && plugin.sectionY >= 52, plugin);
  check("plugin: title switches to page heading", !!plugin && plugin.title === "插件" && plugin.heading === "插件", plugin);
  check("plugin: non-chat route gets topbar padding", !!plugin && !plugin.chatRoute && plugin.padTop === "52px", plugin && plugin.padTop);
  await page.screenshot({ path: path.join(artifactDir, "05-plugin.png") });

  // Plugin market + automation pages: same invariant, different headings.
  for (const [label, expected, selector] of [
    ["插件市场", "插件市场", ".nUhMVa_titleRow"],
    ["自动化任务", "自动化任务", ".olCj9W_pageHeading"]
  ]) {
    const opened = await gotoRow(page, label);
    const info = opened
      ? await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          const b = el?.getBoundingClientRect();
          return {
            title: document.querySelector(".dsh-mobile-title-text")?.textContent,
            y: b ? Math.round(b.y) : null,
            padTop: getComputedStyle(document.querySelector(".mP3x-q_centerCol")).paddingTop
          };
        }, selector)
      : null;
    check(`${expected}: row opens`, opened);
    check(`${expected}: header clears topbar`, !!info && info.y >= 52, info);
    check(`${expected}: title switches`, !!info && info.title === expected, info && info.title);
    await page.screenshot({ path: path.join(artifactDir, `06-${expected}.png`) });
  }

  // Return to a chat session, inject must not have thrown.
  check("mobile: no page errors", page.__errors.length === 0, page.__errors.slice(0, 3));
  await page.close();

  // ---------- Desktop must be untouched ----------
  for (const [name, viewport, expectedSidebar] of [
    ["desktop-1440", { width: 1440, height: 900 }, 280],
    ["desktop-721", { width: 721, height: 900 }, 56]
  ]) {
    const desktop = await newMobilePage(browser);
    await desktop.setViewportSize(viewport);
    await inject(desktop);
    const info = await desktop.evaluate(() => {
      const sidebar = document.querySelector(".mP3x-q_sidebarCol");
      const sb = sidebar?.getBoundingClientRect();
      const topbar = document.querySelector("#dsh-mobile-topbar");
      const header = document.querySelector(".an3WzG_header");
      return {
        topbarDisplay: topbar ? getComputedStyle(topbar).display : "missing",
        sidebarW: sb ? Math.round(sb.width) : null,
        headerVisibility: header ? getComputedStyle(header).visibility : null,
        searchDisplay: document.querySelector(".dsh-mobile-search") ? getComputedStyle(document.querySelector(".dsh-mobile-search")).display : "missing",
        overflow: `${document.documentElement.scrollWidth}/${document.documentElement.clientWidth}`
      };
    });
    check(`${name}: mobile topbar hidden`, info.topbarDisplay === "none", info.topbarDisplay);
    check(`${name}: original sidebar kept (${expectedSidebar}px)`, Math.abs((info.sidebarW ?? 0) - expectedSidebar) <= 2, info.sidebarW);
    check(`${name}: desktop header visible`, info.headerVisibility === "visible", info.headerVisibility);
    check(`${name}: no horizontal overflow`, info.overflow === `${viewport.width}/${viewport.width}`, info.overflow);
    await desktop.screenshot({ path: path.join(artifactDir, `07-${name}.png`) });
    await desktop.close();
  }

  await browser.close();

  failed = results.filter((r) => !r.ok).length;
  console.log(`\nSUMMARY ${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

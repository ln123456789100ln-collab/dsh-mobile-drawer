// Capture sanitized screenshots for the README.
// Requires a running DSH desktop host (~/.dsh-remote/desktop-host.json) like mobile-check.cjs.
// Session names, avatar, balance and foot area are redacted before taking the shots.
//
// Usage: node capture-screenshots.cjs
const { chromium } = require("playwright-core");
const fs = require("fs");
const os = require("os");
const path = require("path");

const hostFile = path.join(os.homedir(), ".dsh-remote", "desktop-host.json");
const { url } = JSON.parse(fs.readFileSync(hostFile, "utf8"));
const appDir = path.resolve(__dirname, "..", "relay", "web", "app");
const outDir = path.resolve(__dirname, "..", "assets", "screenshots");
fs.mkdirSync(outDir, { recursive: true });

const redact = () => {
  // Session titles -> generic labels.
  document.querySelectorAll(".mP3x-q_sidebarCol .wnFoaW_sessionRow").forEach((row, index) => {
    row.innerText = `示例会话 ${String(index + 1).padStart(2, "0")}`;
  });
  // Account / balance / avatar areas -> hidden.
  document
    .querySelectorAll('.mP3x-q_sidebarCol .wtg9ga_footArea, .mP3x-q_sidebarCol [class*="balance" i], .mP3x-q_sidebarCol [class*="avatar" i]')
    .forEach((el) => {
      el.style.visibility = "hidden";
    });
  // Model selector text (may reveal a specific / unreleased build) -> generic.
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    if (/DeepSeek-V[\w.-]+/.test(node.nodeValue)) {
      node.nodeValue = node.nodeValue.replace(/DeepSeek-V[\w.-]+/g, "DeepSeek");
    }
  }
};

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

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  const page = await browser.newPage({
    viewport: { width: 393, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
  });
  await inject(page);

  // 1. Welcome / chat screen (model label redacted, no personal content).
  await page.evaluate(redact);
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(outDir, "mobile-chat.jpg"), type: "jpeg", quality: 85 });

  // 2. Drawer with redacted session list.
  await openDrawer(page);
  await page.evaluate(redact);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, "mobile-drawer.jpg"), type: "jpeg", quality: 85 });

  // 3. Plugin settings page (public toggles only, no personal data).
  const pluginRow = page.locator('.mP3x-q_sidebarCol .wtg9ga_panelRow[aria-label="插件"]');
  if (await pluginRow.count()) {
    await pluginRow.first().click();
    await page.waitForTimeout(1100);
    await page.screenshot({ path: path.join(outDir, "mobile-plugin.jpg"), type: "jpeg", quality: 85 });
  }
  await page.close();

  // 4. Desktop layout stays untouched (sidebar session names redacted).
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await inject(desktop);
  await desktop.evaluate(redact);
  await desktop.waitForTimeout(300);
  await desktop.screenshot({ path: path.join(outDir, "desktop-1440.jpg"), type: "jpeg", quality: 85 });
  await desktop.close();

  await browser.close();
  console.log(`screenshots written to ${outDir}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

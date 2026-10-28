(() => {
  "use strict";

  const VERSION = "mobile4";
  if (window.__dshMobileUi?.version === VERSION) {
    window.__dshMobileUi.sync();
    return;
  }

  const mobileQuery = window.matchMedia("(max-width: 720px)");
  let scheduled = false;
  let observer = null;

  const icons = {
    menu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
    compose: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7"/><path d="m16.5 3.5 4 4L11 17l-5 1 1-5Z"/></svg>`,
    chevron: `<svg class="dsh-mobile-title-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>`,
    search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>`
  };

  function isMobile() {
    return mobileQuery.matches;
  }

  function sidebarOpen() {
    return !!document.querySelector('[aria-label="收起侧边栏"]');
  }

  function sidebarButton(label) {
    return document.querySelector(`[aria-label="${label}"]`);
  }

  function newChatButton() {
    return document.querySelector(".wtg9ga_newSession") ||
      document.querySelector('[aria-label="新建会话"]');
  }

  function hasChatHeader() {
    return !!document.querySelector(".an3WzG_header");
  }

  function pageHeading() {
    const heading = document.querySelector(".mP3x-q_centerCol h1, .mP3x-q_centerCol h2");
    return (heading?.innerText || "").replace(/\s+/g, " ").trim();
  }

  function currentTitle() {
    const crumbs = document.querySelector(".an3WzG_crumbs");
    const text = (crumbs?.innerText || "").replace(/\s+/g, " ").trim();
    if (text) return text;
    if (!hasChatHeader()) {
      const heading = pageHeading();
      if (heading) return heading;
    }
    const documentTitle = (document.title || "")
      .replace(/\s*[—–-]\s*DeepSeek Harness.*$/i, "")
      .replace(/\s+/g, " ")
      .trim();
    return documentTitle && documentTitle !== "DeepSeek Harness" ? documentTitle : "DeepSeek";
  }

  function ensureViewportMeta() {
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "viewport";
      document.head.appendChild(meta);
    }
    const content = meta.getAttribute("content") || "";
    if (!/viewport-fit\s*=\s*cover/i.test(content)) {
      meta.setAttribute("content", `${content ? content.replace(/,\s*$/, "") + ", " : ""}viewport-fit=cover`);
    }
  }

  function buildTopbar() {
    let bar = document.getElementById("dsh-mobile-topbar");
    if (bar) return bar;
    bar = document.createElement("div");
    bar.id = "dsh-mobile-topbar";
    bar.setAttribute("role", "banner");
    bar.innerHTML = `
      <button type="button" class="dsh-mobile-bar-btn" data-dsh-mobile-action="menu" aria-label="打开菜单" aria-expanded="false">
        ${icons.menu}
      </button>
      <button type="button" class="dsh-mobile-title" data-dsh-mobile-action="menu" aria-label="打开侧边栏">
        <span class="dsh-mobile-title-text">DeepSeek</span>
        ${icons.chevron}
      </button>
      <button type="button" class="dsh-mobile-bar-btn" data-dsh-mobile-action="new-chat" aria-label="新建对话">
        ${icons.compose}
      </button>`;
    document.body.appendChild(bar);
    return bar;
  }

  function buildBackdrop() {
    let backdrop = document.getElementById("dsh-mobile-backdrop");
    if (backdrop) return backdrop;
    backdrop = document.createElement("div");
    backdrop.id = "dsh-mobile-backdrop";
    backdrop.setAttribute("aria-hidden", "true");
    document.body.appendChild(backdrop);
    return backdrop;
  }

  function searchRows() {
    return [...document.querySelectorAll(".mP3x-q_sidebarCol .wnFoaW_sessionRow")];
  }

  function applySearch(value) {
    const query = String(value || "").trim().toLowerCase();
    const rows = searchRows();
    for (const row of rows) {
      const match = !query || (row.innerText || "").toLowerCase().includes(query);
      row.classList.toggle("dsh-mobile-search-hidden", !match);
    }
    const empty = document.querySelector(".mP3x-q_sidebarCol .dsh-mobile-search-empty");
    if (empty) {
      empty.classList.toggle("is-visible", !!query && rows.length > 0 && rows.every((row) => row.classList.contains("dsh-mobile-search-hidden")));
    }
  }

  function clearSearch() {
    const input = document.querySelector(".mP3x-q_sidebarCol .dsh-mobile-search input");
    if (!input) return;
    input.value = "";
    applySearch("");
  }

  function ensureSearchRow() {
    if (!isMobile()) return;
    const region = document.querySelector(".mP3x-q_sidebarCol .wtg9ga_regionArea");
    if (!region) return;
    let box = region.querySelector(":scope > .dsh-mobile-search");
    if (!box) {
      box = document.createElement("div");
      box.className = "dsh-mobile-search";
      box.innerHTML = `${icons.search}<input type="search" inputmode="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="搜索对话" placeholder="搜索对话">`;
      const input = box.querySelector("input");
      input.addEventListener("input", () => applySearch(input.value));
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Escape" || !input.value) return;
        event.preventDefault();
        event.stopPropagation();
        clearSearch();
        input.blur();
      });
      region.prepend(box);
    }
    let empty = region.querySelector(":scope > .dsh-mobile-search-empty");
    if (!empty) {
      empty = document.createElement("div");
      empty.className = "dsh-mobile-search-empty";
      empty.textContent = "没有匹配的对话";
      box.after(empty);
    }
    const input = box.querySelector("input");
    if (input?.value) applySearch(input.value);
  }

  function updateTitle() {
    const el = document.querySelector("#dsh-mobile-topbar .dsh-mobile-title-text");
    if (!el) return;
    const title = currentTitle();
    if (el.textContent !== title) el.textContent = title;
    const button = el.closest(".dsh-mobile-title");
    if (button) button.setAttribute("aria-label", title ? `打开侧边栏：${title}` : "打开侧边栏");
  }

  function sync() {
    if (!document.body) return;
    ensureViewportMeta();
    buildTopbar();
    buildBackdrop();
    ensureSearchRow();

    document.documentElement.classList.toggle("dsh-mobile-chat-route", hasChatHeader());

    const open = isMobile() && sidebarOpen();
    if (!open) clearSearch();
    document.documentElement.classList.toggle("dsh-mobile-drawer-open", open);
    document.getElementById("dsh-mobile-backdrop")?.setAttribute("aria-hidden", open ? "false" : "true");

    const menu = document.querySelector('#dsh-mobile-topbar [data-dsh-mobile-action="menu"][aria-label]');
    if (menu) {
      menu.setAttribute("aria-expanded", open ? "true" : "false");
      menu.setAttribute("aria-label", open ? "关闭菜单" : "打开菜单");
    }
    const titleButton = document.querySelector("#dsh-mobile-topbar .dsh-mobile-title");
    titleButton?.setAttribute("aria-expanded", open ? "true" : "false");

    updateTitle();
  }

  function scheduleSync() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      sync();
    });
  }

  function openDrawer() {
    if (!isMobile() || sidebarOpen()) return;
    sidebarButton("打开侧边栏")?.click();
    scheduleSync();
    setTimeout(scheduleSync, 80);
    setTimeout(scheduleSync, 240);
  }

  function closeDrawer() {
    sidebarButton("收起侧边栏")?.click();
    scheduleSync();
    setTimeout(scheduleSync, 80);
    setTimeout(scheduleSync, 240);
  }

  function toggleDrawer() {
    if (sidebarOpen()) closeDrawer();
    else openDrawer();
  }

  function onTopbarClick(event) {
    const action = event.target.closest("[data-dsh-mobile-action]")?.getAttribute("data-dsh-mobile-action");
    if (action === "menu") {
      event.preventDefault();
      toggleDrawer();
      return;
    }
    if (action === "new-chat") {
      event.preventDefault();
      const button = newChatButton();
      if (button) button.click();
      if (sidebarOpen()) setTimeout(closeDrawer, 80);
      scheduleSync();
    }
  }

  function onDocumentClick(event) {
    if (!isMobile() || !sidebarOpen()) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const sidebar = document.querySelector(".mP3x-q_sidebarCol");
    if (!sidebar?.contains(target)) return;
    const navigation = target.closest(".wnFoaW_sessionRow, .wnFoaW_regionRow, .wnFoaW_workspaceRow, .wtg9ga_newSession, .wtg9ga_panelRow");
    if (navigation) setTimeout(closeDrawer, 90);
  }

  function init() {
    if (!document.body) return;
    ensureViewportMeta();
    buildTopbar();
    buildBackdrop();
    document.getElementById("dsh-mobile-topbar")?.addEventListener("click", onTopbarClick);
    document.getElementById("dsh-mobile-backdrop")?.addEventListener("click", closeDrawer);
    document.addEventListener("click", onDocumentClick, true);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && document.documentElement.classList.contains("dsh-mobile-drawer-open")) {
        closeDrawer();
      }
    });
    mobileQuery.addEventListener?.("change", () => {
      if (!isMobile()) {
        document.documentElement.classList.remove("dsh-mobile-drawer-open");
      }
      scheduleSync();
    });
    window.addEventListener("pageshow", scheduleSync);
    observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    sync();
    scheduleSync();
    window.__dshMobileUi = { version: VERSION, sync, openDrawer, closeDrawer, toggleDrawer };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

/* global DshCrypto */
"use strict";

importScripts("/app/crypto.js");

const tunnels = new Map();
const remoteClients = new Map();
const reconnects = new Map();
const resumes = new Map();
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const MOBILE_CSS = "/* DSH mobile drawer UI. Scoped to narrow screens; desktop layout is untouched. */\r\n#dsh-mobile-topbar,\r\n#dsh-mobile-backdrop,\r\n.dsh-mobile-search,\r\n.dsh-mobile-search-empty {\r\n  display: none;\r\n}\r\n\r\n@media (max-width: 720px) {\r\n  :root {\r\n    --dsh-mobile-topbar-h: 52px;\r\n    --dsh-mobile-drawer-w: min(78vw, 340px);\r\n    --dsh-mobile-bg: var(--dsw-alias-bg-primary, #0d1015);\r\n    --dsh-mobile-surface: var(--dsw-alias-bg-secondary, #171b21);\r\n    --dsh-mobile-line: var(--dsw-alias-border-l3, rgba(255, 255, 255, .09));\r\n    --dsh-mobile-label: var(--dsw-alias-label-primary, #f2f4f7);\r\n    --dsh-mobile-muted: var(--dsw-alias-label-secondary, #9aa3af);\r\n    --dsh-mobile-brand: var(--dsw-alias-brand-primary, #4d6bfe);\r\n  }\r\n\r\n  html,\r\n  body {\r\n    width: 100%;\r\n    height: 100%;\r\n    background: var(--dsh-mobile-bg);\r\n    overscroll-behavior-y: none;\r\n  }\r\n\r\n  /* One full-width column. The sidebar is taken out of the layout and becomes a drawer. */\r\n  .mP3x-q_frame {\r\n    width: 100vw !important;\r\n    height: 100vh !important;\r\n    height: 100dvh !important;\r\n    min-height: 100vh !important;\r\n    min-height: 100dvh !important;\r\n    grid-template-columns: 0 minmax(0, 1fr) 0 !important;\r\n    grid-template-rows: minmax(0, 1fr) 0 !important;\r\n    overflow: hidden !important;\r\n  }\r\n\r\n  .mP3x-q_centerCol {\r\n    grid-column: 2 !important;\r\n    width: 100% !important;\r\n    min-width: 0 !important;\r\n    min-height: 0 !important;\r\n  }\r\n\r\n  .mP3x-q_rightbarCol,\r\n  .mP3x-q_sidebarCol {\r\n    display: none !important;\r\n  }\r\n\r\n  .mP3x-q_frame > .an3WzG_widthHandle,\r\n  .an3WzG_widthHandle {\r\n    display: none !important;\r\n  }\r\n\r\n  .an3WzG_root {\r\n    --dsh-conversation-column-width: 100% !important;\r\n    min-width: 0 !important;\r\n    min-height: 0 !important;\r\n  }\r\n\r\n  .an3WzG_body,\r\n  .an3WzG_scrollBody {\r\n    min-width: 0 !important;\r\n    min-height: 0 !important;\r\n  }\r\n\r\n  .an3WzG_viewArea {\r\n    max-width: 100% !important;\r\n  }\r\n\r\n  /* Reserve room for the fixed mobile bar, but hide the desktop header contents. */\r\n  .an3WzG_header {\r\n    height: calc(var(--dsh-mobile-topbar-h) + env(safe-area-inset-top)) !important;\r\n    min-height: calc(var(--dsh-mobile-topbar-h) + env(safe-area-inset-top)) !important;\r\n    padding: env(safe-area-inset-top) 10px 0 !important;\r\n    border-bottom: 0 !important;\r\n    visibility: hidden !important;\r\n  }\r\n\r\n  .an3WzG_header > * {\r\n    display: none !important;\r\n  }\r\n\r\n  /* Non-chat routes (plugin pages, plugin market, automation, ...) have no .an3WzG_header\r\n     and render their own page head at y=0. Reserve the fixed topbar height so it stays clear. */\r\n  html:not(.dsh-mobile-chat-route) .mP3x-q_centerCol {\r\n    box-sizing: border-box !important;\r\n    padding-top: calc(var(--dsh-mobile-topbar-h) + env(safe-area-inset-top)) !important;\r\n  }\r\n\r\n  /* Fixed top app bar. */\r\n  #dsh-mobile-topbar {\r\n    position: fixed;\r\n    inset: 0 0 auto 0;\r\n    z-index: 900;\r\n    display: grid;\r\n    grid-template-columns: 44px minmax(0, 1fr) 44px;\r\n    align-items: center;\r\n    gap: 0;\r\n    box-sizing: border-box;\r\n    height: calc(var(--dsh-mobile-topbar-h) + env(safe-area-inset-top));\r\n    padding: env(safe-area-inset-top) 6px 0;\r\n    color: var(--dsh-mobile-label);\r\n    background: var(--dsh-mobile-bg);\r\n    border-bottom: .5px solid var(--dsh-mobile-line);\r\n    -webkit-backdrop-filter: blur(16px);\r\n    backdrop-filter: blur(16px);\r\n    -webkit-tap-highlight-color: transparent;\r\n  }\r\n\r\n  .dsh-mobile-bar-btn {\r\n    display: inline-flex;\r\n    align-items: center;\r\n    justify-content: center;\r\n    width: 44px;\r\n    height: 44px;\r\n    margin: 0;\r\n    padding: 0;\r\n    color: var(--dsh-mobile-label);\r\n    background: transparent;\r\n    border: 0;\r\n    border-radius: 12px;\r\n    cursor: pointer;\r\n  }\r\n\r\n  .dsh-mobile-bar-btn:active {\r\n    background: rgba(127, 127, 127, .16);\r\n  }\r\n\r\n  .dsh-mobile-bar-btn svg {\r\n    width: 22px;\r\n    height: 22px;\r\n  }\r\n\r\n  .dsh-mobile-title {\r\n    display: inline-flex;\r\n    align-items: center;\r\n    justify-content: center;\r\n    gap: 3px;\r\n    min-width: 0;\r\n    height: 44px;\r\n    margin: 0;\r\n    padding: 0 4px;\r\n    color: var(--dsh-mobile-label);\r\n    background: transparent;\r\n    border: 0;\r\n    font: inherit;\r\n    font-size: 16px;\r\n    font-weight: 600;\r\n    letter-spacing: -.01em;\r\n    cursor: pointer;\r\n  }\r\n\r\n  .dsh-mobile-title-text {\r\n    overflow: hidden;\r\n    text-overflow: ellipsis;\r\n    white-space: nowrap;\r\n  }\r\n\r\n  .dsh-mobile-title-chevron {\r\n    flex: 0 0 auto;\r\n    width: 14px;\r\n    height: 14px;\r\n    color: var(--dsh-mobile-muted);\r\n  }\r\n\r\n  /* Drawer backdrop. */\r\n  #dsh-mobile-backdrop {\r\n    position: fixed;\r\n    inset: 0;\r\n    z-index: 940;\r\n    display: none;\r\n    background: rgba(0, 0, 0, .56);\r\n    -webkit-backdrop-filter: blur(2px);\r\n    backdrop-filter: blur(2px);\r\n    touch-action: none;\r\n  }\r\n\r\n  html.dsh-mobile-drawer-open #dsh-mobile-backdrop {\r\n    display: block;\r\n    animation: dsh-mobile-fade .18s ease-out;\r\n  }\r\n\r\n  html.dsh-mobile-drawer-open .mP3x-q_sidebarCol {\r\n    display: block !important;\r\n    position: fixed !important;\r\n    inset: 0 auto 0 0 !important;\r\n    z-index: 950 !important;\r\n    width: var(--dsh-mobile-drawer-w) !important;\r\n    height: 100vh !important;\r\n    height: 100dvh !important;\r\n    min-width: 0 !important;\r\n    background: var(--dsh-mobile-bg) !important;\r\n    border-right: .5px solid var(--dsh-mobile-line);\r\n    box-shadow: 10px 0 34px rgba(0, 0, 0, .34);\r\n    overflow: hidden !important;\r\n    animation: dsh-mobile-slide .2s cubic-bezier(.2, .8, .2, 1);\r\n  }\r\n\r\n  html.dsh-mobile-drawer-open .mP3x-q_sidebarCol > * {\r\n    height: 100% !important;\r\n  }\r\n\r\n  html.dsh-mobile-drawer-open .mP3x-q_sidebarCol .wtg9ga_root {\r\n    display: flex !important;\r\n    flex-direction: column !important;\r\n    box-sizing: border-box !important;\r\n    width: 100% !important;\r\n    height: 100% !important;\r\n    padding-top: calc(6px + env(safe-area-inset-top)) !important;\r\n    padding-bottom: calc(6px + env(safe-area-inset-bottom)) !important;\r\n    overflow: hidden !important;\r\n  }\r\n\r\n  /* Reorder the existing sidebar: brand/new chat, workspace, tools, account. */\r\n  html.dsh-mobile-drawer-open .wtg9ga_logoRow {\r\n    order: 0 !important;\r\n    flex: 0 0 auto !important;\r\n  }\r\n\r\n  html.dsh-mobile-drawer-open .wtg9ga_newSession {\r\n    order: 1 !important;\r\n    flex: 0 0 auto !important;\r\n    min-height: 44px !important;\r\n    margin: 2px 2px 10px !important;\r\n    color: #fff !important;\r\n    background: var(--dsh-mobile-brand) !important;\r\n    border-radius: 12px !important;\r\n  }\r\n\r\n  html.dsh-mobile-drawer-open .wtg9ga_newSessionLabelMask {\r\n    color: #fff !important;\r\n    font-size: 14px !important;\r\n  }\r\n\r\n  html.dsh-mobile-drawer-open .wtg9ga_newSessionShortcut {\r\n    display: none !important;\r\n  }\r\n\r\n  html.dsh-mobile-drawer-open .wtg9ga_regionArea {\r\n    order: 2 !important;\r\n    flex: 1 1 auto !important;\r\n    min-height: 0 !important;\r\n    overflow: hidden !important;\r\n  }\r\n\r\n  html.dsh-mobile-drawer-open .wtg9ga_panelList {\r\n    order: 3 !important;\r\n    flex: 0 0 auto !important;\r\n    margin-top: 8px !important;\r\n    padding-top: 8px !important;\r\n    border-top: .5px solid var(--dsh-mobile-line);\r\n  }\r\n\r\n  html.dsh-mobile-drawer-open .wtg9ga_panelList::before {\r\n    content: \"工具\";\r\n    display: block;\r\n    padding: 0 8px 6px;\r\n    color: var(--dsh-mobile-muted);\r\n    font-size: 11px;\r\n    line-height: 16px;\r\n    letter-spacing: .04em;\r\n  }\r\n\r\n  html.dsh-mobile-drawer-open .wtg9ga_footArea {\r\n    order: 4 !important;\r\n    flex: 0 0 auto !important;\r\n  }\r\n\r\n  html.dsh-mobile-drawer-open .wtg9ga_brand {\r\n    gap: 8px !important;\r\n  }\r\n\r\n  html.dsh-mobile-drawer-open .wtg9ga_brandIdentity {\r\n    font-size: 0 !important;\r\n  }\r\n\r\n  html.dsh-mobile-drawer-open .wtg9ga_brandName {\r\n    display: none !important;\r\n  }\r\n\r\n  html.dsh-mobile-drawer-open .wtg9ga_footerActions {\r\n    display: none !important;\r\n  }\r\n\r\n  html.dsh-mobile-drawer-open .wtg9ga_brand::after {\r\n    content: \"DeepSeek\";\r\n    color: var(--dsh-mobile-label);\r\n    font-size: 19px;\r\n    font-weight: 650;\r\n    letter-spacing: -.02em;\r\n  }\r\n\r\n  html.dsh-mobile-drawer-open .wtg9ga_iconButton.wtg9ga_toggle {\r\n    width: 36px !important;\r\n    height: 36px !important;\r\n    border-radius: 10px;\r\n  }\r\n\r\n  /* Mobile-only search field: filters the existing session list in place. */\r\n  .dsh-mobile-search {\r\n    box-sizing: border-box;\r\n    display: flex;\r\n    width: calc(100% - 4px);\r\n    height: 40px;\r\n    margin: 0 2px 10px;\r\n    padding: 0 11px;\r\n    align-items: center;\r\n    gap: 8px;\r\n    color: var(--dsh-mobile-muted);\r\n    background: var(--dsh-mobile-surface);\r\n    border: .5px solid var(--dsh-mobile-line);\r\n    border-radius: 11px;\r\n    -webkit-tap-highlight-color: transparent;\r\n  }\r\n\r\n  .dsh-mobile-search svg {\r\n    flex: 0 0 auto;\r\n    width: 16px;\r\n    height: 16px;\r\n  }\r\n\r\n  .dsh-mobile-search input {\r\n    flex: 1 1 auto;\r\n    min-width: 0;\r\n    height: 100%;\r\n    padding: 0;\r\n    color: var(--dsh-mobile-label);\r\n    background: transparent;\r\n    border: 0;\r\n    outline: 0;\r\n    font: inherit;\r\n    font-size: 16px;\r\n  }\r\n\r\n  .dsh-mobile-search input::placeholder {\r\n    color: var(--dsh-mobile-muted);\r\n    opacity: 1;\r\n  }\r\n\r\n  .dsh-mobile-search-empty {\r\n    display: none;\r\n    padding: 12px 10px;\r\n    color: var(--dsh-mobile-muted);\r\n    font-size: 13px;\r\n  }\r\n\r\n  .dsh-mobile-search-empty.is-visible {\r\n    display: block;\r\n  }\r\n\r\n  .dsh-mobile-search-hidden {\r\n    display: none !important;\r\n  }\r\n\r\n  html.dsh-mobile-drawer-open .wtg9ga_regionArea .GAkraW_searchButton {\r\n    display: none !important;\r\n  }\r\n\r\n  /* Composer: keep the real controls, make the bottom safe area usable. */\r\n  .an3WzG_composerSeat {\r\n    padding-bottom: calc(8px + env(safe-area-inset-bottom)) !important;\r\n  }\r\n\r\n  .an3WzG_composerStack,\r\n  .GRgSLq_root {\r\n    box-sizing: border-box !important;\r\n    width: 100% !important;\r\n    min-width: 0 !important;\r\n  }\r\n\r\n  .GRgSLq_card {\r\n    box-sizing: border-box !important;\r\n    max-width: 100% !important;\r\n    overflow: hidden !important;\r\n  }\r\n\r\n  .GRgSLq_row {\r\n    gap: 4px !important;\r\n    padding-left: 8px !important;\r\n    padding-right: 8px !important;\r\n  }\r\n\r\n  .GRgSLq_trailing,\r\n  .GRgSLq_standardControls {\r\n    min-width: 0 !important;\r\n    gap: 4px !important;\r\n  }\r\n\r\n  .GRgSLq_activity {\r\n    display: none !important;\r\n  }\r\n\r\n  .GRgSLq_card ._tag_brmue_4 {\r\n    display: none !important;\r\n  }\r\n\r\n  .GRgSLq_input,\r\n  .GRgSLq_placeholder {\r\n    font-size: 16px !important;\r\n  }\r\n\r\n  .GRgSLq_dock {\r\n    display: none !important;\r\n  }\r\n\r\n  button[aria-label=\"海洋皮肤设置\"] {\r\n    display: none !important;\r\n  }\r\n\r\n  @keyframes dsh-mobile-slide {\r\n    from { transform: translateX(-102%); }\r\n    to { transform: translateX(0); }\r\n  }\r\n\r\n  @keyframes dsh-mobile-fade {\r\n    from { opacity: 0; }\r\n    to { opacity: 1; }\r\n  }\r\n}\r\n";
const MOBILE_JS = "(() => {\r\n  \"use strict\";\r\n\r\n  const VERSION = \"mobile4\";\r\n  if (window.__dshMobileUi?.version === VERSION) {\r\n    window.__dshMobileUi.sync();\r\n    return;\r\n  }\r\n\r\n  const mobileQuery = window.matchMedia(\"(max-width: 720px)\");\r\n  let scheduled = false;\r\n  let observer = null;\r\n\r\n  const icons = {\r\n    menu: `<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" aria-hidden=\"true\"><path d=\"M4 7h16M4 12h16M4 17h16\"/></svg>`,\r\n    compose: `<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7\"/><path d=\"m16.5 3.5 4 4L11 17l-5 1 1-5Z\"/></svg>`,\r\n    chevron: `<svg class=\"dsh-mobile-title-chevron\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"m7 10 5 5 5-5\"/></svg>`,\r\n    search: `<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" aria-hidden=\"true\"><circle cx=\"11\" cy=\"11\" r=\"6.5\"/><path d=\"m16 16 4 4\"/></svg>`\r\n  };\r\n\r\n  function isMobile() {\r\n    return mobileQuery.matches;\r\n  }\r\n\r\n  function sidebarOpen() {\r\n    return !!document.querySelector('[aria-label=\"收起侧边栏\"]');\r\n  }\r\n\r\n  function sidebarButton(label) {\r\n    return document.querySelector(`[aria-label=\"${label}\"]`);\r\n  }\r\n\r\n  function newChatButton() {\r\n    return document.querySelector(\".wtg9ga_newSession\") ||\r\n      document.querySelector('[aria-label=\"新建会话\"]');\r\n  }\r\n\r\n  function hasChatHeader() {\r\n    return !!document.querySelector(\".an3WzG_header\");\r\n  }\r\n\r\n  function pageHeading() {\r\n    const heading = document.querySelector(\".mP3x-q_centerCol h1, .mP3x-q_centerCol h2\");\r\n    return (heading?.innerText || \"\").replace(/\\s+/g, \" \").trim();\r\n  }\r\n\r\n  function currentTitle() {\r\n    const crumbs = document.querySelector(\".an3WzG_crumbs\");\r\n    const text = (crumbs?.innerText || \"\").replace(/\\s+/g, \" \").trim();\r\n    if (text) return text;\r\n    if (!hasChatHeader()) {\r\n      const heading = pageHeading();\r\n      if (heading) return heading;\r\n    }\r\n    const documentTitle = (document.title || \"\")\r\n      .replace(/\\s*[—–-]\\s*DeepSeek Harness.*$/i, \"\")\r\n      .replace(/\\s+/g, \" \")\r\n      .trim();\r\n    return documentTitle && documentTitle !== \"DeepSeek Harness\" ? documentTitle : \"DeepSeek\";\r\n  }\r\n\r\n  function ensureViewportMeta() {\r\n    let meta = document.querySelector('meta[name=\"viewport\"]');\r\n    if (!meta) {\r\n      meta = document.createElement(\"meta\");\r\n      meta.name = \"viewport\";\r\n      document.head.appendChild(meta);\r\n    }\r\n    const content = meta.getAttribute(\"content\") || \"\";\r\n    if (!/viewport-fit\\s*=\\s*cover/i.test(content)) {\r\n      meta.setAttribute(\"content\", `${content ? content.replace(/,\\s*$/, \"\") + \", \" : \"\"}viewport-fit=cover`);\r\n    }\r\n  }\r\n\r\n  function buildTopbar() {\r\n    let bar = document.getElementById(\"dsh-mobile-topbar\");\r\n    if (bar) return bar;\r\n    bar = document.createElement(\"div\");\r\n    bar.id = \"dsh-mobile-topbar\";\r\n    bar.setAttribute(\"role\", \"banner\");\r\n    bar.innerHTML = `\r\n      <button type=\"button\" class=\"dsh-mobile-bar-btn\" data-dsh-mobile-action=\"menu\" aria-label=\"打开菜单\" aria-expanded=\"false\">\r\n        ${icons.menu}\r\n      </button>\r\n      <button type=\"button\" class=\"dsh-mobile-title\" data-dsh-mobile-action=\"menu\" aria-label=\"打开侧边栏\">\r\n        <span class=\"dsh-mobile-title-text\">DeepSeek</span>\r\n        ${icons.chevron}\r\n      </button>\r\n      <button type=\"button\" class=\"dsh-mobile-bar-btn\" data-dsh-mobile-action=\"new-chat\" aria-label=\"新建对话\">\r\n        ${icons.compose}\r\n      </button>`;\r\n    document.body.appendChild(bar);\r\n    return bar;\r\n  }\r\n\r\n  function buildBackdrop() {\r\n    let backdrop = document.getElementById(\"dsh-mobile-backdrop\");\r\n    if (backdrop) return backdrop;\r\n    backdrop = document.createElement(\"div\");\r\n    backdrop.id = \"dsh-mobile-backdrop\";\r\n    backdrop.setAttribute(\"aria-hidden\", \"true\");\r\n    document.body.appendChild(backdrop);\r\n    return backdrop;\r\n  }\r\n\r\n  function searchRows() {\r\n    return [...document.querySelectorAll(\".mP3x-q_sidebarCol .wnFoaW_sessionRow\")];\r\n  }\r\n\r\n  function applySearch(value) {\r\n    const query = String(value || \"\").trim().toLowerCase();\r\n    const rows = searchRows();\r\n    for (const row of rows) {\r\n      const match = !query || (row.innerText || \"\").toLowerCase().includes(query);\r\n      row.classList.toggle(\"dsh-mobile-search-hidden\", !match);\r\n    }\r\n    const empty = document.querySelector(\".mP3x-q_sidebarCol .dsh-mobile-search-empty\");\r\n    if (empty) {\r\n      empty.classList.toggle(\"is-visible\", !!query && rows.length > 0 && rows.every((row) => row.classList.contains(\"dsh-mobile-search-hidden\")));\r\n    }\r\n  }\r\n\r\n  function clearSearch() {\r\n    const input = document.querySelector(\".mP3x-q_sidebarCol .dsh-mobile-search input\");\r\n    if (!input) return;\r\n    input.value = \"\";\r\n    applySearch(\"\");\r\n  }\r\n\r\n  function ensureSearchRow() {\r\n    if (!isMobile()) return;\r\n    const region = document.querySelector(\".mP3x-q_sidebarCol .wtg9ga_regionArea\");\r\n    if (!region) return;\r\n    let box = region.querySelector(\":scope > .dsh-mobile-search\");\r\n    if (!box) {\r\n      box = document.createElement(\"div\");\r\n      box.className = \"dsh-mobile-search\";\r\n      box.innerHTML = `${icons.search}<input type=\"search\" inputmode=\"search\" enterkeyhint=\"search\" autocomplete=\"off\" autocapitalize=\"off\" spellcheck=\"false\" aria-label=\"搜索对话\" placeholder=\"搜索对话\">`;\r\n      const input = box.querySelector(\"input\");\r\n      input.addEventListener(\"input\", () => applySearch(input.value));\r\n      input.addEventListener(\"keydown\", (event) => {\r\n        if (event.key !== \"Escape\" || !input.value) return;\r\n        event.preventDefault();\r\n        event.stopPropagation();\r\n        clearSearch();\r\n        input.blur();\r\n      });\r\n      region.prepend(box);\r\n    }\r\n    let empty = region.querySelector(\":scope > .dsh-mobile-search-empty\");\r\n    if (!empty) {\r\n      empty = document.createElement(\"div\");\r\n      empty.className = \"dsh-mobile-search-empty\";\r\n      empty.textContent = \"没有匹配的对话\";\r\n      box.after(empty);\r\n    }\r\n    const input = box.querySelector(\"input\");\r\n    if (input?.value) applySearch(input.value);\r\n  }\r\n\r\n  function updateTitle() {\r\n    const el = document.querySelector(\"#dsh-mobile-topbar .dsh-mobile-title-text\");\r\n    if (!el) return;\r\n    const title = currentTitle();\r\n    if (el.textContent !== title) el.textContent = title;\r\n    const button = el.closest(\".dsh-mobile-title\");\r\n    if (button) button.setAttribute(\"aria-label\", title ? `打开侧边栏：${title}` : \"打开侧边栏\");\r\n  }\r\n\r\n  function sync() {\r\n    if (!document.body) return;\r\n    ensureViewportMeta();\r\n    buildTopbar();\r\n    buildBackdrop();\r\n    ensureSearchRow();\r\n\r\n    document.documentElement.classList.toggle(\"dsh-mobile-chat-route\", hasChatHeader());\r\n\r\n    const open = isMobile() && sidebarOpen();\r\n    if (!open) clearSearch();\r\n    document.documentElement.classList.toggle(\"dsh-mobile-drawer-open\", open);\r\n    document.getElementById(\"dsh-mobile-backdrop\")?.setAttribute(\"aria-hidden\", open ? \"false\" : \"true\");\r\n\r\n    const menu = document.querySelector('#dsh-mobile-topbar [data-dsh-mobile-action=\"menu\"][aria-label]');\r\n    if (menu) {\r\n      menu.setAttribute(\"aria-expanded\", open ? \"true\" : \"false\");\r\n      menu.setAttribute(\"aria-label\", open ? \"关闭菜单\" : \"打开菜单\");\r\n    }\r\n    const titleButton = document.querySelector(\"#dsh-mobile-topbar .dsh-mobile-title\");\r\n    titleButton?.setAttribute(\"aria-expanded\", open ? \"true\" : \"false\");\r\n\r\n    updateTitle();\r\n  }\r\n\r\n  function scheduleSync() {\r\n    if (scheduled) return;\r\n    scheduled = true;\r\n    requestAnimationFrame(() => {\r\n      scheduled = false;\r\n      sync();\r\n    });\r\n  }\r\n\r\n  function openDrawer() {\r\n    if (!isMobile() || sidebarOpen()) return;\r\n    sidebarButton(\"打开侧边栏\")?.click();\r\n    scheduleSync();\r\n    setTimeout(scheduleSync, 80);\r\n    setTimeout(scheduleSync, 240);\r\n  }\r\n\r\n  function closeDrawer() {\r\n    sidebarButton(\"收起侧边栏\")?.click();\r\n    scheduleSync();\r\n    setTimeout(scheduleSync, 80);\r\n    setTimeout(scheduleSync, 240);\r\n  }\r\n\r\n  function toggleDrawer() {\r\n    if (sidebarOpen()) closeDrawer();\r\n    else openDrawer();\r\n  }\r\n\r\n  function onTopbarClick(event) {\r\n    const action = event.target.closest(\"[data-dsh-mobile-action]\")?.getAttribute(\"data-dsh-mobile-action\");\r\n    if (action === \"menu\") {\r\n      event.preventDefault();\r\n      toggleDrawer();\r\n      return;\r\n    }\r\n    if (action === \"new-chat\") {\r\n      event.preventDefault();\r\n      const button = newChatButton();\r\n      if (button) button.click();\r\n      if (sidebarOpen()) setTimeout(closeDrawer, 80);\r\n      scheduleSync();\r\n    }\r\n  }\r\n\r\n  function onDocumentClick(event) {\r\n    if (!isMobile() || !sidebarOpen()) return;\r\n    const target = event.target instanceof Element ? event.target : null;\r\n    if (!target) return;\r\n    const sidebar = document.querySelector(\".mP3x-q_sidebarCol\");\r\n    if (!sidebar?.contains(target)) return;\r\n    const navigation = target.closest(\".wnFoaW_sessionRow, .wnFoaW_regionRow, .wnFoaW_workspaceRow, .wtg9ga_newSession, .wtg9ga_panelRow\");\r\n    if (navigation) setTimeout(closeDrawer, 90);\r\n  }\r\n\r\n  function init() {\r\n    if (!document.body) return;\r\n    ensureViewportMeta();\r\n    buildTopbar();\r\n    buildBackdrop();\r\n    document.getElementById(\"dsh-mobile-topbar\")?.addEventListener(\"click\", onTopbarClick);\r\n    document.getElementById(\"dsh-mobile-backdrop\")?.addEventListener(\"click\", closeDrawer);\r\n    document.addEventListener(\"click\", onDocumentClick, true);\r\n    document.addEventListener(\"keydown\", (event) => {\r\n      if (event.key === \"Escape\" && document.documentElement.classList.contains(\"dsh-mobile-drawer-open\")) {\r\n        closeDrawer();\r\n      }\r\n    });\r\n    mobileQuery.addEventListener?.(\"change\", () => {\r\n      if (!isMobile()) {\r\n        document.documentElement.classList.remove(\"dsh-mobile-drawer-open\");\r\n      }\r\n      scheduleSync();\r\n    });\r\n    window.addEventListener(\"pageshow\", scheduleSync);\r\n    observer = new MutationObserver(scheduleSync);\r\n    observer.observe(document.body, { childList: true, subtree: true, characterData: true });\r\n    sync();\r\n    scheduleSync();\r\n    window.__dshMobileUi = { version: VERSION, sync, openDrawer, closeDrawer, toggleDrawer };\r\n  }\r\n\r\n  if (document.readyState === \"loading\") {\r\n    document.addEventListener(\"DOMContentLoaded\", init, { once: true });\r\n  } else {\r\n    init();\r\n  }\r\n})();\r\n";
const MOBILE_UI_TAGS = `<link rel="stylesheet" href="/app/mobile.css?v=mobile4"><script defer src="/app/mobile.js?v=mobile4"><\/script>`;

const sessionDatabase = new Promise((resolve, reject) => {
  const request = indexedDB.open("dsh-remote-web", 2);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains("device-keys"))
      request.result.createObjectStore("device-keys");
    if (!request.result.objectStoreNames.contains("tunnel-sessions"))
      request.result.createObjectStore("tunnel-sessions", { keyPath: "deviceId" });
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

function sessionTransaction(mode, action) {
  return sessionDatabase.then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction("tunnel-sessions", mode);
    const request = action(transaction.objectStore("tunnel-sessions"));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));
}

function readSession(deviceId) {
  return sessionTransaction("readonly", (store) => store.get(deviceId));
}

function writeSession(session) {
  return sessionTransaction("readwrite", (store) => store.put(session));
}

function readMasterKey(deviceId) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("dsh-remote-web", 2);
    request.onsuccess = () => {
      const transaction = request.result.transaction("device-keys", "readonly");
      const keyRequest = transaction.objectStore("device-keys").get(deviceId);
      keyRequest.onsuccess = () => resolve(keyRequest.result || null);
      keyRequest.onerror = () => reject(keyRequest.error);
    };
    request.onerror = () => reject(request.error);
  });
}

function id(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function envelope(type, payload, channel) {
  return { v: 1, type, channel, id: crypto.randomUUID(), ts: Date.now(), payload };
}

function bytesToBase64(value) {
  let binary = "";
  for (const byte of new Uint8Array(value)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value || "");
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function versionedStaticPath(path) {
  const url = new URL(path, self.location.origin);
  if (url.origin !== self.location.origin) return false;
  return /^\/assets\/[^/]+-[A-Za-z0-9_-]{6,}\.(?:js|css|woff2?|svg)$/.test(url.pathname) ||
    (url.pathname.startsWith('/plugins/') && /^[A-Za-z0-9_-]{8,128}$/.test(url.searchParams.get('rev') || ''));
}

async function loadRemoteResource(tunnel, path, request) {
  if (request.method !== 'GET' || !versionedStaticPath(path) || typeof caches === 'undefined')
    return tunnel.request(path, request);
  // Called only after the authenticated tunnel is available. Never cache chats,
  // credentials, HTML, or API results; revisioned assets are isolated by device.
  let cache;
  const key = new URL(path, self.location.origin).href;
  try {
      cache = await caches.open(`dsh-static-lite-v3-${encodeURIComponent(tunnel.deviceId)}`);
    const hit = await cache.match(key);
    if (hit) return hit;
  } catch { /* Storage may be unavailable in private browsing; use the tunnel. */ }
  const response = await tunnel.request(path, request);
  if (cache && response.status === 200 &&
      !/no-store|private/i.test(response.headers.get('cache-control') || '') &&
      /javascript|css|font|image\/svg/i.test(response.headers.get('content-type') || '')) {
    try {
      await cache.put(key, response.clone());
      const keys = await cache.keys();
      for (const old of keys.slice(0, Math.max(0, keys.length - 64))) await cache.delete(old);
    } catch { /* A full cache must not prevent the workspace loading. */ }
  }
  return response;
}

function remoteShim() {
  let nextChannel = 0;
  const sockets = new Map();
  let wasHidden = false;
  const recoverForeground = () => {
    if (!sockets.size || !navigator.serviceWorker.controller) return;
    navigator.serviceWorker.controller.postMessage({type: "remote-ws-reset"});
    // Let DSH's own connection manager recreate its subscriptions and reconcile
    // submission receipts. Never replay application frames or reload the page.
    for (const socket of [...sockets.values()]) {
      socket.readyState = 3;
      socket.pendingSends.length = 0;
      sockets.delete(socket.channel);
      socket.dispatchNamed("close", new CloseEvent("close", {code: 1012, reason: "foreground reconnect", wasClean: false}));
    }
  };
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") wasHidden = true;
    else if (wasHidden) { wasHidden = false; recoverForeground(); }
  });
  window.addEventListener?.("pageshow", event => { if (event.persisted) recoverForeground(); });
  navigator.serviceWorker.addEventListener("controllerchange", recoverForeground);

  class DshWebSocket extends EventTarget {
    constructor(url, protocols) {
      super();
      this.url = new URL(url, location.href).href;
      this.readyState = DshWebSocket.CONNECTING;
      this.bufferedAmount = 0;
      this.extensions = "";
      this.protocol = "";
      this.binaryType = "blob";
      this.pendingSends = [];
      this.transmitQueue = Promise.resolve();
      this.channel = `browser_ws_${Date.now()}_${nextChannel++}`;
      sockets.set(this.channel, this);
      navigator.serviceWorker.controller.postMessage({
        type: "remote-ws-open",
        channel: this.channel,
        url: this.url,
        protocols: Array.isArray(protocols) ? protocols : protocols ? [protocols] : [],
      });
    }

    send(data) {
      if (this.readyState === DshWebSocket.CONNECTING) {
        this.pendingSends.push(data);
        return;
      }
      if (this.readyState !== DshWebSocket.OPEN) return;
      this.transmit(data);
    }

    transmit(data) {
      // Match native WebSocket: snapshot the selected bytes without transferring
      // the caller's buffer, and preserve ordering across async Blob conversions.
      const snapshot = typeof data === "string" || data instanceof Blob ? data
        : ArrayBuffer.isView(data)
          ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice().buffer
          : data.slice(0);
      this.transmitQueue = this.transmitQueue.then(async () => {
        if (this.readyState !== DshWebSocket.OPEN) return;
        if (typeof snapshot === "string") {
          navigator.serviceWorker.controller.postMessage({ type: "remote-ws-send", channel: this.channel, text: snapshot });
        } else {
          const buffer = snapshot instanceof Blob ? await snapshot.arrayBuffer() : snapshot;
          navigator.serviceWorker.controller.postMessage({ type: "remote-ws-send", channel: this.channel, buffer }, [buffer]);
        }
      }).catch(() => {
        this.dispatchNamed("error", new Event("error"));
        this.close(1011, "message forwarding failed");
      });
    }

    close(code, reason) {
      if (this.readyState >= DshWebSocket.CLOSING) return;
      this.readyState = DshWebSocket.CLOSING;
      navigator.serviceWorker.controller.postMessage({ type: "remote-ws-close", channel: this.channel, code, reason });
    }

    dispatchNamed(name, event) {
      this.dispatchEvent(event);
      const handler = this[`on${name}`];
      if (typeof handler === "function") handler.call(this, event);
    }
  }

  DshWebSocket.CONNECTING = 0;
  DshWebSocket.OPEN = 1;
  DshWebSocket.CLOSING = 2;
  DshWebSocket.CLOSED = 3;
  Object.assign(DshWebSocket.prototype, {
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
    onopen: null,
    onmessage: null,
    onerror: null,
    onclose: null,
  });

  navigator.serviceWorker.addEventListener("message", (event) => {
    const message = event.data;
    if (message?.type !== "dsh-remote-ws") return;
    const socket = sockets.get(message.channel);
    if (!socket) return;
    if (message.event === "open") {
      socket.readyState = DshWebSocket.OPEN;
      socket.protocol = message.protocol || "";
      socket.dispatchNamed("open", new Event("open"));
      for (const data of socket.pendingSends.splice(0)) socket.transmit(data);
    } else if (message.event === "message") {
      let data = message.text;
      if (message.buffer) data = socket.binaryType === "arraybuffer" ? message.buffer : new Blob([message.buffer]);
      socket.dispatchNamed("message", new MessageEvent("message", { data }));
    } else if (message.event === "close") {
      socket.readyState = DshWebSocket.CLOSED;
      sockets.delete(message.channel);
      socket.dispatchNamed("close", new CloseEvent("close", { code: message.code || 1000, reason: message.reason || "", wasClean: message.wasClean !== false }));
    } else if (message.event === "error") {
      socket.dispatchNamed("error", new Event("error"));
    }
  });

  window.WebSocket = DshWebSocket;
}

const shimSource = `;(${remoteShim.toString()})();`;

class Tunnel {
  constructor(options) {
    this.deviceId = options.deviceId;
    this.accessSessionId = options.accessSessionId;
    this.masterKey = options.masterKey;
    this.tunnelUrl = options.tunnelUrl;
    this.ticket = options.ticket;
    this.createdAt = Date.now();
    this.pendingHttp = new Map();
    this.virtualSockets = new Map();
    this.cookieJar = new Map();
    this.sendQueue = Promise.resolve();
    this.receiveQueue = Promise.resolve();
  }

  connect() {
    return new Promise((resolve, reject) => {
      const encodedTicket = DshCrypto.base64Url(encoder.encode(this.ticket));
      const socket = new WebSocket(this.tunnelUrl, ["dsh-e2ee-v1", `dsh-ticket.${encodedTicket}`]);
      this.socket = socket;
      let opened = false;
      let settled = false;
      const rejectHandshake = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.rejectHandshake = null;
        this.fail(error);
        socket.close();
        reject(error);
      };
      const timer = setTimeout(() => rejectHandshake(new Error(opened
        ? "加密握手超时：已连接中转，但未完成电脑端密钥确认。"
        : "加密连接超时：未能建立到中转的 WebSocket 连接。")), 10000);
      this.rejectHandshake = rejectHandshake;
      socket.addEventListener("open", async () => {
        opened = true;
        try {
          const hello = await DshCrypto.clientHello(this.masterKey, this.accessSessionId);
          if (settled) return;
          this.clientRandomB64 = hello.clientRandomB64;
          socket.send(JSON.stringify(envelope("client_hello", hello.payload)));
        } catch (error) {
          rejectHandshake(new Error("手机端无法生成加密握手，请更新 Safari 后重试。"));
        }
      });
      socket.addEventListener("message", (event) => {
        this.receiveQueue = this.receiveQueue.then(async () => {
          const message = JSON.parse(event.data);
          if (message.type === "server_hello" && !this.cipher) {
            this.cipher = await DshCrypto.acceptServerHello(
              this.masterKey,
              this.accessSessionId,
              this.clientRandomB64,
              message.payload,
            );
            clearTimeout(timer);
            if (settled) return;
            settled = true;
            this.rejectHandshake = null;
            resolve();
            return;
          }
          if (message.type === "sealed" && this.cipher) {
            const inner = await this.cipher.open(message.payload);
            await this.handleInner(inner);
            return;
          }
          if (message.type === "device_close") {
            this.fail(new Error("电脑拒绝了加密连接，请重新扫描电脑上的浏览器访问码。"));
            this.close(1011, "device closed");
          }
        }).catch(() => this.fail(new Error("加密消息校验失败，请重新扫描电脑上的浏览器访问码。")));
      });
      socket.addEventListener("error", () => {
        this.fail(new Error("无法连接加密隧道"));
      });
      socket.addEventListener("close", () => this.fail(new Error("加密隧道已断开")));
    });
  }

  close(code = 1000, reason = "client closed") {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(envelope("client_close", { accessSessionId: this.accessSessionId, reason })));
      this.socket.close(code, reason);
    }
  }

  fail(error) {
    if (this.rejectHandshake) this.rejectHandshake(error);
    if (this.failed) return;
    this.failed = true;
    if (tunnels.get(this.deviceId) === this) tunnels.delete(this.deviceId);
    for (const pending of this.pendingHttp.values()) pending.reject(error);
    this.pendingHttp.clear();
    for (const entry of this.virtualSockets.values()) this.postSocket(entry.clientId, entry.channel, "close", { code: 1011, reason: "secure tunnel failed", wasClean: false });
    this.virtualSockets.clear();
  }

  sendInner(type, payload, channel) {
    this.sendQueue = this.sendQueue.then(async () => {
      if (!this.cipher || this.socket.readyState !== WebSocket.OPEN) throw new Error("secure tunnel unavailable");
      const sealed = await this.cipher.seal(envelope(type, payload, channel));
      this.socket.send(JSON.stringify(envelope("sealed", { accessSessionId: this.accessSessionId, ...sealed })));
    });
    return this.sendQueue;
  }

  request(path, request) {
    return new Promise(async (resolve, reject) => {
      const channel = id("http");
      const headers = Object.fromEntries(request.headers.entries());
      if (this.cookieJar.size) headers.cookie = [...this.cookieJar].map(([name, value]) => `${name}=${value}`).join("; ");
      delete headers.host;
      // HTTP is carried inside encrypted frames, so the browser's native
      // content decoder cannot negotiate or decode these responses for us.
      headers['accept-encoding'] = typeof DecompressionStream !== 'undefined' && versionedStaticPath(path)
        ? 'gzip' : 'identity';
      if (versionedStaticPath(path)) headers['x-dsh-mobile-lite'] = '1';
      const body = request.method === "GET" || request.method === "HEAD" ? new Uint8Array() : new Uint8Array(await request.arrayBuffer());
      this.pendingHttp.set(channel, { resolve, reject, chunks: [], responseStarted: false });
      try {
        await this.sendInner("http_req", { method: request.method, path, headers, bodyB64: bytesToBase64(body) }, channel);
      } catch (error) {
        this.pendingHttp.delete(channel);
        reject(error);
      }
    });
  }

  responseHeaders(raw) {
    const headers = new Headers();
    for (const [name, value] of Object.entries(raw || {})) {
      const lower = name.toLowerCase();
      if (["content-length", "content-security-policy", "transfer-encoding", "connection", "set-cookie"].includes(lower)) continue;
      for (const item of Array.isArray(value) ? value : [value]) {
        let output = String(item);
        if (lower === "location") {
          try {
            const location = new URL(output);
            if (["127.0.0.1", "localhost"].includes(location.hostname))
              output = `${self.location.origin}${location.pathname}${location.search}${location.hash}`;
          } catch {}
        }
        headers.append(name, output);
      }
    }
    return headers;
  }

  rememberCookies(raw) {
    const values = raw?.["set-cookie"] || raw?.["Set-Cookie"];
    for (const value of Array.isArray(values) ? values : values ? [values] : []) {
      const pair = String(value).split(";", 1)[0];
      const split = pair.indexOf("=");
      if (split > 0) this.cookieJar.set(pair.slice(0, split).trim(), pair.slice(split + 1));
    }
  }

  async handleHttpResponse(message) {
    const pending = this.pendingHttp.get(message.channel);
    if (!pending) return;
    const payload = message.payload || {};
    if (payload.status !== undefined && !pending.responseStarted) {
      pending.responseStarted = true;
      pending.status = Number(payload.status) || 502;
      pending.headers = this.responseHeaders(payload.headers);
      this.rememberCookies(payload.headers);
      pending.streaming = pending.headers.get("content-type")?.includes("text/event-stream");
      if (pending.streaming) {
        const stream = new TransformStream();
        pending.writer = stream.writable.getWriter();
        pending.resolve(new Response(stream.readable, { status: pending.status, headers: pending.headers }));
      }
    }
    const chunk = base64ToBytes(payload.bodyB64);
    if (pending.streaming) {
      if (chunk.length) await pending.writer.write(chunk);
      if (payload.final !== false) {
        await pending.writer.close();
        this.pendingHttp.delete(message.channel);
      }
      return;
    }
    if (chunk.length) pending.chunks.push(chunk);
    if (payload.final === false) return;
    this.pendingHttp.delete(message.channel);
    const length = pending.chunks.reduce((sum, value) => sum + value.length, 0);
    const body = new Uint8Array(length);
    let offset = 0;
    for (const value of pending.chunks) {
      body.set(value, offset);
      offset += value.length;
    }
    let output = body;
    if (pending.headers?.get('content-encoding') === 'gzip') {
      try {
        output = new Uint8Array(await new Response(new Blob([body]).stream()
          .pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
        pending.headers.delete('content-encoding');
      } catch { pending.reject(new Error('静态资源解压失败，请重新连接。')); return; }
    }
    if (pending.headers?.get("content-type")?.includes("text/html")) {
      const html = decoder
        .decode(output)
        .replace(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/gi, "");
      const injected = html.includes("<head")
        ? html.replace(/<head([^>]*)>/i, `<head$1><script>${shimSource}<\/script>${MOBILE_UI_TAGS}`)
        : `<script>${shimSource}<\/script>${MOBILE_UI_TAGS}${html}`;
      output = encoder.encode(injected);
    }
    pending.resolve(new Response(output, { status: pending.status || 200, headers: pending.headers }));
  }

  async handleInner(message) {
    if (message.type === "http_res") return this.handleHttpResponse(message);
    const entry = this.virtualSockets.get(message.channel);
    if (!entry) return;
    if (message.type === "ws_open_ok") {
      await this.postSocket(entry.clientId, entry.channel, "open", { protocol: message.payload?.protocol });
      return;
    }
    if (message.type === "ws_frame") {
      const data = base64ToBytes(message.payload?.dataB64);
      if (message.payload?.opcode === 1) await this.postSocket(entry.clientId, entry.channel, "message", { text: decoder.decode(data) });
      else await this.postSocket(entry.clientId, entry.channel, "message", { buffer: data.buffer }, [data.buffer]);
      return;
    }
    if (message.type === "ws_close") {
      this.virtualSockets.delete(message.channel);
      await this.postSocket(entry.clientId, entry.channel, "close", { code: message.payload?.code, reason: message.payload?.reason, wasClean: true });
    }
  }

  async postSocket(clientId, channel, event, data, transfer = []) {
    const client = await clients.get(clientId);
    client?.postMessage({ type: "dsh-remote-ws", channel, event, ...data }, transfer);
  }

  openVirtualSocket(clientId, message) {
    const url = new URL(message.url);
    // Compare HTTP origins: a WebSocket's ws(s) origin otherwise never matches the page.
    if (url.protocol === "ws:") url.protocol = "http:";
    if (url.protocol === "wss:") url.protocol = "https:";
    if (
      !["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      (url.origin !== self.location.origin &&
      !["127.0.0.1", "localhost"].includes(url.hostname))
    )
      return this.postSocket(clientId, message.channel, "error", {});
    const mount = /^\/remote\/([^/]+)(\/.*)?$/.exec(url.pathname);
    if (mount) {
      try {
        if (decodeURIComponent(mount[1]) !== this.deviceId)
          return this.postSocket(clientId, message.channel, "error", {});
      } catch {
        return this.postSocket(clientId, message.channel, "error", {});
      }
    }
    const path = `${mount ? mount[2] || "/" : url.pathname}${url.search}`;
    this.virtualSockets.set(message.channel, { clientId, channel: message.channel });
    const headers = message.protocols?.length ? { "sec-websocket-protocol": message.protocols.join(", ") } : {};
    return this.sendInner("ws_open", { path, headers }, message.channel);
  }
}

async function freshTicket(deviceId) {
  const response = await fetch("/web-ticket", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "content-type": "application/json", "x-dsh-sw-resume": "1" },
    body: JSON.stringify({ deviceId }),
  });
  if (!response.ok) throw new Error("web_ticket_failed");
  return response.json();
}

async function resumeTunnel(deviceId) {
  if (tunnels.has(deviceId)) return tunnels.get(deviceId);
  if (resumes.has(deviceId)) return resumes.get(deviceId);
  const pending = (async () => {
    const [session, masterKey] = await Promise.all([readSession(deviceId), readMasterKey(deviceId)]);
    if (!session || !masterKey) return null;
    // Tickets are consumed by the first upgrade; never retry a stored ticket.
    const ticketData = await freshTicket(deviceId);
    const options = {
      deviceId,
      masterKey,
      ticket: ticketData.ticket,
      accessSessionId: ticketData.accessSessionId,
      tunnelUrl: ticketData.tunnelUrl,
    };
    const tunnel = new Tunnel(options);
    await tunnel.connect();
    tunnels.set(deviceId, tunnel);
    await writeSession({ ...session, ...options, masterKey: undefined });
    return tunnel;
  })().catch(() => null).finally(() => resumes.delete(deviceId));
  resumes.set(deviceId, pending);
  return pending;
}

function remoteDeviceFromUrl(value) {
  try {
    const match = /^\/remote\/([^/]+)/.exec(new URL(value).pathname);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

async function deviceForClient(clientId) {
  if (!clientId) return null;
  const known = remoteClients.get(clientId);
  if (known) return known;
  const client = await clients.get(clientId);
  const deviceId = remoteDeviceFromUrl(client?.url);
  if (deviceId) remoteClients.set(clientId, deviceId);
  return deviceId;
}

async function reconnectTunnel(deviceId) {
  if (!reconnects.has(deviceId)) {
    reconnects.set(deviceId, (async () => {
      const current = tunnels.get(deviceId);
      tunnels.delete(deviceId);
      current?.close(1012, "reconnecting");
      return resumeTunnel(deviceId);
    })().finally(() => reconnects.delete(deviceId)));
  }
  return reconnects.get(deviceId);
}

self.addEventListener("install", (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("message", (event) => {
  const message = event.data || {};
  const respond = (value) => event.ports[0]?.postMessage(value);
  if (message.type === "tunnel-status") {
    const current = tunnels.get(message.deviceId);
    respond({ ok: true, warm: current?.socket?.readyState === 1 });
    return;
  }
  if (message.type === "init-tunnel") {
    event.waitUntil((async () => {
      try {
        const current = tunnels.get(message.deviceId);
        if (current?.socket?.readyState === 1) {
          respond({ ok: true, reused: true });
          return;
        }
        current?.close();
        const tunnel = new Tunnel(message);
        await tunnel.connect();
        tunnels.set(message.deviceId, tunnel);
        await writeSession({
          deviceId: message.deviceId,
          ticket: message.ticket,
          accessSessionId: message.accessSessionId,
          tunnelUrl: message.tunnelUrl,
        });
        respond({ ok: true });
      } catch (error) {
        respond({ ok: false, error: error instanceof Error ? error.message : "无法建立加密隧道" });
      }
    })());
    return;
  }
  const clientId = event.source?.id;
  if (!clientId || typeof message.type !== "string" || !message.type.startsWith("remote-ws-")) return;
  event.waitUntil((async () => {
    const deviceId = await deviceForClient(clientId);
    if (message.type === "remote-ws-reset") {
      if (deviceId) await reconnectTunnel(deviceId);
      return;
    }
    const tunnel = deviceId && (message.type === "remote-ws-open"
      ? (await reconnects.get(deviceId) || tunnels.get(deviceId) || await resumeTunnel(deviceId))
      : tunnels.get(deviceId));
    const entry = tunnel?.virtualSockets.get(message.channel);
    const missingChannel = message.type !== "remote-ws-open" && (!entry || entry.clientId !== clientId);
    if (!tunnel || missingChannel) {
      const client = await clients.get(clientId);
      client?.postMessage({ type: "dsh-remote-ws", channel: message.channel, event: "close", code: 1013, reason: "secure tunnel unavailable", wasClean: false });
      return;
    }
    if (message.type === "remote-ws-open") await tunnel.openVirtualSocket(clientId, message);
    if (message.type === "remote-ws-send") {
      const data = message.text !== undefined ? encoder.encode(message.text) : new Uint8Array(message.buffer);
      await tunnel.sendInner("ws_frame", { dataB64: bytesToBase64(data), opcode: message.text !== undefined ? 1 : 2 }, message.channel);
    }
    if (message.type === "remote-ws-close") {
      tunnel.virtualSockets.delete(message.channel);
      await tunnel.sendInner("ws_close", { code: message.code, reason: message.reason }, message.channel);
    }
  })());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
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
  if (event.request.headers.get("x-dsh-sw-resume") === "1") return;
  const launch = /^\/remote\/([^/]+)(\/.*)?$/.exec(url.pathname);
  let deviceId = event.clientId ? remoteClients.get(event.clientId) : undefined;
  if (launch) {
    deviceId = decodeURIComponent(launch[1]);
    const resultingId = event.resultingClientId || event.clientId;
    if (resultingId) remoteClients.set(resultingId, deviceId);
  }
  deviceId ||= remoteDeviceFromUrl(event.request.referrer);
  if (deviceId && event.clientId) remoteClients.set(event.clientId, deviceId);
  if (!deviceId) return;
  const path = launch ? `${launch[2] || "/"}${url.search}` : `${url.pathname}${url.search}`;
  event.respondWith((async () => {
    const tunnel = tunnels.get(deviceId) || await resumeTunnel(deviceId);
    if (!tunnel) {
      if (event.clientId) remoteClients.delete(event.clientId);
      if (event.resultingClientId) remoteClients.delete(event.resultingClientId);
      return fetch("/remote/unavailable.html");
    }
    try {
      return await loadRemoteResource(tunnel, path, event.request);
    } catch {
      if (!["GET", "HEAD"].includes(event.request.method))
        return new Response("Secure tunnel failed", { status: 502 });
      const recovered = await reconnectTunnel(deviceId);
      if (!recovered) return new Response("Secure tunnel failed", { status: 502 });
      return loadRemoteResource(recovered, path, event.request).catch(() => new Response("Secure tunnel failed", { status: 502 }));
    }
  })());
});

window.__ModuleLoader__.load({
  id: "dsh-remote-kit-panel",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    const React = require("react");
    const h = React.createElement;
    const { useCallback, useEffect, useState } = React;
    const BASE = "/dsh-remote-kit/api";
    const REPO = "https://github.com/ln123456789100ln-collab/dsh-remote-kit";

    const css = `
      .drk-root{color:var(--dsw-alias-label-primary);max-width:640px;padding:4px 0 24px;font-size:14px;line-height:1.55}
      .drk-head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:20px}
      .drk-title{font-size:18px;font-weight:600;margin:0 0 4px}
      .drk-subtle{color:var(--dsw-alias-label-secondary);margin:0}
      .drk-status{display:inline-flex;align-items:center;gap:7px;padding-top:4px;white-space:nowrap;color:var(--dsw-alias-label-secondary)}
      .drk-dot{width:8px;height:8px;border-radius:50%;background:#8a8f98}
      .drk-dot.on{background:#20a464}.drk-dot.warn{background:#d08b19}
      .drk-grid{display:grid;grid-template-columns:132px minmax(0,1fr);border-top:1px solid var(--dsw-alias-border-1)}
      .drk-label,.drk-value{padding:12px 0;border-bottom:1px solid var(--dsw-alias-border-1)}
      .drk-label{color:var(--dsw-alias-label-secondary)}
      .drk-value{overflow-wrap:anywhere}
      .drk-path{display:flex;gap:8px;margin-top:20px;align-items:center}
      .drk-input{flex:1 1 auto;min-width:0;height:36px;box-sizing:border-box;padding:0 10px;border:1px solid var(--dsw-alias-border-1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit}
      .drk-actions{display:flex;align-items:center;gap:10px;margin-top:18px;flex-wrap:wrap}
      .drk-button{height:36px;border:1px solid var(--dsw-alias-border-1);border-radius:8px;padding:0 16px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;white-space:nowrap}
      .drk-button.primary{border-color:#137fec;background:#137fec;color:#fff}
      .drk-button.danger{border-color:#d04444;color:#d04444}
      .drk-button:disabled{opacity:.5;cursor:default}
      .drk-note{color:var(--dsw-alias-label-secondary);margin-top:16px}
      .drk-error{color:#d04444;margin-top:12px}
      .drk-link{color:#137fec;text-decoration:none}
      @media(max-width:620px){.drk-grid{grid-template-columns:110px minmax(0,1fr)}.drk-head{display:block}.drk-status{margin-top:8px}}
    `;
    if (typeof document !== "undefined" && !document.querySelector('style[data-plugin-css="dsh-remote-kit-panel"]')) {
      const style = document.createElement("style");
      style.dataset.pluginCss = "dsh-remote-kit-panel";
      style.textContent = css;
      document.head.appendChild(style);
    }

    async function api(method, path, body) {
      const response = await fetch(BASE + path, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      let data = {};
      try {
        data = await response.json();
      } catch {
        /* empty body */
      }
      if (!response.ok) throw new Error(data.message || data.reason || `HTTP ${response.status}`);
      return data;
    }

    function Row({ label, value }) {
      return h(React.Fragment, null, h("div", { className: "drk-label" }, label), h("div", { className: "drk-value" }, value));
    }

    function Panel() {
      const [state, setState] = useState(null);
      const [draft, setDraft] = useState("");
      const [busy, setBusy] = useState("");
      const [error, setError] = useState("");

      const load = useCallback(async () => {
        try {
          const next = await api("GET", "/state");
          setState(next);
          setDraft((current) => current || next.kitPath || "");
          setError("");
        } catch (reason) {
          setError(reason.message);
        }
      }, []);

      useEffect(() => {
        void load();
        const timer = setInterval(() => void load(), 5000);
        return () => clearInterval(timer);
      }, [load]);

      const run = async (name, path, body, confirmText) => {
        if (confirmText && !window.confirm(confirmText)) return;
        setBusy(name);
        setError("");
        try {
          await api("POST", path, body);
          await load();
        } catch (reason) {
          setError(reason.message);
        } finally {
          setBusy("");
        }
      };

      if (!state) {
        return h("div", { className: "drk-root" }, h("p", { className: "drk-subtle" }, error || "正在读取远程状态…"));
      }

      const running = state.launcherRunning;
      const statusClass = !state.supported ? "warn" : running ? "on" : "";
      const statusText = !state.supported ? "仅支持 Windows" : running ? "远程访问运行中" : "远程访问未运行";

      return h(
        "div",
        { className: "drk-root" },
        h(
          "div",
          { className: "drk-head" },
          h(
            "div",
            null,
            h("h2", { className: "drk-title" }, "DSH Remote Kit"),
            h("p", { className: "drk-subtle" }, "自托管远程访问：手机扫码后使用这台电脑上的 DSH。"),
          ),
          h("span", { className: "drk-status" }, h("span", { className: "drk-dot " + statusClass }), statusText),
        ),
        h(
          "div",
          { className: "drk-grid" },
          h(Row, { label: "Kit 状态", value: state.kitInstalled ? "已安装" : "未配置 / 未找到" }),
          h(Row, { label: "Relay 地址", value: state.relay || "尚未配置" }),
          h(Row, { label: "Relay 端口", value: state.relayPortUp ? "8788 监听中" : "8788 未监听" }),
          h(Row, { label: "控制页", value: state.controlPortUp ? "30889 监听中" : "30889 未监听" }),
          h(Row, { label: "面板版本", value: state.version }),
        ),
        h(
          "div",
          { className: "drk-path" },
          h("input", {
            className: "drk-input",
            value: draft,
            placeholder: "DSH Remote Kit 目录，例如 C:\\dsh-remote-kit",
            onChange: (event) => setDraft(event.target.value),
            spellCheck: false,
          }),
          h(
            "button",
            {
              className: "drk-button",
              type: "button",
              disabled: busy === "save",
              onClick: () => void run("save", "/config", { kitPath: draft }),
            },
            busy === "save" ? "保存中…" : "保存路径",
          ),
        ),
        h(
          "div",
          { className: "drk-actions" },
          h(
            "button",
            {
              className: "drk-button primary",
              type: "button",
              disabled: busy === "start" || !state.supported || !state.kitInstalled || running,
              onClick: () => void run("start", "/start"),
            },
            busy === "start" ? "正在启动…" : "启动远程访问",
          ),
          h(
            "button",
            {
              className: "drk-button danger",
              type: "button",
              disabled: busy === "stop" || !state.controllerPid,
              onClick: () => void run("stop", "/stop", undefined, "停止远程访问会中断手机连接和正在运行的任务，确定吗？"),
            },
            busy === "stop" ? "正在停止…" : "停止",
          ),
          h(
            "button",
            {
              className: "drk-button",
              type: "button",
              disabled: busy === "open" || !state.hasControllerLogin,
              onClick: () => void run("open", "/open"),
            },
            busy === "open" ? "正在打开…" : "打开配对控制页",
          ),
          h("button", { className: "drk-button", type: "button", disabled: busy === "reload", onClick: () => void run("reload", "/state") }, "刷新"),
        ),
        !state.kitInstalled &&
          h(
            "p",
            { className: "drk-note" },
            "还没有找到 DSH Remote Kit。请先按 ",
            h("a", { className: "drk-link", href: REPO, target: "_blank", rel: "noreferrer" }, "README"),
            " 安装 kit（Windows），然后把仓库目录填到上面。",
          ),
        h(
          "p",
          { className: "drk-note" },
          "这是控制面板：远程协议、配对和加密都由本机的 DSH Remote Kit 提供；面板只读取本机状态并调用 kit 的启动器。",
        ),
        error && h("p", { className: "drk-error", role: "alert" }, error),
      );
    }

    const inject = ["slots"];
    function apply(ctx) {
      ctx.slots.inject("settings.section", () =>
        ctx.slots.register(
          {
            name: "settings.section",
            id: "dsh-remote-kit-panel",
            order: 21,
            label: () => "远程访问（Kit）",
            inject: () => ({}),
          },
          Panel,
        ),
      );
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});

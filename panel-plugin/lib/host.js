// DSH Remote Kit — control panel host facet.
//
// The panel is a thin companion for a local installation of DSH Remote Kit
// (https://github.com/ln123456789100ln-collab/dsh-remote-kit). It reads the
// kit's owner-only data folder, shows relay/tunnel status, and starts/stops
// the kit's Windows launcher. It never handles pairing keys or relay traffic.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { connect } from "node:net";

export const name = "dsh-remote-kit-panel";
export const inject = ["webServer"];

let cachedVersion = null;
async function panelVersion() {
  if (cachedVersion) return cachedVersion;
  try {
    cachedVersion = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")).version;
  } catch {
    cachedVersion = "0.0.0";
  }
  return cachedVersion;
}
const DATA_DIR = process.env.DSH_REMOTE_DATA || join(homedir(), ".dsh-remote");
const PANEL_FILE = join(DATA_DIR, "panel.json");
const SETTINGS_FILE = join(DATA_DIR, "settings.json");
const CONTROLLER_FILE = join(DATA_DIR, "controller.json");
const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const PREFIX = "/dsh-remote-kit";
const MAX_BODY = 64 * 1024;

function json(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body));
}

async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error("请求体过大"), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function isLocalRequest(req) {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (forwarded) return false;
  const address = req.socket?.remoteAddress;
  return !address || LOOPBACK.has(address);
}

function probePort(port) {
  return new Promise((resolvePort) => {
    const socket = connect({ host: "127.0.0.1", port });
    const finish = (value) => {
      socket.destroy();
      resolvePort(value);
    };
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.setTimeout(900, () => finish(true));
  });
}

function kitFilesOk(kitPath) {
  if (!kitPath) return false;
  try {
    return (
      existsSync(join(kitPath, "launcher", "one-click.mjs")) &&
      existsSync(join(kitPath, "relay", "package.json"))
    );
  } catch {
    return false;
  }
}

async function resolveKitPath(config) {
  const panel = await readJson(PANEL_FILE, {});
  const candidate = String(
    panel.kitPath || config?.kitPath || process.env.DSH_REMOTE_KIT_PATH || "",
  ).trim();
  return candidate ? resolve(candidate) : "";
}

async function currentState(config) {
  const kitPath = await resolveKitPath(config);
  const [settings, controller, relayPortUp, controlPortUp] = await Promise.all([
    readJson(SETTINGS_FILE, {}),
    readJson(CONTROLLER_FILE, null),
    probePort(8788),
    probePort(30889),
  ]);
  return {
    version: await panelVersion(),
    platform: platform(),
    supported: platform() === "win32",
    dataDir: DATA_DIR,
    kitPath,
    kitInstalled: kitFilesOk(kitPath),
    relay: typeof settings?.relay === "string" ? settings.relay : "",
    relayPortUp,
    controlPortUp,
    launcherRunning: relayPortUp && controlPortUp,
    controllerPid: Number.isSafeInteger(controller?.pid) ? controller.pid : null,
    hasControllerLogin: typeof controller?.loginUrl === "string" && controller.loginUrl.startsWith("http://127.0.0.1:30889/"),
  };
}

async function saveKitPath(value) {
  const kitPath = String(value ?? "").trim();
  if (kitPath) {
    const resolved = resolve(kitPath);
    if (!kitFilesOk(resolved)) {
      throw Object.assign(new Error("这个目录看起来不是 DSH Remote Kit（缺少 launcher/one-click.mjs 或 relay/package.json）"), { status: 400 });
    }
    await mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
    await writeFile(PANEL_FILE, JSON.stringify({ kitPath: resolved }, null, 2) + "\n", { mode: 0o600 });
    return resolved;
  }
  await mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
  await writeFile(PANEL_FILE, JSON.stringify({ kitPath: "" }, null, 2) + "\n", { mode: 0o600 });
  return "";
}

function windowsBinary(name) {
  return join(process.env.SystemRoot || "C:\\Windows", "System32", name);
}

async function startLauncher(config) {
  if (platform() !== "win32") throw Object.assign(new Error("启动器只支持 Windows"), { status: 409 });
  const kitPath = await resolveKitPath(config);
  if (!kitFilesOk(kitPath)) throw Object.assign(new Error("还没有配置有效的 DSH Remote Kit 目录"), { status: 409 });
  const state = await currentState(config);
  if (state.launcherRunning) return { ok: true, alreadyRunning: true };
  const vbs = join(kitPath, "launcher", "Start-All-Silent.vbs");
  await new Promise((resolveSpawn, rejectSpawn) => {
    const child = spawn(windowsBinary("wscript.exe"), [vbs], {
      cwd: join(kitPath, "launcher"),
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.once("error", rejectSpawn);
    child.once("spawn", () => {
      child.unref();
      resolveSpawn();
    });
  });
  return { ok: true, starting: true };
}

async function stopLauncher() {
  if (platform() !== "win32") throw Object.assign(new Error("启动器只支持 Windows"), { status: 409 });
  const controller = await readJson(CONTROLLER_FILE, null);
  const pid = Number(controller?.pid);
  if (!Number.isSafeInteger(pid) || pid < 1) throw Object.assign(new Error("没有找到正在运行的启动器"), { status: 409 });
  await new Promise((resolveStop, rejectStop) => {
    const child = spawn(windowsBinary("taskkill.exe"), ["/PID", String(pid), "/T", "/F"], { windowsHide: true });
    child.once("error", rejectStop);
    child.once("exit", (code) => {
      if (code === 0) resolveStop();
      else rejectStop(Object.assign(new Error("停止启动器失败，可打开控制页手动停止"), { status: 500 }));
    });
  });
  return { ok: true, stopped: true };
}

async function openControlPage() {
  if (platform() !== "win32") throw Object.assign(new Error("启动器只支持 Windows"), { status: 409 });
  const controller = await readJson(CONTROLLER_FILE, null);
  const loginUrl = controller?.loginUrl;
  if (typeof loginUrl !== "string" || !loginUrl.startsWith("http://127.0.0.1:30889/")) {
    throw Object.assign(new Error("控制页还没就绪，请先启动远程访问"), { status: 409 });
  }
  const powershell = join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  await new Promise((resolveOpen, rejectOpen) => {
    const child = spawn(
      powershell,
      ["-NoProfile", "-NonInteractive", "-Command", "$ErrorActionPreference='Stop'; Start-Process -FilePath $env:DSH_LAUNCHER_OPEN_URL"],
      { windowsHide: true, env: { ...process.env, DSH_LAUNCHER_OPEN_URL: loginUrl } },
    );
    child.once("error", rejectOpen);
    child.once("exit", (code) => (code === 0 ? resolveOpen() : rejectOpen(new Error("无法打开控制页"))));
  });
  return { ok: true, opened: true };
}

function createHandler(config) {
  return async function handler(req, res) {
    try {
      if (!isLocalRequest(req)) return json(res, 403, { reason: "local_only" });
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const path = url.pathname.startsWith(PREFIX) ? url.pathname.slice(PREFIX.length) : url.pathname;
      const method = req.method || "GET";

      if (method === "GET" && path === "/api/state") {
        return json(res, 200, await currentState(config));
      }
      if (method === "POST" && path === "/api/config") {
        const body = JSON.parse((await readBody(req)) || "{}");
        const kitPath = await saveKitPath(body.kitPath);
        return json(res, 200, { ok: true, kitPath });
      }
      if (method === "POST" && path === "/api/start") {
        return json(res, 200, await startLauncher(config));
      }
      if (method === "POST" && path === "/api/stop") {
        return json(res, 200, await stopLauncher());
      }
      if (method === "POST" && path === "/api/open") {
        return json(res, 200, await openControlPage());
      }
      return json(res, 404, { reason: "not_found" });
    } catch (error) {
      const status = error?.status || 500;
      return json(res, status, {
        reason: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };
}

export function apply(ctx, config = {}) {
  ctx.effect(() => {
    const dispose = ctx.webServer.register({
      kind: "prefix",
      path: PREFIX,
      handler: createHandler(config),
    });
    ctx.logger?.info?.("DSH Remote Kit panel ready");
    return () => {
      try {
        dispose?.();
      } catch {
        /* route already gone */
      }
    };
  }, "dsh-remote-kit-panel.routes");
}

export const internal = { currentState, createHandler, kitFilesOk };

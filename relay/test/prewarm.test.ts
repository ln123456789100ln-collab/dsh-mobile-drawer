import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

function appFixture() {
  const source = readFileSync("web/app/app.js", "utf8");
  const calls: string[] = [];
  const tunnels: any[] = [];
  const storage = new Map<string, string>();
  const scope: any = {
    AbortSignal, Date, Map, Promise, MessageChannel, setTimeout, clearTimeout,
    document: {hidden: false, body: {dataset: {view: "dashboard"}}, querySelector: () => null},
    elements: {"pair-dialog": {open: false}, "settings-dialog": {open: false}},
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
    DshKeyStore: {get: async () => "test-key"},
    ensureWorker: async () => ({
      postMessage: (message: any, ports: any[]) => {
        if (message.type === "tunnel-status") ports[0].postMessage({ok: true, warm: false});
      },
    }),
    api: async (path: string) => {
      calls.push(path);
      return {
        accessSessionId: "session",
        tunnelUrl: "wss://relay.test/tunnel",
        ticket: "ticket",
      };
    },
    initializeTunnel: async (_worker: unknown, options: any) => {
      tunnels.push(options);
    },
  };
  const body = source.slice(source.indexOf("function tunnelStatus("), source.indexOf("async function connectionStep("));
  runInNewContext(`const prewarmState = new Map();\n${body}\nglobalThis.schedulePrewarm = schedulePrewarm; globalThis.startPrewarm = startPrewarm; globalThis.prewarmState = prewarmState;`, scope);
  return {scope, calls, tunnels, storage};
}

test("prewarms the last used online device and does not repeat within a minute", async () => {
  const f = appFixture();
  f.storage.set("dsh-last-device", "dev_b");
  f.scope.schedulePrewarm([
    {id: "dev_a", online: true, dshStatus: "online"},
    {id: "dev_b", online: true, dshStatus: "online"},
  ]);
  await f.scope.prewarmState.get("dev_b").promise;
  assert.deepEqual(f.calls, ["/web-ticket"]);
  assert.equal(f.tunnels.length, 1);
  assert.equal(f.tunnels[0].deviceId, "dev_b");
  f.scope.schedulePrewarm([{id: "dev_b", online: true, dshStatus: "online"}]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.calls.length, 1);
});

test("a live tunnel is reused without requesting another ticket", async () => {
  const f = appFixture();
  f.scope.ensureWorker = async () => ({
    postMessage: (message: any, ports: any[]) => {
      if (message.type === "tunnel-status") ports[0].postMessage({ok: true, warm: true});
    },
  });
  f.scope.schedulePrewarm([{id: "dev_a", online: true, dshStatus: "online"}]);
  await f.scope.prewarmState.get("dev_a").promise;
  assert.deepEqual(f.calls, []);
  assert.equal(f.tunnels.length, 0);
});

test("skips prewarming while hidden, while a dialog is open, or when no device is usable", async () => {
  const f = appFixture();
  f.scope.document.hidden = true;
  f.scope.schedulePrewarm([{id: "dev_a", online: true, dshStatus: "online"}]);
  f.scope.document.hidden = false;
  f.scope.elements["pair-dialog"].open = true;
  f.scope.schedulePrewarm([{id: "dev_a", online: true, dshStatus: "online"}]);
  f.scope.elements["pair-dialog"].open = false;
  f.scope.schedulePrewarm([{id: "dev_a", online: false, dshStatus: "offline"}]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.calls.length, 0);
  assert.equal(f.tunnels.length, 0);
});

test("a failed prewarm does not retry on every status refresh", async () => {
  const f = appFixture();
  f.scope.DshKeyStore.get = async () => {throw new Error("storage blocked");};
  f.scope.schedulePrewarm([{id: "dev_a", online: true, dshStatus: "online"}]);
  await f.scope.prewarmState.get("dev_a").promise.catch(() => {});
  f.scope.schedulePrewarm([{id: "dev_a", online: true, dshStatus: "online"}]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.calls.length, 0);
  assert.equal(f.tunnels.length, 0);
});

function swFixture() {
  const listeners: Record<string, (event: any) => void> = {};
  const scope: any = {
    importScripts() {}, indexedDB: {open: () => ({})},
    TextEncoder, TextDecoder, URL, Headers, Request, Response, Blob, TransformStream, DecompressionStream,
    Uint8Array, btoa, atob, crypto: globalThis.crypto,
    caches: {open: async () => ({match: async () => undefined, put: async () => {}, keys: async () => [], delete: async () => {}})},
    self: {location: {origin: "https://relay.test"}, addEventListener(type: string, fn: (event: any) => void) {listeners[type] = fn;}},
  };
  runInNewContext(readFileSync("web/app/sw.js", "utf8") + "\nglobalThis.tunnels = tunnels;", scope);
  return {scope, listeners};
}

test("init-tunnel reuses a live tunnel instead of closing and reconnecting it", async () => {
  const f = swFixture();
  let closed = 0;
  f.scope.tunnels.set("dev_a", {socket: {readyState: 1}, createdAt: Date.now() - 10 * 60_000, close: () => closed++});
  let response: any;
  const event = {
    data: {type: "init-tunnel", deviceId: "dev_a"},
    ports: [{postMessage: (value: any) => {response = value;}}],
    waitUntil: (promise: Promise<void>) => {event.promise = promise;},
    promise: Promise.resolve(),
  };
  f.listeners.message(event);
  await event.promise;
  assert.equal(response.ok, true);
  assert.equal(response.reused, true);
  assert.equal(closed, 0);
});

test("tunnel-status reports a live tunnel without creating a ticket", async () => {
  const f = swFixture();
  f.scope.tunnels.set("dev_a", {socket: {readyState: 1}, createdAt: Date.now(), close: () => {}});
  let response: any;
  f.listeners.message({
    data: {type: "tunnel-status", deviceId: "dev_a"},
    ports: [{postMessage: (value: any) => {response = value;}}],
  });
  assert.equal(response.ok, true);
  assert.equal(response.warm, true);
});

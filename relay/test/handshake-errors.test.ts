import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

function fixture() {
  let socket: any;
  let timeout: any;
  let cleared = false;
  class Socket extends EventTarget {
    static OPEN = 1;
    readyState = 0;
    constructor() { super(); socket = this; }
    close() { this.readyState = 3; }
  }
  const scope: any = {
    importScripts() {}, indexedDB: { open: () => ({}) },
    TextEncoder, TextDecoder, URL, Map, Promise,
    WebSocket: Socket,
    setTimeout(callback: any) { timeout = callback; return 1; },
    clearTimeout() { cleared = true; },
    DshCrypto: { base64Url: () => "ticket" },
    self: { location: { origin: "https://relay.test" }, addEventListener() {} },
  };
  runInNewContext(readFileSync("web/app/sw.js", "utf8") + "\nglobalThis.TestTunnel = Tunnel;", scope);
  const tunnel = new scope.TestTunnel({deviceId:"dev_test",ticket:"test",tunnelUrl:"wss://relay.test"});
  return { tunnel, socket: () => socket, timeout: () => timeout(), cleared: () => cleared };
}

test("closed socket immediately rejects handshake and clears its timeout", async () => {
  const f = fixture();
  const pending = f.tunnel.connect();
  f.socket().dispatchEvent(new Event("close"));
  await assert.rejects(pending, /加密隧道已断开/);
  assert.equal(f.cleared(), true);
});

test("timeout closes the unfinished socket and reports the connection stage", async () => {
  const f = fixture();
  const pending = f.tunnel.connect();
  f.timeout();
  await assert.rejects(pending, /WebSocket/);
  assert.equal(f.socket().readyState, 3);
});

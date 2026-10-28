import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

function tunnelFixture() {
  const scope: any = {
    importScripts() {}, indexedDB: { open: () => ({}) },
    TextEncoder, TextDecoder, URL, Map, Promise,
    self: { location: { origin: "https://relay.test" }, addEventListener() {} },
  };
  runInNewContext(readFileSync("web/app/sw.js", "utf8") + "\nglobalThis.TestTunnel = Tunnel;", scope);
  const tunnel = Object.create(scope.TestTunnel.prototype);
  tunnel.deviceId = "dev_test";
  tunnel.virtualSockets = new Map();
  const sent: any[] = [];
  const events: any[] = [];
  tunnel.sendInner = (...args: any[]) => sent.push(args);
  tunnel.postSocket = (...args: any[]) => events.push(args);
  return { tunnel, sent, events };
}

test("websocket route strips only the current device mount and preserves query", () => {
  const { tunnel, sent } = tunnelFixture();
  tunnel.openVirtualSocket("client", { url: "wss://relay.test/remote/dev_test/api/remote.mux?q=1", channel: "socket", protocols: ["test-protocol"] });
  assert.equal(sent.length, 1);
  assert.equal(sent[0][1].path, "/api/remote.mux?q=1");
  assert.equal(sent[0][1].headers["sec-websocket-protocol"], "test-protocol");
});

test("websocket route accepts unmounted same-origin addresses and rejects other devices", () => {
  const { tunnel, sent, events } = tunnelFixture();
  tunnel.openVirtualSocket("client", { url: "wss://relay.test/api/remote.mux", channel: "plain" });
  assert.equal(sent[0][1].path, "/api/remote.mux");
  tunnel.openVirtualSocket("client", { url: "wss://relay.test/remote/other/api/remote.mux", channel: "other" });
  tunnel.openVirtualSocket("client", { url: "wss://evil.test/api/remote.mux", channel: "evil" });
  assert.equal(sent.length, 1);
  assert.equal(events.length, 2);
  assert.equal(tunnel.virtualSockets.size, 1);
});

import test from "node:test";
import assert from "node:assert/strict";
import { deviceRelayUrl } from "../src/relay-client.js";

test("device transport can use explicit loopback mapping without changing the public relay", () => {
  assert.equal(deviceRelayUrl("https://relay.test", "http://127.0.0.1:8788", "https://relay.test"), "ws://127.0.0.1:8788/device");
  assert.equal(deviceRelayUrl("https://other.test", "http://127.0.0.1:8788", "https://relay.test"), "wss://other.test/device");
  assert.equal(deviceRelayUrl("https://relay.test"), "wss://relay.test/device");
});

test("local transport refuses non-loopback targets and embedded credentials or paths", () => {
  for (const value of ["http://evil.test:8788", "http://127.0.0.1.evil.test", "http://user:secret@127.0.0.1:8788", "http://127.0.0.1:8788/path", "http://127.0.0.1:8788/?x=1", "http://127.0.0.1:8788/#x"]) {
    assert.throws(() => deviceRelayUrl("https://relay.test", value, "https://relay.test"), /loopback/);
  }
});

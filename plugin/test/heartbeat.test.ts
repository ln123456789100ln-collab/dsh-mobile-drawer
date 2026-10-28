import test from "node:test";
import assert from "node:assert/strict";
import { RelayClient } from "../src/relay-client.js";

test("missing relay responses terminate a half-open connection; pong renews the deadline", (t) => {
  let now = 1000;
  let tick: () => void = () => {};
  let terminated = 0;
  t.mock.method(Date, "now", () => now);
  t.mock.method(globalThis, "setInterval", (fn: () => void) => { tick = fn; return 1 as any; });
  t.mock.method(console, "log", () => {});
  const client: any = new RelayClient({relay:"https://relay.test",dshPort:1234,deviceName:"test"});
  client.ws = {readyState:1,send() {},terminate() { terminated++; }};
  client.handle({type:"auth_ok"});
  now += 50000;
  client.handle({type:"pong"});
  now += 50000;
  tick();
  assert.equal(terminated, 0);
  assert.equal(client.status().connected, true);
  now += 25000;
  tick();
  assert.equal(terminated, 1);
  assert.equal(client.status().connected, false);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

function fixture() {
  const timers = new Map<number, () => void>();
  let next = 0;
  const notices: string[] = [];
  const navigations: string[] = [];
  const apiCalls: string[] = [];
  let tunnels = 0;
  const source = readFileSync("web/app/app.js", "utf8");
  const scope: any = {
    AbortSignal, Promise, elements: {"connecting-device": {}}, prewarmState: new Map(),
    setTimeout(fn: () => void, ms: number) { assert.equal(ms, 15000); timers.set(++next, fn); return next; },
    clearTimeout(id: number) { timers.delete(id); },
    showOnly() {}, showNotice(error: Error) { notices.push(error.message); },
    DshKeyStore: {get: async () => "test-key"},
    api: async (path: string) => {
      apiCalls.push(path);
      return {accessSessionId: "session", tunnelUrl: "wss://relay.test/tunnel", ticket: "ticket"};
    },
    ensureWorker: async () => ({}), initializeTunnel: async () => { tunnels += 1; },
    location: {assign: (url: string) => navigations.push(url)},
  };
  runInNewContext("let connectionAttempt=0, connectionCancelled=false;\n" + source.slice(source.indexOf("async function connectionStep("), source.indexOf("async function removeDevice(")) + "\nglobalThis.cancel = () => {connectionAttempt++;connectionCancelled=true;};", scope);
  return {scope,timers,notices,navigations,apiCalls,tunnels: () => tunnels};
}

test("blocked pairing storage exits connecting with a stage-specific error", async () => {
  const f = fixture();
  f.scope.DshKeyStore.get = () => new Promise(() => {});
  const pending = f.scope.openRemote({id:"dev_test",name:"test"});
  for (const fn of [...f.timers.values()]) fn();
  await pending;
  assert.match(f.notices[0], /读取本机配对信息.*超时/);
  assert.equal(f.navigations.length, 0);
  assert.equal(f.timers.size, 0);
});

test("cancelled attempt cannot navigate or override a newer successful attempt", async () => {
  const f = fixture();
  let release: (key: string) => void = () => {};
  f.scope.DshKeyStore.get = () => new Promise(resolve => {release = resolve;});
  const old = f.scope.openRemote({id:"old",name:"old"});
  await Promise.resolve();
  f.scope.cancel();
  f.scope.DshKeyStore.get = async () => "test-key";
  await f.scope.openRemote({id:"new",name:"new"});
  release("test-key");
  await old;
  assert.deepEqual(f.navigations, ["/remote/new/"]);
  assert.equal(f.notices.length, 0);
  assert.equal(f.timers.size, 0);
});

test("a warm tunnel navigates without a second ticket or initialization", async () => {
  const f = fixture();
  f.scope.prewarmState.set("dev_warm", {at: Date.now(), ok: true, promise: Promise.resolve(true)});
  await f.scope.openRemote({id:"dev_warm",name:"warm"});
  assert.deepEqual(f.navigations, ["/remote/dev_warm/"]);
  assert.deepEqual(f.apiCalls, []);
  assert.equal(f.tunnels(), 0);
  assert.equal(f.notices.length, 0);
  assert.equal(f.timers.size, 0);
});

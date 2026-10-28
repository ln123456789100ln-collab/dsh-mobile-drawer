import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

function fixture(api: (...args: any[]) => any) {
  const source = readFileSync("web/app/app.js", "utf8");
  const rendered: any[] = [];
  const notices: any[] = [];
  const scope: any = {
    api, AbortSignal,
    document: { hidden: false, body: { dataset: { view: "dashboard" } }, querySelector: () => null, addEventListener() {} },
    window: { addEventListener() {} },
    elements: { "pair-dialog": { open: false }, "settings-dialog": { open: false } },
    renderDevices: async (data: any) => rendered.push(data),
    showNotice: (error: Error) => notices.push(error.message),
    setTimeout: (callback: () => void) => callback(), setInterval() {},
  };
  runInNewContext("let refreshingDevices = false;\n" + source.slice(source.indexOf("async function waitForDevice("), source.indexOf("async function ensureWorker(")), scope);
  return { scope, rendered, notices };
}

test("pairing waits for the device and DSH to become online", async () => {
  let calls = 0;
  const { scope } = fixture(async () => ({ devices: [{ id: "dev_test", online: ++calls >= 2, dshStatus: calls >= 3 ? "online" : "offline" }] }));
  await scope.waitForDevice("dev_test");
  assert.equal(calls, 3);
});

test("status refresh skips hidden pages and does not overlap requests", async () => {
  let resolve: any;
  let calls = 0;
  const { scope, rendered } = fixture(() => { calls++; return new Promise(r => { resolve = r; }); });
  scope.document.hidden = true;
  await scope.refreshDeviceStatus();
  assert.equal(calls, 0);
  scope.document.hidden = false;
  const pending = scope.refreshDeviceStatus();
  await scope.refreshDeviceStatus();
  assert.equal(calls, 1);
  scope.document.body.dataset.view = "connecting";
  resolve({ devices: [] });
  await pending;
  assert.equal(rendered.length, 0);
});

test("failed refresh reports the problem and permits a later retry", async () => {
  let calls = 0;
  const { scope, rendered, notices } = fixture(async () => {
    if (++calls === 1) throw new Error("network down");
    return { devices: [] };
  });
  await scope.refreshDeviceStatus();
  await scope.refreshDeviceStatus();
  assert.equal(notices.length, 1);
  assert.equal(rendered.length, 1);
});

import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

function fixture() {
  const source = readFileSync("web/app/sw.js", "utf8");
  const sent: any[] = [];
  const document = Object.assign(new EventTarget(), {visibilityState: 'visible'});
  const scope: any = {EventTarget, Event, Blob, ArrayBuffer, Uint8Array, URL,
    CloseEvent: class extends Event {constructor(name: string, options: any) {super(name); Object.assign(this, options);}},
    document, location:{href:"https://relay.test/remote/dev_test/"}, window:new EventTarget(),
    navigator:{serviceWorker:{controller:{postMessage:(message: any)=>sent.push(message)},addEventListener(){}}}};
  runInNewContext(source.slice(source.indexOf("function remoteShim()"),source.indexOf("const shimSource"))+"\nremoteShim();",scope);
  const socket = new scope.window.WebSocket("wss://relay.test/api/remote.mux");
  socket.readyState = 1;
  return {socket,sent,document};
}

test('returning from background invalidates stale sockets without replaying tasks or navigating away', () => {
  const {socket, sent, document} = fixture();
  let closed = 0;
  socket.onclose = () => {closed++;};
  socket.pendingSends.push('unconfirmed task');
  document.visibilityState = 'hidden';
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(closed, 0);
  document.visibilityState = 'visible';
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(closed, 1);
  assert.equal(socket.readyState, 3);
  assert.equal(socket.pendingSends.length, 0);
  assert.equal(sent.filter(m => m.type === 'remote-ws-reset').length, 1);
  assert.equal(sent.filter(m => m.type === 'remote-ws-send').length, 0);
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(closed, 1);
});

test("binary views transmit only their slice and preserve caller storage", async () => {
  const {socket,sent} = fixture();
  const backing = new Uint8Array([99,1,2,88]);
  socket.send(backing.subarray(1,3));
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual([...new Uint8Array(sent[1].buffer)],[1,2]);
  assert.notEqual(sent[1].buffer,backing.buffer);
});

test("asynchronous Blob conversion cannot reorder later text frames", async () => {
  const {socket,sent} = fixture();
  socket.send(new Blob([new Uint8Array([1,2])]));
  socket.send("after");
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.ok(sent[1].buffer);
  assert.equal(sent[2].text,"after");
});

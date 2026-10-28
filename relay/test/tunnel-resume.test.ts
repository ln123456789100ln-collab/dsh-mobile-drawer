import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

function fixture() {
  const attempts: string[] = [];
  let tickets = 0;
  let rejectNext = false;
  const scope: any = {
    importScripts() {}, indexedDB: { open: () => ({}) },
    TextEncoder, TextDecoder, URL, Map, Promise,
    self: { location: { origin: "https://relay.test" }, addEventListener() {} },
    session: {deviceId: "dev_test", ticket: "consumed"},
    async ticket() { tickets++; return {ticket: "fresh"}; },
    async connect(ticket: string) {
      attempts.push(ticket);
      if (ticket === "consumed" || rejectNext) {
        rejectNext = false;
        throw new Error("invalid ticket");
      }
    },
  };
  runInNewContext(readFileSync("web/app/sw.js", "utf8") + `
    readSession = async () => session;
    readMasterKey = async () => "test-key";
    writeSession = async () => {};
    freshTicket = ticket;
    Tunnel.prototype.connect = function () { return connect(this.ticket); };
    globalThis.resume = resumeTunnel;
    globalThis.drop = () => tunnels.clear();
  `, scope);
  return {scope, attempts, tickets: () => tickets, failNext: () => {rejectNext = true;}};
}

test("resume skips an already consumed one-time ticket", async () => {
  const f = fixture();
  assert.ok(await f.scope.resume("dev_test"));
  assert.deepEqual(f.attempts, ["fresh"]);
});

test("concurrent resource loads share one handshake and reuse the established tunnel", async () => {
  const f = fixture();
  const results = await Promise.all(Array.from({length: 12}, () => f.scope.resume("dev_test")));
  assert.equal(f.tickets(), 1);
  assert.equal(f.attempts.length, 1);
  for (const result of results) assert.equal(result, results[0]);
  assert.equal(await f.scope.resume("dev_test"), results[0]);
  assert.equal(f.tickets(), 1);
});

test("failed resume allows a later attempt with a fresh ticket", async () => {
  const f = fixture();
  f.failNext();
  assert.equal(await f.scope.resume("dev_test"), null);
  assert.ok(await f.scope.resume("dev_test"));
  assert.equal(f.tickets(), 2);
});

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = await mkdtemp(join(tmpdir(), "drk-panel-test-"));
process.env.DSH_REMOTE_DATA = dataDir;
const { apply } = await import("../lib/host.js");

function makeCtx() {
  const routes = [];
  return {
    routes,
    effect(fn) {
      const cleanup = fn();
      return cleanup;
    },
    logger: { info() {}, warn() {}, error() {} },
    webServer: {
      register(options) {
        routes.push(options);
        return () => {};
      },
    },
  };
}

async function request(handler, { method = "GET", url = "/api/state", body, remote = "127.0.0.1", forwarded } = {}) {
  const req = {
    method,
    url,
    socket: { remoteAddress: remote },
    headers: forwarded ? { "x-forwarded-for": forwarded } : {},
    async *[Symbol.asyncIterator]() {
      if (body !== undefined) yield Buffer.from(body);
    },
  };
  const res = {
    statusCode: 0,
    headers: {},
    body: "",
    writeHead(code, headers) {
      this.statusCode = code;
      this.headers = headers;
    },
    end(payload) {
      this.body = payload === undefined ? "" : String(payload);
    },
  };
  await handler(req, res);
  return { status: res.statusCode, headers: res.headers, body: res.body ? JSON.parse(res.body) : null };
}

test.after(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

test("registers a loopback controller route", () => {
  const ctx = makeCtx();
  apply(ctx);
  assert.equal(ctx.routes.length, 1);
  assert.equal(ctx.routes[0].kind, "prefix");
  assert.equal(ctx.routes[0].path, "/dsh-remote-kit");
});

test("GET state returns panel state", async () => {
  const ctx = makeCtx();
  apply(ctx);
  const handler = ctx.routes[0].handler;
  const result = await request(handler);
  assert.equal(result.status, 200);
  assert.equal(typeof result.body.version, "string");
  assert.equal(result.body.kitInstalled, false);
  assert.equal(result.body.kitPath, "");
  assert.equal(result.body.relay, "");
});

test("rejects non-loopback callers", async () => {
  const ctx = makeCtx();
  apply(ctx);
  const handler = ctx.routes[0].handler;
  assert.equal((await request(handler, { remote: "10.0.0.2" })).status, 403);
  assert.equal((await request(handler, { forwarded: "10.0.0.2" })).status, 403);
});

test("rejects an invalid kit path", async () => {
  const ctx = makeCtx();
  apply(ctx);
  const handler = ctx.routes[0].handler;
  const result = await request(handler, {
    method: "POST",
    url: "/api/config",
    body: JSON.stringify({ kitPath: join(dataDir, "not-a-kit") }),
  });
  assert.equal(result.status, 400);
});

test("clearing the kit path is allowed", async () => {
  const ctx = makeCtx();
  apply(ctx);
  const handler = ctx.routes[0].handler;
  const result = await request(handler, {
    method: "POST",
    url: "/api/config",
    body: JSON.stringify({ kitPath: "" }),
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.kitPath, "");
});

test("unknown routes return 404 json", async () => {
  const ctx = makeCtx();
  apply(ctx);
  const handler = ctx.routes[0].handler;
  const result = await request(handler, { url: "/api/nope" });
  assert.equal(result.status, 404);
  assert.equal(result.body.reason, "not_found");
});

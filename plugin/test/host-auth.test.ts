import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { LocalHostAuth } from "../src/host-auth.js";

test("local login is shared, cached in memory, renewable and cleared on close", async () => {
  let exchanges = 0;
  const server = createServer((req, res) => {
    assert.equal(req.url, "/?token=test-only-launch-token");
    exchanges++;
    res.writeHead(303, { location: "./", "set-cookie": "dsh_test=test-only-cookie; HttpOnly; Path=/" });
    res.end();
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const auth = new LocalHostAuth(address.port, base => `${base}?token=test-only-launch-token`);
  try {
    assert.throws(() => auth.headers());
    await Promise.all([auth.ensure(), auth.ensure(), auth.ensure()]);
    assert.equal(exchanges, 1);
    assert.equal(auth.headers().cookie, "dsh_test=test-only-cookie");
    assert.doesNotMatch(JSON.stringify(auth), /test-only/);
    auth.invalidate();
    assert.throws(() => auth.headers());
    await auth.ensure();
    assert.equal(exchanges, 2);
    auth.close();
    assert.throws(() => auth.headers());
    await assert.rejects(auth.ensure());
  } finally {
    auth.close();
    server.close();
    server.closeAllConnections();
    await once(server, "close");
  }
});

test("unsafe bootstrap targets are rejected without exposing the token", async () => {
  for (const target of ["https://example.invalid/?token=private-value", "http://127.0.0.1:3080/connect?token=private-value", "http://127.0.0.1:3080/?token=a&token=private-value"]) {
    const auth = new LocalHostAuth(3080, () => target);
    await assert.rejects(auth.ensure(), error => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, "Cannot authenticate with the local DSH host.");
      assert.equal(error.cause, undefined);
      return true;
    });
    assert.throws(() => auth.headers());
  }
});

test("closing during login prevents a late response from restoring credentials", async () => {
  let release!: () => void;
  const received = new Promise<void>(resolve => { release = resolve; });
  let respond!: () => void;
  const server = createServer((_req, res) => {
    respond = () => { res.writeHead(303, { location: "./", "set-cookie": "dsh_test=late-cookie" }); res.end(); };
    release();
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const auth = new LocalHostAuth(address.port, base => `${base}?token=test-token`);
  try {
    const pending = auth.ensure();
    await received;
    auth.close();
    respond();
    await assert.rejects(pending);
    assert.throws(() => auth.headers());
  } finally {
    auth.close();
    server.close();
    server.closeAllConnections();
    await once(server, "close");
  }
});

test("failed login and unexpected redirects never grant a credential or follow a redirect", async () => {
  let status = 401;
  let location = "./";
  let cookie = "dsh_test=test-cookie";
  let followed = 0;
  const server = createServer((req, res) => {
    if (req.url === "/unexpected") followed++;
    res.writeHead(status, { location, "set-cookie": cookie });
    res.end();
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    for (const scenario of ["unauthorized", "not-a-login-response", "unexpected-redirect", "malformed-cookie"]) {
      status = scenario === "unauthorized" ? 401 : scenario === "not-a-login-response" ? 200 : 303;
      location = scenario === "unexpected-redirect" ? "/unexpected" : "./";
      cookie = scenario === "malformed-cookie" ? "missing-value" : "dsh_test=test-cookie";
      const auth = new LocalHostAuth(address.port, base => `${base}?token=test-token`);
      await assert.rejects(auth.ensure());
      assert.throws(() => auth.headers());
      auth.close();
    }
    assert.equal(followed, 0);
  } finally {
    server.close();
    server.closeAllConnections();
    await once(server, "close");
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { createManagementHandler, registerManagementRoutes } from "../src/management.js";
import { RemoteAccessManager } from "../src/remote-access.js";

for (const scenario of ["missing-service", "unauthenticated", "untrusted-origin", "non-owner", "owner", "broken-service"]) {
  test(`management admission: ${scenario}`, async () => {
    let downstreamCalls = 0;
    const manager = new RemoteAccessManager({ deviceName: "Test", relay: "https://relay.test", dshPort: 3080 }, {
      probeDsh: async () => { downstreamCalls++; return true; },
    });
    const connection = scenario === "missing-service" ? undefined : {
      admit: () => {
        if (scenario === "broken-service") throw new Error("private diagnostic");
        if (scenario === "unauthenticated") return { rejection: 401 };
        if (scenario === "untrusted-origin") return { rejection: 403 };
        return { peer: { principal: { kind: scenario === "non-owner" ? "guest" : "owner" } } };
      },
    };
    const server = createServer(createManagementHandler(manager, undefined, connection));
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}`;
    try {
      const expected = scenario === "owner" ? 200 : scenario === "unauthenticated" ? 401 :
        scenario === "missing-service" || scenario === "broken-service" ? 503 : 403;
      const response = await fetch(`${base}/dsh-mobile/api/state`);
      assert.equal(response.status, expected);
      assert.doesNotMatch(await response.text(), /private diagnostic/);
      if (scenario !== "owner") {
        for (const [method, path] of [["GET", "files"], ["GET", "api/files"], ["GET", "api/browser-access"], ["POST", "api/pairing"], ["POST", "api/update"], ["DELETE", "api/pairing"]]) {
          const denied = await fetch(`${base}/dsh-mobile/${path}`, { method });
          assert.equal(denied.status, expected);
          await denied.text();
        }
        assert.equal(downstreamCalls, 0);
      }
    } finally {
      manager.dispose();
      server.close();
      server.closeAllConnections();
      await once(server, "close");
    }
  });
}

test("registered routes recheck each request and hide pairing keys from remote state", async () => {
  const manager = new RemoteAccessManager({ deviceName: "Test", relay: "https://relay.test", dshPort: 3080 });
  const pairing = { code: "123456", expiresAt: 1, qrPayload: "test-only-pairing-secret", qrSvg: "test-only-qr" };
  manager.state = async () => ({ phase: "pairing", deviceId: null, deviceName: "Test", relay: "https://relay.test", dsh: "online", relayConnection: "offline", pairing });
  const server = createServer();
  let allowed = true;
  const unregister = registerManagementRoutes({ register: route => {
    server.on("request", route.handler);
    return () => { server.off("request", route.handler); };
  } }, manager, undefined, { admit: req => {
    if (req.headers.origin === "https://untrusted.test") return { rejection: 403 };
    if (!allowed || req.headers.cookie !== "test-session=owner") return { rejection: 401 };
    return { peer: { principal: { kind: "owner" } } };
  } });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}/dsh-mobile/api/state`;
  try {
    const local = await fetch(url, { headers: { cookie: "test-session=owner" } });
    assert.equal(local.status, 200);
    assert.deepEqual((await local.json()).pairing, pairing);
    const remote = await fetch(url, { headers: { cookie: "test-session=owner", "x-dsh-mobile-remote": "1" } });
    assert.equal(remote.status, 200);
    const body = await remote.text();
    assert.equal(JSON.parse(body).pairing, null);
    assert.doesNotMatch(body, /test-only|123456/);
    const forged = await fetch(url, { headers: { "x-dsh-mobile-remote": "0" } });
    assert.equal(forged.status, 401);
    await forged.text();
    const crossOrigin = await fetch(url, { headers: { cookie: "test-session=owner", origin: "https://untrusted.test" } });
    assert.equal(crossOrigin.status, 403);
    await crossOrigin.text();
    allowed = false;
    const revoked = await fetch(url, { headers: { cookie: "test-session=owner" } });
    assert.equal(revoked.status, 401);
    await revoked.text();
  } finally {
    unregister();
    manager.dispose();
    server.close();
    server.closeAllConnections();
    await once(server, "close");
  }
});

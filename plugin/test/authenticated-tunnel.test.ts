import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import {gunzipSync} from 'node:zlib';
import { randomBytes, randomUUID } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import { RelayClient, Envelope } from "../src/relay-client.js";
import { LocalHostAuth } from "../src/host-auth.js";
import { clientProof, createClientCipher, generateMasterKey, SecureCipher } from "../src/e2ee.js";

for (const localTransport of [false, true]) {
test(`encrypted HTTP and WebSocket use host-only credentials; closed sessions cannot send tasks (loopback override: ${localTransport})`, { timeout: 10_000 }, async (t) => {
  const cookie = "dsh_test=host-private-cookie";
  let taskRequests = 0;
  const seenHeaders: Record<string, unknown>[] = [];
  const host = createServer((req, res) => {
    if (req.url === "/?token=host-private-launch") {
      res.writeHead(303, { location: "./", "set-cookie": `${cookie}; HttpOnly; Path=/` });
      res.end();
      return;
    }
    if (req.headers.cookie !== cookie) { res.writeHead(401); res.end(); return; }
    if (req.url?.startsWith('/plugins/')) {
      assert.equal(req.headers['accept-encoding'], 'identity');
      assert.equal(req.headers['x-dsh-mobile-lite'], undefined);
      res.writeHead(200, {'content-type':'text/javascript', etag:'original'});
      res.end('var onboarding_welcome_default = "data:image/webp;base64,AAAA";');
      return;
    }
    if (req.url === "/api/tasks") { taskRequests++; seenHeaders.push(req.headers); }
    res.writeHead(200, { "set-cookie": `${cookie}; HttpOnly`, "content-type": "text/plain" });
    res.end(req.url === "/api/tasks" ? "task-list" : "ready");
  });
  const hostWs = new WebSocketServer({ noServer: true });
  host.on("upgrade", (req, socket, head) => {
    if (req.headers.cookie !== cookie) { socket.destroy(); return; }
    seenHeaders.push(req.headers);
    hostWs.handleUpgrade(req, socket, head, ws => {
      hostWs.emit("connection", ws);
      ws.on("message", data => ws.send(data));
    });
  });
  host.listen(0, "127.0.0.1");
  await once(host, "listening");
  const address = host.address();
  assert.ok(address && typeof address !== "string");
  const relay = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  await once(relay, "listening");
  const relayAddress = relay.address();
  assert.ok(typeof relayAddress !== "string");
  const key = generateMasterKey();
  const sessionId = "test-session";
  const random = randomBytes(32).toString("base64url");
  let cipher: SecureCipher | undefined;
  let peer!: WebSocket;
  const rawFrames: string[] = [];
  const inbox: Envelope[] = [];
  let wake: (() => void) | undefined;
  const envelope = (type: string, payload: unknown, channel?: string) => ({ v: 1, type, payload, channel, id: randomUUID(), ts: Date.now() });
  const send = (type: string, payload: unknown, channel?: string) => peer.send(JSON.stringify(envelope(type, payload, channel)));
  const sendInner = (type: string, payload: unknown, channel: string) => send("sealed", { accessSessionId: sessionId, ...cipher!.seal(envelope(type, payload, channel)) });
  async function next(type: string, channel?: string): Promise<Envelope> {
    const deadline = Date.now() + 2500;
    while (true) {
      const i = inbox.findIndex(m => m.type === type && (channel === undefined || m.channel === channel));
      if (i >= 0) return inbox.splice(i, 1)[0];
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => { wake = undefined; reject(new Error(`Timed out waiting for ${type}`)); }, Math.max(1, deadline - Date.now()));
        wake = () => { clearTimeout(timer); wake = undefined; resolve(); };
      });
    }
  }
  relay.on("connection", ws => {
    peer = ws;
    ws.on("message", data => {
      rawFrames.push(data.toString());
      const outer = JSON.parse(data.toString());
      if (outer.type === "auth") send("auth_ok", {});
      const msg = outer.type === "sealed" ? cipher!.open(outer.payload) as Envelope : outer;
      inbox.push(msg);
      wake?.();
    });
  });
  const auth = new LocalHostAuth(address.port, base => `${base}?token=host-private-launch`);
  const client = new RelayClient({ deviceName: "Test", deviceId: "device", deviceToken: "test-relay-token", e2eeMasterKey: key, dshPort: address.port, relay: localTransport ? "https://public.invalid" : `http://127.0.0.1:${relayAddress.port}` }, auth,
    localTransport ? {url: `http://127.0.0.1:${relayAddress.port}`, publicRelay: "https://public.invalid"} : undefined);
  try {
    await client.start();
    await next("auth");
    send("client_hello", { accessSessionId: sessionId, clientRandomB64: random, clientProofB64: clientProof(key, sessionId, random) });
    const hello = await next("server_hello");
    cipher = createClientCipher(key, sessionId, random, hello.payload);
    const spoofed = { Cookie: "attacker-cookie", HOST: "attacker.invalid", "X-Dsh-Mobile-Remote": "0", Authorization: "attacker-value", Origin: "https://phone.example", "Sec-Fetch-Site": "cross-site" };
    sendInner("http_req", { method: "GET", path: "/api/tasks", headers: spoofed }, "http");
    let body = "";
    while (true) {
      const response = await next("http_res", "http");
      if (response.payload.status) assert.equal(response.payload.status, 200);
      assert.equal(response.payload.headers?.["set-cookie"], undefined);
      body += Buffer.from(response.payload.bodyB64, "base64").toString();
      if (response.payload.final) break;
    }
    assert.equal(body, "task-list");
    sendInner('http_req', {method:'GET', path:'/plugins/??test/client.js&rev=abcdef123456',
      headers:{'x-dsh-mobile-lite':'1','accept-encoding':'gzip'}}, 'lite');
    const compressed: Buffer[] = [];
    for (;;) {
      const response = await next('http_res', 'lite');
      if (response.payload.headers) {
        assert.equal(response.payload.headers['content-encoding'], 'gzip');
        assert.equal(response.payload.headers.etag, undefined);
      }
      compressed.push(Buffer.from(response.payload.bodyB64, 'base64'));
      if (response.payload.final) break;
    }
    assert(!gunzipSync(Buffer.concat(compressed)).toString().includes('base64,AAAA'));
    const upgraded = once(hostWs, "connection");
    sendInner("ws_open", { path: "/api/events", headers: spoofed }, "ws");
    await next("ws_open_ok", "ws");
    const [localSocket] = await upgraded;
    sendInner("ws_frame", { dataB64: Buffer.from("task-progress").toString("base64"), opcode: 1 }, "ws");
    assert.equal(Buffer.from((await next("ws_frame", "ws")).payload.dataB64, "base64").toString(), "task-progress");
    assert.equal(seenHeaders.length, 2);
    for (const headers of seenHeaders) {
      assert.equal(headers.cookie, cookie);
      assert.equal(headers.host, `127.0.0.1:${address.port}`);
      assert.equal(headers["x-dsh-mobile-remote"], "1");
      assert.equal(headers.authorization, undefined);
      assert.equal(headers["sec-fetch-site"], "same-origin");
    }
    const closed = once(localSocket, "close");
    send("client_close", { accessSessionId: sessionId });
    await closed;
    sendInner("http_req", { method: "GET", path: "/api/tasks" }, "stale");
    await next("device_close");
    assert.equal(taskRequests, 1);
    assert.doesNotMatch(rawFrames.join("\n"), /host-private/);
    client.stop();
    assert.throws(() => auth.headers());
    assert.deepEqual(client.status(), { connected: false, dsh: false });
  } finally {
    client.stop();
    for (const ws of relay.clients) ws.terminate();
    for (const ws of hostWs.clients) ws.terminate();
    await new Promise<void>(resolve => relay.close(() => resolve()));
    await new Promise<void>(resolve => hostWs.close(() => resolve()));
    host.close();
    host.closeAllConnections();
    await once(host, "close");
  }
});
}

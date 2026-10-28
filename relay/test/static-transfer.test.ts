import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {webcrypto} from 'node:crypto';

function fixture() {
  const stores = new Map<string, Map<string, Response>>();
  const scope: any = {importScripts() {}, indexedDB: {open: () => ({})},
    TextEncoder, TextDecoder, URL, Headers, Request, Response, Blob, TransformStream, DecompressionStream,
    Uint8Array, btoa, atob, crypto: webcrypto,
    caches: {open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name)!;
      return {match: async (key: string) => entries.get(key)?.clone(),
        put: async (key: string, value: Response) => {entries.set(key, value.clone());},
        keys: async () => [...entries.keys()], delete: async (key: string) => entries.delete(key)};
    }},
    self: {location: {origin: 'https://relay.test'}, addEventListener() {}},
  };
  runInNewContext(readFileSync('web/app/sw.js', 'utf8') + '\nglobalThis.T = Tunnel; globalThis.staticPath = versionedStaticPath; globalThis.loadAsset = loadRemoteResource;', scope);
  return scope;
}

test('gzip assets are negotiated and decoded before being returned to the browser', async () => {
  const s = fixture(), t = new s.T({deviceId: 'device'});
  const original = 'const example = "加载工作区";'.repeat(100);
  let payload: any, channel = '';
  t.sendInner = async (_type: string, p: any, c: string) => {payload = p; channel = c;};
  const promise = t.request('/assets/index-ABC12345.js', new Request('https://relay.test/assets/index-ABC12345.js'));
  await Promise.resolve();
  assert.equal(payload.headers['accept-encoding'], 'gzip');
  await t.handleHttpResponse({channel, payload: {status: 200, headers: {'content-type': 'text/javascript', 'content-encoding': 'gzip'},
    bodyB64: gzipSync(original).toString('base64'), final: true}});
  const response = await promise;
  assert.equal(await response.text(), original);
  assert.equal(response.headers.get('content-encoding'), null);
});

test('only versioned static GET assets are cached; API, HTML, errors and revisions stay separate', async () => {
  const s = fixture();
  assert.equal(s.staticPath('/api/session'), false);
  assert.equal(s.staticPath('/plugins/?name=test'), false);
  assert.equal(s.staticPath('/assets/index-ABC12345.js'), true);
  let calls = 0;
  const tunnel = {deviceId: 'device', request: async () => {calls++; return new Response('asset', {headers: {'content-type': 'text/javascript'}});}};
  const path = '/plugins/??pkg/client.js&rev=abcdef123456';
  const request = new Request('https://relay.test'+path);
  await s.loadAsset(tunnel, path, request);
  await s.loadAsset(tunnel, path, request);
  assert.equal(calls, 1);
  await s.loadAsset(tunnel, path.replace('abcdef123456', 'bbbbbb123456'), request);
  await s.loadAsset(tunnel, '/api/session', request);
  await s.loadAsset(tunnel, '/api/session', request);
  assert.equal(calls, 4);
  await s.loadAsset({...tunnel, deviceId: 'another-device'}, path, request);
  assert.equal(calls, 5);
  await s.loadAsset(tunnel, path, new Request(request, {method: 'POST'}));
  assert.equal(calls, 6);
});

test('failed, private and HTML responses are not cached, and denied storage falls back to the tunnel', async () => {
  const s = fixture(), path = '/assets/index-ABC12345.js', request = new Request('https://relay.test'+path);
  for (const options of [
    {status: 502, headers: {'content-type': 'text/javascript'}},
    {headers: {'content-type': 'text/javascript', 'cache-control': 'no-store'}},
    {headers: {'content-type': 'text/html'}},
  ]) {
    let calls = 0;
    const t = {deviceId: 'device', request: async () => {calls++; return new Response('body', options);}};
    await s.loadAsset(t, path, request); await s.loadAsset(t, path, request);
    assert.equal(calls, 2);
  }
  s.caches.open = async () => {throw new Error('quota unavailable');};
  const result = await s.loadAsset({deviceId: 'device', request: async () => new Response('fallback')}, path, request);
  assert.equal(await result.text(), 'fallback');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {Readable} from 'node:stream';
import {lightweightClientScript, isLightweightRequest, lightweightAssetStream} from '../src/lightweight-assets.js';

test('only explicit versioned plugin GET requests use the lightweight variant', () => {
  assert.equal(isLightweightRequest('GET', '/plugins/??pkg/client.js&rev=abcdef123456', '1'), true);
  for (const [method,path,flag] of [['POST','/plugins/??pkg/client.js&rev=abcdef123456','1'],['GET','/api/session','1'],['GET','/plugins/??pkg/client.js','1'],['GET','/plugins/??pkg/client.js&rev=abcdef123456','0']])
    assert.equal(isLightweightRequest(method,path,flag), false);
});

test('replaces only named built-in onboarding illustrations; keeps user data and ordinary icons', () => {
  const src = 'var onboarding_welcome_default = "data:image/webp;base64,AAAA"; var attachment = "data:image/webp;base64,BBBB"; var badge_skill_preview_zh_default = "data:image/svg+xml;base64,CCCC";';
  const result = lightweightClientScript(src);
  assert(!result.includes('base64,AAAA'));
  assert(!result.includes('base64,CCCC'));
  assert(result.includes('base64,BBBB'));
  assert.doesNotThrow(() => runInNewContext(result));
});

test('remote ocean skin module exports a no-op without starting the background renderer', () => {
  const source = 'window.__ModuleLoader__.load({ id: "open-sea-skin", factory: (require) => { throw new Error("background started"); }});';
  let exported: any;
  runInNewContext(lightweightClientScript(source), {window:{__ModuleLoader__:{load: (m:any)=>{exported=m.factory();}}}});
  assert.equal(typeof exported.apply,'function');
  assert.equal(lightweightClientScript('const other = 1;'), 'const other = 1;');
});

test('handles split input and bounds buffered source size', async () => {
  const stream = Readable.from(['var onboarding_welcome_default = "data:image/', 'webp;base64,AAAA";']).pipe(lightweightAssetStream());
  let result=''; for await(const chunk of stream) result+=chunk;
  assert(!result.includes('base64,AAAA'));
  const limited=Readable.from([Buffer.alloc(9)]).pipe(lightweightAssetStream(8));
  await assert.rejects(async()=>{for await(const _ of limited){}}, /too large/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

test('a send from an old page cannot create a tunnel and silently replay into a missing channel', async () => {
  const handlers: Record<string, Function> = {}, messages: any[] = [];
  let resumed = 0, sent = 0;
  const scope: any = {
    importScripts() {}, indexedDB: {open: () => ({})}, TextEncoder, TextDecoder, URL, btoa,
    self: {location: {origin: 'https://relay.test'}, addEventListener: (name: string, fn: Function) => {handlers[name] = fn;}},
    clients: {get: async () => ({url: 'https://relay.test/remote/dev_test/', postMessage: (m: any) => messages.push(m)})},
    recover: async () => {resumed++; return {virtualSockets: new Map(), sendInner: async () => {sent++;}};},
  };
  runInNewContext(readFileSync('web/app/sw.js', 'utf8') + '\nresumeTunnel = recover;', scope);
  let pending: Promise<void> | undefined;
  handlers.message({source: {id: 'page'}, data: {type: 'remote-ws-send', channel: 'lost', text: 'task'},
    waitUntil: (p: Promise<void>) => {pending = p;}, ports: []});
  await pending;
  assert.equal(resumed, 0);
  assert.equal(sent, 0);
  assert.equal(messages[0]?.event, 'close');
  assert.equal(messages[0]?.wasClean, false);
});

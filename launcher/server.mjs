import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export async function createControlServer(runtime, onExit = async () => {}, port = 0) {
  const secret = randomBytes(32).toString('hex');
  const page = await readFile(new URL('./index.html', import.meta.url));
  const script = await readFile(new URL('./ui.js', import.meta.url));
  let origin, cookieName;
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    const json = (code, body) => { res.writeHead(code, {'content-type': 'application/json; charset=utf-8'}); res.end(JSON.stringify(body)); };
    if (req.headers.host !== new URL(origin).host) return json(403, {error: '访问地址不正确。'});
    const url = new URL(req.url, origin);
    if (req.method === 'GET' && url.pathname === '/' && url.searchParams.get('key') === secret) {
      res.writeHead(303, {location: '/', 'set-cookie': `${cookieName}=${secret}; HttpOnly; SameSite=Strict; Path=/`});
      return res.end();
    }
    const cookies = (req.headers.cookie || '').split(';').map(value => value.trim());
    if (!cookies.includes(`${cookieName}=${secret}`)) return json(401, {error: '请重新双击启动入口打开控制页面。'});
    if (req.method === 'GET' && url.pathname === '/') { res.writeHead(200, {'content-type': 'text/html; charset=utf-8'}); return res.end(page); }
    if (req.method === 'GET' && url.pathname === '/ui.js') { res.writeHead(200, {'content-type': 'text/javascript; charset=utf-8'}); return res.end(script); }
    if (req.method !== 'GET' && req.headers.origin !== origin) return json(403, {error: '请在本机控制页面操作。'});
    try {
      if (req.method === 'GET' && url.pathname === '/api/state') return json(200, await runtime.snapshot());
      if (req.method === 'GET' && url.pathname === '/open') {
        const target = runtime.openUrl();
        if (!target) return json(409, {error: '请先启动 Harness。'});
        res.writeHead(303, {location: target}); return res.end();
      }
      if (req.method !== 'POST') return json(404, {error: '页面不存在。'});
      if (url.pathname === '/api/start') await runtime.start();
      else if (url.pathname === '/api/stop') await runtime.stop();
      else if (url.pathname === '/api/relay') {
        let body = '';
        for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 2048) return json(413, {error: '地址过长。'}); }
        let settings;
        try { settings = JSON.parse(body); } catch { return json(400, {error: '设置格式无效。'}); }
        await runtime.setRelay(settings.relay);
      } else if (url.pathname === '/api/pair') return json(200, await runtime.pairing());
      else if (url.pathname === '/api/unpair') await runtime.request('/pairing', 'DELETE');
      else if (url.pathname === '/api/exit') { await runtime.stop(); json(200, {ok: true}); setImmediate(() => { server.close(); void onExit(); }); return; }
      else return json(404, {error: '操作不存在。'});
      return json(200, {ok: true});
    } catch (error) {
      const message = error instanceof Error && /[\u3400-\u9fff]/.test(error.message) ? error.message : '操作失败，请检查连接后重试。';
      return json(409, {error: message});
    }
  });
  server.requestTimeout = 240_000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;
  cookieName = `dsh_launcher_${server.address().port}`;
  return {server, origin, loginUrl: `${origin}/?key=${secret}`};
}

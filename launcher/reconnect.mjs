import { request } from 'node:http';

// A loopback probe must not depend on the desktop browser or proxy configuration.
export function probeController(loginUrl, port) {
  let url;
  try {
    url = new URL(loginUrl);
    if (url.origin !== `http://127.0.0.1:${port}` || url.pathname !== '/' || url.hash ||
        [...url.searchParams.keys()].length !== 1 || !/^[a-f0-9]{64}$/.test(url.searchParams.get('key') || '')) return Promise.resolve(false);
  } catch { return Promise.resolve(false); }
  return new Promise(resolve => {
    const expected = `dsh_launcher_${port}=${url.searchParams.get('key')};`;
    const req = request(url, {agent: false}, response => {
      const authorized = response.statusCode === 303 && response.headers.location === '/' &&
        response.headers['set-cookie']?.some(value => value.startsWith(expected));
      response.resume();
      resolve(Boolean(authorized));
    });
    req.setTimeout(1500, () => req.destroy());
    req.once('error', () => resolve(false));
    req.once('close', () => resolve(false));
    req.end();
  });
}

export async function reopenController({readState, port, open, attempts = 15, delay = ms => new Promise(resolve => setTimeout(resolve, ms))}) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    let state;
    try { state = await readState(); } catch { /* Another launch may still be writing the private state file. */ }
    if (state && await probeController(state.loginUrl, port)) {
      // Do not swallow browser failures or misreport them as port collisions.
      await open(state.loginUrl);
      return;
    }
    await delay(300);
  }
  throw new Error('端口已有服务，但无法验证它是否为本启动器。现有进程未被关闭，请保留页面并联系检查。');
}

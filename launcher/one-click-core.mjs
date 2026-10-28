export function quickTunnelUrl(text) {
  return String(text).match(/https:\/\/[a-z0-9]+(?:-[a-z0-9]+)+\.trycloudflare\.com(?=[\s|]|$)/)?.[0] || null;
}

export function fixedRelayUrl(value) {
  try {
    const text = String(value).trim().replace(/\/$/, '');
    const url = new URL(text);
    if (url.protocol !== 'https:' || url.origin !== text) return null;
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function updatedSettings(settings, remote, relay, fixed = false) {
  const url = new URL(relay);
  const valid = fixed
    ? fixedRelayUrl(relay) === relay
    : quickTunnelUrl(relay) === relay && url.origin === relay;
  if (!valid) throw new Error(fixed ? '固定地址必须是 HTTPS 根地址。' : '临时中转地址格式无效。');
  return {
    settings: {...settings, relay},
    remote: {...remote, relay},
    local: {publicRelay: relay, localRelay: 'http://127.0.0.1:8788'},
  };
}

// Own only the processes created by this run; never stop a pre-existing stack.
export async function runStack(ops) {
  if (await ops.reuse()) return {reused: true};
  if (await ops.occupied()) throw new Error('本机中转端口已占用，但启动器未运行。请保留现有窗口，先检查旧中转，不会自动关闭它。');
  const owned = [];
  try {
    const tunnel = await ops.tunnel(); owned.push(tunnel);
    const url = await tunnel.ready;
    const relay = await ops.relay(url); owned.push(relay);
    await relay.ready;
    await ops.configure(url);
    const launcher = await ops.launcher(); owned.push(launcher);
    await launcher.ready;
    await ops.ready(url);
    await Promise.race([
      launcher.done,
      tunnel.done.then(() => { throw new Error('Cloudflare 已退出，一键启动已停止。请重新打开入口。'); }),
      relay.done.then(() => { throw new Error('本机中转已退出，一键启动已停止。请重新打开入口。'); }),
    ]);
    return {reused: false};
  } finally {
    const errors=[];
    for (const child of owned.reverse()) {
      try { await ops.stop(child); } catch(error) { errors.push(error); }
    }
    if(errors.length)throw new AggregateError(errors,'部分一键启动进程未能退出，请检查启动器状态。');
  }
}

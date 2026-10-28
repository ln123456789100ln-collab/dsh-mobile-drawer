import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

export function desktopAddress(record) {
  const url = new URL(record.url);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port ||
      url.username || url.password || url.pathname !== '/' || url.hash ||
      [...url.searchParams.keys()].length !== 1 || !url.searchParams.get('token') ||
      !Number.isSafeInteger(record.pid) || record.pid < 1) throw new Error('Invalid desktop endpoint');
  return {url: url.href, port: Number(url.port)};
}

// Attaches to the official desktop host; never launches a second data-owning host.
export class DesktopRuntime {
  constructor({dataDir, appDir}) {Object.assign(this, {dataDir, appDir, phase: 'stopped', error: ''});}
  async initialize() {
    this.settings = JSON.parse(await readFile(join(this.dataDir, 'settings.json'), 'utf8'));
  }
  async attach() {
    const record = JSON.parse(await readFile(join(this.dataDir, 'desktop-host.json'), 'utf8'));
    const address = desktopAddress(record);
    process.kill(record.pid, 0);
    const {LocalHostAuth} = await import(pathToFileURL(join(record.pluginRoot, 'dist/host-auth.js')).href);
    const auth = new LocalHostAuth(address.port, () => address.url);
    try {
      await auth.ensure();
      const response = await fetch(`http://127.0.0.1:${address.port}/dsh-mobile/api/state`,
        {headers: auth.headers(), signal: AbortSignal.timeout(3500), redirect: 'error'});
      if (!response.ok) throw new Error('Desktop plugin unavailable');
      const state = await response.json();
      if (state.relay !== this.settings.relay) throw new Error('Desktop relay configuration changed');
      this.auth?.close(); this.auth = auth; this.address = address;
    } catch (error) {auth.close(); throw error;}
  }
  async start() {
    if (this.phase === 'running' || this.phase === 'starting') return;
    this.phase = 'starting'; this.error = '';
    try {
      await this.initialize();
      try {await this.attach();} catch {
        const env = {...process.env}; delete env.ELECTRON_RUN_AS_NODE; delete env.DSH_HOME;
        const child = spawn(join(this.appDir, 'DeepSeek Harness.exe'), [],
          {env, detached: true, stdio: 'ignore', windowsHide: true});
        await new Promise((resolve, reject) => {child.once('spawn', resolve); child.once('error', reject);});
        child.unref();
        let ready = false;
        for (let attempt = 0; attempt < 90; attempt++) {
          try {await this.attach(); ready = true; break;} catch {await new Promise(resolve => setTimeout(resolve, 1000));}
        }
        if (!ready) throw new Error('Desktop host not ready');
      }
      this.phase = 'running';
    } catch {
      this.phase = 'error'; this.error = '桌面连接尚未就绪。请保存工作后退出并重新打开 DeepSeek Harness，再点击连接。';
      throw new Error(this.error);
    }
  }
  async stop() {
    if (this.phase === 'starting') throw new Error('正在连接桌面，请等待完成。');
    this.auth?.close(); this.auth = undefined; this.address = undefined; this.phase = 'stopped';
  }
  async setRelay() {throw new Error('桌面同步模式的中转地址由一键启动维护。');}
  async request(path, method = 'GET') {
    if (!this.auth || !this.address) throw new Error('请先连接桌面 Harness。');
    await this.auth.ensure();
    const response = await fetch(`http://127.0.0.1:${this.address.port}/dsh-mobile/api${path}`,
      {method, headers: this.auth.headers(), signal: AbortSignal.timeout(12000), redirect: 'error'});
    if (!response.ok) {await response.body?.cancel(); throw new Error('桌面插件请求失败，请检查桌面程序与中转连接。');}
    return response.json();
  }
  async pairing() {
    return (await this.request('/state')).phase === 'paired'
      ? this.request('/browser-access') : (await this.request('/pairing', 'POST')).pairing;
  }
  openUrl() {return this.phase === 'running' ? this.address?.url : null;}
  async snapshot() {
    let remote = null, error = this.error;
    if (this.phase === 'running') {
      try {const state = await this.request('/state'); remote = {phase: state.phase, connection: state.relayConnection};}
      catch {
        this.auth?.close(); this.auth = undefined; this.address = undefined; this.phase = 'error';
        error = '桌面暂时无法连接，请点击连接桌面重试。';
      }
    }
    return {mode: 'desktop', phase: this.phase, error, relay: this.settings.relay, installed: true, remote};
  }
}

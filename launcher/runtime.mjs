import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const PACKAGE_HASH = '66e959c37bd4b61b646ebd925dbd6436c984e79d18bd5f32f8469e93e2ec9253';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export function localRelayEnvironment(mapping, relay) {
  if (!mapping || mapping.publicRelay !== relay) return {};
  try {
    const url = new URL(mapping.localRelay);
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' ||
        url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error();
    return {DSH_LOCAL_RELAY_URL: url.origin, DSH_LOCAL_RELAY_PUBLIC_URL: relay};
  } catch { throw new Error('本机中转设置无效，地址必须为 http://127.0.0.1:端口。'); }
}

export function launcherPatch(documents, mapping, relay) {
  const local = localRelayEnvironment(mapping, relay);
  return `- id: workspace-controller\n  config:\n    documentsDirectory: ${JSON.stringify(documents)}\n` +
    `- id: dsh-mobile\n  config:\n    relay: ${JSON.stringify(relay)}\n    dshPort: !!js ctx.webStartup.port ?? 3080\n    deviceRelay: ${JSON.stringify(local.DSH_LOCAL_RELAY_URL || '')}\n    deviceRelayPublic: ${JSON.stringify(local.DSH_LOCAL_RELAY_PUBLIC_URL || '')}\n`;
}

export function startupDiagnostic(chunk) {
  return String(chunk).split(/\r?\n/).filter(line => /error|warn|failed|exception|invalid|失败|错误/i.test(line))
    .map(line => line.replace(/https?:\/\/\S+/g, '[url]')
      .replace(/((?:token|secret|password|authorization|cookie|key)\s*[=:]\s*)\S+/gi, '$1[redacted]')
      .replace(/[A-Za-z0-9_+\/-]{32,}={0,2}/g, '[redacted]')).join('\n').slice(-12000);
}

export function validateRelay(value) {
  if (typeof value !== 'string') throw new Error('请输入 HTTPS 中转地址。');
  value = value.trim();
  if (!value) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash)
      throw new Error();
    return url.origin;
  } catch { throw new Error('中转地址应为 https://域名，不包含账号、路径或查询参数。'); }
}

export function launchAddress(line) {
  const match = line.match(/http:\/\/127\.0\.0\.1:\d+\/\?[^\s]+/);
  if (!match) return null;
  try {
    const url = new URL(match[0]);
    const port = Number(url.port);
    if (port < 1 || port > 65535 || url.hash || [...url.searchParams.keys()].length !== 1 || !url.searchParams.get('token')) return null;
    return {url: url.href, port};
  } catch { return null; }
}

export class Runtime {
  #child; #auth; #address; #busy = false; #relay = ''; #installed = false;
  #localRelay;
  #diagnostics = '';
  constructor({dataDir, appDir, packagePath}) {
    this.dataDir = dataDir;
    this.appDir = appDir;
    this.packagePath = packagePath;
    this.phase = 'stopped';
    this.error = '';
  }
  get pluginDir() { return join(this.dataDir, 'home', 'profiles', 'web', 'node_modules', '@april-jk', 'dsh-mobile'); }
  async initialize() {
    await mkdir(this.dataDir, {recursive: true, mode: 0o700});
    try { this.#relay = validateRelay(JSON.parse(await readFile(join(this.dataDir, 'settings.json'), 'utf8')).relay); }
    catch (error) { if (error.code !== 'ENOENT') throw new Error('启动设置无法读取。请保留数据目录并联系检查，不要删除配对数据。'); }
    try { this.#localRelay = JSON.parse(await readFile(join(this.dataDir, 'local-relay.json'), 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw new Error('本机中转设置无法读取。'); }
    localRelayEnvironment(this.#localRelay, this.#relay);
  }
  #spawn(args) {
    return spawn(join(this.appDir, 'DeepSeek Harness.exe'), [
      '--expose-internals', join(this.appDir, 'resources', 'app.asar', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-desktop-host', 'lib', 'cli.js'), ...args,
    ], {
      windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], cwd: this.dataDir,
      env: {...process.env, ELECTRON_RUN_AS_NODE: '1', DSH_HOME: join(this.dataDir, 'home'),
        DSH_LOCAL_RELAY_URL: '', DSH_LOCAL_RELAY_PUBLIC_URL: '',
        ...localRelayEnvironment(this.#localRelay, this.#relay),
        DSH_REMOTE_CONFIG: join(this.dataDir, 'remote.json'), DSH_RELAY: this.#relay || 'http://127.0.0.1:1'},
    });
  }
  async #terminate(child) {
    if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
    // Only a currently owned child handle is used; no persisted or user-supplied PID.
    await promisify(execFile)(join(process.env.SystemRoot, 'System32', 'taskkill.exe'), ['/PID', String(child.pid), '/T', '/F'], {windowsHide: true})
      .catch(error => { if (child.exitCode === null && child.signalCode === null) throw error; });
  }
  async #install() {
    const actual = createHash('sha256').update(await readFile(this.packagePath)).digest('hex');
    if (actual !== PACKAGE_HASH) throw new Error('插件包校验失败。请重新解压完整启动包。');
    try {
      const stamp = await readFile(join(this.dataDir, 'installed-version'), 'utf8');
      await readFile(join(this.pluginDir, 'dist', 'host-auth.js'));
      if (stamp === PACKAGE_HASH) { this.#installed = true; return; }
    } catch (error) { if (error.code !== 'ENOENT') throw new Error('插件安装记录不可读取，请检查数据目录权限。'); }
    this.phase = 'installing';
    const child = this.#spawn(['plugin', '--profile', 'web', 'add', this.packagePath]);
    this.#child = child;
    child.stdout.resume(); child.stderr.resume();
    let timedOut = false;
    let timer;
    try {
      await new Promise((resolve, reject) => {
        timer = setTimeout(() => { timedOut = true; reject(new Error('安装超过三分钟，请检查网络后重试。')); }, 180_000);
        child.once('error', () => reject(new Error('无法启动已安装的 DeepSeek Harness，请检查安装位置。')));
        child.once('exit', code => code === 0 ? resolve() : reject(new Error(timedOut
          ? '安装超过三分钟，请检查网络后重试。' : '插件安装失败，请检查网络及数据目录是否可写，然后重试。')));
      });
    } finally {
      clearTimeout(timer);
      if (!child.pid || child.exitCode !== null || child.signalCode !== null) this.#child = undefined;
    }
    await writeFile(join(this.dataDir, 'installed-version'), PACKAGE_HASH, {mode: 0o600});
    this.#installed = true;
  }
  async start() {
    if (this.phase === 'running') return;
    if (this.#busy) throw new Error('正在处理上一步操作，请稍候。');
    if (this.#child?.pid && this.#child.exitCode === null && this.#child.signalCode === null) throw new Error('上次启动的进程尚未停止，请先点击停止再重试。');
    this.#busy = true; this.error = '';
    try {
      await this.#install();
      this.phase = 'starting';
      this.#diagnostics = '';
      await writeFile(join(this.dataDir, 'last-start-diagnostic.txt'), 'Starting Harness\n', {mode: 0o600});
      const documents = join(this.dataDir, 'projects');
      await mkdir(documents, {recursive: true});
      const overlay = join(this.dataDir, 'launcher.patch.yml');
      await writeFile(overlay, launcherPatch(documents, this.#localRelay, this.#relay), {mode: 0o600});
      const child = this.#spawn(['web', '--patch', overlay, '--no-open', '--host', '127.0.0.1', '--port', '0']);
      this.#child = child;
      const record = chunk => {
        const message = startupDiagnostic(chunk);
        if (message) this.#diagnostics = (this.#diagnostics + '\n' + message).slice(-12000);
      };
      child.stderr.on('data', record);
      child.stdout.on('data', record);
      const address = await new Promise((resolve, reject) => {
        let pending = '';
        const timer = setTimeout(() => reject(new Error('Harness 启动超时。请停止后重试。')), 60_000);
        const finish = (error, value) => { clearTimeout(timer); error ? reject(error) : resolve(value); };
        child.stdout.on('data', chunk => {
          pending += chunk.toString();
          const lines = pending.split(/\r?\n/); pending = lines.pop().slice(-8192);
          for (const line of lines) { const value = launchAddress(line); if (value) finish(null, value); }
        });
        child.once('error', () => finish(new Error('无法启动 Harness，请检查是否已安装。')));
        child.once('exit', () => {
          if (this.#child === child) {
            this.#child = undefined; this.#auth?.close(); this.#auth = undefined; this.#address = undefined;
            if (this.phase === 'running') { this.phase = 'error'; this.error = 'Harness 意外退出，请点击启动重试。'; }
          }
          finish(new Error('Harness 在准备就绪前退出，请检查安装或重新启动。'));
        });
      });
      const {LocalHostAuth} = await import(pathToFileURL(join(this.pluginDir, 'dist', 'host-auth.js')));
      this.#address = address;
      this.#auth = new LocalHostAuth(address.port, () => address.url);
      let ready = false;
      const deadline = Date.now() + 20_000;
      while (Date.now() < deadline) {
        try { await this.request('/state'); ready = true; break; } catch { await delay(500); }
      }
      if (!ready) throw new Error('Harness 已启动，但远程插件未就绪。请停止后重试，或检查版本兼容性。');
      this.phase = 'running';
    } catch (error) {
      await writeFile(join(this.dataDir, 'last-start-diagnostic.txt'),
        this.#diagnostics || 'No detailed plugin error was emitted.\n', {mode: 0o600});
      try { await this.#terminate(this.#child); } catch { /* Retain handle for the explicit stop action. */ }
      this.#auth?.close(); this.#auth = undefined; this.#address = undefined;
      this.phase = 'error';
      this.error = error instanceof Error && /[\u3400-\u9fff]/.test(error.message) ? error.message : '启动失败，请检查 Harness 安装、网络和数据目录权限。';
      throw new Error(this.error);
    } finally { this.#busy = false; }
  }
  async stop() {
    if (this.#busy) throw new Error('正在安装或启动，请等待完成后停止。');
    this.#busy = true;
    try {
      this.phase = 'stopping';
      await this.#terminate(this.#child);
      this.#child = undefined; this.#auth?.close(); this.#auth = undefined; this.#address = undefined;
      this.phase = 'stopped'; this.error = '';
    } catch { this.phase = 'error'; throw new Error('停止失败，请关闭本启动器启动的 Harness 后重试。'); }
    finally { this.#busy = false; }
  }
  async setRelay(value) {
    const relay = validateRelay(value);
    if (this.#busy || this.#child) throw new Error('请先停止 Harness，再修改中转地址。');
    this.#busy = true;
    try {
      let config;
      try { config = JSON.parse(await readFile(join(this.dataDir, 'remote.json'), 'utf8')); }
      catch (error) { if (error.code !== 'ENOENT') throw new Error('配对配置无法读取，请先检查配置文件。'); }
      if (config?.deviceToken && relay !== this.#relay) throw new Error('请先启动并撤销原有配对，再更换中转地址。');
      await writeFile(join(this.dataDir, 'settings.next.json'), JSON.stringify({relay}), {mode: 0o600});
      await rename(join(this.dataDir, 'settings.next.json'), join(this.dataDir, 'settings.json'));
      this.#relay = relay;
    } finally { this.#busy = false; }
  }
  async request(path, method = 'GET') {
    if (!this.#auth || !this.#address) throw new Error('请先启动 Harness。');
    await this.#auth.ensure();
    const response = await fetch(`http://127.0.0.1:${this.#address.port}/dsh-mobile/api${path}`, {
      method, headers: this.#auth.headers(), signal: AbortSignal.timeout(12_000), redirect: 'error',
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) this.#auth.invalidate();
      await response.body?.cancel();
      throw new Error('远程插件请求失败，请检查中转连接后重试。');
    }
    return response.json();
  }
  async pairing() {
    if (!this.#relay) throw new Error('尚未配置外网 HTTPS 中转地址。');
    const state = await this.request('/state');
    return state.phase === 'paired' ? await this.request('/browser-access') : (await this.request('/pairing', 'POST')).pairing;
  }
  openUrl() { return this.phase === 'running' ? this.#address?.url : null; }
  async snapshot() {
    let remote = null;
    let error = this.error;
    if (this.phase === 'running') {
      try { const state = await this.request('/state'); remote = {phase: state.phase, connection: state.relayConnection}; }
      catch { error = 'Harness 正在运行，但暂时无法读取远程状态。'; }
    }
    return {phase: this.phase, error, relay: this.#relay, installed: this.#installed, remote};
  }
}

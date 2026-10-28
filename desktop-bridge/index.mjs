import {readFile, writeFile, rename, rm} from 'node:fs/promises';
import {join, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

export const name = 'dsh-mobile-desktop-local';
const packageRoot = dirname(fileURLToPath(import.meta.resolve('@april-jk/dsh-mobile/package.json')));
const moduleAt = name => import(pathToFileURL(join(packageRoot, 'dist', name + '.js')).href);

// All credentials remain inside the launcher's existing owner-only directory.
export async function apply(ctx) {
  const data = process.env.DSH_LAUNCHER_DATA || join(process.env.USERPROFILE, '.dsh-remote');
  const read = async name => JSON.parse(await readFile(join(data, name), 'utf8'));
  const atomic = async (name, value) => {
    const target = join(data, name), temporary = target + '.desktop-next';
    await writeFile(temporary, JSON.stringify(value) + '\n', {mode: 0o600});
    await rename(temporary, target);
  };
  const [{RemoteAccessManager}, {RelayClient}, {LocalHostAuth}, {registerManagementRoutes}] =
    await Promise.all(['remote-access', 'relay-client', 'host-auth', 'management'].map(moduleAt));
  const origin = ctx.webServer.getOrigin();
  if (origin !== `http://127.0.0.1:${ctx.webServer.port}`) throw new Error('Desktop remote requires loopback HTTP.');
  // Never replace this locally patched adapter with the public upstream package.
  const updater = {check: async () => ({available: false}), update: async () => {throw new Error('请通过本机启动包更新。');}};
  let manager, unregister, signature, disposed = false, pending;
  const refresh = async () => {
    const settings = await read('settings.json'), mapping = await read('local-relay.json');
    if (disposed) return;
    // The supervisor replaces these files separately. Wait for the complete generation.
    if (mapping.publicRelay !== settings.relay) return;
    const persisted = await read('remote.json');
    if (persisted.relay !== settings.relay || disposed) return;
    const next = JSON.stringify([settings.mode, settings.relay, mapping, persisted]);
    if (signature === next) return;
    unregister?.(); manager?.dispose(); manager = undefined; unregister = undefined;
    signature = undefined;
    if (settings.mode === 'desktop') {
      const config = {...persisted, relay: settings.relay, dshPort: ctx.webServer.port};
      manager = new RemoteAccessManager(config, {
        save: value => atomic('remote.json', value),
        createClient: value => new RelayClient(value,
          new LocalHostAuth(value.dshPort, base => ctx.connection.authenticatedUrl(base)),
          {url: mapping.localRelay, publicRelay: mapping.publicRelay}),
      });
      unregister = registerManagementRoutes(ctx.webServer, manager, updater, ctx.connection);
      await manager.initialize();
      if (!disposed) await atomic('desktop-host.json', {
        pid: process.pid, url: ctx.connection.authenticatedUrl(origin + '/'), pluginRoot: packageRoot,
      });
    }
    signature = next;
  };
  const tick = () => pending ??= refresh().finally(() => {pending = undefined;});
  const timer = setInterval(() => {
    void tick().catch(() => ctx.logger.warn('桌面远程配置暂不可用，请检查本机启动器。'));
  }, 2000);
  ctx.effect(() => async () => {
    disposed = true; clearInterval(timer); await pending?.catch(() => {});
    unregister?.(); manager?.dispose();
    const record = await read('desktop-host.json').catch(() => null);
    if (record?.pid === process.pid) await rm(join(data, 'desktop-host.json'), {force: true});
  });
  await tick();
}

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Runtime } from './runtime.mjs';
import { DesktopRuntime } from './desktop-runtime.mjs';
import { createControlServer } from './server.mjs';
import { reopenController } from './reconnect.mjs';

const exec = promisify(execFile);
const root = dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DSH_LAUNCHER_DATA || join(process.env.USERPROFILE, '.dsh-remote');
const appDir = process.env.DSH_LAUNCHER_APP || join(process.env.LOCALAPPDATA, 'Programs', 'DeepSeek Harness');
const port = Number(process.env.DSH_LAUNCHER_PORT || 30889);
const statePath = join(dataDir, 'controller.json');
const ps = join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
const open = async url => {
  if (process.env.DSH_LAUNCHER_NO_BROWSER === '1') return;
  // Use Windows' URL association; pass the URL via the environment, not shell text.
  try {
    await exec(ps, ['-NoProfile', '-NonInteractive', '-Command', "$ErrorActionPreference = 'Stop'; Start-Process -FilePath $env:DSH_LAUNCHER_OPEN_URL"], {
      windowsHide: true, timeout: 10000, env: {...process.env, DSH_LAUNCHER_OPEN_URL: url},
    });
  } catch { throw new Error('系统无法自动打开浏览器。请检查默认浏览器设置，再双击入口重试。已有工作区不会因此被关闭。'); }
};

async function main() {
  await mkdir(dataDir, {recursive: true, mode: 0o700});
  // Protect the directory before writing any login URL or pairing data.
  await exec(ps, ['-NoProfile', '-NonInteractive', '-Command', `
    $ErrorActionPreference = 'Stop'
    $sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl = [System.Security.AccessControl.DirectorySecurity]::new()
    $acl.SetOwner($sid)
    $acl.SetAccessRuleProtection($true, $false)
    $acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'ContainerInherit, ObjectInherit', 'None', 'Allow'))
    [System.IO.Directory]::SetAccessControl($env:DSH_LAUNCHER_DATA, $acl)
  `], {windowsHide: true, timeout: 10000, env: {...process.env, DSH_LAUNCHER_DATA: dataDir}});
  const settings = JSON.parse(await readFile(join(dataDir, 'settings.json'), 'utf8').catch(error => {
    if (error.code === 'ENOENT') return '{}';
    throw error;
  }));
  const RuntimeClass = settings.mode === 'desktop' ? DesktopRuntime : Runtime;
  const runtime = new RuntimeClass({dataDir, appDir, packagePath: join(root, '..', 'vendor', 'dsh-mobile-0.1.9-local-compat.tgz')});
  await runtime.initialize();
  let control;
  try {
    control = await createControlServer(runtime, async () => { await rm(statePath, {force: true}); process.exit(0); }, port);
  } catch (error) {
    if (error.code !== 'EADDRINUSE') throw error;
    await reopenController({readState: async () => JSON.parse(await readFile(statePath, 'utf8')), port, open});
    return;
  }
  await writeFile(statePath, JSON.stringify({loginUrl: control.loginUrl, pid: process.pid}), {mode: 0o600});
  await open(control.loginUrl);
  console.log('DSH remote launcher is ready. Login address is stored in its private data directory.');
  void runtime.start().catch(() => { /* The control page displays the sanitized runtime error. */ });
}

main().catch(async error => {
  const message = error instanceof Error && /[\u3400-\u9fff]/.test(error.message) ? error.message : 'The remote launcher could not start. Check that DeepSeek Harness is installed, port 30889 is available, and the data folder is writable. Your workspace data has been preserved.';
  console.error(message);
  if (process.env.DSH_LAUNCHER_NO_BROWSER !== '1') {
    await exec(ps, ['-NoProfile', '-NonInteractive', '-Command', "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show($env:DSH_LAUNCHER_ERROR, 'DSH Remote Launcher') | Out-Null"], {windowsHide: true, env: {...process.env, DSH_LAUNCHER_ERROR: message}}).catch(() => {});
  }
  process.exit(1);
});

import {readFile, writeFile, rename, access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn, execFile} from 'node:child_process';
import {createServer, connect} from 'node:net';
import {join, dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import {probeController} from './reconnect.mjs';
import {quickTunnelUrl, fixedRelayUrl, updatedSettings, runStack} from './one-click-core.mjs';

const root=dirname(fileURLToPath(import.meta.url));
// This entry is for the already installed workspace on this computer.
const project=resolve(root,'..');
// AppData is virtualized for packaged app descendants on Windows.
const data=process.env.DSH_LAUNCHER_DATA || join(process.env.USERPROFILE,'.dsh-remote');
const node=join(process.env.ProgramFiles,'nodejs/node.exe');
const electron=join(process.env.LOCALAPPDATA,'Programs/DeepSeek Harness/DeepSeek Harness.exe');
const cloudflared=join(project,'tools/cloudflared.exe');
const relayRoot=join(project,'relay');
const keepAwakeScript=join(root,'keep-awake.ps1');
const ps=join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
const exec=promisify(execFile);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const log=message=>console.log(message);

async function json(path) { return JSON.parse(await readFile(path,'utf8')); }
async function configuredFixedRelay() {
  const env = (process.env.DSH_PUBLIC_RELAY_URL || '').trim();
  if (env) {
    const fixed = fixedRelayUrl(env);
    if (!fixed) throw new Error('DSH_PUBLIC_RELAY_URL 必须是 HTTPS 根地址。');
    return fixed;
  }
  let text = '';
  try {
    text = await readFile(join(data, 'fixed-relay.txt'), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  if (!text.trim()) return null;
  const fixed = fixedRelayUrl(text);
  if (!fixed) throw new Error('fixed-relay.txt 必须是 HTTPS 根地址。');
  return fixed;
}
async function controller() {
  try {
    const state=await json(join(data,'controller.json'));
    return await probeController(state.loginUrl,30889) ? state : null;
  } catch { return null; }
}
async function open(state) {
  if(process.env.DSH_LAUNCHER_NO_BROWSER==='1')return;
  await exec(ps,['-NoProfile','-NonInteractive','-Command',
    "$ErrorActionPreference='Stop'; Start-Process -FilePath $env:DSH_LAUNCHER_OPEN_URL"],
    {windowsHide:true,timeout:10000,env:{...process.env,DSH_LAUNCHER_OPEN_URL:state.loginUrl}});
}
async function occupied(port) {
  return new Promise(resolve=>{
    const socket=connect({host:'127.0.0.1',port});
    const finish=value=>{socket.destroy();resolve(value);};
    socket.once('connect',()=>finish(true));socket.once('error',()=>finish(false));
    socket.setTimeout(1500,()=>finish(true));
  });
}
function launch(command,args,options={}) {
  const processHandle=spawn(command,args,{windowsHide:true,stdio:['ignore','pipe','pipe'],...options});
  const child={process:processHandle,exited:false,output:''};
  child.done=new Promise(resolve=>{
    const done=()=>{child.exited=true;resolve();};
    processHandle.once('exit',done);processHandle.once('error',done);
  });
  const collect=chunk=>{child.output=(child.output+chunk.toString()).slice(-16384);};
  processHandle.stdout.on('data',collect);processHandle.stderr.on('data',collect);
  return child;
}
async function waitFor(check,ms,message,child) {
  const until=Date.now()+ms;
  while(Date.now()<until) {
    if(child?.exited) throw new Error(message);
    const value=await check();if(value)return value;
    await pause(400);
  }
  throw new Error(message);
}
async function stop(child) {
  if(child.exited || !child.process.pid)return;
  await exec(join(process.env.SystemRoot,'System32/taskkill.exe'),['/PID',String(child.process.pid),'/T','/F'],{windowsHide:true})
    .catch(error=>{if(!child.exited)throw error;});
  await child.done;
}
async function writeJson(name,value) {
  const path=join(data,name), temp=path+'.oneclick-next';
  await writeFile(temp,JSON.stringify(value,null,2)+'\n',{mode:0o600});
  await rename(temp,path);
}
async function main() {
  const fixed = await configuredFixedRelay();
  const lock=createServer(socket=>socket.end());
  try {
    await new Promise((resolve,reject)=>{lock.once('error',reject);lock.listen(30890,'127.0.0.1',resolve);});
  } catch(error) {
    if(error.code!=='EADDRINUSE')throw error;
    const existing=await waitFor(controller,90000,'另一份一键启动仍未就绪，请稍后查看启动提示。');
    await open(existing);log('Reused existing launcher.');return;
  }
  let keepAwake;
  try {
    keepAwake=launch(ps,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',keepAwakeScript]);
    log('Keeping the computer awake while remote access is running.');
  } catch {
    keepAwake=null;
  }
  try {
    const result=await runStack({
      reuse:async()=>{
        const existing=await controller();if(!existing)return false;
        if(fixed){
          const settings=await json(join(data,'settings.json'));
          if(settings.relay!==fixed)throw new Error('当前运行中的远程地址与固定地址不一致。请先关闭当前启动器，再重新启动。');
        }
        await open(existing);return true;
      },
      occupied:async()=>await occupied(30889)||await occupied(8788),
      tunnel:async()=>{
        if(fixed){
          log('Using fixed public relay: '+fixed);
          return {process:{pid:0},exited:false,output:'',done:new Promise(()=>{}),ready:Promise.resolve(fixed)};
        }
        for(const path of [node,electron,cloudflared,join(relayRoot,'dist/server.js'),join(data,'cloudflare-relay/jwt-secret.txt')])await access(path);
        const hash=createHash('sha256').update(await readFile(cloudflared)).digest('hex');
        if(hash!=='76b2805253d0d6ffacb092a7acfbee99e7af6917835c0c5410e23f3ef5052da2')throw new Error('Cloudflare 程序校验失败，请检查安装文件。');
        log('Starting Cloudflare.');
        const child=launch(cloudflared,['tunnel','--no-autoupdate','--url','http://127.0.0.1:8788'],{cwd:project});
        child.ready=waitFor(()=>quickTunnelUrl(child.output),60000,'Cloudflare 未能取得公网地址，请检查电脑网络后重试。',child);
        return child;
      },
      relay:async url=>{
        const secret=(await readFile(join(data,'cloudflare-relay/jwt-secret.txt'),'utf8')).trim();
        if(secret.length<32)throw new Error('中转认证配置不可用。原数据未删除，请检查配置。');
        log('Starting authenticated local relay.');
        const child=launch(node,['dist/server.js'],{cwd:relayRoot,env:{...process.env,
          ELECTRON_RUN_AS_NODE:'',HOST:'127.0.0.1',PORT:'8788',NODE_ENV:'production',
          PUBLIC_RELAY_URL:url,DATABASE_PATH:join(data,'cloudflare-relay/relay.sqlite'),JWT_SECRET:secret,
          ALLOW_LEGACY_WEB_PROXY:'0',TRUST_PROXY:'0',ADMIN_USERNAME:'',ADMIN_PASSWORD:''}});
        child.ready=waitFor(async()=>{
          try {const r=await fetch('http://127.0.0.1:8788/health',{signal:AbortSignal.timeout(1500)});return r.ok&&(await r.json()).ok===true;}catch{return false;}
        },15000,'本机中转未能启动，请检查端口或运行环境。',child);
        return child;
      },
      configure:async url=>{
        if(fixed){
          log('Checking fixed public relay: '+url);
          await waitFor(async()=>{
            try {
              const response=await fetch(url+'/health',{signal:AbortSignal.timeout(3000)});
              return response.ok&&(await response.json()).ok===true;
            } catch { return false; }
          },30000,'固定地址无法访问。请确认 Tailscale Funnel 或命名隧道已指向本机 8788 端口。');
        }
        const [settings,remote]=await Promise.all([json(join(data,'settings.json')),json(join(data,'remote.json'))]);
        const updated=updatedSettings(settings,remote,url,!!fixed);
        await writeJson('remote.json',updated.remote);
        await writeJson('local-relay.json',updated.local);
        await writeJson('settings.json',updated.settings);
      },
      launcher:async()=>{
        log('Starting workspace.');
        const child=launch(electron,['--expose-internals',join(root,'main.mjs')],{cwd:root,env:{...process.env,ELECTRON_RUN_AS_NODE:'1'}});
        child.ready=waitFor(controller,90000,'工作区启动器未能就绪，请查看本机启动提示。',child);
        return child;
      },
      ready:async url=>{log('Ready: '+url);},stop,
    });
    if(result.reused)log('Reused existing launcher; no services restarted.');
  } finally {
    if(keepAwake)await stop(keepAwake).catch(()=>{});
    await new Promise(resolve=>lock.close(resolve));
  }
}

main().catch(async error=>{
  const message=error instanceof Error&&/[\u3400-\u9fff]/.test(error.message)?error.message:'一键启动失败。请检查本机 Node、Cloudflare 和中转文件是否仍在原位置。';
  console.error(message);
  await exec(ps,['-NoProfile','-NonInteractive','-Command',
    "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show($env:DSH_START_ERROR, 'DeepSeek 一键启动') | Out-Null"],
    {windowsHide:true,env:{...process.env,DSH_START_ERROR:message}}).catch(()=>{});
  process.exitCode=1;
});

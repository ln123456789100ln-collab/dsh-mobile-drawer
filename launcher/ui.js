const el = id => document.getElementById(id);
let busy = false, initial = true, exited = false, qrExpiry = 0, actionError = '', desktop = false;
const names = {stopped: '已停止', installing: '正在安装插件', starting: '正在启动', running: '运行中', stopping: '正在停止', error: '需要处理'};
async function api(path, body) {
  const response = await fetch(`/api/${path}`, body === undefined ? {} : {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body)});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '操作失败，请重试。');
  return result;
}
function showError(message) { el('error').textContent = message; el('error').hidden = !message; }
function hideQr() { el('qrPanel').hidden = true; el('qr').removeAttribute('src'); qrExpiry = 0; }
async function refresh() {
  if (exited) return;
  try {
    const state = await api('state');
    desktop = state.mode === 'desktop';
    if (desktop) {
      el('modeTitle').textContent = '与电脑桌面共用工作区';
      el('modeHint').textContent = '手机与官方桌面程序使用同一份对话和插件配置。电脑上的更改也会在手机访问的工作区中生效。插件自身的移动端兼容性仍由各插件决定。';
      el('lifecycleHint').textContent = '断开控制页不会关闭桌面程序。退出一键启动会停止它启动的外网中转，桌面任务继续运行。';
      el('start').textContent = '连接桌面'; el('stop').textContent = '断开控制页'; el('exit').textContent = '退出启动器';
      el('settings').hidden = true;
    }
    el('hostStatus').textContent = names[state.phase] || '未知状态';
    el('hostHint').textContent = state.phase === 'installing' ? '首次安装需要下载依赖，请保持联网，通常需几分钟。' : state.phase === 'running' ? '电脑端已就绪，可以打开 Harness。' : '工作区和插件会保留，再次启动可继续使用。';
    const pending = busy || ['installing', 'starting', 'stopping'].includes(state.phase);
    el('start').disabled = pending || state.phase === 'running';
    el('stop').disabled = pending || state.phase === 'stopped';
    el('open').disabled = state.phase !== 'running';
    el('save').disabled = pending || state.phase === 'running';
    el('exit').disabled = pending;
    el('pair').disabled = pending || state.phase !== 'running' || !state.relay;
    el('unpair').disabled = pending || state.phase !== 'running' || !state.remote || state.remote.phase === 'unpaired';
    if (initial) { el('relay').value = state.relay; initial = false; }
    let label = '待配置中转', hint = '本机已可使用；尚未接入手机外网通道。';
    if (state.relay) {
      label = state.phase !== 'running' ? '等待电脑端启动' : state.remote?.phase === 'unpaired' ? '等待手机配对' : state.remote?.phase === 'pairing' ? '等待扫码' : state.remote?.connection === 'connected' ? '中转已连接' : '中转尚未连接';
      hint = state.remote?.connection === 'connected' ? '电脑已连上中转；手机是否可访问仍需在手机上确认。' : '电脑与手机需要使用同一个中转地址。';
    }
    el('remoteStatus').textContent = label; el('remoteHint').textContent = hint;
    if (state.phase !== 'running' || state.remote?.phase === 'unpaired' || (qrExpiry && Date.now() >= qrExpiry)) hideQr();
    if (!busy) showError(state.error || actionError);
  } catch { showError('启动器暂时无法连接。请重新双击启动入口；如果正在安装，请先等待完成。'); }
}
async function action(name, body = {}, after) {
  if (busy) return;
  busy = true; actionError = ''; showError(''); el('notice').textContent = '正在处理…';
  void refresh();
  try {
    const result = await api(name, body);
    el('notice').textContent = '已完成。';
    if (after) after(result);
  } catch (error) { actionError = error.message; showError(actionError); el('notice').textContent = ''; }
  finally { busy = false; if (!exited) await refresh(); }
}
el('start').onclick = () => action('start');
el('stop').onclick = () => { if (desktop || confirm('停止此工作区会中断正在执行的任务。确定停止？')) void action('stop', {}, hideQr); };
el('open').onclick = () => window.open('/open', '_blank', 'noopener,noreferrer');
el('save').onclick = () => action('relay', {relay: el('relay').value});
el('pair').onclick = () => action('pair', {}, result => {
  if (!result?.qrSvg) throw new Error('尚未生成二维码，请检查中转连接后重试。');
  el('qr').src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(result.qrSvg)))}`;
  qrExpiry = result.expiresAt || 0;
  el('qrHint').textContent = qrExpiry ? '配对码有时限。若过期，请重新生成。' : '这是此浏览器的访问码；请勿转发给他人。';
  el('qrPanel').hidden = false;
});
el('hideQr').onclick = hideQr;
el('unpair').onclick = () => { if (confirm('撤销后，已配对手机将失去访问权限。确定撤销？')) void action('unpair', {}, hideQr); };
el('exit').onclick = () => { if (confirm(desktop ? '退出启动器？一键启动管理的外网连接会停止，桌面程序继续运行。' : '停止此工作区并退出启动器？')) void action('exit', {}, () => { exited = true; hideQr(); document.querySelectorAll('button').forEach(button => button.disabled = true); el('hostStatus').textContent = '已退出'; el('remoteStatus').textContent = '已退出控制'; el('notice').textContent = '可以关闭此页面。'; }); };
void refresh();
setInterval(refresh, 2500);

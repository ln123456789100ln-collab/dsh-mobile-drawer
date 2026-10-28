# 插件适配说明（relative to upstream dsh-mobile-plugin 0.1.9）

本目录是 `@april-jk/dsh-mobile` 的本地适配版（local-compat）。上游 [`LICENSE`](LICENSE) 原样保留（MIT）。

## 相对上游的主要改动

1. **打包成可直接安装的 npm 包**
   - `vendor/dsh-mobile-0.1.9-local-compat.tgz` 即由本目录打包生成（`npm pack` 等价产物）；
   - 启动器的独立工作区模式、`desktop-bridge` 都使用这个包，保证行为一致。

2. **桌面模式支持（host-auth）**
   - 增加 `dist/host-auth.js` 导出，供 `desktop-bridge` 和启动器在本机回环地址上完成短期鉴权；
   - `desktop-runtime.mjs` 通过它连接日常 DSH 实例，而不是另起一个数据宿主。

3. **手机轻量资源（local8）**
   - `dist/lightweight-assets.js`：对手机请求的版本化插件资源做轻量转换（欢迎/充值/技能预览/语音预览插图替换为 1x1 透明 GIF，`open-sea-skin` 模块变为空实现），减少首屏体积；桌面端不受影响。

4. **可被本地覆盖的升级**
   - 桌面桥接里把 updater 固定为不可用，避免插件市场把本地适配版覆盖掉；升级请跟随本仓库。

## 构建/打包

```powershell
cd plugin
npm install
npm pack        # 生成 dsh-mobile-0.1.9.tgz
```

打包后如需替换仓库里的 `vendor/dsh-mobile-0.1.9-local-compat.tgz`，记得同步重新构建并核对 `tests` 里的手机 UI 回归。

## 注意

- `plugin/` 是源码；运行用的已打包版本在 `vendor/`。两者不要各改一半。
- 上游是 MIT，允许修改/再分发；保留 `LICENSE` 与出处声明。

# NOTICE

## 上游来源

- `app/sw.template.js` 基于 [april-jk/dsh-relay](https://github.com/april-jk/dsh-relay) 的 `web/app/sw.js`（MIT License，Copyright (c) 2026 dsh-mobile contributors），并加入移动端资源内嵌与 HTML 注入逻辑。
- 移动端 UI 的注入思路、配对/中继体系来自同一项目的 [dsh-mobile-plugin](https://github.com/april-jk/dsh-mobile-plugin)（MIT License）。
- 本项目只修改 Relay 浏览器端的静态前端与 Service Worker，不包含 DeepSeek Harness（DSH）本体代码、安装包或任何官方资源。

## 非官方声明

本项目为个人对自有 DSH Relay 部署的界面增强，**非 DeepSeek 官方项目**，与 DeepSeek 无隶属关系。
使用前请确认你拥有所连接 DSH 实例的合法访问权；本项目不提供绕过鉴权、配对或加密的能力。

## 不包含的内容

本仓库刻意不包含：

- `cloudflared.exe`、Relay 后端、DSH 安装包或 `app.asar`
- 任何设备密钥、配对二维码、JWT、数据库或 `~/.dsh-remote` 数据
- 真实会话内容或个人截图（文档截图已脱敏）

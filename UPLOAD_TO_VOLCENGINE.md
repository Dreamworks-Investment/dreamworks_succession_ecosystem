# 火山引擎上传说明

## 一句话流程

```
npm run build:zip
```

产物在 `dist/mgc-website-<日期>-<时分>.zip`，直接点火山引擎函数服务里的「上传」，选中这个 zip 即可，不需要手工压缩、也不需要解压再拖拽。

## 包结构约定

zip 是**根目录平铺**的。解压后第一层应直接看到：

- `package.json`
- `server.js`
- `index.html`
- `run.sh`
- `DEPLOYMENT.md`
- `css/`、`js/`、`assets/`、`docs/`、`office-tour/`、`vendor/`

不要再把整个文件夹用 Finder / 资源管理器重新压缩，否则会再次产生外层目录和 `__MACOSX`。

运行环境：Node.js 20.x
启动命令：`node server.js`（或 `./run.sh`）
监听端口：`8000`

## 包内不含什么

构建脚本会硬性排除以下内容，**如果 `.env` 被误纳入，脚本会直接中止并报错**：

- `.env`、`.env.local` 等一切真实凭据文件（`.env.example` 保留，只作为配置清单）
- `node_modules/`、`dist/`、`.workbuddy/`、`.git/`
- `qa/`（本地自检脚本与截图）
- `CHANGELOG_*`、`VERSION_V*`、`*.log`

## 环境变量在哪配

因为 `.env` 不进包，**所有真实凭据都必须在火山引擎控制台 →「函数配置 / 环境变量」里填写**。完整清单见 `.env.example` 与 `DEPLOYMENT.md`。改完环境变量必须重新发布函数才生效。

上线后自检顺序：

1. `GET /` 返回 200，首页正常。
2. `GET /api/market-agent/status` 未登录时必须是 `404`（保护生效）。
3. 用市场专员账号登录后 `GET /api/market-agent/status` 返回 `configured: true`。
4. `GET /api/strategy-auth/status` 只能看到布尔值，不能出现任何账号、密码或 Token。

## 已知部署约束

- **会话保存在进程内存**：平台如果扩容成多实例，或实例被回收，进行中的 AI 会话会丢失，用户需要重新点一次报告类型。建议保持单实例，或至少确认平台不回收活跃实例。
- **限流按真实访客 IP 计数**：服务端会读 `X-Forwarded-For` / `X-Real-IP`。仅当对端是网关/私网地址时才信任这些请求头（也可用 `TRUST_PROXY=true` 强制开启），避免公网客户端伪造。
- **接口超时**：AI 会话接口会每 15 秒发一次流式心跳，平台执行超时建议 ≥ 120 秒。

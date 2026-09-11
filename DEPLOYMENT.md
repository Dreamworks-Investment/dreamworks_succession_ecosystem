# 火山引擎部署配置

- 框架类型：自定义
- 运行环境：Native Node.js 20.x
- 启动命令：`./run.sh`
- 监听端口：`8000`
- 执行超时：`60 Sec`（创建阶段可用；正式部署建议按平台支持调整至 120 Sec）
- 健康检查：HTTP GET `/`，端口 `8000`

本包不需要 `npm install`，仅使用 Node.js 20 内置模块。

服务必须监听 `0.0.0.0`，本包已配置。

## WorkBuddy 身家诊断专家

身家诊断第五步后的 AI 专家入口通过本站 Node 服务代理，浏览器不会获得 WorkBuddy 凭据。企业环境推荐使用 OAuth Client Credentials；后端会自动换取并缓存短期 Access Token。

- `WORKBUDDY_CLIENT_ID`：开放平台第三方应用生成的 Client ID。
- `WORKBUDDY_CLIENT_SECRET`：与该应用配套的 Client Secret。
- `WORKBUDDY_TOKEN_URL=https://copilot.tencent.com/oauth2/token`。
- `WORKBUDDY_API_KEY`：当前发布的专家要求的 Runtime secret；即使使用 OAuth 控制面认证也必须设置。
- 后端会把上面的 Key 自动映射成 `CODEBUDDY_API_KEY`，仅注入本次私有 Runtime，浏览器不可见；不再需要额外的注入开关。
- `WORKBUDDY_SOURCE_APP=dreamworks-succession-main`：用于 Runtime 可见性隔离，后续保持不变。
- `WORKBUDDY_INTERNET_ENVIRONMENT=internal`：中国版必须设置；后端会把它注入 Runtime。企业 OAuth access token 也会以 `CODEBUDDY_AUTH_TOKEN` 安全注入，不需要用户在聊天框输入 `/login`。
- `WORKBUDDY_AGENT_ID=agent_01M1AB3GRFAR44G0ED9RQ51WY9`：已发布的“身家诊断专家”Manifest ID。
- `WORKBUDDY_AGENT_NAME=身家诊断专家`。
- `WORKBUDDY_API_BASE=https://www.codebuddy.cn/v2/agentos`。
- `WORKBUDDY_MOCK=false`：生产必须保持 `false`；仅本地联调用 `true`。

可选参数及安全默认值见 `.env.example`。不要把 API Key、临时 COS 签名链接或导出的管理后台 Manifest 写入 Git。

建议把 Web Service 的请求执行超时调至至少 `120 Sec`。接口会每 15 秒发送一次流式心跳以避免空闲连接被代理提前关闭，但平台若采用总时长硬限制，仍需要提高该上限。

部署后的无密钥检查：访问 `GET /api/wealth-agent/status`，只会返回是否已配置、认证模式、Agent ID 和运行模式，不会返回 Client Secret、Access Token 或 ACP Token。首次真实验证建议使用一个无敏感身份信息的演示案例；成功标准为换取企业 Access Token、创建私有 Runtime、收到首轮流式回复，并在结束会话后完成 Runtime 清理。

## 战略与实践分级访问

“战略与实践”的系统介绍和“定位是中心，价值才是核心”页面保持公开；案例库与梦工场定位智体分别由两组服务端凭据保护。首页“商业模式”图片墙中的机密沟通截图复用案例库的账号密码，但签发独立的 `chat` 会话 Cookie：登录案例库不会自动解锁截图，解锁截图也不会进入案例库。请在部署平台为当前环境设置以下变量：

- `STRATEGY_CASES_USERNAME`：内部案例库账号。
- `STRATEGY_CASES_PASSWORD`：内部案例库密码。
- `STRATEGY_AGENT_USERNAME`：梦工场定位智体客户账号。
- `STRATEGY_AGENT_PASSWORD`：梦工场定位智体客户密码。
- `STRATEGY_AUTH_SESSION_SECRET`：会话签名密钥，至少 32 个随机字符。可用 `openssl rand -hex 32` 生成；它不是任何用户的登录密码。
- `STRATEGY_AUTH_SESSION_TTL_SECONDS=28800`：登录有效期，默认 8 小时，可选范围为 5 分钟至 24 小时。
- `STRATEGY_AILY_CHANNEL_TOKEN`：飞书智能体 Web SDK 页面“代码”区域给出的 `channelToken`。
- `STRATEGY_AILY_SDK_VERSION=0.0.12`。
- `STRATEGY_AILY_IFRAME_ORIGIN=https://aily.feishu.cn`。
- `STRATEGY_AILY_ALLOWED_HOST`：已加入飞书 Web SDK 域名白名单的本站线上域名，仅填主机名，不带 `https://` 和路径。

两组账号可以使用完全不同的命名和密码。不要把任何真实值写进 `.env.example`、HTML、浏览器脚本或 Git；修改环境变量后必须重新部署实例才能生效。

旧版曾把定位智体的 Web SDK `channelToken` 放在浏览器配置文件中。新版本已移除该文件；为了让历史构建包或 Git 历史中的旧值失效，建议先在飞书后台轮换/重新生成该渠道 Token，再把新值写入 `STRATEGY_AILY_CHANNEL_TOKEN`。

实现采用由服务器签名的 `HttpOnly; SameSite=Strict` 会话 Cookie。未获得案例权限时，服务器会从 HTML 中移除案例正文与数据脚本，并拒绝 `/assets/strategy/`、案例数据脚本和章节脚本的直接请求；未获得 `chat` 权限时，服务器会拒绝 `/assets/confidential/` 下原图的直接请求；未获得智体权限时，服务器不会下发智体页面或 Web SDK `channelToken`。因此这不是可用开发者工具绕过的前端遮罩。

部署后的检查顺序：

1. 无痕窗口访问 `#strategy`，确认公开介绍和价值核心页面可见。
2. 点击“翻阅合作案例”或“查看创维完整案例”，确认停留在案例库验证页；直接访问 `/assets/strategy/` 下的已知图片应返回 `404`。
3. 使用案例库凭据登录，确认十个案例及创维完整章节可见，但定位智体仍要求另一组凭据。
4. 回到首页“前世今生 → 商业模式”，确认机密沟通图片仍为锁定状态；使用同一组案例库凭据再次验证后才显示预览，并确认未登录时直接访问 `/assets/confidential/strategy-wechat-case.jpeg` 返回 `404`。
5. 退出无痕窗口后重新打开，点击“梦工场定位智体”，使用智体凭据登录并确认飞书会话面板加载。
6. 访问 `GET /api/strategy-auth/status` 只能看到权限和配置状态布尔值，不应出现账号、密码、会话密钥或飞书 Token。

## 狠值投资、身家诊断与家族信托智体

三个业务智体沿用同一套服务端认证机制，但账号、密码和 Channel Token 完全独立。请在部署平台增加以下九个环境变量：

- `VALUE_AGENT_USERNAME`、`VALUE_AGENT_PASSWORD`、`VALUE_AILY_CHANNEL_TOKEN`：梦工场投研专员。
- `WEALTH_AGENT_USERNAME`、`WEALTH_AGENT_PASSWORD`、`WEALTH_AILY_CHANNEL_TOKEN`：身家诊断顾问。
- `TRUST_AGENT_USERNAME`、`TRUST_AGENT_PASSWORD`、`TRUST_AILY_CHANNEL_TOKEN`：家族信托设立系统顾问。

三组智体共用现有的 `STRATEGY_AUTH_SESSION_SECRET`、`STRATEGY_AUTH_SESSION_TTL_SECONDS`、`STRATEGY_AILY_SDK_VERSION`、`STRATEGY_AILY_IFRAME_ORIGIN` 和 `STRATEGY_AILY_ALLOWED_HOST`。因此无需为每台设备生成 Session Secret：它是部署实例统一使用的服务端签名密钥，所有访问者由服务器签发各自的 HttpOnly 会话 Cookie。

登录某一智体只授予该智体的权限，不会解锁其他智体。未登录时，服务器会移除对应智体正文；登录成功并刷新后，认证封面也会从 HTML 中移除，再通过该智体专属接口下发 Channel Token。

部署检查：分别用无痕窗口打开 `#value-agent`、`#wealth-agent`、`#trust-agent`，确认各自只接受对应账号密码；登录后检查会话面板能载入，且页面源代码与 `GET /api/strategy-auth/status` 均不包含任何真实凭据或 Token。

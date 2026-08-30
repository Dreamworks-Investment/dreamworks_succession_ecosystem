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
- `WORKBUDDY_API_KEY`：可选备用；完整 OAuth 凭据存在时无需设置。
- `WORKBUDDY_SOURCE_APP=dreamworks-succession-main`：用于 Runtime 可见性隔离，后续保持不变。
- `WORKBUDDY_AGENT_ID=agent_01M1AB3GRFAR44G0ED9RQ51WY9`：已发布的“身家诊断专家”Manifest ID。
- `WORKBUDDY_AGENT_NAME=身家诊断专家`。
- `WORKBUDDY_API_BASE=https://www.codebuddy.cn/v2/agentos`。
- `WORKBUDDY_MOCK=false`：生产必须保持 `false`；仅本地联调用 `true`。

可选参数及安全默认值见 `.env.example`。不要把 API Key、临时 COS 签名链接或导出的管理后台 Manifest 写入 Git。

建议把 Web Service 的请求执行超时调至至少 `120 Sec`。接口会每 15 秒发送一次流式心跳以避免空闲连接被代理提前关闭，但平台若采用总时长硬限制，仍需要提高该上限。

部署后的无密钥检查：访问 `GET /api/wealth-agent/status`，只会返回是否已配置、认证模式、Agent ID 和运行模式，不会返回 Client Secret、Access Token 或 ACP Token。首次真实验证建议使用一个无敏感身份信息的演示案例；成功标准为换取企业 Access Token、创建私有 Runtime、收到首轮流式回复，并在结束会话后完成 Runtime 清理。

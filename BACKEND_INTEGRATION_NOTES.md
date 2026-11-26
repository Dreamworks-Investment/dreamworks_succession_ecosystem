# 狠值投资入口与后端认证说明

## 当前入口行为

梦工场网站中的“狠值投资”入口统一打开：

https://sd85slpdkcofupk4bn66g.apigateway-cn-guangzhou.volceapi.com/

默认在新标签页打开；如浏览器拦截弹窗，则回退为当前窗口打开。

## 为什么不在梦工场网页中写 Bearer Token

上传的后端已经包含自己的认证流程：

- `GET /`：公开加载 `frontend/index.html` 登录壳
- `POST /auth/login`：提交邮箱和密码，返回 `access_token`
- 前端把 token 只保存在当前页面内存中
- 后续 `/api/*` 请求由后端前端通过 `Authorization: Bearer ...` 自动携带
- `/auth/me` 用于验证 token

因此梦工场主站不应该：

- 把 token 写进 HTML 或前端 JavaScript
- 把 token 放进 URL、查询参数或 hash
- 把 token 打进 ZIP
- 代替后端执行登录

## 部署检查

按照上传的 `passed_agent_5.9.9_passed_fallback.zip`，后端应满足：

- `backend/auth_gate.py` 的 `PUBLIC_PATHS` 包含 `/`
- `backend/app.py` 的 `GET /` 返回 `frontend/index.html`
- `POST /auth/login` 保持公开
- `/api/*` 和 `/auth/me` 受 Bearer Token 保护

如果浏览器直接打开根地址仍返回：

```json
{"detail":"Missing bearer token"}
```

这不是梦工场入口链接的问题，而是线上部署版本或反向代理没有按上述规则运行。需要重新部署上传的后端版本，或检查反向代理是否把 `/` 错误转发到了受保护路由。

## 环境变量

后端至少需要：

- `MGC_AUTH_ENABLED=true`
- `MGC_AUTH_EMAIL=...`
- `MGC_AUTH_PASSWORD=...`
- `MGC_AUTH_SECRET_KEY=...`
- `MGC_AUTH_TOKEN_EXPIRE_MINUTES=30`

真实凭据只应配置在后端部署环境，不得写入前端项目。

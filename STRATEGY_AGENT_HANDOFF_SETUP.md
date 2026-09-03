# 战略与实践分级访问配置

“战略与实践”的公开介绍无需登录。以下两个区域分别使用独立的服务端账号/密码：

1. 合作案例库：保护案例列表、合作照片、研究附件、创维完整章节与相关静态资源。
2. 梦工场定位智体：保护专属智体页面，并在验证成功后才读取飞书 Web SDK `channelToken`。

## 部署环境变量

在部署平台填写，不要把真实值写入本文件或任何浏览器脚本：

```text
STRATEGY_CASES_USERNAME=
STRATEGY_CASES_PASSWORD=
STRATEGY_AGENT_USERNAME=
STRATEGY_AGENT_PASSWORD=
STRATEGY_AUTH_SESSION_SECRET=
STRATEGY_AUTH_SESSION_TTL_SECONDS=28800
STRATEGY_AILY_CHANNEL_TOKEN=
STRATEGY_AILY_SDK_VERSION=0.0.12
STRATEGY_AILY_IFRAME_ORIGIN=https://aily.feishu.cn
STRATEGY_AILY_ALLOWED_HOST=你的线上域名（仅主机名）

VALUE_AGENT_USERNAME=
VALUE_AGENT_PASSWORD=
VALUE_AILY_CHANNEL_TOKEN=
WEALTH_AGENT_USERNAME=
WEALTH_AGENT_PASSWORD=
WEALTH_AILY_CHANNEL_TOKEN=
TRUST_AGENT_USERNAME=
TRUST_AGENT_PASSWORD=
TRUST_AILY_CHANNEL_TOKEN=
```

`STRATEGY_AUTH_SESSION_SECRET` 是服务器签名会话的随机密钥，不是用户登录密码。请用 `openssl rand -hex 32` 生成至少 32 个随机字符。两组用户密码由管理员自行设定，并通过安全渠道分别交给内部人员和获授权客户。

飞书 Token 在 Aily 智能体的 Web SDK 渠道详情页“代码”区域取得。将该页显示的 `channelToken` 填入 `STRATEGY_AILY_CHANNEL_TOKEN`，并确认本站生产域名已加入飞书域名白名单。

投研、身家诊断与家族信托三个智体分别把各自 Web SDK 页面显示的 `channelToken` 填入 `VALUE_AILY_CHANNEL_TOKEN`、`WEALTH_AILY_CHANNEL_TOKEN`、`TRUST_AILY_CHANNEL_TOKEN`。九个业务变量只存放在部署平台；三组认证共用同一个服务端 `STRATEGY_AUTH_SESSION_SECRET`，不需要也不应由每位用户或每台设备各自生成。

旧版浏览器配置曾包含这一 Token，因此首次启用服务端保护时应在飞书后台轮换渠道 Token，并只把新值放入部署环境变量。

## 验证路径

- “点击进入 企业价值诊断与增进系统”只进入公开方法论页面。
- “翻阅合作案例”和“查看创维完整案例”进入案例库验证封面；成功后刷新并恢复到原目标。
- “点击进入 梦工场定位智体”进入另一张验证封面；成功后才加载飞书官方会话面板。

认证成功后，服务器签发带签名的 `HttpOnly; SameSite=Strict` Cookie。账号、密码与会话签名密钥不会发送到浏览器；未授权时案例 HTML、数据脚本、附件、图片和飞书 Token 也不会下发。

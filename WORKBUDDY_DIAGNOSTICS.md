# WorkBuddy 全链路诊断日志

身家诊断专家的每一次状态检查、会话创建、提问和关闭都会生成唯一的 `Trace ID`。同一条 Trace 会同时出现在浏览器诊断包、API 响应头和部署平台标准输出中。

## 测试人员如何取得日志

1. 在身家诊断第五步下方进入 AI 专家。
2. 无论请求成功或失败，展开“技术诊断日志”。
3. 点击“下载完整诊断日志 JSON”。
4. 将 JSON 文件和页面显示的 Trace ID 交给技术人员。
5. 在部署平台日志中搜索完整 Trace ID，例如 `dw-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`，即可取得服务端逐阶段结构化事件。

浏览器下载包包含本次页面的客户端时间线，以及最近 20 条服务端 Trace。单条 Trace 也可在同一服务实例中通过以下接口查询：

```text
GET /api/wealth-agent/diagnostics/{traceId}
```

服务端内存最多保留最近 120 条 Trace、最长 60 分钟。FaaS 冷启动或扩缩容后查询接口可能找不到旧 Trace，因此失败响应会同时直接携带完整诊断快照，浏览器下载不依赖后续查询。

## 时间线覆盖范围

- HTTP 请求进入、参数和授权校验
- 使用的认证模式与环境变量来源
- API Key 是否重复冲突及各自长度（不记录值）
- OAuth Client Credentials 请求、状态码、耗时和缓存命中
- WorkBuddy Runtime API 路径、状态码、请求编号和耗时
- Runtime 创建与状态轮询
- ACP SSE 通知连接
- ACP initialize、session/load、session/new 和 prompt
- 收到的 ACP update 类型、文本块数量和停止原因
- Runtime 内部认证错误的 `auth-type`、`token-type`、凭据长度及目标服务
- 最终错误代码、失败阶段和总耗时

## 安全边界

诊断器会递归脱敏以下字段和内容：

- Authorization / Bearer Token
- API Key、OAuth Token、Client Secret、密码与 Cookie
- URL 中的签名和 access token
- Runtime ID 与 Session ID 的服务端 API 路径
- 用户输入的完整 Prompt 和完整资产诊断数据

仅记录诊断所需的字节长度、配置来源、布尔状态、HTTP 状态、错误代码、阶段名称和耗时。

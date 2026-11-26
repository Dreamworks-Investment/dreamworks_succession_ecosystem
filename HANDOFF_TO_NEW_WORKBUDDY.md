# 交接说明 · 梦工场市场专员直达出报告流程

交接时间：2026-11-26

## 0. 新 WorkBuddy 第一步

打开本工作区后，先读：

1. `HANDOFF_TO_NEW_WORKBUDDY.md`（本文件）
2. `.workbuddy/memory/MEMORY.md`
3. `.workbuddy/memory/2026-11-25.md`

可直接对新的 WorkBuddy 说：

> 请读取 `HANDOFF_TO_NEW_WORKBUDDY.md` 和 `.workbuddy/memory/MEMORY.md`，从「真实云端端到端实测」这一步继续，不要让我重复描述背景。不要要求我发送密钥。

## 1. 用户最终目标

网站访问者通过市场专员入口登录（登录仍强制每次输密码），然后：

1. 选择「上市公司模块」或「非上市公司模块」；
2. 选择「详细版」或「简版」；
3. 上传报告底稿（必传），封面图片 1–3 张（可选）；
4. 点格式按钮（`.docx` / `.pdf` / `.md` / `.html`）；
5. 网站内部自动按专家包 A/B/C/D 模式发指令给用户的特定 WorkBuddy 专家；
6. 专家返回报告正文后，按所选格式交付；访问者不需要输入任何指令。

模式映射：

- 上市公司 + 详细版 → A
- 上市公司 + 简版 → B
- 非上市公司 + 详细版 → C
- 非上市公司 + 简版 → D

版本说明文案已定稿，不要随意改动：

- 详细版：框架完整、过程充分，保留全部章节、数据和推演过程，呈现完整研究脉络。
- 简版：框架完整、重点突出，保留核心结论与关键依据，压缩推演过程，阅读更聚焦。

两版都可发给客户，不要写「内部 / 对外」场景区分。

## 2. 当前完成状态

### 前端 / 服务端

已完成并自检通过：

- 市场专员登录页保留。
- 登录后两步选择：模块 → 详细/简版。
- 会话面板内上传底稿和图片、点格式一键生成。
- 前端 `REPORT_MODES` 自动拼 A/B/C/D 指令，访客不需输入。
- 文件通道 `market-file-channel.js`：multipart 上传、会话 workspace 落盘、sha256 清单、文本/base64 注入、会话结束清理。
- `server.js` 提供 `POST/GET /api/market-agent/upload`。
- `workbuddy-agent.js` 支持 `attachFiles()` 和 `buildPromptEnvelope()`；mock prompt 保持干净。
- 一键本地启动脚本 `start-market-agent.bat` 已修好，可在关闭 WorkBuddy UI 后启动服务。

当前缓存版本：

- `css/value-agent-websdk.css?v=8`
- `js/market-agent.js?v=13`

### 交付包

最新官网发布包：

- `dist/mgc-website-20261125-1441.zip`

专家包相关产物（仍未变）：

- `dist/report-converter-fixed-20261125-1241.zip`
- `dist/report-converter-workspace-20261125-1241.zip`

专家包结论：它不是 4 个独立 skill，而是 1 个 Agent 型专家 + 1 个 skill，skill 内用 A/B/C/D 四模式路由。`SKILL.md` 的 name 已统一为 `report-converter`。

## 3. 仍未完成 / 下一步

### 3.1 凭据与发布（需要用户本人操作，不能代为索取）

用户企业旗舰版席位尚未加上。用户需要：

1. 在 CodeBuddy / WorkBuddy「API 管理 → 访问密钥 → 创建密钥」生成 Runtime API Key；
2. 填到服务端环境变量 `WORKBUDDY_API_KEY`；若走企业 OAuth，则填 `WORKBUDDY_CLIENT_ID` / `WORKBUDDY_CLIENT_SECRET`；
3. 在「发布管理 → 专家」拿到专家 Manifest ID；
4. 配置 `MARKET_WORKBUDDY_AGENT_ID`（必要）和 `MARKET_WORKBUDDY_AGENT_NAME`（可选）；
5. 本地 `.env` 改完后重启服务；线上填火山引擎控制台环境变量。

**不要要求用户把密钥发到聊天里。密钥不能进 zip。**

### 3.2 真实云端端到端实测

凭据就绪后按以下顺序验证：

1. `WORKBUDDY_MOCK=false`，重启服务；
2. 登录市场专员；
3. 非上市公司模块 + 详细版 + 上传真实底稿 → 点生成 PDF；
4. 上市公司模块 + 简版 + 上传真实底稿 → 点生成 DOCX；
5. 检查服务端诊断 trace：
   - `context.reportMode` 是否为 C / B；
   - prompt 是否包含 workspace 文件清单和底稿内容；
   - Runtime 是否真的读到 `/workspace/inputs/...`；
   - 专家是否按对应模式输出，而不是混入身家诊断话术；
6. 记录失败点和修正方案。

### 3.3 PDF 直接下载

当前 `.docx / .md / .html` 是生成后自动下载；`.pdf` 目前打开浏览器打印面板让用户「另存为 PDF」。

用户明确要求：点生成 PDF 就直接下载 PDF 文件。真实链路跑通后，若专家或服务端能返回 PDF 文件字节，应新增下载接口，替换打印面板路径。不要把这个需求忘掉。

## 4. 关键命令

本地一键启动：

- 双击项目根目录 `start-market-agent.bat`
- 打开 `http://localhost:8000/#market-agent`

常用自检（不要用完整 `npm test`，有历史遗留失败）：

```bash
node qa/check-js-syntax.mjs
node qa/check-page-structure.mjs
node qa/check-market-agent.mjs
node qa/check-market-file-channel.mjs
node qa/check-workbuddy-integration.mjs
node qa/check-report-export.mjs
node qa/check-release-build.mjs
```

出包：

```bash
npm run build:zip
```

专家包重建（用户给新的解压目录时）：

```bash
node tools/build-expert-assets.mjs "<解压后的专家包目录>"
```

## 5. 重要避坑点

- 修改 `js/*.js` 或 CSS 后，必须同步升级 `index.html` 里的 `?v=N`，否则浏览器缓存会让按钮失效。
- 本地必须通过 `http://localhost:8000/` 访问，不能 `file://` 打开 index.html。
- 市场专员每次从入口进入都必须重新输密码，不要改成免登录。
- `npm test` 会因历史遗留 cube-face 断言失败；逐项跑 `qa/check-*.mjs`。
- 云上限流必须用 `server.js` 的 `clientAddress(req)`，不要直接用 `req.socket.remoteAddress`。
- 会话存在进程内存，建议单实例；流式接口每 15s 心跳，平台超时需 ≥120s。
- Windows + 中文路径下 `fs.cpSync` 会静默不复制；`tools/build-expert-assets.mjs` 已改显式 read/write，不要改回去。
- 不要把专家包当成 4 个 skill 来改；它是一个 skill 内四模式。
- 用户很在意文案口径：两版都可给客户；简版不是缺框架，只是压缩推演过程。

## 6. 当前风险 / 未决

- 企业席位和 API Key 未就绪，真实 Runtime 未实测。
- 专家包依赖本地 Office 编辑通道、Python 包、Word COM、字体；云端 Runtime 是否具备这些能力未知。
- 专家发布可见性：用户曾问「不让公众搜到」与「网站 API 可调用」能否兼得，尚未定论。
- 直接 PDF 下载尚未实现，等真实专家返回 PDF 字节后再改。

import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { createWealthAgentService } from "../workbuddy-agent.js";
import { createDiagnosticStore } from "../wealth-agent-diagnostics.js";
import { createMarketFileChannel } from "../market-file-channel.js";
import { handleWealthAgentApi } from "../server.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = path => readFileSync(join(root, path), "utf8");

// 静态防回归：文件通道必须从前端一路接到 Runtime prompt。
const html = read("index.html");
const client = read("js/market-agent.js");
const server = read("server.js");
const agent = read("workbuddy-agent.js");
const envExample = read(".env.example");
const builder = read("tools/build-expert-assets.mjs");

assert(html.includes("js/market-agent.js?v=13"), "修改文案后必须升级 market-agent.js 缓存版本");
assert(client.includes("async function uploadAttachments"), "客户端必须实现真实附件上传");
assert(client.includes("new FormData()"), "附件上传必须使用 multipart/form-data");
assert(client.includes("form.append('sessionId'"), "上传请求必须携带会话标识");
assert(client.includes("fetch(`${API}/upload`"), "客户端必须调用市场专员上传端点");
assert(client.includes("await uploadAttachments()"), "发送提问前必须先上传附件");
assert(!/\[报告底稿：\$\{reports\.join/.test(client), "不得再把附件名拼进提问内容代替真实上传");
assert(server.includes('pathname === `${pathPrefix}/upload`'), "服务端必须提供上传端点");
assert(server.includes("fileChannel.saveFiles"), "上传端点必须把文件落到 workspace");
assert(server.includes("agentService.attachFiles"), "上传后必须把清单挂到会话");
assert(server.includes("fileChannel.deleteFiles"), "结束会话必须清理本地文件");
assert(agent.includes("async function attachFiles"), "WorkBuddy 服务必须支持会话附件");
assert(agent.includes("fileChannel.buildPromptEnvelope"), "真实 prompt 必须注入文件清单与内容");
assert(agent.includes("record.mock\n        ? text.trim()"), "演示模式不得被文件注入污染");
for (const key of [
  "MARKET_AGENT_WORKSPACE_ROOT=",
  "MARKET_AGENT_MAX_UPLOAD_BYTES=",
  "WORKBUDDY_FILE_TEXT_BYTES=",
  "WORKBUDDY_FILE_BASE64_BYTES="
]) {
  assert(envExample.includes(key), `.env.example 必须说明 ${key}`);
}
assert(builder.includes("name: ${SKILL_NAME}"), "专家包构建脚本必须统一 skill 名称");
assert(builder.includes("workspace-manifest.json"), "专家包构建脚本必须产出 workspace 清单");

/* ---------------- 端到端文件通道（mock 模式，不需要真实 API Key） ---------------- */

const tempRoot = join(tmpdir(), `mgc-file-channel-qa-${randomUUID()}`);
const env = {
  WORKBUDDY_MOCK: "true",
  WORKBUDDY_MOCK_PROFILE: "market",
  MARKET_AGENT_WORKSPACE_ROOT: tempRoot
};
const diagnostics = createDiagnosticStore();
const service = createWealthAgentService({ env, diagnostics });
const channel = createMarketFileChannel({ env });
const session = await service.createSession({
  schemaVersion: "dreamworks-market-agent-v1",
  reportType: "unlisted",
  purpose: "文件通道自检"
});

function multipartField(boundary, name, value) {
  return Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n`),
    Buffer.from(value, "utf8"),
    Buffer.from("\r\n")
  ]);
}

function multipartFile(boundary, name, filename, contentType, data) {
  return Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`),
    Buffer.isBuffer(data) ? data : Buffer.from(data, "utf8"),
    Buffer.from("\r\n")
  ]);
}

const boundary = "mgc-qa-boundary";
const reportBody = "# 测试底稿\n\n第一章：企业概况\nABCDEFG，营收 12.3 亿元。\n";
const pngBytes = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
const multipart = Buffer.concat([
  multipartField(boundary, "sessionId", session.sessionId),
  multipartFile(boundary, "report", "底稿.md", "text/markdown", reportBody),
  multipartFile(boundary, "image", "封面.png", "image/png", pngBytes),
  Buffer.from(`--${boundary}--\r\n`)
]);

const request = Readable.from([multipart]);
request.method = "POST";
request.url = "/api/market-agent/upload";
request.headers = {
  host: "dreamworks.test",
  "content-type": `multipart/form-data; boundary=${boundary}`
};
const response = {
  statusCode: 0,
  headers: {},
  body: "",
  headersSent: false,
  writableEnded: false,
  destroyed: false,
  writeHead(statusCode, headers) {
    this.statusCode = statusCode;
    this.headers = headers || {};
    this.headersSent = true;
  },
  write(chunk) {
    this.body += String(chunk);
    return true;
  },
  end(chunk = "") {
    this.body += String(chunk);
    this.writableEnded = true;
  }
};

const handled = await handleWealthAgentApi(
  request,
  response,
  "/api/market-agent/upload",
  service,
  diagnostics,
  "/api/market-agent",
  channel
);
assert.equal(handled, true, "上传端点必须由市场专员 API 接管");
assert.equal(response.statusCode, 201, "合法上传应返回 201");
const payload = JSON.parse(response.body);
assert.equal(payload.ok, true);
assert.equal(payload.files.length, 2, "一次上传应包含底稿与封面图");
assert.equal(payload.files.filter(file => file.kind === "report").length, 1);
assert.equal(payload.files.filter(file => file.kind === "image").length, 1);
assert.equal(Object.hasOwn(payload.files[0], "absolutePath"), false, "浏览器不得拿到服务端绝对路径");
assert(payload.files[0].sha256 && payload.files[0].workspacePath.startsWith("inputs/"));
assert(existsSync(join(tempRoot, "sessions", session.sessionId, "manifest.json")));

const prompt = await channel.buildPromptEnvelope("请按非上市详细版转换", channel.publicManifest(await channel.readManifest(session.sessionId)));
assert(prompt.includes("【本次会话已上传文件】"), "prompt 必须包含文件清单");
assert(prompt.includes("inputs/01-底稿.md"), "prompt 必须包含 workspace 相对路径");
assert(prompt.includes("ABCDEFG，营收 12.3 亿元"), "文本底稿正文必须注入 prompt");
assert(prompt.includes("编码：base64"), "小体积图片必须以 base64 注入");
assert(prompt.includes("不要要求用户重新上传这些文件"), "必须明确禁止让访客重传");

// 演示模式仍保持对话干净，不应把 base64 展示给用户。
const chunks = [];
await service.prompt(session.sessionId, "请开始", event => chunks.push(event));
const mockText = chunks.filter(event => event.type === "text").map(event => event.text).join("");
assert(!mockText.includes("base64"), "演示回复不得把 base64 暴露到对话区");
assert(mockText.includes("上市公司报告润览") || mockText.includes("非上市公司报告润览"));

await service.closeSession(session.sessionId);
await channel.deleteFiles(session.sessionId);
assert.equal(existsSync(join(tempRoot, "sessions", session.sessionId)), false, "结束会话后临时文件必须清理");
rmSync(tempRoot, { recursive: true, force: true });

console.log("Market agent file channel checks passed.");

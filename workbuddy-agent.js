import { randomUUID } from "node:crypto";
import { createDiagnosticStore } from "./wealth-agent-diagnostics.js";
import { createMarketFileChannel } from "./market-file-channel.js";

const DEFAULT_AGENT_ID = "agent_01M1AB3GRFAR44G0ED9RQ51WY9";
const DEFAULT_AGENT_NAME = "身家诊断专家";
const DEFAULT_API_BASE = "https://www.codebuddy.cn/v2/agentos";
const DEFAULT_TOKEN_URL = "https://copilot.tencent.com/oauth2/token";
const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_CONTEXT_BYTES = 180 * 1024;
const MAX_PROMPT_BYTES = 20 * 1024;

class WorkBuddyError extends Error {
  constructor(message, statusCode = 502, code = "WORKBUDDY_ERROR", details = undefined) {
    super(message);
    this.name = "WorkBuddyError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function parseBoolean(value, fallback = false) {
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function safeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function byteLength(value) {
  return Buffer.byteLength(typeof value === "string" ? value : JSON.stringify(value), "utf8");
}

function sanitizeProviderMessage(payload, fallback) {
  const candidate = payload?.msg || payload?.message || payload?.error?.message;
  if (typeof candidate !== "string" || !candidate.trim()) return fallback;
  return candidate.replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]").slice(0, 300);
}

function isRuntimeAuthenticationPrompt(text) {
  return typeof text === "string" &&
    /authentication required/i.test(text) &&
    /\/login/i.test(text);
}

function runtimeAuthenticationDetails(text) {
  if (!isRuntimeAuthenticationPrompt(text)) return {};
  const capture = pattern => text.match(pattern)?.[1] || null;
  return {
    authType: capture(/auth-type:([^,\s)]+)/i),
    tokenType: capture(/token-type:([^,\s)]+)/i),
    credentialLength: safeNumber(capture(/token-length:(\d+)/i), null),
    target: capture(/target:\s*([^\s)]+)/i),
    providerReference: capture(/\)\s*\(([^)]+)\)\s*$/)
  };
}

function safeHost(value) {
  try { return new URL(value).host; } catch { return "invalid-url"; }
}

function diagnosticApiPath(path) {
  return String(path)
    .replace(/\/runtimes\/[^/]+/g, "/runtimes/:runtimeId")
    .replace(/\/sessions\/[^/]+/g, "/sessions/:sessionId");
}

function extractRuntimeId(rawText, parsed) {
  const parsedId = parsed?.data?.id;
  const match = rawText.match(/"data"\s*:\s*\{\s*"id"\s*:\s*(?:"(\d+)"|(\d+))/);
  if (match) return match[1] || match[2];
  if (typeof parsedId === "string" || typeof parsedId === "number") return String(parsedId);
  return "";
}

function timeoutPromise(milliseconds, message, onTimeout) {
  let timer;
  const promise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      onTimeout?.();
      reject(new WorkBuddyError(message, 504, "WORKBUDDY_TIMEOUT"));
    }, milliseconds);
    timer.unref?.();
  });
  return { promise, clear: () => clearTimeout(timer) };
}

async function fetchHeadersWithTimeout(fetchImpl, url, options, timeoutMs, message) {
  const controller = new AbortController();
  const upstreamSignal = options.signal;
  const abortFromUpstream = () => controller.abort(upstreamSignal?.reason);
  if (upstreamSignal?.aborted) abortFromUpstream();
  else upstreamSignal?.addEventListener("abort", abortFromUpstream, { once: true });
  const timeout = timeoutPromise(timeoutMs, message, () => controller.abort());
  try {
    return await Promise.race([
      fetchImpl(url, { ...options, signal: controller.signal }),
      timeout.promise
    ]);
  } finally {
    timeout.clear();
  }
}

async function readJsonResponse(response) {
  const rawText = await response.text();
  let payload;
  try {
    payload = rawText ? JSON.parse(rawText) : {};
  } catch {
    throw new WorkBuddyError("WorkBuddy 返回了无法解析的响应。", 502, "INVALID_PROVIDER_RESPONSE");
  }
  return { payload, rawText };
}

function extractTextParts(value, depth = 0, seen = new Set()) {
  if (depth > 6 || value == null) return [];
  if (typeof value === "string") return value ? [value] : [];
  if (typeof value !== "object" || seen.has(value)) return [];
  seen.add(value);

  if (Array.isArray(value)) {
    return value.flatMap(item => extractTextParts(item, depth + 1, seen));
  }

  if (typeof value.text === "string" && value.text) return [value.text];
  const parts = [];
  for (const key of ["content", "message", "output", "parts", "delta"]) {
    if (value[key] != null) parts.push(...extractTextParts(value[key], depth + 1, seen));
  }
  return parts;
}

function processSseBlock(block, onEnvelope) {
  const data = block
    .split(/\r?\n|\r/)
    .filter(line => line.startsWith("data:"))
    .map(line => line.slice(5).trimStart())
    .join("\n")
    .trim();
  if (!data || data === "[DONE]") return;
  try {
    const payload = JSON.parse(data);
    if (Array.isArray(payload)) payload.forEach(onEnvelope);
    else onEnvelope(payload);
  } catch {
    // Ignore keep-alive or non-JSON events. ACP payloads are JSON-RPC envelopes.
  }
}

async function consumeSse(body, onEnvelope) {
  if (!body) return;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split(/\r\n\r\n|\n\n|\r\r/);
    buffer = blocks.pop() || "";
    blocks.forEach(block => processSseBlock(block, onEnvelope));
  }

  buffer += decoder.decode();
  if (buffer.trim()) processSseBlock(buffer, onEnvelope);
}

class AcpConnection {
  constructor({ url, token, fetchImpl, rpcTimeoutMs, noTextGraceMs }) {
    this.url = url;
    this.token = token;
    this.fetchImpl = fetchImpl;
    this.rpcTimeoutMs = rpcTimeoutMs;
    this.noTextGraceMs = noTextGraceMs;
    this.connectionId = "";
    this.rpcId = 0;
    this.pending = new Map();
    this.notificationAbort = null;
    this.notificationTask = null;
    this.notificationAlive = false;
    this.closed = false;
    this.activeTurn = null;
  }

  authHeaders(extra = {}) {
    return {
      Authorization: `Bearer ${this.token}`,
      ...extra
    };
  }

  emitText(value, source) {
    if (!this.activeTurn) return;
    const parts = extractTextParts(value);
    for (const text of parts) {
      if (!text) continue;
      if (isRuntimeAuthenticationPrompt(text)) {
        this.activeTurn.authRequired = true;
        this.activeTurn.authDetails = runtimeAuthenticationDetails(text);
        this.activeTurn.trace?.event("runtime.authentication_required", "error", {
          source,
          ...this.activeTurn.authDetails
        });
        continue;
      }
      this.activeTurn.textChunks += 1;
      this.activeTurn.sources.add(source);
      this.activeTurn.emit({ type: "text", text });
    }
  }

  handleEnvelope(envelope) {
    if (Array.isArray(envelope)) {
      envelope.forEach(item => this.handleEnvelope(item));
      return;
    }
    if (envelope?.data && !envelope.method && !Object.prototype.hasOwnProperty.call(envelope, "id")) {
      this.handleEnvelope(envelope.data);
      return;
    }

    if (envelope && Object.prototype.hasOwnProperty.call(envelope, "id") &&
      (Object.prototype.hasOwnProperty.call(envelope, "result") || Object.prototype.hasOwnProperty.call(envelope, "error"))) {
      const id = Number(envelope.id);
      const pending = this.pending.get(id);
      if (pending) {
        this.pending.delete(id);
        pending.clear();
        if (envelope.error) {
          pending.reject(new WorkBuddyError(
            sanitizeProviderMessage(envelope.error, "WorkBuddy ACP 请求失败。"),
            502,
            "ACP_RPC_ERROR"
          ));
        } else {
          if (pending.method === "session/prompt" && this.activeTurn?.textChunks === 0) {
            this.emitText(envelope.result, "prompt_result");
          }
          pending.resolve(envelope.result || {});
        }
      }
    }

    if (envelope?.method !== "session/update") return;
    const update = envelope.params?.update || envelope.params || {};
    const type = update.sessionUpdate || update.session_update || update.type || "unknown";
    this.activeTurn?.updateTypes.add(String(type));
    if (["agent_message_chunk", "agent_message", "assistant_message_chunk", "assistant_message"].includes(type)) {
      this.emitText(update.content ?? update.message ?? update, type);
    } else if (type === "agent_thought_chunk") {
      this.activeTurn?.emit({ type: "status", text: "专家正在推演诊断结论…" });
    } else if (type === "tool_call") {
      this.activeTurn?.emit({ type: "status", text: update.title || "专家正在调用诊断工具…" });
    } else if (type === "tool_call_update") {
      const label = update.status === "failed" ? "工具调用未完成" : "诊断工具已完成";
      this.activeTurn?.emit({ type: "status", text: label });
    } else if (type === "plan") {
      this.activeTurn?.emit({ type: "status", text: "专家正在形成诊断步骤…" });
    }
  }

  createPending(id, method, timeoutMs = this.rpcTimeoutMs) {
    let timer;
    const promise = new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new WorkBuddyError("等待 WorkBuddy ACP 响应超时。", 504, "ACP_TIMEOUT"));
      }, timeoutMs);
      timer.unref?.();
      this.pending.set(id, { method, resolve, reject, clear: () => clearTimeout(timer) });
    });
    return promise;
  }

  async connect(trace) {
    const finish = trace?.span("acp.notification.connect", {
      endpointHost: safeHost(this.url),
      credentialLength: this.token.length
    });
    this.notificationAbort?.abort();
    const notificationAbort = new AbortController();
    this.notificationAbort = notificationAbort;
    this.closed = false;
    let response;
    try {
      response = await fetchHeadersWithTimeout(
        this.fetchImpl,
        this.url,
        {
          method: "GET",
          headers: this.authHeaders({ Accept: "text/event-stream", "Cache-Control": "no-cache" }),
          signal: notificationAbort.signal
        },
        20_000,
        "连接 WorkBuddy ACP 通知通道超时。"
      );
    } catch (error) {
      finish?.("error", { errorCode: error.code || "FETCH_ERROR", message: error.message });
      throw error;
    }
    if (!response.ok) {
      finish?.("error", { httpStatus: response.status });
      throw new WorkBuddyError(`WorkBuddy ACP 连接失败（HTTP ${response.status}）。`, 502, "ACP_CONNECT_FAILED");
    }
    this.connectionId = response.headers.get("Acp-Connection-Id") || response.headers.get("acp-connection-id") || "";
    if (!this.connectionId) {
      finish?.("error", { httpStatus: response.status, connectionIdPresent: false });
      throw new WorkBuddyError("WorkBuddy ACP 未返回连接标识。", 502, "ACP_CONNECTION_ID_MISSING");
    }
    finish?.("success", { httpStatus: response.status, connectionIdPresent: true });
    this.notificationAlive = true;
    this.notificationTask = consumeSse(response.body, envelope => this.handleEnvelope(envelope))
      .catch(error => {
        if (error?.name !== "AbortError") {
          for (const pending of this.pending.values()) {
            pending.clear();
            pending.reject(new WorkBuddyError("WorkBuddy ACP 长连接已中断。", 502, "ACP_DISCONNECTED"));
          }
          this.pending.clear();
        }
      })
      .finally(() => {
        if (this.notificationAbort === notificationAbort) this.notificationAlive = false;
      });
  }

  async rpc(method, params, timeoutMs = this.rpcTimeoutMs, trace) {
    const finishTransport = trace?.span("acp.rpc.transport", { method, timeoutMs });
    const id = ++this.rpcId;
    const pending = this.createPending(id, method, timeoutMs);
    let response;
    try {
      response = await fetchHeadersWithTimeout(
        this.fetchImpl,
        this.url,
        {
          method: "POST",
          headers: this.authHeaders({
            "Acp-Connection-Id": this.connectionId,
            "Content-Type": "application/json",
            Accept: "application/json, text/event-stream"
          }),
          body: JSON.stringify({ jsonrpc: "2.0", id, method, params })
        },
        20_000,
        `发送 ${method} 请求超时。`
      );
    } catch (error) {
      finishTransport?.("error", { errorCode: error.code || "FETCH_ERROR", message: error.message });
      const waiting = this.pending.get(id);
      waiting?.clear();
      waiting?.reject(error);
      this.pending.delete(id);
      return pending;
    }

    if (![200, 202].includes(response.status)) {
      finishTransport?.("error", { httpStatus: response.status });
      const error = new WorkBuddyError(`WorkBuddy ACP ${method} 失败（HTTP ${response.status}）。`, 502, "ACP_HTTP_ERROR");
      const waiting = this.pending.get(id);
      waiting?.clear();
      waiting?.reject(error);
      this.pending.delete(id);
      return pending;
    }

    const contentType = response.headers.get("content-type") || "";
    finishTransport?.("success", {
      httpStatus: response.status,
      contentType: contentType.split(";")[0] || "unspecified"
    });
    if (response.status === 200 && contentType.includes("text/event-stream")) {
      void consumeSse(response.body, envelope => this.handleEnvelope(envelope)).catch(error => {
        const waiting = this.pending.get(id);
        if (waiting) {
          waiting.clear();
          this.pending.delete(id);
          waiting.reject(error);
        }
      });
    } else if (response.status === 200 && contentType.includes("application/json")) {
      const { payload } = await readJsonResponse(response);
      this.handleEnvelope(payload);
    }

    return pending;
  }

  async initializeAndLoad(sessionId, trace) {
    const finishInitialize = trace?.span("acp.initialize");
    try {
      await this.rpc("initialize", {
        protocolVersion: 1,
        clientCapabilities: { fs: { readTextFile: false, writeTextFile: false } },
        clientInfo: { name: "dreamworks-succession-ecosystem", version: "1.0.0" }
      }, this.rpcTimeoutMs, trace);
      finishInitialize?.("success");
    } catch (error) {
      finishInitialize?.("error", { errorCode: error.code, message: error.message });
      throw error;
    }

    const finishLoad = trace?.span("acp.session.load", { sessionIdPresent: Boolean(sessionId) });
    try {
      await this.rpc("session/load", { sessionId, cwd: "/workspace", mcpServers: [] }, 45_000, trace);
      finishLoad?.("success");
      return sessionId;
    } catch (error) {
      finishLoad?.("error", { errorCode: error.code, message: error.message });
      if (error.code !== "ACP_RPC_ERROR" && error.code !== "ACP_TIMEOUT") throw error;
      const finishNew = trace?.span("acp.session.new", { fallbackFromLoad: true });
      const result = await this.rpc("session/new", { cwd: "/workspace", mcpServers: [] }, 45_000, trace);
      finishNew?.("success", { sessionIdPresent: Boolean(result.sessionId || result.id) });
      return String(result.sessionId || result.id || sessionId);
    }
  }

  async setMode(sessionId, mode, trace) {
    if (!mode || mode === "default") return;
    try {
      await this.rpc("session/set_mode", { sessionId, modeId: mode }, 20_000, trace);
      trace?.event("acp.session.mode", "success", { mode });
    } catch (error) {
      trace?.event("acp.session.mode", "warning", { mode, errorCode: error.code });
      // Optional compatibility setting. The diagnostic chat still works in default mode.
    }
  }

  async prompt(sessionId, text, emit, trace) {
    if (this.activeTurn) {
      throw new WorkBuddyError("上一轮专家诊断尚未结束，请稍候。", 409, "PROMPT_IN_PROGRESS");
    }
    let activeSessionId = sessionId;
    if (!this.notificationAlive && !this.closed) {
      trace?.event("acp.reconnect", "start", { reason: "notification_channel_inactive" });
      await this.connect(trace);
      activeSessionId = await this.initializeAndLoad(sessionId, trace);
    }
    const turn = {
      emit,
      textChunks: 0,
      sources: new Set(),
      updateTypes: new Set(),
      authRequired: false,
      authDetails: null,
      trace
    };
    this.activeTurn = turn;
    try {
      const result = await this.rpc(
        "session/prompt",
        { sessionId: activeSessionId, prompt: [{ type: "text", text }] },
        180_000,
        trace
      );
      if (turn.authRequired) {
        throw new WorkBuddyError(
          "WorkBuddy Runtime 内部认证未完成。无需在对话中输入 /login；请由服务端注入中国版环境和企业 OAuth 令牌后重新创建会话。",
          502,
          "RUNTIME_AUTH_REQUIRED",
          turn.authDetails
        );
      }
      if (turn.textChunks === 0 && this.noTextGraceMs > 0) {
        await new Promise(resolve => setTimeout(resolve, this.noTextGraceMs));
      }
      if (turn.textChunks === 0) {
        const received = [...turn.updateTypes].slice(0, 8).join("、") || "无 session/update 通知";
        trace?.event("acp.prompt.no_text", "error", {
          receivedUpdateTypes: [...turn.updateTypes].slice(0, 8),
          notificationAlive: this.notificationAlive
        });
        this.notificationAbort?.abort();
        this.notificationAlive = false;
        throw new WorkBuddyError(
          `WorkBuddy 已结束本轮，但未返回可显示文本（收到：${received}）。系统将在下一次提问时重连专家会话。`,
          502,
          "ACP_NO_TEXT"
        );
      }
      trace?.event("acp.prompt.completed", "success", {
        stopReason: result.stopReason || "end_turn",
        textChunks: turn.textChunks,
        textSources: [...turn.sources],
        updateTypes: [...turn.updateTypes].slice(0, 12)
      });
      return { stopReason: result.stopReason || "end_turn" };
    } finally {
      if (this.activeTurn === turn) this.activeTurn = null;
    }
  }

  async close() {
    this.closed = true;
    this.notificationAlive = false;
    this.notificationAbort?.abort();
    if (!this.connectionId) return;
    try {
      await fetchHeadersWithTimeout(
        this.fetchImpl,
        this.url,
        {
          method: "DELETE",
          headers: this.authHeaders({ "Acp-Connection-Id": this.connectionId })
        },
        8_000,
        "关闭 WorkBuddy ACP 连接超时。"
      );
    } catch {
      // Runtime cleanup below remains the authoritative release operation.
    }
  }
}

function buildMockReply(prompt, turn, profile, context) {
  if (profile === "market") return buildMarketMockReply(prompt, turn, context);
  if (turn === 1 || prompt.includes("诊断数据摘要")) {
    return [
      "已接收本次五步身家诊断摘要。我会把它作为顾问初筛材料，而不是重新让您填写一遍。\n\n",
      "初步判断应先核对三件事：第一，要求回报率的三项来源是否完整；第二，未来刚性支出与可投入本金是否匹配；第三，低于要求回报率的资产是否同时承担流动性、使用或情感功能。\n\n",
      "为了进入深度诊断，请先补充一个当前摘要中看不到的信息：未来三年内，是否存在未录入的企业增资、税务、医疗或家族成员安排等大额刚性支出？"
    ];
  }
  return [
    "我已经记录这项补充。下一步会把它放回现金流时间轴，复核要求回报率与流动性安全边界，",
    "再按“先保支付能力、再修复低效资产、最后讨论长期传承结构”的顺序形成顾问复核清单。"
  ];
}

// 市场专员的演示回复：只讲市场研究口径，绝不混入身家诊断话术。
// 本地演示时用来验证「提问 → 回答 → 导出报告」整条链路。
function buildMarketMockReply(prompt, turn, context) {
  const reportType = context && context.reportType === "unlisted"
    ? "非上市公司报告润览"
    : "上市公司报告润览";
  const question = String(prompt || "")
    .replace(/\[已上传附件：[^\]]*\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);

  if (turn <= 1) {
    return [
      "当前是本地演示模式，尚未接入真实 WorkBuddy 专家。下面给出的是用于验证导出流程的示例结构，接入后由专家按所选口径输出完整底稿。\n\n",
      question ? `已记录你的需求：${question}\n\n` : "",
      `一、标的与赛道概览（${reportType}）\n示例：主营业务、所处环节、下游需求与竞争格局。\n\n`,
      "二、商业模式与收入结构\n示例：产品与客户构成、区域分布、定价方式与议价能力。\n\n",
      "三、财务质量与关键指标\n示例：收入增速、毛利率、经营现金流与应收账款周转。\n\n",
      "四、估值与同业对比\n示例：可比公司区间、当前折溢价与隐含假设。\n\n",
      "五、核心风险与证据缺口\n示例：客户集中度、政策变动、尚未取得的原始材料。\n\n",
      "六、下一步深研任务清单\n示例：调取近三年年报、访谈渠道方、核对产能与在手订单。\n\n",
      "如需真实输出，请把 WORKBUDDY_MOCK 设为 false 并配置市场专员专家的 Manifest ID。"
    ].join("");
  }
  return [
    question ? `已记录这条补充：${question}\n\n` : "已记录这条补充。\n\n",
    "下一步会按「先校验证据、再给结论」的顺序更新底稿：先把新增信息落到对应章节，再重算关键指标，",
    "最后把仍未闭合的信息缺口单列成待办，避免用推测填满结论。"
  ].join("");
}

export function createWealthAgentService({
  env = process.env,
  fetchImpl = globalThis.fetch,
  diagnostics = createDiagnosticStore()
} = {}) {
  const workbuddyApiKey = env.WORKBUDDY_API_KEY || "";
  const codebuddyApiKey = env.CODEBUDDY_API_KEY || "";
  const config = {
    apiKey: workbuddyApiKey || codebuddyApiKey,
    credentialSource: workbuddyApiKey ? "WORKBUDDY_API_KEY" : codebuddyApiKey ? "CODEBUDDY_API_KEY" : "none",
    credentialConflict: Boolean(workbuddyApiKey && codebuddyApiKey && workbuddyApiKey !== codebuddyApiKey),
    workbuddyCredentialLength: workbuddyApiKey.length,
    codebuddyCredentialLength: codebuddyApiKey.length,
    clientId: env.WORKBUDDY_CLIENT_ID || "",
    clientSecret: env.WORKBUDDY_CLIENT_SECRET || "",
    tokenUrl: env.WORKBUDDY_TOKEN_URL || DEFAULT_TOKEN_URL,
    oauthScope: env.WORKBUDDY_OAUTH_SCOPE || "",
    apiBase: (env.WORKBUDDY_API_BASE || DEFAULT_API_BASE).replace(/\/$/, ""),
    sourceApp: env.WORKBUDDY_SOURCE_APP || "dreamworks-succession-main",
    internetEnvironment: env.WORKBUDDY_INTERNET_ENVIRONMENT || "internal",
    agentId: env.WORKBUDDY_AGENT_ID || DEFAULT_AGENT_ID,
    agentName: env.WORKBUDDY_AGENT_NAME || DEFAULT_AGENT_NAME,
    mock: parseBoolean(env.WORKBUDDY_MOCK),
    // 本地演示时的模拟回复口径：wealth = 身家诊断，market = 市场专员
    mockProfile: (env.WORKBUDDY_MOCK_PROFILE || "wealth").trim().toLowerCase(),
    acpMode: env.WORKBUDDY_ACP_MODE || "default",
    runtimeTimeoutMs: safeNumber(env.WORKBUDDY_RUNTIME_TIMEOUT_MS, 50_000),
    rpcTimeoutMs: safeNumber(env.WORKBUDDY_RPC_TIMEOUT_MS, 60_000),
    noTextGraceMs: safeNumber(env.WORKBUDDY_NO_TEXT_GRACE_MS, 1_200),
    sessionTtlMs: safeNumber(env.WORKBUDDY_SESSION_TTL_MS, SESSION_TTL_MS),
    // 市场专员会把底稿正文/base64 注入 prompt，默认放宽到 4MB；身家诊断仍保持 20KB。
    maxPromptBytes: safeNumber(
      env.WORKBUDDY_MAX_PROMPT_BYTES,
      String(env.WORKBUDDY_MOCK_PROFILE || "wealth").trim().toLowerCase() === "market" ? 4 * 1024 * 1024 : MAX_PROMPT_BYTES
    )
  };
  const fileChannel = createMarketFileChannel({ env });
  const sessions = new Map();
  let oauthToken = null;

  function diagnosticMetadata() {
    return {
      integrationRevision: "runtime-oauth-diagnostics-v5",
      nodeVersion: process.version,
      mode: config.mock ? "mock" : "live",
      authMode: authMode(),
      agentId: config.agentId,
      agentName: config.agentName,
      sourceApp: config.sourceApp,
      apiBaseHost: safeHost(config.apiBase),
      tokenEndpointHost: safeHost(config.tokenUrl),
      internetEnvironment: config.internetEnvironment,
      credentialSource: config.credentialSource,
      credentialLength: config.apiKey.length,
      credentialConflict: config.credentialConflict,
      workbuddyCredentialLength: config.workbuddyCredentialLength,
      codebuddyCredentialLength: config.codebuddyCredentialLength,
      oauthClientConfigured: Boolean(config.clientId && config.clientSecret)
    };
  }

  function authMode() {
    if (config.mock) return "mock";
    if (config.clientId && config.clientSecret) return "oauth";
    if (config.apiKey) return "api-key";
    return "none";
  }

  function status() {
    const currentAuthMode = authMode();
    const runtimeSecretConfigured = Boolean(config.apiKey);
    return {
      configured: currentAuthMode !== "none" && (config.mock || runtimeSecretConfigured),
      mode: config.mock ? "mock" : "live",
      authMode: currentAuthMode,
      runtimeSecretConfigured,
      credentialDiagnostics: {
        source: config.credentialSource,
        length: config.apiKey.length,
        duplicateConflict: config.credentialConflict,
        workbuddyLength: config.workbuddyCredentialLength,
        codebuddyLength: config.codebuddyCredentialLength
      },
      runtimeNetworkEnvironment: config.internetEnvironment,
      integrationRevision: "runtime-oauth-diagnostics-v5",
      agentId: config.agentId,
      agentName: config.agentName,
      sourceApp: config.sourceApp
    };
  }

  function assertConfigured() {
    if (authMode() === "none") {
      throw new WorkBuddyError(
        "AI 专家尚未配置，请设置企业 OAuth 凭据或 WORKBUDDY_API_KEY。",
        503,
        "NOT_CONFIGURED"
      );
    }
    if (!config.mock && !config.apiKey) {
      throw new WorkBuddyError(
        `${config.agentName} Runtime 缺少必需的 WORKBUDDY_API_KEY。`,
        503,
        "RUNTIME_SECRET_NOT_CONFIGURED"
      );
    }
  }

  async function getBearerToken({ forceRefresh = false, trace } = {}) {
    if (authMode() === "api-key") return config.apiKey;
    if (authMode() !== "oauth") {
      throw new WorkBuddyError("缺少 WorkBuddy 认证凭据。", 503, "NOT_CONFIGURED");
    }
    if (!forceRefresh && oauthToken && oauthToken.expiresAt > Date.now() + 60_000) {
      trace?.event("oauth.token.cache", "success", {
        cacheHit: true,
        expiresInMs: oauthToken.expiresAt - Date.now()
      });
      return oauthToken.value;
    }

    const finish = trace?.span("oauth.token.request", {
      endpointHost: safeHost(config.tokenUrl),
      grantType: "client_credentials",
      clientIdConfigured: Boolean(config.clientId),
      clientSecretConfigured: Boolean(config.clientSecret),
      forceRefresh
    });

    const form = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: config.clientSecret
    });
    if (config.oauthScope) form.set("scope", config.oauthScope);
    let response;
    try {
      response = await fetchHeadersWithTimeout(
        fetchImpl,
        config.tokenUrl,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json"
          },
          body: form.toString()
        },
        20_000,
        "获取 CodeBuddy 企业访问令牌超时。"
      );
    } catch (error) {
      finish?.("error", { errorCode: error.code || "FETCH_ERROR", message: error.message });
      throw error;
    }
    let payload;
    try {
      ({ payload } = await readJsonResponse(response));
    } catch (error) {
      finish?.("error", { httpStatus: response.status, errorCode: error.code, message: error.message });
      throw error;
    }
    if (!response.ok || typeof payload.access_token !== "string" || !payload.access_token) {
      finish?.("error", {
        httpStatus: response.status,
        providerCode: payload.code || payload.error || null,
        providerMessage: sanitizeProviderMessage(payload, "OAuth token response did not contain access_token")
      });
      throw new WorkBuddyError(
        sanitizeProviderMessage(payload, "CodeBuddy 企业 OAuth 认证失败，请检查 Client ID 和 Client Secret。"),
        502,
        "OAUTH_TOKEN_ERROR"
      );
    }
    const expiresIn = Math.max(120, safeNumber(payload.expires_in, 3600));
    oauthToken = {
      value: payload.access_token,
      expiresAt: Date.now() + expiresIn * 1000
    };
    finish?.("success", {
      httpStatus: response.status,
      expiresInSeconds: expiresIn,
      credentialLength: payload.access_token.length
    });
    return oauthToken.value;
  }

  async function apiRequest(path, options = {}, allowAuthRetry = true, trace) {
    const bearerToken = await getBearerToken({ trace });
    const method = options.method || "GET";
    const safePath = diagnosticApiPath(path);
    const finish = trace?.span("workbuddy.api.request", {
      method,
      path: safePath,
      endpointHost: safeHost(config.apiBase),
      authMode: authMode()
    });
    let response;
    try {
      response = await fetchHeadersWithTimeout(
        fetchImpl,
        `${config.apiBase}${path}`,
        {
          ...options,
          headers: {
            Authorization: `Bearer ${bearerToken}`,
            "X-Source-App": config.sourceApp,
            "Content-Type": "application/json",
            ...(options.headers || {})
          }
        },
        20_000,
        "连接 WorkBuddy Runtime API 超时。"
      );
    } catch (error) {
      finish?.("error", { errorCode: error.code || "FETCH_ERROR", message: error.message });
      throw error;
    }
    if (response.status === 401 && authMode() === "oauth" && allowAuthRetry) {
      finish?.("warning", { httpStatus: 401, action: "refresh_oauth_and_retry" });
      oauthToken = null;
      await getBearerToken({ forceRefresh: true, trace });
      return apiRequest(path, options, false, trace);
    }
    let payload;
    let rawText;
    try {
      ({ payload, rawText } = await readJsonResponse(response));
    } catch (error) {
      finish?.("error", { httpStatus: response.status, errorCode: error.code, message: error.message });
      throw error;
    }
    if (!response.ok || (payload.code != null && payload.code !== 0)) {
      finish?.("error", {
        httpStatus: response.status,
        providerCode: payload.code ?? null,
        providerRequestId: payload.requestId || null,
        providerMessage: sanitizeProviderMessage(payload, "Runtime API failure")
      });
      throw new WorkBuddyError(
        sanitizeProviderMessage(payload, `WorkBuddy Runtime API 请求失败（HTTP ${response.status}）。`),
        response.status === 401 || response.status === 403 ? 502 : 502,
        "RUNTIME_API_ERROR",
        {
          method,
          path: safePath,
          httpStatus: response.status,
          providerCode: payload.code ?? null,
          providerRequestId: payload.requestId || null
        }
      );
    }
    finish?.("success", {
      httpStatus: response.status,
      providerCode: payload.code ?? 0,
      providerRequestId: payload.requestId || null
    });
    return { data: payload.data || {}, rawText };
  }

  async function waitForRuntime(runtimeId, initialData, trace) {
    let runtime = initialData;
    const deadline = Date.now() + config.runtimeTimeoutMs;
    let attempts = 0;
    while (runtime?.status !== "RUNNING") {
      attempts += 1;
      trace?.event("runtime.status", "info", { status: runtime?.status || "unknown", pollAttempt: attempts });
      if (runtime?.status === "FAILED") {
        throw new WorkBuddyError("WorkBuddy Runtime 初始化失败。", 502, "RUNTIME_FAILED");
      }
      if (Date.now() >= deadline) {
        throw new WorkBuddyError("WorkBuddy Runtime 仍在初始化，请稍后重试。", 504, "RUNTIME_START_TIMEOUT");
      }
      await new Promise(resolve => setTimeout(resolve, 1_200));
      runtime = (await apiRequest(`/runtimes/${encodeURIComponent(runtimeId)}`, { method: "GET" }, true, trace)).data;
    }
    trace?.event("runtime.status", "success", { status: "RUNNING", pollAttempts: attempts });
    return runtime;
  }

  async function createLiveSession(trace) {
    trace?.event("runtime.configuration", config.credentialConflict ? "warning" : "info", {
      credentialSource: config.credentialSource,
      credentialLength: config.apiKey.length,
      duplicateCredentialConflict: config.credentialConflict,
      workbuddyCredentialLength: config.workbuddyCredentialLength,
      codebuddyCredentialLength: config.codebuddyCredentialLength,
      internetEnvironment: config.internetEnvironment,
      agentId: config.agentId,
      sourceApp: config.sourceApp
    });
    const runtimeAuthToken = authMode() === "oauth" ? await getBearerToken({ trace }) : "";
    const manifest = {
      id: config.agentId,
      name: config.agentName,
      manifestVersion: "1.0",
      useWorkspaceRoot: true
    };
    // OAuth authenticates the web service to the Runtime control plane, while
    // the published expert requires CODEBUDDY_API_KEY inside its private sandbox.
    manifest.secrets = [{ key: "CODEBUDDY_API_KEY", value: config.apiKey }];
    if (runtimeAuthToken) {
      manifest.secrets.push({ key: "CODEBUDDY_AUTH_TOKEN", value: runtimeAuthToken });
    }
    manifest.envs = [
      { key: "CODEBUDDY_INTERNET_ENVIRONMENT", value: config.internetEnvironment }
    ];
    const created = await apiRequest("/runtimes", {
      method: "POST",
      body: JSON.stringify({
        runtimeName: `dreamworks-wealth-${Date.now()}-${randomUUID().slice(0, 8)}`,
        visibility: "PRIVATE",
        agentManifest: manifest,
        metadata: { source: "wealth-diagnosis", experience: "main-test" }
      })
    }, true, trace);
    const runtimeId = extractRuntimeId(created.rawText, { data: created.data });
    if (!runtimeId) throw new WorkBuddyError("WorkBuddy 未返回 Runtime ID。", 502, "RUNTIME_ID_MISSING");
    trace?.event("runtime.created", "success", {
      runtimeIdPresent: true,
      initialStatus: created.data?.status || "unknown"
    });
    const runtime = await waitForRuntime(runtimeId, created.data, trace);
    const acpLink = runtime?.links?.acpLink;
    if (!acpLink?.url || !acpLink?.token) {
      throw new WorkBuddyError("WorkBuddy Runtime 已启动，但未返回 ACP 连接信息。", 502, "ACP_LINK_MISSING");
    }
    const acp = new AcpConnection({
      url: acpLink.url,
      token: acpLink.token,
      fetchImpl,
      rpcTimeoutMs: config.rpcTimeoutMs,
      noTextGraceMs: config.noTextGraceMs
    });
    await acp.connect(trace);
    const acpSessionId = await acp.initializeAndLoad(runtimeId, trace);
    await acp.setMode(acpSessionId, config.acpMode, trace);
    return { runtimeId, acpSessionId, acp };
  }

  async function createSession(context, suppliedTrace) {
    const trace = suppliedTrace || diagnostics.start("wealth-agent.session.create", diagnosticMetadata());
    const ownsTrace = !suppliedTrace;
    try {
      assertConfigured();
      if (!context || typeof context !== "object" || Array.isArray(context)) {
        throw new WorkBuddyError("缺少可供专家分析的会话上下文。", 400, "INVALID_CONTEXT");
      }
      const contextBytes = byteLength(context);
      trace.event("diagnosis.context.validated", "success", {
        byteLength: contextBytes,
        schemaVersion: context.schemaVersion || "unspecified",
        namesRemoved: context.privacy?.namesRemoved ?? context.namesRemoved ?? null
      });
      if (contextBytes > MAX_CONTEXT_BYTES) {
        throw new WorkBuddyError("会话上下文过大，请精简后重试。", 413, "CONTEXT_TOO_LARGE", {
          byteLength: contextBytes,
          limitBytes: MAX_CONTEXT_BYTES
        });
      }
      const publicId = randomUUID();
      const record = config.mock
        ? { publicId, mock: true, turn: 0, createdAt: Date.now(), lastUsedAt: Date.now(), context }
        : { publicId, ...(await createLiveSession(trace)), createdAt: Date.now(), lastUsedAt: Date.now(), context };
      record.files = [];
      sessions.set(publicId, record);
      trace.event("session.registered", "success", {
        publicSessionIdPresent: true,
        runtimeIdPresent: Boolean(record.runtimeId),
        mode: config.mock ? "mock" : "live"
      });
      if (ownsTrace) trace.finish("success");
      return { sessionId: publicId, agentName: config.agentName, mode: config.mock ? "mock" : "live" };
    } catch (error) {
      if (ownsTrace) trace.fail(error);
      throw error;
    }
  }

  // 上传端点把文件清单交给会话记录；prompt 时再组装成专家可读的文本。
  async function attachFiles(publicId, manifest, suppliedTrace) {
    const trace = suppliedTrace || diagnostics.start("wealth-agent.session.attach-files", {
      ...diagnosticMetadata(),
      publicSessionIdPresent: Boolean(publicId)
    });
    const ownsTrace = !suppliedTrace;
    try {
      const record = sessions.get(publicId);
      if (!record) throw new WorkBuddyError("专家会话已过期，请重新进入。", 404, "SESSION_NOT_FOUND");
      record.files = Array.isArray(manifest?.files) ? manifest.files : [];
      record.lastUsedAt = Date.now();
      trace.event("session.files.attached", "success", { fileCount: record.files.length });
      if (ownsTrace) trace.finish("success");
      return { ok: true, fileCount: record.files.length };
    } catch (error) {
      if (ownsTrace) trace.fail(error);
      throw error;
    }
  }

  async function prompt(publicId, text, emit, suppliedTrace) {
    const trace = suppliedTrace || diagnostics.start("wealth-agent.session.prompt", {
      ...diagnosticMetadata(),
      publicSessionIdPresent: Boolean(publicId)
    });
    const ownsTrace = !suppliedTrace;
    try {
      const record = sessions.get(publicId);
      if (!record) throw new WorkBuddyError("专家会话已过期，请重新进入。", 404, "SESSION_NOT_FOUND");
      if (typeof text !== "string" || !text.trim()) {
        throw new WorkBuddyError("请输入要咨询的问题。", 400, "EMPTY_PROMPT");
      }
      // 演示模式保持对话干净；真实专家必须收到 workspace 清单与文件内容。
      const outgoing = record.mock
        ? text.trim()
        : await fileChannel.buildPromptEnvelope(text.trim(), {
          sessionId: publicId,
          workspace: "/workspace",
          files: record.files || []
        });
      const promptBytes = byteLength(outgoing);
      if (promptBytes > config.maxPromptBytes) {
        throw new WorkBuddyError("本次输入与附件内容过大，请精简问题或分批上传底稿。", 413, "PROMPT_TOO_LARGE", {
          byteLength: promptBytes,
          limitBytes: config.maxPromptBytes
        });
      }
      trace.event("prompt.validated", "success", {
        byteLength: promptBytes,
        fileCount: (record.files || []).length,
        mock: Boolean(record.mock),
        runtimeIdPresent: Boolean(record.runtimeId)
      });
      record.lastUsedAt = Date.now();
      let result;
      if (record.mock) {
        record.turn += 1;
        const chunks = buildMockReply(text, record.turn, config.mockProfile, record.context);
        emit({ type: "status", text: `${config.agentName}正在分析…` });
        for (const chunk of chunks) {
          await new Promise(resolve => setTimeout(resolve, 12));
          emit({ type: "text", text: chunk });
        }
        trace.event("mock.prompt.completed", "success", { turn: record.turn, textChunks: chunks.length });
        result = { stopReason: "end_turn" };
      } else {
        result = await record.acp.prompt(record.acpSessionId, outgoing, emit, trace);
      }
      if (ownsTrace) trace.finish("success", { stopReason: result.stopReason || "end_turn" });
      return result;
    } catch (error) {
      if (ownsTrace) trace.fail(error);
      throw error;
    }
  }

  async function closeSession(publicId, suppliedTrace) {
    const trace = suppliedTrace || diagnostics.start("wealth-agent.session.close", diagnosticMetadata());
    const ownsTrace = !suppliedTrace;
    try {
      const record = sessions.get(publicId);
      if (!record) {
        trace.event("session.lookup", "warning", { found: false });
        if (ownsTrace) trace.finish("success", { alreadyClosed: true });
        return false;
      }
      sessions.delete(publicId);
      trace.event("session.lookup", "success", { found: true, mock: Boolean(record.mock) });
      if (record.mock) {
        if (ownsTrace) trace.finish("success");
        return true;
      }
      await record.acp.close();
      try {
        await apiRequest(`/runtimes/${encodeURIComponent(record.runtimeId)}/delete`, {
          method: "POST",
          body: "{}"
        }, true, trace);
        trace.event("runtime.deleted", "success");
      } catch (error) {
        trace.event("runtime.deleted", "warning", { errorCode: error.code, message: error.message });
        // Session is already inaccessible locally. Platform-side TTL remains a fallback.
      }
      if (ownsTrace) trace.finish("success");
      return true;
    } catch (error) {
      if (ownsTrace) trace.fail(error);
      throw error;
    }
  }

  async function cleanupExpired() {
    const expired = [...sessions.values()]
      .filter(record => Date.now() - record.lastUsedAt > config.sessionTtlMs)
      .map(record => record.publicId);
    await Promise.allSettled(expired.map(closeSession));
  }

  const cleanupTimer = setInterval(() => void cleanupExpired(), 5 * 60 * 1000);
  cleanupTimer.unref?.();

  return { status, createSession, attachFiles, prompt, closeSession, cleanupExpired, WorkBuddyError };
}

export { WorkBuddyError };

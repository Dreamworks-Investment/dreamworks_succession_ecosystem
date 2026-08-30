import { randomUUID } from "node:crypto";

const DEFAULT_AGENT_ID = "agent_01M1AB3GRFAR44G0ED9RQ51WY9";
const DEFAULT_AGENT_NAME = "身家诊断专家";
const DEFAULT_API_BASE = "https://www.codebuddy.cn/v2/agentos";
const DEFAULT_TOKEN_URL = "https://copilot.tencent.com/oauth2/token";
const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_CONTEXT_BYTES = 180 * 1024;
const MAX_PROMPT_BYTES = 20 * 1024;

class WorkBuddyError extends Error {
  constructor(message, statusCode = 502, code = "WORKBUDDY_ERROR") {
    super(message);
    this.name = "WorkBuddyError";
    this.statusCode = statusCode;
    this.code = code;
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

async function consumeSse(body, onEnvelope) {
  if (!body) return;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() || "";

    for (const block of blocks) {
      const data = block
        .split("\n")
        .filter(line => line.startsWith("data:"))
        .map(line => line.slice(5).trim())
        .join("\n")
        .trim();
      if (!data || data === "[DONE]") continue;
      try {
        onEnvelope(JSON.parse(data));
      } catch {
        // Ignore keep-alive or non-JSON events. ACP payloads are JSON-RPC envelopes.
      }
    }
  }
}

class AcpConnection {
  constructor({ url, token, fetchImpl, rpcTimeoutMs }) {
    this.url = url;
    this.token = token;
    this.fetchImpl = fetchImpl;
    this.rpcTimeoutMs = rpcTimeoutMs;
    this.connectionId = "";
    this.rpcId = 0;
    this.pending = new Map();
    this.notificationAbort = null;
    this.notificationTask = null;
    this.activeEmit = null;
  }

  authHeaders(extra = {}) {
    return {
      Authorization: `Bearer ${this.token}`,
      ...extra
    };
  }

  handleEnvelope(envelope) {
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
          pending.resolve(envelope.result || {});
        }
      }
    }

    if (envelope?.method !== "session/update") return;
    const update = envelope.params?.update || {};
    const type = update.sessionUpdate;
    if (type === "agent_message_chunk") {
      const text = update.content?.text;
      if (typeof text === "string" && text) this.activeEmit?.({ type: "text", text });
    } else if (type === "tool_call") {
      this.activeEmit?.({ type: "status", text: update.title || "专家正在调用诊断工具…" });
    } else if (type === "tool_call_update") {
      const label = update.status === "failed" ? "工具调用未完成" : "诊断工具已完成";
      this.activeEmit?.({ type: "status", text: label });
    } else if (type === "plan") {
      this.activeEmit?.({ type: "status", text: "专家正在形成诊断步骤…" });
    }
  }

  createPending(id, timeoutMs = this.rpcTimeoutMs) {
    let timer;
    const promise = new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new WorkBuddyError("等待 WorkBuddy ACP 响应超时。", 504, "ACP_TIMEOUT"));
      }, timeoutMs);
      timer.unref?.();
      this.pending.set(id, { resolve, reject, clear: () => clearTimeout(timer) });
    });
    return promise;
  }

  async connect() {
    this.notificationAbort = new AbortController();
    const response = await fetchHeadersWithTimeout(
      this.fetchImpl,
      this.url,
      {
        method: "GET",
        headers: this.authHeaders({ Accept: "text/event-stream", "Cache-Control": "no-cache" }),
        signal: this.notificationAbort.signal
      },
      20_000,
      "连接 WorkBuddy ACP 通知通道超时。"
    );
    if (!response.ok) {
      throw new WorkBuddyError(`WorkBuddy ACP 连接失败（HTTP ${response.status}）。`, 502, "ACP_CONNECT_FAILED");
    }
    this.connectionId = response.headers.get("Acp-Connection-Id") || response.headers.get("acp-connection-id") || "";
    if (!this.connectionId) {
      throw new WorkBuddyError("WorkBuddy ACP 未返回连接标识。", 502, "ACP_CONNECTION_ID_MISSING");
    }
    this.notificationTask = consumeSse(response.body, envelope => this.handleEnvelope(envelope))
      .catch(error => {
        if (error?.name !== "AbortError") {
          for (const pending of this.pending.values()) {
            pending.clear();
            pending.reject(new WorkBuddyError("WorkBuddy ACP 长连接已中断。", 502, "ACP_DISCONNECTED"));
          }
          this.pending.clear();
        }
      });
  }

  async rpc(method, params, timeoutMs = this.rpcTimeoutMs) {
    const id = ++this.rpcId;
    const pending = this.createPending(id, timeoutMs);
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
      const waiting = this.pending.get(id);
      waiting?.clear();
      waiting?.reject(error);
      this.pending.delete(id);
      return pending;
    }

    if (![200, 202].includes(response.status)) {
      const error = new WorkBuddyError(`WorkBuddy ACP ${method} 失败（HTTP ${response.status}）。`, 502, "ACP_HTTP_ERROR");
      const waiting = this.pending.get(id);
      waiting?.clear();
      waiting?.reject(error);
      this.pending.delete(id);
      return pending;
    }

    const contentType = response.headers.get("content-type") || "";
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

  async initializeAndLoad(sessionId) {
    await this.rpc("initialize", {
      protocolVersion: 1,
      clientCapabilities: {},
      clientInfo: { name: "dreamworks-succession-ecosystem", version: "1.0.0" }
    });

    try {
      await this.rpc("session/load", { sessionId, cwd: "/workspace", mcpServers: [] }, 45_000);
      return sessionId;
    } catch (error) {
      if (error.code !== "ACP_RPC_ERROR" && error.code !== "ACP_TIMEOUT") throw error;
      const result = await this.rpc("session/new", { cwd: "/workspace", mcpServers: [] }, 45_000);
      return String(result.sessionId || result.id || sessionId);
    }
  }

  async setMode(sessionId, mode) {
    if (!mode || mode === "default") return;
    try {
      await this.rpc("session/set_mode", { sessionId, modeId: mode }, 20_000);
    } catch {
      // Optional compatibility setting. The diagnostic chat still works in default mode.
    }
  }

  async prompt(sessionId, text, emit) {
    if (this.activeEmit) {
      throw new WorkBuddyError("上一轮专家诊断尚未结束，请稍候。", 409, "PROMPT_IN_PROGRESS");
    }
    this.activeEmit = emit;
    try {
      const result = await this.rpc(
        "session/prompt",
        { sessionId, prompt: [{ type: "text", text }] },
        180_000
      );
      return { stopReason: result.stopReason || "end_turn" };
    } finally {
      this.activeEmit = null;
    }
  }

  async close() {
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

function buildMockReply(prompt, turn) {
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

export function createWealthAgentService({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const config = {
    apiKey: env.WORKBUDDY_API_KEY || env.CODEBUDDY_API_KEY || "",
    clientId: env.WORKBUDDY_CLIENT_ID || "",
    clientSecret: env.WORKBUDDY_CLIENT_SECRET || "",
    tokenUrl: env.WORKBUDDY_TOKEN_URL || DEFAULT_TOKEN_URL,
    oauthScope: env.WORKBUDDY_OAUTH_SCOPE || "",
    apiBase: (env.WORKBUDDY_API_BASE || DEFAULT_API_BASE).replace(/\/$/, ""),
    sourceApp: env.WORKBUDDY_SOURCE_APP || "dreamworks-succession-main",
    agentId: env.WORKBUDDY_AGENT_ID || DEFAULT_AGENT_ID,
    agentName: env.WORKBUDDY_AGENT_NAME || DEFAULT_AGENT_NAME,
    mock: parseBoolean(env.WORKBUDDY_MOCK),
    acpMode: env.WORKBUDDY_ACP_MODE || "default",
    runtimeTimeoutMs: safeNumber(env.WORKBUDDY_RUNTIME_TIMEOUT_MS, 50_000),
    rpcTimeoutMs: safeNumber(env.WORKBUDDY_RPC_TIMEOUT_MS, 60_000),
    sessionTtlMs: safeNumber(env.WORKBUDDY_SESSION_TTL_MS, SESSION_TTL_MS)
  };
  const sessions = new Map();
  let oauthToken = null;

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
      integrationRevision: "oauth-runtime-secret-v2",
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
        "身家诊断专家 Runtime 缺少必需的 WORKBUDDY_API_KEY。",
        503,
        "RUNTIME_SECRET_NOT_CONFIGURED"
      );
    }
  }

  async function getBearerToken({ forceRefresh = false } = {}) {
    if (authMode() === "api-key") return config.apiKey;
    if (authMode() !== "oauth") {
      throw new WorkBuddyError("缺少 WorkBuddy 认证凭据。", 503, "NOT_CONFIGURED");
    }
    if (!forceRefresh && oauthToken && oauthToken.expiresAt > Date.now() + 60_000) {
      return oauthToken.value;
    }

    const form = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: config.clientSecret
    });
    if (config.oauthScope) form.set("scope", config.oauthScope);
    const response = await fetchHeadersWithTimeout(
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
    const { payload } = await readJsonResponse(response);
    if (!response.ok || typeof payload.access_token !== "string" || !payload.access_token) {
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
    return oauthToken.value;
  }

  async function apiRequest(path, options = {}, allowAuthRetry = true) {
    const bearerToken = await getBearerToken();
    const response = await fetchHeadersWithTimeout(
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
    if (response.status === 401 && authMode() === "oauth" && allowAuthRetry) {
      oauthToken = null;
      await getBearerToken({ forceRefresh: true });
      return apiRequest(path, options, false);
    }
    const { payload, rawText } = await readJsonResponse(response);
    if (!response.ok || (payload.code != null && payload.code !== 0)) {
      throw new WorkBuddyError(
        sanitizeProviderMessage(payload, `WorkBuddy Runtime API 请求失败（HTTP ${response.status}）。`),
        response.status === 401 || response.status === 403 ? 502 : 502,
        "RUNTIME_API_ERROR"
      );
    }
    return { data: payload.data || {}, rawText };
  }

  async function waitForRuntime(runtimeId, initialData) {
    let runtime = initialData;
    const deadline = Date.now() + config.runtimeTimeoutMs;
    while (runtime?.status !== "RUNNING") {
      if (runtime?.status === "FAILED") {
        throw new WorkBuddyError("WorkBuddy Runtime 初始化失败。", 502, "RUNTIME_FAILED");
      }
      if (Date.now() >= deadline) {
        throw new WorkBuddyError("WorkBuddy Runtime 仍在初始化，请稍后重试。", 504, "RUNTIME_START_TIMEOUT");
      }
      await new Promise(resolve => setTimeout(resolve, 1_200));
      runtime = (await apiRequest(`/runtimes/${encodeURIComponent(runtimeId)}`, { method: "GET" })).data;
    }
    return runtime;
  }

  async function createLiveSession() {
    const manifest = {
      id: config.agentId,
      name: config.agentName,
      manifestVersion: "1.0",
      useWorkspaceRoot: true
    };
    // OAuth authenticates the web service to the Runtime control plane, while
    // the published expert requires CODEBUDDY_API_KEY inside its private sandbox.
    manifest.secrets = [{ key: "CODEBUDDY_API_KEY", value: config.apiKey }];
    const created = await apiRequest("/runtimes", {
      method: "POST",
      body: JSON.stringify({
        runtimeName: `dreamworks-wealth-${Date.now()}-${randomUUID().slice(0, 8)}`,
        visibility: "PRIVATE",
        agentManifest: manifest,
        metadata: { source: "wealth-diagnosis", experience: "main-test" }
      })
    });
    const runtimeId = extractRuntimeId(created.rawText, { data: created.data });
    if (!runtimeId) throw new WorkBuddyError("WorkBuddy 未返回 Runtime ID。", 502, "RUNTIME_ID_MISSING");
    const runtime = await waitForRuntime(runtimeId, created.data);
    const acpLink = runtime?.links?.acpLink;
    if (!acpLink?.url || !acpLink?.token) {
      throw new WorkBuddyError("WorkBuddy Runtime 已启动，但未返回 ACP 连接信息。", 502, "ACP_LINK_MISSING");
    }
    const acp = new AcpConnection({
      url: acpLink.url,
      token: acpLink.token,
      fetchImpl,
      rpcTimeoutMs: config.rpcTimeoutMs
    });
    await acp.connect();
    const acpSessionId = await acp.initializeAndLoad(runtimeId);
    await acp.setMode(acpSessionId, config.acpMode);
    return { runtimeId, acpSessionId, acp };
  }

  async function createSession(context) {
    assertConfigured();
    if (!context || typeof context !== "object" || Array.isArray(context)) {
      throw new WorkBuddyError("缺少可供专家分析的诊断摘要。", 400, "INVALID_CONTEXT");
    }
    if (byteLength(context) > MAX_CONTEXT_BYTES) {
      throw new WorkBuddyError("诊断摘要过大，请精简后重试。", 413, "CONTEXT_TOO_LARGE");
    }
    const publicId = randomUUID();
    const record = config.mock
      ? { publicId, mock: true, turn: 0, createdAt: Date.now(), lastUsedAt: Date.now(), context }
      : { publicId, ...(await createLiveSession()), createdAt: Date.now(), lastUsedAt: Date.now(), context };
    sessions.set(publicId, record);
    return { sessionId: publicId, agentName: config.agentName, mode: config.mock ? "mock" : "live" };
  }

  async function prompt(publicId, text, emit) {
    const record = sessions.get(publicId);
    if (!record) throw new WorkBuddyError("专家会话已过期，请重新进入。", 404, "SESSION_NOT_FOUND");
    if (typeof text !== "string" || !text.trim()) {
      throw new WorkBuddyError("请输入要咨询的问题。", 400, "EMPTY_PROMPT");
    }
    if (byteLength(text) > MAX_PROMPT_BYTES) {
      throw new WorkBuddyError("本次输入过长，请精简后重试。", 413, "PROMPT_TOO_LARGE");
    }
    record.lastUsedAt = Date.now();
    if (record.mock) {
      record.turn += 1;
      const chunks = buildMockReply(text, record.turn);
      emit({ type: "status", text: "身家诊断专家正在分析…" });
      for (const chunk of chunks) {
        await new Promise(resolve => setTimeout(resolve, 12));
        emit({ type: "text", text: chunk });
      }
      return { stopReason: "end_turn" };
    }
    return record.acp.prompt(record.acpSessionId, text.trim(), emit);
  }

  async function closeSession(publicId) {
    const record = sessions.get(publicId);
    if (!record) return false;
    sessions.delete(publicId);
    if (record.mock) return true;
    await record.acp.close();
    try {
      await apiRequest(`/runtimes/${encodeURIComponent(record.runtimeId)}/delete`, {
        method: "POST",
        body: "{}"
      });
    } catch {
      // Session is already inaccessible locally. Platform-side TTL remains a fallback.
    }
    return true;
  }

  async function cleanupExpired() {
    const expired = [...sessions.values()]
      .filter(record => Date.now() - record.lastUsedAt > config.sessionTtlMs)
      .map(record => record.publicId);
    await Promise.allSettled(expired.map(closeSession));
  }

  const cleanupTimer = setInterval(() => void cleanupExpired(), 5 * 60 * 1000);
  cleanupTimer.unref?.();

  return { status, createSession, prompt, closeSession, cleanupExpired, WorkBuddyError };
}

export { WorkBuddyError };

import http from "node:http";
import { createReadStream, statSync, existsSync, readFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createWealthAgentService, WorkBuddyError } from "./workbuddy-agent.js";
import { createDiagnosticStore } from "./wealth-agent-diagnostics.js";
import { createStrategyAuthService } from "./strategy-auth.js";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const DEFAULT_PORT = Number(process.env.PORT || 8000);
const DEFAULT_HOST = "0.0.0.0";
const MAX_JSON_BODY_BYTES = 220 * 1024;
const REQUEST_BUCKETS = new Map();
const DEFAULT_DIAGNOSTICS = createDiagnosticStore();
const PROTECTED_PATH_SCOPES = [
  { prefix: "/assets/strategy/", scope: "cases" },
  { prefix: "/docs/strategy/", scope: "cases" },
  { prefix: "/js/strategy-cases-data.js", scope: "cases" },
  { prefix: "/js/strategy-cases.js", scope: "cases" },
  { prefix: "/js/strategy.js", scope: "cases" },
  { prefix: "/assets/confidential/", scope: "chat" }
];
const STRATEGY_BLOCKS = {
  cases: ["STRATEGY_CASES_PROTECTED_START", "STRATEGY_CASES_PROTECTED_END"],
  agent: ["STRATEGY_AGENT_PROTECTED_START", "STRATEGY_AGENT_PROTECTED_END"],
  casesGate: ["STRATEGY_CASES_GATE_START", "STRATEGY_CASES_GATE_END"],
  valueAgent: ["VALUE_AGENT_PROTECTED_START", "VALUE_AGENT_PROTECTED_END"],
  valueAgentGate: ["VALUE_AGENT_GATE_START", "VALUE_AGENT_GATE_END"],
  wealthAily: ["WEALTH_AILY_PROTECTED_START", "WEALTH_AILY_PROTECTED_END"],
  wealthAilyGate: ["WEALTH_AILY_GATE_START", "WEALTH_AILY_GATE_END"],
  trustAily: ["TRUST_AILY_PROTECTED_START", "TRUST_AILY_PROTECTED_END"],
  trustAilyGate: ["TRUST_AILY_GATE_START", "TRUST_AILY_GATE_END"],
  wealthInternal: ["WEALTH_INTERNAL_REVIEW_START", "WEALTH_INTERNAL_REVIEW_END"]
};

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf"
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const normalized = normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const candidate = resolve(ROOT, "." + normalized);
  return candidate.startsWith(resolve(ROOT)) ? candidate : null;
}

function sendFile(req, res, filePath, extraHeaders = {}) {
  try {
    const stat = statSync(filePath);
    if (!stat.isFile()) return false;
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[extname(filePath).toLowerCase()] || "application/octet-stream",
      "Content-Length": stat.size,
      "Cache-Control": extname(filePath).toLowerCase() === ".html" ? "no-cache" : "public, max-age=3600",
      ...extraHeaders
    });
    if (req.method === "HEAD") res.end();
    else createReadStream(filePath).pipe(res);
    return true;
  } catch {
    return false;
  }
}

function sendJson(res, statusCode, payload, traceId = "") {
  if (res.headersSent) return;
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...(traceId ? { "X-Dreamworks-Trace-Id": traceId } : {})
  });
  res.end(JSON.stringify(payload));
}

function sendHtml(req, res, html) {
  const body = Buffer.from(html, "utf8");
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "private, no-store",
    Vary: "Cookie",
    "X-Content-Type-Options": "nosniff"
  });
  if (req.method === "HEAD") res.end();
  else res.end(body);
}

function removeOrUnwrapProtectedBlocks(html, scope, allowed) {
  const [start, end] = STRATEGY_BLOCKS[scope];
  const block = new RegExp(`<!-- ${start} -->[\\s\\S]*?<!-- ${end} -->`, "g");
  if (!allowed) return html.replace(block, "");
  return html
    .replaceAll(`<!-- ${start} -->`, "")
    .replaceAll(`<!-- ${end} -->`, "");
}

function renderIndex(authStatus) {
  let html = readFileSync(join(ROOT, "index.html"), "utf8");
  html = removeOrUnwrapProtectedBlocks(html, "cases", authStatus.grants.cases);
  html = removeOrUnwrapProtectedBlocks(html, "agent", authStatus.grants.agent);
  html = removeOrUnwrapProtectedBlocks(html, "casesGate", !authStatus.grants.cases);
  html = removeOrUnwrapProtectedBlocks(html, "valueAgent", authStatus.grants.value);
  html = removeOrUnwrapProtectedBlocks(html, "valueAgentGate", !authStatus.grants.value);
  html = removeOrUnwrapProtectedBlocks(html, "wealthAily", authStatus.grants.wealth);
  html = removeOrUnwrapProtectedBlocks(html, "wealthAilyGate", !authStatus.grants.wealth);
  html = removeOrUnwrapProtectedBlocks(html, "trustAily", authStatus.grants.trust);
  html = removeOrUnwrapProtectedBlocks(html, "trustAilyGate", !authStatus.grants.trust);
  // The WorkBuddy expert is an internal review tool. Reuse the internal case-library
  // grant so public visitors never receive its UI or client script.
  html = removeOrUnwrapProtectedBlocks(html, "wealthInternal", authStatus.grants.cases);
  const bootstrap = JSON.stringify(authStatus).replace(/</g, "\\u003c");
  return html.replace(
    "<!-- STRATEGY_AUTH_BOOTSTRAP -->",
    `<script>window.DREAMWORKS_STRATEGY_AUTH=Object.freeze(${bootstrap});</script>`
  );
}

function protectedScopeForPath(pathname) {
  const entry = PROTECTED_PATH_SCOPES.find(({ prefix }) => pathname === prefix || pathname.startsWith(prefix));
  return entry ? entry.scope : "";
}

function readJsonBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    let raw = "";
    let size = 0;
    req.setEncoding("utf8");
    req.on("data", chunk => {
      size += Buffer.byteLength(chunk, "utf8");
      if (size > MAX_JSON_BODY_BYTES) {
        rejectBody(new WorkBuddyError("请求内容过大。", 413, "REQUEST_TOO_LARGE"));
        req.destroy();
        return;
      }
      raw += chunk;
    });
    req.on("end", () => {
      if (!raw) return resolveBody({});
      try {
        resolveBody(JSON.parse(raw));
      } catch {
        rejectBody(new WorkBuddyError("请求 JSON 格式无效。", 400, "INVALID_JSON"));
      }
    });
    req.on("error", rejectBody);
  });
}

function isSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function diagnosticPathname(pathname) {
  return String(pathname)
    .replace(/\/session\/[a-f0-9-]+/ig, "/session/:sessionId")
    .replace(/\/diagnostics\/dw-[a-f0-9-]+/ig, "/diagnostics/:traceId");
}

function assertWithinRateLimit(req, scope, limit, windowMs) {
  const remoteAddress = req.socket?.remoteAddress || "local";
  const key = `${scope}:${remoteAddress}`;
  const now = Date.now();
  const bucket = REQUEST_BUCKETS.get(key);
  if (!bucket || now >= bucket.resetAt) {
    REQUEST_BUCKETS.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (bucket.count >= limit) {
    throw new WorkBuddyError("请求过于频繁，请稍后再试。", 429, "RATE_LIMITED");
  }
  bucket.count += 1;
}

function publicError(error, trace) {
  const diagnostic = trace?.snapshot();
  if (error instanceof WorkBuddyError) {
    return {
      statusCode: error.statusCode || 502,
      payload: {
        ok: false,
        traceId: trace?.traceId || "",
        diagnostic,
        error: { code: error.code, message: error.message }
      }
    };
  }
  return {
    statusCode: 500,
    payload: {
      ok: false,
      traceId: trace?.traceId || "",
      diagnostic,
      error: { code: "INTERNAL_ERROR", message: "服务暂时不可用，请稍后重试。" }
    }
  };
}

export async function handleWealthAgentApi(req, res, pathname, agentService, diagnostics = DEFAULT_DIAGNOSTICS) {
  if (!pathname.startsWith("/api/wealth-agent")) return false;
  if (!isSameOrigin(req)) {
    sendJson(res, 403, { ok: false, error: { code: "ORIGIN_REJECTED", message: "仅允许从本站发起专家诊断。" } });
    return true;
  }

  const diagnosticMatch = pathname.match(/^\/api\/wealth-agent\/diagnostics\/(dw-[a-f0-9-]+)$/i);
  if (diagnosticMatch && req.method === "GET") {
    const diagnostic = diagnostics.get(diagnosticMatch[1]);
    sendJson(
      res,
      diagnostic ? 200 : 404,
      diagnostic
        ? { ok: true, diagnostic }
        : { ok: false, error: { code: "TRACE_NOT_FOUND", message: "诊断记录已过期或不在当前服务实例中。" } },
      diagnosticMatch[1]
    );
    return true;
  }

  const safePathname = diagnosticPathname(pathname);
  const trace = diagnostics.start(`http.${req.method || "UNKNOWN"}.${safePathname}`, {
    method: req.method || "UNKNOWN",
    pathname: safePathname,
    contentType: req.headers["content-type"] || "unspecified",
    userAgentPresent: Boolean(req.headers["user-agent"])
  });

  try {
    if (pathname === "/api/wealth-agent/status" && req.method === "GET") {
      trace.event("service.status", "success", agentService.status());
      const diagnostic = trace.finish("success");
      sendJson(res, 200, { ok: true, ...agentService.status(), traceId: trace.traceId, diagnostic }, trace.traceId);
      return true;
    }
    if (pathname === "/api/wealth-agent/session" && req.method === "POST") {
      assertWithinRateLimit(req, "create-session", 8, 15 * 60 * 1000);
      const body = await readJsonBody(req);
      if (body.consent !== true) throw new WorkBuddyError("请先确认数据处理授权。", 400, "CONSENT_REQUIRED");
      trace.event("http.request.validated", "success", { consent: true });
      const session = await agentService.createSession(body.context, trace);
      const diagnostic = trace.finish("success");
      sendJson(res, 201, { ok: true, ...session, traceId: trace.traceId, diagnostic }, trace.traceId);
      return true;
    }

    const promptMatch = pathname.match(/^\/api\/wealth-agent\/session\/([a-f0-9-]+)\/prompt$/i);
    if (promptMatch && req.method === "POST") {
      assertWithinRateLimit(req, "prompt", 40, 10 * 60 * 1000);
      const body = await readJsonBody(req);
      res.writeHead(200, {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "X-Content-Type-Options": "nosniff",
        "X-Dreamworks-Trace-Id": trace.traceId
      });
      const emit = event => {
        if (!res.writableEnded && !res.destroyed) res.write(JSON.stringify(event) + "\n");
      };
      emit({ type: "trace", traceId: trace.traceId });
      emit({ type: "status", text: "请求已提交，专家正在分析…" });
      const heartbeat = setInterval(() => emit({ type: "heartbeat" }), 15_000);
      heartbeat.unref?.();
      try {
        const result = await agentService.prompt(promptMatch[1], body.prompt, emit, trace);
        const diagnostic = trace.finish("success", { stopReason: result.stopReason || "end_turn" });
        emit({ type: "done", stopReason: result.stopReason || "end_turn", traceId: trace.traceId, diagnostic });
      } catch (error) {
        const diagnostic = trace.fail(error);
        const { payload } = publicError(error, trace);
        emit({ type: "error", traceId: trace.traceId, error: payload.error, diagnostic });
      } finally {
        clearInterval(heartbeat);
      }
      res.end();
      return true;
    }

    const closeMatch = pathname.match(/^\/api\/wealth-agent\/session\/([a-f0-9-]+)\/close$/i);
    if (closeMatch && req.method === "POST") {
      await agentService.closeSession(closeMatch[1], trace);
      const diagnostic = trace.finish("success");
      sendJson(res, 200, { ok: true, traceId: trace.traceId, diagnostic }, trace.traceId);
      return true;
    }

    const notFound = new WorkBuddyError("接口不存在。", 404, "API_NOT_FOUND");
    trace.fail(notFound);
    const { payload } = publicError(notFound, trace);
    sendJson(res, 404, payload, trace.traceId);
    return true;
  } catch (error) {
    trace.fail(error);
    const { statusCode, payload } = publicError(error, trace);
    sendJson(res, statusCode, payload, trace.traceId);
    return true;
  }
}

export async function handleStrategyAuthApi(req, res, pathname, authService) {
  if (!pathname.startsWith("/api/strategy-auth")) return false;
  if (!isSameOrigin(req)) {
    sendJson(res, 403, { ok: false, error: { code: "ORIGIN_REJECTED", message: "仅允许从本站发起访问验证。" } });
    return true;
  }

  if (pathname === "/api/strategy-auth/status" && req.method === "GET") {
    sendJson(res, 200, { ok: true, ...authService.status(req) });
    return true;
  }

  if (pathname === "/api/strategy-auth/login" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const scope = ["cases", "chat", "agent", "value", "wealth", "trust"].includes(body.scope) ? body.scope : "";
      assertWithinRateLimit(req, `strategy-auth:${scope || "invalid"}`, 8, 15 * 60 * 1000);
      if (!scope) {
        sendJson(res, 400, { ok: false, error: { code: "INVALID_SCOPE", message: "访问区域无效。" } });
        return true;
      }
      const result = authService.authenticate(scope, body.username, body.password);
      if (result.reason === "not_configured") {
        sendJson(res, 503, { ok: false, error: { code: "AUTH_NOT_CONFIGURED", message: "该访问区域尚未完成服务端凭据配置。" } });
        return true;
      }
      if (!result.ok) {
        sendJson(res, 401, { ok: false, error: { code: "INVALID_CREDENTIALS", message: "账号或密码不正确。" } });
        return true;
      }
      const grantCookie = authService.grant(req, scope);
      res.setHeader("Set-Cookie", grantCookie);
      const issuedCookie = String(grantCookie).split(";")[0];
      const statusCookie = [req.headers.cookie || "", issuedCookie].filter(Boolean).join("; ");
      sendJson(res, 200, { ok: true, scope, ...authService.status({ headers: { cookie: statusCookie } }) });
      return true;
    } catch (error) {
      const statusCode = error instanceof WorkBuddyError ? error.statusCode : 500;
      const code = error instanceof WorkBuddyError ? error.code : "INTERNAL_ERROR";
      const message = error instanceof WorkBuddyError ? error.message : "验证服务暂时不可用，请稍后重试。";
      sendJson(res, statusCode, { ok: false, error: { code, message } });
      return true;
    }
  }

  if (pathname === "/api/strategy-auth/logout" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const scope = ["cases", "chat", "agent", "value", "wealth", "trust"].includes(body.scope) ? body.scope : "all";
      res.setHeader("Set-Cookie", authService.revoke(req, scope));
      sendJson(res, 200, { ok: true, scope });
      return true;
    } catch (error) {
      const statusCode = error instanceof WorkBuddyError ? error.statusCode : 500;
      sendJson(res, statusCode, { ok: false, error: { code: error.code || "INTERNAL_ERROR", message: error.message || "退出失败。" } });
      return true;
    }
  }

  const agentConfigMatch = pathname.match(/^\/api\/strategy-auth\/agent-config(?:\/(value|wealth|trust))?$/);
  if (agentConfigMatch && req.method === "GET") {
    const scope = agentConfigMatch[1] || "agent";
    if (!authService.status(req).grants[scope]) {
      sendJson(res, 401, { ok: false, error: { code: "AUTH_REQUIRED", message: "请先通过对应智体的访问验证。" } });
      return true;
    }
    const config = authService.agentConfig(scope);
    if (!config.channelToken) {
      sendJson(res, 503, { ok: false, error: { code: "AGENT_NOT_CONFIGURED", message: "该智体渠道配置尚未完成。" } });
      return true;
    }
    sendJson(res, 200, { ok: true, config });
    return true;
  }

  sendJson(res, 404, { ok: false, error: { code: "API_NOT_FOUND", message: "接口不存在。" } });
  return true;
}

export function createDreamworksServer(options = {}) {
  const diagnostics = options.diagnostics || DEFAULT_DIAGNOSTICS;
  const agentService = options.agentService || createWealthAgentService({ diagnostics });
  const strategyAuthService = options.strategyAuthService || createStrategyAuthService();
  return http.createServer(async (req, res) => {
    const pathname = new URL(req.url || "/", "http://localhost").pathname;
    const authStatus = strategyAuthService.status(req);
    if (pathname.startsWith("/api/wealth-agent") && !authStatus.grants.cases) {
      sendJson(res, 404, { ok: false, error: { code: "NOT_FOUND", message: "接口不存在。" } });
      return;
    }
    if (await handleWealthAgentApi(req, res, pathname, agentService, diagnostics)) return;
    if (await handleStrategyAuthApi(req, res, pathname, strategyAuthService)) return;

    if (!["GET", "HEAD"].includes(req.method || "")) {
      res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Method Not Allowed");
      return;
    }
    let filePath = safePath(pathname);
    if (!filePath) {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Bad Request");
      return;
    }
    const protectedScope = protectedScopeForPath(pathname);
    if (protectedScope && !authStatus.grants[protectedScope]) {
      res.writeHead(404, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "private, no-store",
        Vary: "Cookie",
        "X-Content-Type-Options": "nosniff"
      });
      res.end("Not Found");
      return;
    }
    if (pathname === "/" || (existsSync(filePath) && statSync(filePath).isDirectory())) {
      filePath = join(pathname === "/" ? ROOT : filePath, "index.html");
    }
    if (filePath === join(ROOT, "index.html")) {
      sendHtml(req, res, renderIndex(authStatus));
      return;
    }
    if (sendFile(req, res, filePath, protectedScope ? {
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
      "X-Content-Type-Options": "nosniff"
    } : {})) return;
    sendHtml(req, res, renderIndex(authStatus));
  });
}

const isDirectRun = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isDirectRun) {
  const server = createDreamworksServer();
  server.listen(DEFAULT_PORT, DEFAULT_HOST, () => {
    console.log(`Dreamworks site listening on http://${DEFAULT_HOST}:${DEFAULT_PORT}`);
  });
}

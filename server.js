import http from "node:http";
import { createReadStream, statSync, existsSync, readFileSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createWealthAgentService, WorkBuddyError } from "./workbuddy-agent.js";
import { createDiagnosticStore } from "./wealth-agent-diagnostics.js";
import { createStrategyAuthService } from "./strategy-auth.js";
import { createOfficeTourAuthService } from "./office-tour-auth.js";
import { createMarketFileChannel } from "./market-file-channel.js";

const ROOT = fileURLToPath(new URL(".", import.meta.url));

// 本地开发凭据：从项目根目录 .env 加载到 process.env。
// 部署平台注入的真实环境变量优先，永远不被 .env 覆盖。
function loadLocalEnv() {
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) return;
  try {
    const content = readFileSync(envPath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator < 1) continue;
      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (error) {
    console.warn("[env] 无法读取 .env：", error && error.message ? error.message : error);
  }
}
loadLocalEnv();

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
  agentGate: ["STRATEGY_AGENT_GATE_START", "STRATEGY_AGENT_GATE_END"],
  casesGate: ["STRATEGY_CASES_GATE_START", "STRATEGY_CASES_GATE_END"],
  valueAgent: ["VALUE_AGENT_PROTECTED_START", "VALUE_AGENT_PROTECTED_END"],
  valueAgentGate: ["VALUE_AGENT_GATE_START", "VALUE_AGENT_GATE_END"],
  wealthAily: ["WEALTH_AILY_PROTECTED_START", "WEALTH_AILY_PROTECTED_END"],
  wealthAilyGate: ["WEALTH_AILY_GATE_START", "WEALTH_AILY_GATE_END"],
  trustAily: ["TRUST_AILY_PROTECTED_START", "TRUST_AILY_PROTECTED_END"],
  trustAilyGate: ["TRUST_AILY_GATE_START", "TRUST_AILY_GATE_END"],
  marketAgent: ["MARKET_AGENT_PROTECTED_START", "MARKET_AGENT_PROTECTED_END"],
  marketAgentGate: ["MARKET_AGENT_GATE_START", "MARKET_AGENT_GATE_END"],
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
  try {
    const decoded = decodeURIComponent(urlPath.split("?")[0]);
    const normalized = normalize(decoded).replace(/^(\.\.[/\\])+/, "");
    const root = resolve(ROOT);
    const candidate = resolve(root, "." + normalized);
    return candidate === root || candidate.startsWith(root + sep) ? candidate : null;
  } catch {
    return null;
  }
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

function sendPlain(req, res, statusCode, text, extraHeaders = {}) {
  const body = Buffer.from(text, "utf8");
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": body.length,
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders
  });
  if (req.method === "HEAD") res.end();
  else res.end(body);
}

function officeTourSecurityHeaders(isPrivate = true) {
  return {
    "Cache-Control": isPrivate ? "private, no-store" : "public, max-age=3600",
    ...(isPrivate ? { Vary: "Cookie" } : {}),
    "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'; worker-src 'self' blob:",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN"
  };
}

function officeTourGateHtml(configured) {
  const unavailable = configured
    ? ""
    : '<p class="notice" role="alert">参访验证尚未完成服务端配置，请联系管理员。</p>';
  const disabled = configured ? "" : " disabled";
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>企业线上参访 · 访问验证</title>
  <style>
    :root{color-scheme:light;--ink:#102c24;--gold:#b18a45;--paper:#f5f1e8;--muted:#718078}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 20% 10%,#315246 0,transparent 33%),linear-gradient(145deg,#071b19,#0f3028);font-family:Inter,"PingFang SC","Microsoft YaHei",sans-serif;color:var(--ink)}main{width:min(520px,100%);background:var(--paper);border:1px solid #cfb77e;border-radius:18px;padding:clamp(28px,6vw,52px);box-shadow:0 30px 90px #0007}.eyebrow{margin:0 0 18px;color:#967127;font-size:11px;letter-spacing:.22em;font-weight:700}h1{margin:0 0 14px;font-family:Georgia,"Songti SC",serif;font-size:clamp(30px,7vw,45px);font-weight:500}p{color:var(--muted);line-height:1.8;font-size:14px}.notice{padding:10px 12px;border-left:3px solid #a37728;background:#eee5d4;color:#765b29}form{display:grid;gap:10px;margin-top:28px}label{font-size:13px;font-weight:700}input{width:100%;border:1px solid #c8cec8;border-radius:8px;background:#fff;padding:14px 15px;font:inherit;color:var(--ink)}input:focus{outline:2px solid #c29a4b;outline-offset:2px}button{margin-top:8px;border:0;border-radius:8px;padding:14px 18px;background:#cfaa4b;color:#0c2922;font:700 14px inherit;cursor:pointer}button:disabled{cursor:not-allowed;opacity:.5}.message{min-height:24px;margin:5px 0 0;color:#9c3c34;font-size:12px}.back{display:inline-block;margin-top:25px;color:#52655d;font-size:13px;text-underline-offset:4px}
  </style>
</head>
<body>
  <main>
    <p class="eyebrow">DREAMWORKS · PRIVATE OFFICE JOURNEY</p>
    <h1>企业线上参访</h1>
    <p>办公实景包含内部空间信息。请输入独立的参访账号和密码，验证后即可进入 14 站虚拟路线。</p>
    ${unavailable}
    <form id="login" novalidate>
      <label for="username">参访账号</label>
      <input id="username" name="username" autocomplete="username" required${disabled}>
      <label for="password">参访密码</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required${disabled}>
      <p class="message" id="message" role="alert" aria-live="polite"></p>
      <button type="submit"${disabled}>验证并进入参访 →</button>
    </form>
    <a class="back" href="/">← 返回梦工场家族传承系统</a>
  </main>
  <script>
    const form=document.getElementById('login');const message=document.getElementById('message');
    form.addEventListener('submit',async(event)=>{event.preventDefault();message.textContent='正在验证…';const button=form.querySelector('button');button.disabled=true;try{const response=await fetch('/api/office-tour-auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:form.username.value,password:form.password.value})});const body=await response.json();if(!response.ok)throw new Error(body.error?.message||'验证失败。');location.replace('/office-tour/');}catch(error){message.textContent=error.message||'验证失败，请重试。';button.disabled=${configured ? "false" : "true"};}});
  </script>
</body>
</html>`;
}

function sendOfficeTourGate(req, res, configured) {
  const body = Buffer.from(officeTourGateHtml(configured), "utf8");
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": body.length,
    ...officeTourSecurityHeaders(true)
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
  html = removeOrUnwrapProtectedBlocks(html, "agentGate", !authStatus.grants.agent);
  html = removeOrUnwrapProtectedBlocks(html, "casesGate", !authStatus.grants.cases);
  html = removeOrUnwrapProtectedBlocks(html, "valueAgent", authStatus.grants.value);
  html = removeOrUnwrapProtectedBlocks(html, "valueAgentGate", !authStatus.grants.value);
  html = removeOrUnwrapProtectedBlocks(html, "wealthAily", authStatus.grants.wealth);
  html = removeOrUnwrapProtectedBlocks(html, "wealthAilyGate", !authStatus.grants.wealth);
  html = removeOrUnwrapProtectedBlocks(html, "trustAily", authStatus.grants.trust);
  html = removeOrUnwrapProtectedBlocks(html, "trustAilyGate", !authStatus.grants.trust);
  html = removeOrUnwrapProtectedBlocks(html, "marketAgent", authStatus.grants.market);
  html = removeOrUnwrapProtectedBlocks(html, "marketAgentGate", !authStatus.grants.market);
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

// 判断一个地址是否属于「反向代理/网关」网段（含回环与私网）。
// 云平台（含火山引擎函数服务）会在前面挂一层网关，此时 socket 对端永远是内网地址，
// 真实访客地址只在 X-Forwarded-For 里。仅当对端是网关时才信任该请求头，
// 避免公网直连的客户端伪造 XFF 绕过限流。
function isGatewayAddress(address) {
  const value = String(address || "").trim().toLowerCase();
  if (!value) return false;
  if (value === "::1" || value === "localhost") return true;
  const normalized = value.startsWith("::ffff:") ? value.slice(7) : value;
  if (normalized === "127.0.0.1" || normalized.startsWith("127.")) return true;
  if (normalized === "::1") return true;
  if (normalized.startsWith("10.")) return true;
  if (normalized.startsWith("192.168.")) return true;
  const match = normalized.match(/^172\.(\d{1,3})\./);
  if (match) {
    const second = Number(match[1]);
    if (second >= 16 && second <= 31) return true;
  }
  if (normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80")) return true;
  return false;
}

function clientAddress(req) {
  const peer = req.socket?.remoteAddress || "";
  const trustHeader = String(process.env.TRUST_PROXY || "").toLowerCase() === "true" || isGatewayAddress(peer);
  if (trustHeader) {
    const forwarded = req.headers["x-forwarded-for"];
    const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    if (typeof raw === "string" && raw.trim()) {
      const first = raw.split(",")[0].trim();
      if (first) return first;
    }
    const realIp = req.headers["x-real-ip"];
    if (typeof realIp === "string" && realIp.trim()) return realIp.trim();
  }
  return peer || "local";
}

function assertWithinRateLimit(req, scope, limit, windowMs) {
  const remoteAddress = clientAddress(req);
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

export async function handleWealthAgentApi(req, res, pathname, agentService, diagnostics = DEFAULT_DIAGNOSTICS, pathPrefix = "/api/wealth-agent", fileChannel = null) {
  if (!pathname.startsWith(pathPrefix)) return false;
  if (!isSameOrigin(req)) {
    sendJson(res, 403, { ok: false, error: { code: "ORIGIN_REJECTED", message: "仅允许从本站发起专家诊断。" } });
    return true;
  }

  const escapedPrefix = pathPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const diagnosticMatch = pathname.match(new RegExp(`^${escapedPrefix}/diagnostics/(dw-[a-f0-9-]+)$`, "i"));
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
    if (pathname === `${pathPrefix}/status` && req.method === "GET") {
      trace.event("service.status", "success", agentService.status());
      const diagnostic = trace.finish("success");
      sendJson(res, 200, { ok: true, ...agentService.status(), traceId: trace.traceId, diagnostic }, trace.traceId);
      return true;
    }
    if (pathname === `${pathPrefix}/session` && req.method === "POST") {
      assertWithinRateLimit(req, `${pathPrefix}:create-session`, 60, 15 * 60 * 1000);
      const body = await readJsonBody(req);
      if (body.consent !== true) throw new WorkBuddyError("请先确认数据处理授权。", 400, "CONSENT_REQUIRED");
      trace.event("http.request.validated", "success", { consent: true });
      const session = await agentService.createSession(body.context, trace);
      const diagnostic = trace.finish("success");
      sendJson(res, 201, { ok: true, ...session, traceId: trace.traceId, diagnostic }, trace.traceId);
      return true;
    }

    // 市场专员文件通道：底稿与封面图先落到本次会话 workspace，
    // 再由 workbuddy-agent.js 在 prompt 时注入文件清单、正文或 base64。
    if (pathname === `${pathPrefix}/upload`) {
      if (!fileChannel) {
        sendJson(res, 404, { ok: false, error: { code: "API_NOT_FOUND", message: "接口不存在。" } });
        return true;
      }
      try {
        if (req.method === "POST") {
          assertWithinRateLimit(req, `${pathPrefix}:upload`, 30, 15 * 60 * 1000);
          const parts = await fileChannel.readMultipart(req, fileChannel.multipartBoundary(req.headers["content-type"]));
          const sessionId = String(parts.find(part => !part.filename && part.fieldName === "sessionId")?.data.toString("utf8") || "").trim();
          if (!sessionId) throw new WorkBuddyError("缺少会话标识，请重新进入市场专员。", 400, "SESSION_ID_REQUIRED");
          const manifest = await fileChannel.saveFiles(sessionId, parts);
          const publicFiles = fileChannel.publicManifest(manifest);
          await agentService.attachFiles(sessionId, publicFiles, trace);
          trace.event("http.upload.completed", "success", { fileCount: publicFiles.files.length });
          const diagnostic = trace.finish("success");
          sendJson(res, 201, { ok: true, ...publicFiles, traceId: trace.traceId, diagnostic }, trace.traceId);
          return true;
        }
        if (req.method === "GET") {
          const sessionId = String(new URL(req.url || "/", "http://localhost").searchParams.get("sessionId") || "").trim();
          if (!sessionId) throw new WorkBuddyError("缺少会话标识，请重新进入市场专员。", 400, "SESSION_ID_REQUIRED");
          const manifest = await fileChannel.readManifest(sessionId);
          const publicFiles = fileChannel.publicManifest(manifest);
          sendJson(res, 200, { ok: true, ...publicFiles });
          return true;
        }
        throw new WorkBuddyError("接口不存在。", 404, "API_NOT_FOUND");
      } catch (error) {
        const wrapped = error instanceof WorkBuddyError
          ? error
          : new WorkBuddyError(error.message || "上传失败，请重试。", error.statusCode || 400, error.code || "UPLOAD_FAILED");
        trace.fail(wrapped);
        const { statusCode, payload } = publicError(wrapped, trace);
        sendJson(res, statusCode, payload, trace.traceId);
        return true;
      }
    }

    const promptMatch = pathname.match(new RegExp(`^${escapedPrefix}/session/([a-f0-9-]+)/prompt$`, "i"));
    if (promptMatch && req.method === "POST") {
      assertWithinRateLimit(req, `${pathPrefix}:prompt`, 40, 10 * 60 * 1000);
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

    const closeMatch = pathname.match(new RegExp(`^${escapedPrefix}/session/([a-f0-9-]+)/close$`, "i"));
    if (closeMatch && req.method === "POST") {
      await agentService.closeSession(closeMatch[1], trace);
      if (fileChannel) await fileChannel.deleteFiles(closeMatch[1]);
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
      const scope = ["cases", "chat", "agent", "value", "wealth", "trust", "market"].includes(body.scope) ? body.scope : "";
      assertWithinRateLimit(req, `strategy-auth:${scope || "invalid"}`, 30, 15 * 60 * 1000);
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
      // Compartment switch: issue this grant and revoke every other protected
      // scope in the same response. Never merge the incoming browser grants
      // into the login response status.
      const grantCookies = authService.grantExclusive(req, scope);
      res.setHeader("Set-Cookie", grantCookies);
      const issuedCookie = String(grantCookies[0] || "").split(";")[0];
      const statusCookie = issuedCookie;
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
      const scope = ["cases", "chat", "agent", "value", "wealth", "trust", "market"].includes(body.scope) ? body.scope : "all";
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

export async function handleOfficeTourAuthApi(req, res, pathname, authService) {
  if (!pathname.startsWith("/api/office-tour-auth")) return false;
  if (!isSameOrigin(req)) {
    sendJson(res, 403, { ok: false, error: { code: "ORIGIN_REJECTED", message: "仅允许从本站发起参访验证。" } });
    return true;
  }

  if (pathname === "/api/office-tour-auth/status" && req.method === "GET") {
    sendJson(res, 200, { ok: true, ...authService.status(req) });
    return true;
  }

  if (pathname === "/api/office-tour-auth/login" && req.method === "POST") {
    try {
      assertWithinRateLimit(req, "office-tour-auth", 8, 15 * 60 * 1000);
      const body = await readJsonBody(req);
      const result = authService.authenticate(body.username, body.password);
      if (result.reason === "not_configured") {
        sendJson(res, 503, { ok: false, error: { code: "AUTH_NOT_CONFIGURED", message: "企业参访尚未完成服务端凭据配置。" } });
        return true;
      }
      if (!result.ok) {
        sendJson(res, 401, { ok: false, error: { code: "INVALID_CREDENTIALS", message: "参访账号或密码不正确。" } });
        return true;
      }
      if (!authService.status(req).public) {
        const grantedCookie = authService.grant(req);
        res.setHeader("Set-Cookie", grantedCookie);
        const issuedCookie = String(grantedCookie).split(";")[0];
        sendJson(res, 200, { ok: true, ...authService.status({ headers: { cookie: issuedCookie } }) });
        return true;
      }
      sendJson(res, 200, { ok: true, ...authService.status(req) });
      return true;
    } catch (error) {
      const statusCode = error instanceof WorkBuddyError ? error.statusCode : 500;
      sendJson(res, statusCode, {
        ok: false,
        error: {
          code: error.code || "INTERNAL_ERROR",
          message: error.message || "参访验证服务暂时不可用，请稍后重试。"
        }
      });
      return true;
    }
  }

  if (pathname === "/api/office-tour-auth/logout" && req.method === "POST") {
    res.setHeader("Set-Cookie", authService.revoke(req));
    sendJson(res, 200, { ok: true });
    return true;
  }

  sendJson(res, 404, { ok: false, error: { code: "API_NOT_FOUND", message: "接口不存在。" } });
  return true;
}

export function createDreamworksServer(options = {}) {
  const diagnostics = options.diagnostics || DEFAULT_DIAGNOSTICS;
  const agentService = options.agentService || createWealthAgentService({ diagnostics });
  // 市场专员 WorkBuddy 服务：复用同一套 Runtime 凭据，但使用独立的专家身份。
  // 未单独配置时回退到通用 WorkBuddy 凭据，保证部署只需一套环境变量也能工作。
  const marketAgentService = options.marketAgentService || createWealthAgentService({
    diagnostics,
    env: {
      ...process.env,
      WORKBUDDY_AGENT_ID: process.env.MARKET_WORKBUDDY_AGENT_ID || process.env.WORKBUDDY_AGENT_ID,
      WORKBUDDY_AGENT_NAME: process.env.MARKET_WORKBUDDY_AGENT_NAME || process.env.WORKBUDDY_AGENT_NAME || "梦工场市场专员",
      // 本地演示时用市场研究口径的模拟回复，避免出现身家诊断话术
      WORKBUDDY_MOCK_PROFILE: process.env.MARKET_WORKBUDDY_MOCK_PROFILE || "market"
    }
  });
  const marketFileChannel = options.marketFileChannel || createMarketFileChannel({ env: process.env });
  const strategyAuthService = options.strategyAuthService || createStrategyAuthService();
  const officeTourAuthService = options.officeTourAuthService || createOfficeTourAuthService();
  return http.createServer(async (req, res) => {
    const pathname = new URL(req.url || "/", "http://localhost").pathname;
    const authStatus = strategyAuthService.status(req);
    if (pathname.startsWith("/api/wealth-agent") && !authStatus.grants.cases) {
      sendJson(res, 404, { ok: false, error: { code: "NOT_FOUND", message: "接口不存在。" } });
      return;
    }
    if (pathname.startsWith("/api/market-agent") && !authStatus.grants.market) {
      sendJson(res, 404, { ok: false, error: { code: "NOT_FOUND", message: "接口不存在。" } });
      return;
    }
    if (await handleWealthAgentApi(req, res, pathname, agentService, diagnostics)) return;
    if (await handleWealthAgentApi(req, res, pathname, marketAgentService, diagnostics, "/api/market-agent", marketFileChannel)) return;
    if (await handleStrategyAuthApi(req, res, pathname, strategyAuthService)) return;
    if (await handleOfficeTourAuthApi(req, res, pathname, officeTourAuthService)) return;

    if (!["GET", "HEAD"].includes(req.method || "")) {
      res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Method Not Allowed");
      return;
    }

    if (pathname === "/office-tour") {
      res.writeHead(308, {
        Location: "/office-tour/",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      });
      res.end();
      return;
    }

    const isOfficeTourRequest = pathname.startsWith("/office-tour/");
    const officeTourStatus = officeTourAuthService.status(req);
    if (isOfficeTourRequest && !officeTourStatus.authenticated) {
      if (pathname === "/office-tour/" || pathname === "/office-tour/index.html") {
        sendOfficeTourGate(req, res, officeTourStatus.configured);
      } else {
        sendPlain(req, res, 404, "Not Found", officeTourSecurityHeaders(true));
      }
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
    const protectedHeaders = protectedScope ? {
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
      "X-Content-Type-Options": "nosniff"
    } : {};
    const officeTourHeaders = isOfficeTourRequest
      ? officeTourSecurityHeaders(!officeTourStatus.public)
      : {};
    if (sendFile(req, res, filePath, {
      ...protectedHeaders,
      ...officeTourHeaders
    })) return;
    if (isOfficeTourRequest) {
      sendPlain(req, res, 404, "Not Found", officeTourSecurityHeaders(!officeTourStatus.public));
      return;
    }
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

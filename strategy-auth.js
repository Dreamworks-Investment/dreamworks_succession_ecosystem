import { createHmac, createHash, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "dw_strategy_auth";
const DEFAULT_TTL_SECONDS = 8 * 60 * 60;
const VALID_SCOPES = new Set(["cases", "agent"]);

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function clampTtl(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_TTL_SECONDS;
  return Math.min(Math.max(Math.round(parsed), 5 * 60), 24 * 60 * 60);
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function digest(value) {
  return createHash("sha256").update(String(value), "utf8").digest();
}

function safeEqual(left, right) {
  return timingSafeEqual(digest(left), digest(right));
}

function parseCookies(header = "") {
  return String(header).split(";").reduce((cookies, entry) => {
    const separator = entry.indexOf("=");
    if (separator < 1) return cookies;
    const key = entry.slice(0, separator).trim();
    const value = entry.slice(separator + 1).trim();
    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      cookies[key] = value;
    }
    return cookies;
  }, {});
}

function isSecureRequest(req) {
  if (req.socket?.encrypted) return true;
  return String(req.headers?.["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim()
    .toLowerCase() === "https";
}

export function createStrategyAuthService(options = {}) {
  const env = options.env || process.env;
  const now = options.now || (() => Date.now());
  const ttlSeconds = clampTtl(env.STRATEGY_AUTH_SESSION_TTL_SECONDS);
  const sessionSecret = clean(env.STRATEGY_AUTH_SESSION_SECRET);
  const credentials = {
    cases: {
      username: clean(env.STRATEGY_CASES_USERNAME),
      password: String(env.STRATEGY_CASES_PASSWORD || "")
    },
    agent: {
      username: clean(env.STRATEGY_AGENT_USERNAME),
      password: String(env.STRATEGY_AGENT_PASSWORD || "")
    }
  };

  function configured(scope) {
    if (scope === "session") return sessionSecret.length >= 32;
    const credential = credentials[scope];
    return Boolean(credential?.username && credential?.password && configured("session"));
  }

  function signature(encodedPayload) {
    return createHmac("sha256", sessionSecret).update(encodedPayload).digest("base64url");
  }

  function encode(grants) {
    const payload = base64url(JSON.stringify({
      v: 1,
      grants: [...new Set(grants)].filter(scope => VALID_SCOPES.has(scope)),
      exp: Math.floor(now() / 1000) + ttlSeconds
    }));
    return `${payload}.${signature(payload)}`;
  }

  function decode(token) {
    if (!configured("session") || typeof token !== "string") return null;
    const [payload, candidateSignature, extra] = token.split(".");
    if (!payload || !candidateSignature || extra) return null;
    if (!safeEqual(signature(payload), candidateSignature)) return null;
    try {
      const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      if (parsed.v !== 1 || !Array.isArray(parsed.grants) || !Number.isFinite(parsed.exp)) return null;
      if (parsed.exp <= Math.floor(now() / 1000)) return null;
      return {
        grants: parsed.grants.filter(scope => VALID_SCOPES.has(scope)),
        expiresAt: new Date(parsed.exp * 1000).toISOString()
      };
    } catch {
      return null;
    }
  }

  function session(req) {
    const token = parseCookies(req.headers?.cookie || "")[COOKIE_NAME];
    return decode(token) || { grants: [], expiresAt: null };
  }

  function status(req) {
    const current = session(req);
    return {
      grants: {
        cases: current.grants.includes("cases"),
        agent: current.grants.includes("agent")
      },
      configured: {
        cases: configured("cases"),
        agent: configured("agent"),
        session: configured("session")
      },
      expiresAt: current.expiresAt
    };
  }

  function authenticate(scope, username, password) {
    if (!VALID_SCOPES.has(scope)) return { ok: false, reason: "invalid_scope" };
    if (!configured(scope)) return { ok: false, reason: "not_configured" };
    const expected = credentials[scope];
    const validUsername = safeEqual(clean(username), expected.username);
    const validPassword = safeEqual(String(password || ""), expected.password);
    return { ok: validUsername && validPassword, reason: validUsername && validPassword ? null : "invalid_credentials" };
  }

  function cookie(req, grants) {
    const value = encode(grants);
    const secure = isSecureRequest(req) ? "; Secure" : "";
    return `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${ttlSeconds}${secure}`;
  }

  function clearCookie(req) {
    const secure = isSecureRequest(req) ? "; Secure" : "";
    return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
  }

  function grant(req, scope) {
    const current = session(req);
    return cookie(req, [...current.grants, scope]);
  }

  function revoke(req, scope) {
    if (!scope || scope === "all") return clearCookie(req);
    const remaining = session(req).grants.filter(grantScope => grantScope !== scope);
    return remaining.length ? cookie(req, remaining) : clearCookie(req);
  }

  function agentConfig() {
    return {
      channelToken: clean(env.STRATEGY_AILY_CHANNEL_TOKEN),
      sdkVersion: clean(env.STRATEGY_AILY_SDK_VERSION) || "0.0.12",
      iframeOrigin: clean(env.STRATEGY_AILY_IFRAME_ORIGIN) || "https://aily.feishu.cn",
      allowedHost: clean(env.STRATEGY_AILY_ALLOWED_HOST)
    };
  }

  return {
    cookieName: COOKIE_NAME,
    status,
    session,
    authenticate,
    grant,
    revoke,
    configured,
    agentConfig
  };
}

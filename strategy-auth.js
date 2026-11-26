import { createHmac, createHash, timingSafeEqual } from "node:crypto";

const COOKIE_PREFIX = "dw_auth_";
const DEFAULT_TTL_SECONDS = 8 * 60 * 60;
const VALID_SCOPES = new Set(["cases", "chat", "agent", "value", "wealth", "trust", "market"]);

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
    // The confidential home-page artifact uses the case-library credential
    // pair, but receives its own signed cookie so one login never unlocks the
    // other area implicitly.
    chat: {
      username: clean(env.STRATEGY_CASES_USERNAME),
      password: String(env.STRATEGY_CASES_PASSWORD || "")
    },
    agent: {
      username: clean(env.STRATEGY_AGENT_USERNAME),
      password: String(env.STRATEGY_AGENT_PASSWORD || "")
    },
    value: {
      username: clean(env.VALUE_AGENT_USERNAME),
      password: String(env.VALUE_AGENT_PASSWORD || "")
    },
    wealth: {
      username: clean(env.WEALTH_AGENT_USERNAME),
      password: String(env.WEALTH_AGENT_PASSWORD || "")
    },
    trust: {
      username: clean(env.TRUST_AGENT_USERNAME),
      password: String(env.TRUST_AGENT_PASSWORD || "")
    },
    market: {
      username: clean(env.MARKET_AGENT_USERNAME),
      password: String(env.MARKET_AGENT_PASSWORD || "")
    }
  };

  function configured(scope) {
    if (scope === "session") return sessionSecret.length >= 32;
    const credential = credentials[scope];
    return Boolean(credential?.username && credential?.password && configured("session"));
  }

  function cookieName(scope) {
    return `${COOKIE_PREFIX}${scope}`;
  }

  function signature(scope, encodedPayload) {
    return createHmac("sha256", sessionSecret)
      .update(`scope:${scope}:${encodedPayload}`)
      .digest("base64url");
  }

  function encode(scope) {
    const payload = base64url(JSON.stringify({
      v: 2,
      scope,
      exp: Math.floor(now() / 1000) + ttlSeconds
    }));
    return `${payload}.${signature(scope, payload)}`;
  }

  function decode(scope, token) {
    if (!VALID_SCOPES.has(scope) || !configured("session") || typeof token !== "string") return null;
    const [payload, candidateSignature, extra] = token.split(".");
    if (!payload || !candidateSignature || extra) return null;
    if (!safeEqual(signature(scope, payload), candidateSignature)) return null;
    try {
      const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      if (parsed.v !== 2 || parsed.scope !== scope || !Number.isFinite(parsed.exp)) return null;
      if (parsed.exp <= Math.floor(now() / 1000)) return null;
      return {
        scope,
        expiresAt: new Date(parsed.exp * 1000).toISOString()
      };
    } catch {
      return null;
    }
  }

  function session(req) {
    const cookies = parseCookies(req.headers?.cookie || "");
    const decodedGrants = [];
    const decodedGrantExpiresAt = {};
    for (const scope of VALID_SCOPES) {
      const decoded = decode(scope, cookies[cookieName(scope)]);
      if (!decoded) continue;
      decodedGrants.push(scope);
      decodedGrantExpiresAt[scope] = decoded.expiresAt;
    }
    // A browser is allowed to hold exactly one protected business grant at a
    // time. Treat legacy/stale multi-cookie states as unauthenticated so an
    // old SDK instance or copied cookie set cannot merge departmental access.
    const conflict = decodedGrants.length > 1;
    const grants = conflict ? [] : decodedGrants;
    const grantExpiresAt = conflict ? {} : decodedGrantExpiresAt;
    const expiries = Object.values(grantExpiresAt).sort();
    return {
      grants,
      expiresAt: expiries[0] || null,
      grantExpiresAt,
      isolation: {
        mode: "exclusive",
        conflict,
        rejectedGrantCount: conflict ? decodedGrants.length : 0
      }
    };
  }

  function status(req) {
    const current = session(req);
    return {
      grants: {
        cases: current.grants.includes("cases"),
        chat: current.grants.includes("chat"),
        agent: current.grants.includes("agent"),
        value: current.grants.includes("value"),
        wealth: current.grants.includes("wealth"),
        trust: current.grants.includes("trust"),
        market: current.grants.includes("market")
      },
      configured: {
        cases: configured("cases"),
        chat: configured("chat"),
        agent: configured("agent"),
        value: configured("value"),
        wealth: configured("wealth"),
        trust: configured("trust"),
        market: configured("market"),
        session: configured("session")
      },
      expiresAt: current.expiresAt,
      grantExpiresAt: current.grantExpiresAt,
      isolation: current.isolation
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

  function cookie(req, scope) {
    const value = encode(scope);
    const secure = isSecureRequest(req) ? "; Secure" : "";
    return `${cookieName(scope)}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${ttlSeconds}${secure}`;
  }

  function clearCookie(req, scope) {
    const secure = isSecureRequest(req) ? "; Secure" : "";
    return `${cookieName(scope)}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
  }

  function grant(req, scope) {
    return cookie(req, scope);
  }

  function grantExclusive(req, scope) {
    if (!VALID_SCOPES.has(scope)) return [];
    return [
      cookie(req, scope),
      ...[...VALID_SCOPES]
        .filter(grantScope => grantScope !== scope)
        .map(grantScope => clearCookie(req, grantScope))
    ];
  }

  function revoke(req, scope) {
    if (!scope || scope === "all") {
      return [...VALID_SCOPES].map(grantScope => clearCookie(req, grantScope));
    }
    return clearCookie(req, scope);
  }

  function agentConfig(scope = "agent") {
    const tokenVariables = {
      agent: "STRATEGY_AILY_CHANNEL_TOKEN",
      value: "VALUE_AILY_CHANNEL_TOKEN",
      wealth: "WEALTH_AILY_CHANNEL_TOKEN",
      trust: "TRUST_AILY_CHANNEL_TOKEN"
    };
    return {
      channelToken: clean(env[tokenVariables[scope] || ""]),
      sdkVersion: clean(env.STRATEGY_AILY_SDK_VERSION) || "0.0.12",
      iframeOrigin: clean(env.STRATEGY_AILY_IFRAME_ORIGIN) || "https://aily.feishu.cn",
      allowedHost: clean(env.STRATEGY_AILY_ALLOWED_HOST)
    };
  }

  return {
    cookieNames: Object.fromEntries([...VALID_SCOPES].map(scope => [scope, cookieName(scope)])),
    status,
    session,
    authenticate,
    grant,
    grantExclusive,
    revoke,
    configured,
    agentConfig
  };
}

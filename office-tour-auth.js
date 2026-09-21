import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "dw_office_tour";
const DEFAULT_TTL_SECONDS = 8 * 60 * 60;

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function enabled(value) {
  return ["1", "true", "yes", "on"].includes(clean(value).toLowerCase());
}

function clampTtl(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_TTL_SECONDS;
  return Math.min(Math.max(Math.round(parsed), 5 * 60), 24 * 60 * 60);
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

export function createOfficeTourAuthService(options = {}) {
  const env = options.env || process.env;
  const now = options.now || (() => Date.now());
  const publicAccess = enabled(env.OFFICE_TOUR_PUBLIC);
  const username = clean(env.OFFICE_TOUR_USERNAME);
  const password = String(env.OFFICE_TOUR_PASSWORD || "");
  const sessionSecret = clean(env.OFFICE_TOUR_SESSION_SECRET);
  const ttlSeconds = clampTtl(env.OFFICE_TOUR_SESSION_TTL_SECONDS);

  function configured() {
    return publicAccess || Boolean(username && password && sessionSecret.length >= 32);
  }

  function sign(payload) {
    return createHmac("sha256", sessionSecret)
      .update(`audience:office-tour:${payload}`)
      .digest("base64url");
  }

  function encode() {
    const payload = Buffer.from(JSON.stringify({
      v: 1,
      audience: "office-tour",
      exp: Math.floor(now() / 1000) + ttlSeconds
    }), "utf8").toString("base64url");
    return `${payload}.${sign(payload)}`;
  }

  function decode(token) {
    if (!configured() || publicAccess || typeof token !== "string") return null;
    const [payload, candidateSignature, extra] = token.split(".");
    if (!payload || !candidateSignature || extra) return null;
    if (!safeEqual(sign(payload), candidateSignature)) return null;
    try {
      const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      if (parsed.v !== 1 || parsed.audience !== "office-tour" || !Number.isFinite(parsed.exp)) return null;
      if (parsed.exp <= Math.floor(now() / 1000)) return null;
      return { expiresAt: new Date(parsed.exp * 1000).toISOString() };
    } catch {
      return null;
    }
  }

  function status(req) {
    if (publicAccess) {
      return { authenticated: true, configured: true, public: true, expiresAt: null };
    }
    const token = parseCookies(req.headers?.cookie || "")[COOKIE_NAME];
    const session = decode(token);
    return {
      authenticated: Boolean(session),
      configured: configured(),
      public: false,
      expiresAt: session?.expiresAt || null
    };
  }

  function authenticate(candidateUsername, candidatePassword) {
    if (publicAccess) return { ok: true, reason: null };
    if (!configured()) return { ok: false, reason: "not_configured" };
    const validUsername = safeEqual(clean(candidateUsername), username);
    const validPassword = safeEqual(String(candidatePassword || ""), password);
    const ok = validUsername && validPassword;
    return { ok, reason: ok ? null : "invalid_credentials" };
  }

  function grant(req) {
    const secure = isSecureRequest(req) ? "; Secure" : "";
    return `${COOKIE_NAME}=${encodeURIComponent(encode())}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${ttlSeconds}${secure}`;
  }

  function revoke(req) {
    const secure = isSecureRequest(req) ? "; Secure" : "";
    return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
  }

  return {
    cookieName: COOKIE_NAME,
    status,
    authenticate,
    grant,
    revoke,
    configured
  };
}

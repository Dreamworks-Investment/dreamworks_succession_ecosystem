import { randomUUID } from "node:crypto";

const DEFAULT_TTL_MS = 60 * 60 * 1000;
const DEFAULT_MAX_TRACES = 120;
const MAX_STRING_LENGTH = 800;
const SENSITIVE_KEY = /(authorization|cookie|password|secret|token|api[_-]?key|client[_-]?secret)/i;

function redactString(value) {
  return String(value)
    .replace(/Bearer\s+[^\s"']+/gi, "Bearer [REDACTED]")
    .replace(/([?&](?:q-signature|access_token|token|api_key|key)=)[^&\s]+/gi, "$1[REDACTED]")
    .slice(0, MAX_STRING_LENGTH);
}

function sanitize(value, key = "", depth = 0, seen = new Set()) {
  if (SENSITIVE_KEY.test(key) && !/(configured|conflict|length|source|expires|host|type)$/i.test(key)) {
    return "[REDACTED]";
  }
  if (value == null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return redactString(value);
  if (depth >= 5) return "[TRUNCATED]";
  if (typeof value !== "object") return redactString(value);
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);
  if (Array.isArray(value)) return value.slice(0, 40).map(item => sanitize(item, key, depth + 1, seen));
  const output = {};
  for (const [childKey, childValue] of Object.entries(value).slice(0, 60)) {
    output[childKey] = sanitize(childValue, childKey, depth + 1, seen);
  }
  return output;
}

function safeError(error) {
  if (!error) return null;
  return sanitize({
    name: error.name || "Error",
    code: error.code || "UNKNOWN_ERROR",
    message: error.message || "Unknown error",
    statusCode: error.statusCode || 500,
    details: error.details || undefined
  });
}

class DiagnosticTrace {
  constructor(store, operation, metadata = {}) {
    this.store = store;
    this.traceId = `dw-${randomUUID()}`;
    this.operation = operation;
    this.startedAt = new Date().toISOString();
    this.startedMs = Date.now();
    this.finishedAt = null;
    this.outcome = "running";
    this.metadata = sanitize(metadata);
    this.events = [];
    this.error = null;
    this.event("trace.started", "start", { operation });
  }

  event(stage, status = "info", data = {}) {
    const entry = {
      sequence: this.events.length + 1,
      timestamp: new Date().toISOString(),
      offsetMs: Date.now() - this.startedMs,
      stage,
      status,
      data: sanitize(data)
    };
    this.events.push(entry);
    this.store.write({
      service: "dreamworks-wealth-agent",
      traceId: this.traceId,
      operation: this.operation,
      ...entry
    });
    return entry;
  }

  span(stage, data = {}) {
    const started = Date.now();
    this.event(stage, "start", data);
    let ended = false;
    return (status = "success", endData = {}) => {
      if (ended) return;
      ended = true;
      this.event(stage, status, { ...endData, durationMs: Date.now() - started });
    };
  }

  finish(outcome = "success", data = {}) {
    if (this.finishedAt) return this.snapshot();
    this.outcome = outcome;
    this.finishedAt = new Date().toISOString();
    this.event("trace.finished", outcome, { ...data, durationMs: Date.now() - this.startedMs });
    this.store.save(this);
    return this.snapshot();
  }

  fail(error, data = {}) {
    if (this.finishedAt) return this.snapshot();
    this.error = safeError(error);
    this.event("trace.error", "error", { ...data, error: this.error });
    return this.finish("error");
  }

  snapshot() {
    return {
      schemaVersion: "dreamworks-agent-trace-v1",
      traceId: this.traceId,
      operation: this.operation,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      durationMs: Date.now() - this.startedMs,
      outcome: this.outcome,
      metadata: this.metadata,
      events: this.events.map(event => sanitize(event)),
      error: this.error
    };
  }
}

export function createDiagnosticStore({
  maxTraces = DEFAULT_MAX_TRACES,
  ttlMs = DEFAULT_TTL_MS,
  logger = entry => console.log(JSON.stringify(entry))
} = {}) {
  const traces = new Map();

  function prune() {
    const now = Date.now();
    for (const [traceId, record] of traces) {
      if (now - record.savedAt > ttlMs) traces.delete(traceId);
    }
    while (traces.size > maxTraces) traces.delete(traces.keys().next().value);
  }

  return {
    start(operation, metadata) {
      prune();
      return new DiagnosticTrace(this, operation, metadata);
    },
    save(trace) {
      traces.set(trace.traceId, { savedAt: Date.now(), snapshot: trace.snapshot() });
      prune();
    },
    get(traceId) {
      prune();
      return traces.get(traceId)?.snapshot || null;
    },
    write(entry) {
      try { logger(sanitize(entry)); } catch {}
    }
  };
}

export function diagnosticError(error) {
  return safeError(error);
}

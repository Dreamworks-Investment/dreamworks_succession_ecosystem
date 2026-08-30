import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { ReadableStream } from 'node:stream/web';
import { createWealthAgentService } from '../workbuddy-agent.js';
import { handleWealthAgentApi } from '../server.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const html = readFileSync(join(root, 'index.html'), 'utf8');
const browserClient = readFileSync(join(root, 'js/wealth-agent.js'), 'utf8');
const serverSource = readFileSync(join(root, 'server.js'), 'utf8');
const agentSource = readFileSync(join(root, 'workbuddy-agent.js'), 'utf8');
const envExample = readFileSync(join(root, '.env.example'), 'utf8');

assert(html.includes('id="wealth-agent-consent"'), 'AI handoff must require explicit consent');
assert(html.includes('id="wealth-agent-console"'), 'AI handoff must provide an embedded expert console');
assert(html.includes('js/wealth-agent.js?v=2'), 'AI handoff browser client must be loaded with the current cache version');
assert(browserClient.includes('namesRemoved: true'), 'Submitted context must be explicitly de-identified');
assert(browserClient.includes('assistantContent.textContent += event.text'), 'Agent output must be rendered as text, not HTML');
assert(!browserClient.includes('assistantContent.innerHTML'), 'Agent output must never be assigned through innerHTML');
assert(serverSource.includes('/api/wealth-agent/status'), 'Server must expose a safe configuration status route');
assert(serverSource.includes('isSameOrigin(req)'), 'Mutating AI routes must enforce same-origin requests');
assert(serverSource.includes('assertWithinRateLimit(req'), 'Public AI routes must have basic abuse protection');
assert(agentSource.includes('agent_01M1AB3GRFAR44G0ED9RQ51WY9'), 'Configured expert manifest ID must match the published expert');
assert(agentSource.includes('session/load'), 'ACP must load the Runtime default session before prompting');
assert(agentSource.includes('Acp-Connection-Id'), 'ACP calls must carry the negotiated connection ID');
assert(envExample.includes('WORKBUDDY_API_KEY=') && !envExample.match(/WORKBUDDY_API_KEY=\S+/), 'Example environment file must not contain a secret');
assert(envExample.includes('WORKBUDDY_CLIENT_ID=') && envExample.includes('WORKBUDDY_CLIENT_SECRET='), 'Enterprise OAuth variables must be documented');

const combinedSource = [html, browserClient, serverSource, agentSource, envExample].join('\n');
assert(!combinedSource.includes('q-signature='), 'Temporary signed plugin URLs must not be committed');
assert(!combinedSource.match(/AKID[0-9A-Za-z]{12,}/), 'Cloud access key identifiers must not be committed');

const encoder = new TextEncoder();
const runtimeId = '2079388093639327744';
const apiBase = 'https://workbuddy.test/v2/agentos';
const tokenUrl = 'https://copilot.test/oauth2/token';
const acpUrl = 'https://runtime.test/acp';
const liveCalls = [];
let notificationController;

function fakeResponse(bodyValue, { status = 200, headers = {} } = {}) {
  const normalizedHeaders = new Map(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: name => normalizedHeaders.get(String(name).toLowerCase()) || null },
    body: bodyValue instanceof ReadableStream ? bodyValue : null,
    async text() { return typeof bodyValue === 'string' ? bodyValue : ''; }
  };
}

function sseStream(envelopes) {
  return new ReadableStream({
    start(controller) {
      for (const envelope of envelopes) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(envelope)}\n\n`));
      }
      controller.close();
    }
  });
}

async function fakeWorkBuddyFetch(url, options = {}) {
  const method = options.method || 'GET';
  liveCalls.push({ url: String(url), method, headers: options.headers, body: options.body || '' });
  if (url === tokenUrl && method === 'POST') {
    const form = new URLSearchParams(options.body);
    assert.equal(form.get('grant_type'), 'client_credentials');
    assert.equal(form.get('client_id'), 'test-client-id');
    assert.equal(form.get('client_secret'), 'test-client-secret');
    return fakeResponse(JSON.stringify({ access_token: 'test-oauth-token', expires_in: 3600 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  if (url === `${apiBase}/runtimes` && method === 'POST') {
    assert.equal(options.headers.Authorization, 'Bearer test-oauth-token');
    return fakeResponse(JSON.stringify({
      code: 0,
      data: {
        id: runtimeId,
        status: 'RUNNING',
        links: { acpLink: { url: acpUrl, token: 'test-acp-token' } }
      }
    }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  }
  if (url === `${apiBase}/runtimes/${runtimeId}/delete` && method === 'POST') {
    return fakeResponse(JSON.stringify({ code: 0, data: { id: runtimeId } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  if (url === acpUrl && method === 'GET') {
    const stream = new ReadableStream({
      start(controller) {
        notificationController = controller;
        options.signal?.addEventListener('abort', () => {
          try { controller.close(); } catch (error) {}
        }, { once: true });
      }
    });
    return fakeResponse(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Acp-Connection-Id': 'connection-123' }
    });
  }
  if (url === acpUrl && method === 'POST') {
    assert.equal(options.headers['Acp-Connection-Id'], 'connection-123');
    assert.equal(options.headers.Accept, 'application/json, text/event-stream');
    const rpc = JSON.parse(options.body);
    if (rpc.method === 'session/prompt') {
      return fakeResponse(sseStream([
        {
          jsonrpc: '2.0',
          method: 'session/update',
          params: { update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: '真实协议模拟回复' } } }
        },
        { jsonrpc: '2.0', id: rpc.id, result: { stopReason: 'end_turn' } }
      ]), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    }
    const result = rpc.method === 'initialize'
      ? { protocolVersion: 1, agentInfo: { name: '身家诊断专家', version: '1.0' } }
      : { sessionId: runtimeId };
    queueMicrotask(() => notificationController.enqueue(encoder.encode(
      `data: ${JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result })}\n\n`
    )));
    return fakeResponse(null, { status: 202 });
  }
  if (url === acpUrl && method === 'DELETE') return fakeResponse('{}', { status: 200 });
  throw new Error(`Unexpected fake WorkBuddy request: ${method} ${url}`);
}

const liveService = createWealthAgentService({
  env: {
    WORKBUDDY_CLIENT_ID: 'test-client-id',
    WORKBUDDY_CLIENT_SECRET: 'test-client-secret',
    WORKBUDDY_API_KEY: 'test-runtime-api-key',
    WORKBUDDY_TOKEN_URL: tokenUrl,
    WORKBUDDY_API_BASE: apiBase,
    WORKBUDDY_SOURCE_APP: 'dreamworks-test',
    WORKBUDDY_AGENT_ID: 'agent_01M1AB3GRFAR44G0ED9RQ51WY9',
    WORKBUDDY_AGENT_NAME: '身家诊断专家',
    WORKBUDDY_RUNTIME_TIMEOUT_MS: '5000',
    WORKBUDDY_RPC_TIMEOUT_MS: '5000'
  },
  fetchImpl: fakeWorkBuddyFetch
});
const liveSession = await liveService.createSession({ sample: true, namesRemoved: true });
const liveChunks = [];
const liveResult = await liveService.prompt(liveSession.sessionId, '开始诊断', event => liveChunks.push(event));
assert.equal(liveResult.stopReason, 'end_turn');
assert(liveChunks.some(event => event.type === 'text' && event.text === '真实协议模拟回复'));
await liveService.closeSession(liveSession.sessionId);
assert.deepEqual(
  liveCalls.filter(call => call.url === acpUrl && call.method === 'POST').map(call => JSON.parse(call.body).method),
  ['initialize', 'session/load', 'session/prompt'],
  'ACP order must be initialize, load default session, then prompt'
);
const runtimeCreateBody = JSON.parse(liveCalls.find(call => call.url === `${apiBase}/runtimes`).body);
assert.equal(runtimeCreateBody.agentManifest.id, 'agent_01M1AB3GRFAR44G0ED9RQ51WY9');
assert.equal(Object.hasOwn(runtimeCreateBody.agentManifest, 'plugins'), false, 'Runtime must resolve the published expert without committing a signed plugin URL');
assert.deepEqual(
  runtimeCreateBody.agentManifest.secrets,
  [{ key: 'CODEBUDDY_API_KEY', value: 'test-runtime-api-key' }],
  'OAuth control-plane auth must support the API key required inside the expert Runtime'
);
assert.equal(liveCalls.filter(call => call.url === tokenUrl).length, 1, 'OAuth access token must be cached across Runtime API calls');
assert.equal(liveService.status().runtimeSecretConfigured, true, 'Runtime secret readiness must be visible without exposing its value');
assert.equal(liveService.status().integrationRevision, 'oauth-runtime-secret-v2');

const service = createWealthAgentService({
  env: {
    WORKBUDDY_MOCK: 'true',
    WORKBUDDY_AGENT_ID: 'agent_01M1AB3GRFAR44G0ED9RQ51WY9',
    WORKBUDDY_AGENT_NAME: '身家诊断专家'
  }
});

assert.equal(service.status().configured, true, 'Mock integration must report configured');
assert.equal(service.status().mode, 'mock', 'Mock integration must identify its mode');
assert.equal(service.status().authMode, 'mock', 'Mock integration must expose a non-secret authentication mode');

async function callApi(method, pathname, body) {
  const req = Readable.from(body == null ? [] : [JSON.stringify(body)]);
  req.method = method;
  req.url = pathname;
  req.headers = { host: 'dreamworks.test', 'content-type': 'application/json' };
  const response = {
    statusCode: 0,
    headers: {},
    body: '',
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
    end(chunk = '') {
      this.body += String(chunk);
      this.writableEnded = true;
    }
  };
  const handled = await handleWealthAgentApi(req, response, pathname, service);
  assert.equal(handled, true, `${pathname} must be handled by the AI API`);
  return response;
}

const statusResponse = await callApi('GET', '/api/wealth-agent/status');
const statusPayload = JSON.parse(statusResponse.body);
assert.equal(statusResponse.statusCode, 200);
assert.equal(statusPayload.configured, true);
assert.equal(Object.hasOwn(statusPayload, 'apiKey'), false, 'Status endpoint must not expose API key');
assert.equal(Object.hasOwn(statusPayload, 'clientSecret'), false, 'Status endpoint must not expose OAuth client secret');
assert.equal(Object.hasOwn(statusPayload, 'accessToken'), false, 'Status endpoint must not expose OAuth access token');

const rejected = await callApi('POST', '/api/wealth-agent/session', {
  consent: false,
  context: { sample: true }
});
assert.equal(rejected.statusCode, 400, 'Session creation must reject missing consent');

const created = await callApi('POST', '/api/wealth-agent/session', {
  consent: true,
  context: { sample: true, namesRemoved: true }
});
const createdPayload = JSON.parse(created.body);
assert.equal(created.statusCode, 201);
assert.match(createdPayload.sessionId, /^[a-f0-9-]{36}$/i);
assert.equal(Object.hasOwn(createdPayload, 'runtimeId'), false, 'Browser must receive only an opaque local session ID');

const prompted = await callApi(
  'POST',
  `/api/wealth-agent/session/${createdPayload.sessionId}/prompt`,
  { prompt: '诊断数据摘要：请开始。' }
);
assert.equal(prompted.statusCode, 200);
assert(prompted.body.includes('"type":"text"'), 'Prompt endpoint must stream expert text events');
assert(prompted.body.includes('"type":"done"'), 'Prompt endpoint must close each turn explicitly');

const closed = await callApi(
  'POST',
  `/api/wealth-agent/session/${createdPayload.sessionId}/close`,
  {}
);
assert.equal(closed.statusCode, 200);

console.log('WorkBuddy wealth-agent integration checks passed.');

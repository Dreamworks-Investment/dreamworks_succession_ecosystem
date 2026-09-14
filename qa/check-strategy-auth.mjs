import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { createDreamworksServer } from '../server.js';
import { createStrategyAuthService } from '../strategy-auth.js';

const env = {
  STRATEGY_CASES_USERNAME: 'internal@example.test',
  STRATEGY_CASES_PASSWORD: 'case-password-2026',
  STRATEGY_AGENT_USERNAME: 'client@example.test',
  STRATEGY_AGENT_PASSWORD: 'agent-password-2026',
  STRATEGY_AUTH_SESSION_SECRET: 'test-session-secret-that-is-at-least-thirty-two-characters',
  STRATEGY_AUTH_SESSION_TTL_SECONDS: '3600',
  STRATEGY_AILY_CHANNEL_TOKEN: 'wsk_test_token_never_in_public_html',
  STRATEGY_AILY_SDK_VERSION: '0.0.12',
  STRATEGY_AILY_IFRAME_ORIGIN: 'https://aily.feishu.cn',
  STRATEGY_AILY_ALLOWED_HOST: 'example.test',
  VALUE_AGENT_USERNAME: 'research@example.test',
  VALUE_AGENT_PASSWORD: 'research-password-2026',
  VALUE_AILY_CHANNEL_TOKEN: 'wsk_value_test_token_never_in_public_html',
  WEALTH_AGENT_USERNAME: 'wealth@example.test',
  WEALTH_AGENT_PASSWORD: 'wealth-password-2026',
  WEALTH_AILY_CHANNEL_TOKEN: 'wsk_wealth_test_token_never_in_public_html',
  TRUST_AGENT_USERNAME: 'trust@example.test',
  TRUST_AGENT_PASSWORD: 'trust-password-2026',
  TRUST_AILY_CHANNEL_TOKEN: 'wsk_trust_test_token_never_in_public_html'
};

const authService = createStrategyAuthService({ env });
assert.equal(authService.authenticate('cases', env.STRATEGY_CASES_USERNAME, env.STRATEGY_CASES_PASSWORD).ok, true);
assert.equal(authService.authenticate('chat', env.STRATEGY_CASES_USERNAME, env.STRATEGY_CASES_PASSWORD).ok, true);
assert.equal(authService.authenticate('agent', env.STRATEGY_CASES_USERNAME, env.STRATEGY_CASES_PASSWORD).ok, false);
assert.equal(authService.authenticate('cases', env.STRATEGY_AGENT_USERNAME, env.STRATEGY_AGENT_PASSWORD).ok, false);
assert.equal(authService.authenticate('value', env.VALUE_AGENT_USERNAME, env.VALUE_AGENT_PASSWORD).ok, true);
assert.equal(authService.authenticate('wealth', env.WEALTH_AGENT_USERNAME, env.WEALTH_AGENT_PASSWORD).ok, true);
assert.equal(authService.authenticate('trust', env.TRUST_AGENT_USERNAME, env.TRUST_AGENT_PASSWORD).ok, true);

const server = createDreamworksServer({
  strategyAuthService: authService,
  agentService: { status: () => ({ configured: false }) }
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});

const address = server.address();
const base = `http://127.0.0.1:${address.port}`;
const request = (path, options = {}) => fetch(base + path, options);
const cookieFrom = response => String(response.headers.get('set-cookie') || '').split(';')[0];
const setCookiesFrom = response => {
  if (typeof response.headers.getSetCookie === 'function') return response.headers.getSetCookie();
  return String(response.headers.get('set-cookie') || '').split(/,(?=\s*dw_auth_)/i);
};

const emptyGrants = () => ({ cases: false, chat: false, agent: false, value: false, wealth: false, trust: false });
const expectedGrantsFor = scope => ({ ...emptyGrants(), [scope]: true });

function assertExclusiveSetCookies(response, activeScope) {
  const cookies = setCookiesFrom(response);
  assert.equal(cookies.length, 6, `${activeScope} login must update all six compartment cookies`);
  assert(cookies.some(value => value.startsWith(`dw_auth_${activeScope}=`) && !/Max-Age=0(?:;|$)/.test(value)), `${activeScope} login must issue its active cookie`);
  for (const scope of ['cases', 'chat', 'agent', 'value', 'wealth', 'trust']) {
    if (scope === activeScope) continue;
    assert(cookies.some(value => value.startsWith(`dw_auth_${scope}=;`) && value.includes('Max-Age=0')), `${activeScope} login must revoke ${scope}`);
  }
}

try {
  const publicIndexResponse = await request('/');
  const publicIndex = await publicIndexResponse.text();
  assert.equal(publicIndexResponse.status, 200);
  assert.match(publicIndexResponse.headers.get('cache-control') || '', /no-store/);
  assert.match(publicIndexResponse.headers.get('vary') || '', /Cookie/);
  assert(publicIndex.includes('定位是中心，<span>价值才是核心</span>'), 'Public strategy hub must remain available');
  assert(publicIndex.includes('data-strategy-auth-form="cases"'), 'Public HTML must include the case-library gate');
  assert(publicIndex.includes('data-strategy-auth-form="chat"'), 'Public HTML must include the confidential-media gate');
  assert(publicIndex.includes('data-strategy-auth-form="agent"'), 'Public HTML must include the positioning-agent gate');
  assert(publicIndex.includes('data-strategy-auth-form="value"'), 'Public HTML must include the research-agent gate');
  assert(publicIndex.includes('data-strategy-auth-form="wealth"'), 'Public HTML must include the wealth-agent gate');
  assert(publicIndex.includes('data-strategy-auth-form="trust"'), 'Public HTML must include the trust-agent gate');
  assert(!publicIndex.includes('八个合作项目，一套通用翻阅方式'), 'Public HTML must not contain the protected case library');
  assert(!publicIndex.includes('id="strategy-agent-websdk-view"'), 'Public HTML must not contain the protected agent view');
  assert(!publicIndex.includes('id="value-agent-websdk-view"'), 'Public HTML must not contain the protected research-agent view');
  assert(!publicIndex.includes('id="wealth-agent-websdk-view"'), 'Public HTML must not contain the protected wealth-agent view');
  assert(!publicIndex.includes('id="trust-agent-websdk-view"'), 'Public HTML must not contain the protected trust-agent view');
  assert(!publicIndex.includes(env.STRATEGY_AILY_CHANNEL_TOKEN), 'Public HTML must never contain the Aily channel token');
  assert(!publicIndex.includes(env.STRATEGY_CASES_USERNAME), 'Public HTML must never contain login credentials');
  ['value', 'wealth', 'trust', 'academy', 'charity', 'vision'].forEach(page => {
    assert(publicIndex.includes(`id="page-${page}"`), `Public render must preserve page-${page}`);
  });
  assert(!publicIndex.includes('id="wealth-agent-launch"'), 'Public HTML must not expose the internal WorkBuddy review entry');
  const publicWealthAgentApi = await request('/api/wealth-agent/status');
  assert.equal(publicWealthAgentApi.status, 404, 'Public visitors must not be able to call the internal WorkBuddy API');

  const publicAsset = await request('/assets/strategy/scene-home.png');
  assert.equal(publicAsset.status, 404, 'Strategy assets must not be directly retrievable before case authentication');
  const publicConfidentialAsset = await request('/assets/confidential/strategy-wechat-case.jpeg');
  assert.equal(publicConfidentialAsset.status, 404, 'Confidential media must not be directly retrievable before its own authentication');
  const publicCaseScript = await request('/js/strategy-cases-data.js');
  assert.equal(publicCaseScript.status, 404, 'Case data must not be directly retrievable before authentication');
  const publicDocument = await request('/docs/strategy/chapter2-final/RESEARCH_SOURCE_INDEX.md');
  assert.equal(publicDocument.status, 404, 'Strategy documents must be protected with the case library');

  const badLogin = await request('/api/strategy-auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope: 'cases', username: env.STRATEGY_CASES_USERNAME, password: 'wrong' })
  });
  assert.equal(badLogin.status, 401);
  assert(!JSON.stringify(await badLogin.json()).includes(env.STRATEGY_CASES_USERNAME), 'Login errors must not echo usernames');

  const casesLogin = await request('/api/strategy-auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope: 'cases', username: env.STRATEGY_CASES_USERNAME, password: env.STRATEGY_CASES_PASSWORD })
  });
  assert.equal(casesLogin.status, 200);
  assertExclusiveSetCookies(casesLogin, 'cases');
  const casesCookie = cookieFrom(casesLogin);
  assert(casesCookie.startsWith('dw_auth_cases='), 'Case login must issue its own scope-bound HttpOnly cookie');
  assert.match(casesLogin.headers.get('set-cookie') || '', /HttpOnly/);
  assert.match(casesLogin.headers.get('set-cookie') || '', /SameSite=Strict/);
  const transplantedCasesToken = casesCookie.slice(casesCookie.indexOf('=') + 1);
  const transplantedCasesStatus = await (await request('/api/strategy-auth/status', {
    headers: { Cookie: `dw_auth_agent=${transplantedCasesToken}` }
  })).json();
  assert.deepEqual(transplantedCasesStatus.grants, { cases: false, chat: false, agent: false, value: false, wealth: false, trust: false }, 'A signed cookie value must not be reusable under another scope name');

  const casesIndexResponse = await request('/#strategy-library', { headers: { Cookie: casesCookie } });
  const casesIndex = await casesIndexResponse.text();
  assert(casesIndex.includes('八个合作项目，一套通用翻阅方式'), 'Case grant must reveal the case library');
  assert(!casesIndex.includes('data-strategy-auth-form="cases"'), 'Case grant must remove the blocker instead of rendering it beside the library');
  assert(!casesIndex.includes('id="strategy-cases-access"'), 'The authenticated case-library HTML must not contain the blocker stage');
  assert(casesIndex.includes('js/strategy-cases-data.js'), 'Case grant must load the protected case router');
  assert(casesIndex.includes('id="wealth-agent-launch"'), 'Internal case-library grant must reveal the controlled WorkBuddy review entry');
  const internalWealthAgentApi = await request('/api/wealth-agent/status', { headers: { Cookie: casesCookie } });
  assert.equal(internalWealthAgentApi.status, 200, 'Internal case-library grant must unlock the WorkBuddy review API');
  assert(!casesIndex.includes('id="strategy-agent-websdk-view"'), 'Case grant must not reveal the independently protected agent');
  const protectedAsset = await request('/assets/strategy/scene-home.png', { headers: { Cookie: casesCookie } });
  assert.equal(protectedAsset.status, 200);
  assert.match(protectedAsset.headers.get('cache-control') || '', /private, no-store/);
  assert.match(protectedAsset.headers.get('vary') || '', /Cookie/);
  const casesCannotReadConfidentialMedia = await request('/assets/confidential/strategy-wechat-case.jpeg', { headers: { Cookie: casesCookie } });
  assert.equal(casesCannotReadConfidentialMedia.status, 404, 'Case-library login must not automatically unlock the confidential chat image');
  const casesCannotReadAgentConfig = await request('/api/strategy-auth/agent-config', { headers: { Cookie: casesCookie } });
  assert.equal(casesCannotReadAgentConfig.status, 401, 'Case access must not imply agent access');

  const agentLogin = await request('/api/strategy-auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: casesCookie },
    body: JSON.stringify({ scope: 'agent', username: env.STRATEGY_AGENT_USERNAME, password: env.STRATEGY_AGENT_PASSWORD })
  });
  assert.equal(agentLogin.status, 200);
  assertExclusiveSetCookies(agentLogin, 'agent');
  const agentCookie = cookieFrom(agentLogin);
  assert(agentCookie.startsWith('dw_auth_agent='), 'Positioning-agent login must issue a separate scope-bound cookie');
  const agentOnlyStatus = await (await request('/api/strategy-auth/status', { headers: { Cookie: agentCookie } })).json();
  assert.deepEqual(agentOnlyStatus.grants, { cases: false, chat: false, agent: true, value: false, wealth: false, trust: false }, 'One scope cookie must never inherit another scope');
  const combinedCookie = `${casesCookie}; ${agentCookie}`;
  const combinedIndex = await (await request('/#strategy-agent', { headers: { Cookie: combinedCookie } })).text();
  assert(!combinedIndex.includes('八个合作项目，一套通用翻阅方式'), 'Conflicting old grants must not reveal the case library');
  assert(!combinedIndex.includes('id="strategy-agent-websdk-view"'), 'Conflicting old grants must not reveal the protected agent page');
  assert(combinedIndex.includes('data-strategy-auth-form="cases"'), 'A conflict must restore the case blocker');
  assert(combinedIndex.includes('data-strategy-auth-form="agent"'), 'A conflict must restore the agent blocker');
  assert(!combinedIndex.includes(env.STRATEGY_AILY_CHANNEL_TOKEN), 'Even authenticated HTML must not inline the Aily token');

  const conflictingStatus = await (await request('/api/strategy-auth/status', { headers: { Cookie: combinedCookie } })).json();
  assert.deepEqual(conflictingStatus.grants, emptyGrants(), 'Multiple valid legacy cookies must fail closed');
  assert.deepEqual(conflictingStatus.isolation, { mode: 'exclusive', conflict: true, rejectedGrantCount: 2 });
  const conflictingAgentConfig = await request('/api/strategy-auth/agent-config', { headers: { Cookie: combinedCookie } });
  assert.equal(conflictingAgentConfig.status, 401, 'Conflicting old grants must not release a channel token');

  const agentConfigResponse = await request('/api/strategy-auth/agent-config', { headers: { Cookie: agentCookie } });
  assert.equal(agentConfigResponse.status, 200);
  const agentConfig = await agentConfigResponse.json();
  assert.equal(agentConfig.config.channelToken, env.STRATEGY_AILY_CHANNEL_TOKEN);

  const chatLogin = await request('/api/strategy-auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope: 'chat', username: env.STRATEGY_CASES_USERNAME, password: env.STRATEGY_CASES_PASSWORD })
  });
  assert.equal(chatLogin.status, 200);
  assertExclusiveSetCookies(chatLogin, 'chat');
  const chatCookie = cookieFrom(chatLogin);
  assert(chatCookie.startsWith('dw_auth_chat='), 'Confidential-media login must issue a separate scope-bound cookie');
  const chatOnlyStatus = await (await request('/api/strategy-auth/status', { headers: { Cookie: chatCookie } })).json();
  assert.deepEqual(chatOnlyStatus.grants, { cases: false, chat: true, agent: false, value: false, wealth: false, trust: false }, 'Confidential-media login must not unlock the case library or any agent');
  const confidentialAsset = await request('/assets/confidential/strategy-wechat-case.jpeg', { headers: { Cookie: chatCookie } });
  assert.equal(confidentialAsset.status, 200);
  assert.match(confidentialAsset.headers.get('cache-control') || '', /private, no-store/);
  const chatCannotReadCases = await request('/assets/strategy/scene-home.png', { headers: { Cookie: chatCookie } });
  assert.equal(chatCannotReadCases.status, 404, 'Confidential-media login must not unlock case-library assets');

  const scopeCookies = new Map([
    ['cases', casesCookie],
    ['chat', chatCookie],
    ['agent', agentCookie]
  ]);
  const businessAgents = [
    { scope: 'value', username: env.VALUE_AGENT_USERNAME, password: env.VALUE_AGENT_PASSWORD, token: env.VALUE_AILY_CHANNEL_TOKEN, view: 'value-agent-websdk-view' },
    { scope: 'wealth', username: env.WEALTH_AGENT_USERNAME, password: env.WEALTH_AGENT_PASSWORD, token: env.WEALTH_AILY_CHANNEL_TOKEN, view: 'wealth-agent-websdk-view' },
    { scope: 'trust', username: env.TRUST_AGENT_USERNAME, password: env.TRUST_AGENT_PASSWORD, token: env.TRUST_AILY_CHANNEL_TOKEN, view: 'trust-agent-websdk-view' }
  ];
  for (const agent of businessAgents) {
    const unauthorisedConfig = await request(`/api/strategy-auth/agent-config/${agent.scope}`);
    assert.equal(unauthorisedConfig.status, 401, `${agent.scope} config must require its own grant`);
    const login = await request('/api/strategy-auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: agent.scope, username: agent.username, password: agent.password })
    });
    assert.equal(login.status, 200, `${agent.scope} login must succeed`);
    assertExclusiveSetCookies(login, agent.scope);
    const scopeCookie = cookieFrom(login);
    assert(scopeCookie.startsWith(`dw_auth_${agent.scope}=`), `${agent.scope} must receive only its own cookie`);
    const isolatedStatus = await (await request('/api/strategy-auth/status', { headers: { Cookie: scopeCookie } })).json();
    assert.deepEqual(isolatedStatus.grants, expectedGrantsFor(agent.scope), `${agent.scope} login must not unlock any other area`);
    const protectedIndex = await (await request(`/#${agent.scope}-agent`, { headers: { Cookie: scopeCookie } })).text();
    assert(protectedIndex.includes(`id="${agent.view}"`), `${agent.scope} grant must reveal its protected agent view`);
    assert(!protectedIndex.includes(`data-strategy-auth-form="${agent.scope}"`), `${agent.scope} blocker must be removed after login`);
    assert(!protectedIndex.includes(agent.token), `${agent.scope} token must never be in HTML`);
    for (const other of businessAgents.filter(candidate => candidate.scope !== agent.scope)) {
      const otherConfig = await request(`/api/strategy-auth/agent-config/${other.scope}`, { headers: { Cookie: scopeCookie } });
      assert.equal(otherConfig.status, 401, `${agent.scope} cookie must not unlock ${other.scope}`);
    }
    const configResponse = await request(`/api/strategy-auth/agent-config/${agent.scope}`, { headers: { Cookie: scopeCookie } });
    assert.equal(configResponse.status, 200);
    assert.equal((await configResponse.json()).config.channelToken, agent.token);
    scopeCookies.set(agent.scope, scopeCookie);
  }

  const protectedResources = {
    cases: '/assets/strategy/scene-home.png',
    chat: '/assets/confidential/strategy-wechat-case.jpeg',
    agent: '/api/strategy-auth/agent-config',
    value: '/api/strategy-auth/agent-config/value',
    wealth: '/api/strategy-auth/agent-config/wealth',
    trust: '/api/strategy-auth/agent-config/trust'
  };
  const protectedUi = {
    cases: { content: '八个合作项目，一套通用翻阅方式', gate: 'data-strategy-auth-form="cases"' },
    agent: { content: 'id="strategy-agent-websdk-view"', gate: 'data-strategy-auth-form="agent"' },
    value: { content: 'id="value-agent-websdk-view"', gate: 'data-strategy-auth-form="value"' },
    wealth: { content: 'id="wealth-agent-websdk-view"', gate: 'data-strategy-auth-form="wealth"' },
    trust: { content: 'id="trust-agent-websdk-view"', gate: 'data-strategy-auth-form="trust"' }
  };

  // Full 6 × 6 access matrix: every cookie may open exactly its own resource,
  // and must be denied by each of the other five protected resources.
  for (const [sourceScope, sourceCookie] of scopeCookies) {
    const isolatedStatus = await (await request('/api/strategy-auth/status', { headers: { Cookie: sourceCookie } })).json();
    assert.deepEqual(isolatedStatus.grants, expectedGrantsFor(sourceScope), `${sourceScope} status must expose exactly one grant`);
    assert.deepEqual(isolatedStatus.isolation, { mode: 'exclusive', conflict: false, rejectedGrantCount: 0 });
    for (const [targetScope, resource] of Object.entries(protectedResources)) {
      const response = await request(resource, { headers: { Cookie: sourceCookie } });
      const expectedStatus = sourceScope === targetScope ? 200 : (targetScope === 'cases' || targetScope === 'chat' ? 404 : 401);
      assert.equal(response.status, expectedStatus, `${sourceScope} cookie must ${sourceScope === targetScope ? 'open' : 'not open'} ${targetScope}`);
    }
    const isolatedIndex = await (await request('/', { headers: { Cookie: sourceCookie } })).text();
    for (const [targetScope, markers] of Object.entries(protectedUi)) {
      assert.equal(isolatedIndex.includes(markers.content), sourceScope === targetScope, `${sourceScope} HTML must ${sourceScope === targetScope ? 'include' : 'exclude'} ${targetScope} protected UI`);
      assert.equal(isolatedIndex.includes(markers.gate), sourceScope !== targetScope, `${sourceScope} HTML must ${sourceScope !== targetScope ? 'retain' : 'remove'} ${targetScope} gate`);
    }
  }

  const allCookies = [...scopeCookies.values()].join('; ');
  const statusResponse = await request('/api/strategy-auth/status', { headers: { Cookie: allCookies } });
  const statusText = await statusResponse.text();
  assert(!statusText.includes(env.STRATEGY_CASES_USERNAME));
  assert(!statusText.includes(env.STRATEGY_CASES_PASSWORD));
  assert(!statusText.includes(env.STRATEGY_AUTH_SESSION_SECRET));
  assert(!statusText.includes(env.STRATEGY_AILY_CHANNEL_TOKEN));
  assert(!statusText.includes(env.VALUE_AILY_CHANNEL_TOKEN));
  assert(!statusText.includes(env.WEALTH_AILY_CHANNEL_TOKEN));
  assert(!statusText.includes(env.TRUST_AILY_CHANNEL_TOKEN));
  const status = JSON.parse(statusText);
  assert.deepEqual(status.grants, emptyGrants(), 'A six-cookie legacy state must fail closed rather than merge grants');
  assert.equal(status.isolation.mode, 'exclusive');
  assert.equal(status.isolation.conflict, true);
  assert.equal(status.isolation.rejectedGrantCount, 6);

  for (const resource of Object.values(protectedResources)) {
    const response = await request(resource, { headers: { Cookie: allCookies } });
    assert([401, 404].includes(response.status), `Conflicting cookies must deny ${resource}`);
  }

  const accessScript = readFileSync(new URL('../js/strategy-access.js', import.meta.url), 'utf8');
  const confidentialScript = readFileSync(new URL('../js/home-confidential-media.js', import.meta.url), 'utf8');
  assert(accessScript.includes('window.location.reload()'), 'Every successful login must cross a full-page lifecycle boundary');
  assert(!accessScript.includes('dreamworks:auth-granted'), 'Chat login must not mutate the live page into an authenticated state');
  assert(!confidentialScript.includes('dreamworks:auth-granted'), 'Confidential media must only unlock from server-rendered auth state');
} finally {
  await new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections?.();
  });
}

console.log('Strategy server-side access control checks passed.');

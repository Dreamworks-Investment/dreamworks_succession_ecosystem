import { strict as assert } from 'node:assert';
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
  STRATEGY_AILY_ALLOWED_HOST: 'example.test'
};

const authService = createStrategyAuthService({ env });
assert.equal(authService.authenticate('cases', env.STRATEGY_CASES_USERNAME, env.STRATEGY_CASES_PASSWORD).ok, true);
assert.equal(authService.authenticate('agent', env.STRATEGY_CASES_USERNAME, env.STRATEGY_CASES_PASSWORD).ok, false);
assert.equal(authService.authenticate('cases', env.STRATEGY_AGENT_USERNAME, env.STRATEGY_AGENT_PASSWORD).ok, false);

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

try {
  const publicIndexResponse = await request('/');
  const publicIndex = await publicIndexResponse.text();
  assert.equal(publicIndexResponse.status, 200);
  assert.match(publicIndexResponse.headers.get('cache-control') || '', /no-store/);
  assert.match(publicIndexResponse.headers.get('vary') || '', /Cookie/);
  assert(publicIndex.includes('定位是中心，<span>价值才是核心</span>'), 'Public strategy hub must remain available');
  assert(publicIndex.includes('data-strategy-auth-form="cases"'), 'Public HTML must include the case-library gate');
  assert(publicIndex.includes('data-strategy-auth-form="agent"'), 'Public HTML must include the positioning-agent gate');
  assert(!publicIndex.includes('十个合作项目，一套通用翻阅方式'), 'Public HTML must not contain the protected case library');
  assert(!publicIndex.includes('id="strategy-agent-websdk-view"'), 'Public HTML must not contain the protected agent view');
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
  const casesCookie = cookieFrom(casesLogin);
  assert(casesCookie.startsWith('dw_strategy_auth='), 'Successful login must issue the signed HttpOnly session cookie');
  assert.match(casesLogin.headers.get('set-cookie') || '', /HttpOnly/);
  assert.match(casesLogin.headers.get('set-cookie') || '', /SameSite=Strict/);

  const casesIndexResponse = await request('/#strategy-library', { headers: { Cookie: casesCookie } });
  const casesIndex = await casesIndexResponse.text();
  assert(casesIndex.includes('十个合作项目，一套通用翻阅方式'), 'Case grant must reveal the case library');
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
  const casesCannotReadAgentConfig = await request('/api/strategy-auth/agent-config', { headers: { Cookie: casesCookie } });
  assert.equal(casesCannotReadAgentConfig.status, 401, 'Case access must not imply agent access');

  const agentLogin = await request('/api/strategy-auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: casesCookie },
    body: JSON.stringify({ scope: 'agent', username: env.STRATEGY_AGENT_USERNAME, password: env.STRATEGY_AGENT_PASSWORD })
  });
  assert.equal(agentLogin.status, 200);
  const combinedCookie = cookieFrom(agentLogin);
  const combinedIndex = await (await request('/#strategy-agent', { headers: { Cookie: combinedCookie } })).text();
  assert(combinedIndex.includes('十个合作项目，一套通用翻阅方式'), 'Adding agent access must preserve the existing case grant');
  assert(combinedIndex.includes('id="strategy-agent-websdk-view"'), 'Agent grant must reveal the protected agent page');
  assert(combinedIndex.includes('js/strategy-agent-websdk.js?v=1'), 'Agent grant must load its SDK client');
  assert(!combinedIndex.includes(env.STRATEGY_AILY_CHANNEL_TOKEN), 'Even authenticated HTML must not inline the Aily token');

  const agentConfigResponse = await request('/api/strategy-auth/agent-config', { headers: { Cookie: combinedCookie } });
  assert.equal(agentConfigResponse.status, 200);
  const agentConfig = await agentConfigResponse.json();
  assert.equal(agentConfig.config.channelToken, env.STRATEGY_AILY_CHANNEL_TOKEN);

  const statusResponse = await request('/api/strategy-auth/status', { headers: { Cookie: combinedCookie } });
  const statusText = await statusResponse.text();
  assert(!statusText.includes(env.STRATEGY_CASES_USERNAME));
  assert(!statusText.includes(env.STRATEGY_CASES_PASSWORD));
  assert(!statusText.includes(env.STRATEGY_AUTH_SESSION_SECRET));
  assert(!statusText.includes(env.STRATEGY_AILY_CHANNEL_TOKEN));
  const status = JSON.parse(statusText);
  assert.deepEqual(status.grants, { cases: true, agent: true });
} finally {
  await new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections?.();
  });
}

console.log('Strategy server-side access control checks passed.');

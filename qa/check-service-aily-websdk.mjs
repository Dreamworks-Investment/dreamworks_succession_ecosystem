import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8');
const html = read('index.html');
const client = read('js/service-agent-websdk.js');
const css = read('css/service-agent-websdk.css');
const app = read('js/app.js');
const env = read('.env.example');

for (const scope of ['wealth', 'trust']) {
  assert(html.includes(`data-strategy-auth-form="${scope}"`), `${scope} must have its own authentication cover`);
  assert(html.includes(`id="${scope}-agent-websdk-view"`), `${scope} must have a protected agent view`);
  assert(html.includes(`id="${scope}-agent-container"`), `${scope} must have a Web SDK mount container`);
  assert(html.includes(`id="${scope}-agent-loading"`), `${scope} must have an individually removable loading cover`);
  assert(client.includes(`/api/strategy-auth/agent-config/${scope}`) || client.includes('`/api/strategy-auth/agent-config/${scope}`'), `${scope} must use the scoped config endpoint`);
}

assert(html.includes('点击进入 身家诊断顾问'), 'The wealth cover must include an agent CTA');
assert(html.includes('点击进入 家族信托设立系统顾问'), 'The trust cover must include an agent CTA');
assert(html.includes('WEALTH_AILY_PROTECTED_START') && html.includes('TRUST_AILY_PROTECTED_START'), 'Both agent pages must be server protected');
assert(client.includes("initAgentChat(elements.root, { channelToken: config.channelToken })"), 'Both agents must use the verified Aily Web SDK');
assert(client.includes('function hideLoading()'), 'The shared loader must remove its loading cover once the SDK mounts');
assert(client.includes('new MutationObserver'), 'The shared loader must observe the SDK-created iframe');
assert(client.includes("addTrace('iframe.created', 'success'"), 'Diagnostics must record iframe creation');
assert(client.includes("addTrace('iframe.loaded', 'success'"), 'Diagnostics must record iframe load completion');
assert(client.includes("replace(/wsk_[A-Za-z0-9_-]+/g, 'wsk_[REDACTED]')"), 'Diagnostics must redact any accidental token text');
assert(client.includes('downloadTrace'), 'Both agents must provide downloadable sanitized diagnostics');
assert(client.includes('window.wealthAilyOpen') && client.includes('window.trustAilyOpen'), 'Both page routers must be exposed');
assert(app.includes("requested === 'wealth-agent'") && app.includes("requested === 'trust-agent'"), 'Direct agent URLs must be routable');
assert(app.includes('window.wealthAilyAgentDestroy') && app.includes('window.trustAilyAgentDestroy'), 'Leaving a tab must destroy its SDK iframe');
assert(css.includes('.wealth-agent-auth-active') && css.includes('.trust-agent-auth-active'), 'Authentication covers must replace their underlying page content');

[
  'VALUE_AGENT_USERNAME', 'VALUE_AGENT_PASSWORD', 'VALUE_AILY_CHANNEL_TOKEN',
  'WEALTH_AGENT_USERNAME', 'WEALTH_AGENT_PASSWORD', 'WEALTH_AILY_CHANNEL_TOKEN',
  'TRUST_AGENT_USERNAME', 'TRUST_AGENT_PASSWORD', 'TRUST_AILY_CHANNEL_TOKEN'
].forEach((name) => assert(env.includes(`${name}=`), `${name} must be documented`));

assert(!/\bwsk_[A-Za-z0-9_-]{16,}\b/.test([html, client].join('\n')), 'No real Aily token may be committed to browser code');

console.log('Protected wealth/trust Aily Web SDK checks passed.');

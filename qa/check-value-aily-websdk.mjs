import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8');
const html = read('index.html');
const client = read('js/value-agent-websdk.js');
const authService = read('strategy-auth.js');
const server = read('server.js');
const app = read('js/app.js');
const css = read('css/value-agent-websdk.css');
const vendorSdk = read('vendor/aily-web-sdk/aily-web-sdk.js');

assert(html.includes('id="value-agent-websdk-view"'), 'Value investing needs a dedicated research-agent view');
assert(html.includes('id="value-agent-websdk-container"'), 'The research-agent view needs a Web SDK mount container');
assert(html.includes('点击进入 梦工场投研专员'), 'The value-investing introduction needs a visible research-agent CTA');
assert(html.includes('data-strategy-auth-form="value"'), 'The research assistant needs an independent server-side access cover');
assert(html.includes('VALUE_AGENT_PROTECTED_START'), 'The research assistant HTML must be server protected');
assert(html.includes('href="https://sd85slpdkcofupk4bn66g.apigateway-cn-guangzhou.volceapi.com/"'), 'The existing value-investing system CTA must remain available');
assert(html.includes('type="module" src="js/value-agent-websdk.js?v=1"'), 'The research-agent client must load as an ES module');
assert(html.includes('css/value-agent-websdk.css?v=1'), 'The research-agent view must load responsive styles');
assert(html.includes('/dreamworks-full-report-xu-prefin-v2'), 'The page must explain the general research skill');
assert(html.includes('/dreamworks-innovative-drug-report-xu-prefin-v2'), 'The page must explain the innovative-drug research skill');

assert(authService.includes('VALUE_AILY_CHANNEL_TOKEN'), 'The research-agent token must come from the deployment environment');
assert(server.includes('agent-config(?:\\/(value|wealth|trust))?'), 'The server must expose scoped protected configuration endpoints');

assert(client.includes("import { initAgentChat } from '../vendor/aily-web-sdk/aily-web-sdk.js'"), 'The research assistant must reuse the verified official SDK bundle');
assert(client.includes("fetch('/api/strategy-auth/agent-config/value'"), 'The token must be fetched only after server authentication');
assert(client.includes('initAgentChat(root, { channelToken: config.channelToken })'), 'The SDK must receive only the public channel token for this MVP');
assert(client.includes("'/dreamworks-full-report-xu-prefin-v2'"), 'The general skill copy template must be available');
assert(client.includes("'/dreamworks-innovative-drug-report-xu-prefin-v2'"), 'The innovative-drug skill copy template must be available');
assert(client.includes('skill.template.copied'), 'Skill-copy actions must be visible in sanitized diagnostics');
assert(client.includes('window.valueAgentDiagnostics'), 'Operators must be able to inspect a sanitized diagnostic trace');
assert(client.includes('downloadTrace'), 'Operators must be able to download the diagnostic trace');
assert(client.includes("handshake: handshakeTimedOutLikely ? 'not-confirmed' : 'confirmed'"), 'Slow SDK handshakes must remain visible instead of becoming false successes');
assert(!client.includes('customParams:'), 'The MVP must not inject unverified identity or stock data as trusted custom parameters');

assert(app.includes("requested === 'value-agent'"), 'The application router must support direct research-agent URLs');
assert(app.includes("event.state.valueView === 'agent'"), 'Browser Back/Forward must restore the research-agent view');
assert(app.includes('window.valueAgentDestroy'), 'Leaving the value-investing tab must destroy its SDK iframe');
assert(/js\/app\.js\?v=(?:[9]|[1-9]\d+)/.test(html), 'The modified router must use browser-cache revision 9 or later');
assert(css.includes('#page-value.value-agent-active .value-intro-document { display: none; }'), 'The agent route must replace rather than overlap the introduction slides');
assert(css.includes('@media (max-width: 820px)') && css.includes('@media (prefers-reduced-motion: reduce)'), 'The agent view needs mobile and reduced-motion treatments');

assert(/from\s+["']\.\/internal-slardar\.js["']/.test(vendorSdk), 'Vendored SDK dependencies must resolve without a package manager in the browser');
assert(!vendorSdk.includes("from '@lark-apaas/internal-slardar'"), 'The browser bundle must not retain a bare dependency import');
assert(![html, client].join('\n').match(/HS256|shared.?secret|client.?secret/i), 'Front-end integration must not contain a JWT shared secret');

console.log('Value Aily Web SDK checks passed (30 assertions).');

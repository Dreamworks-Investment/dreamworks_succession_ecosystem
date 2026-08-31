import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8');
const html = read('index.html');
const config = read('js/strategy-agent-config.js');
const agentClient = read('js/strategy-agent-websdk.js');
const strategyRouter = read('js/strategy-cases.js');
const appRouter = read('js/app.js');
const strategyChapters = read('js/strategy.js');
const vendorSdk = read('vendor/aily-web-sdk/aily-web-sdk.js');

assert(html.includes('id="strategy-agent-websdk-view"'), 'Strategy needs a dedicated embedded-agent view');
assert(html.includes('id="strategy-agent-websdk-container"'), 'Strategy needs a Web SDK mount container');
assert((html.match(/strategyOpenAgent\(\{ pushHistory: true \}\)/g) || []).length >= 2, 'Both strategy entry points must open the embedded agent');
assert(html.includes('type="module" src="js/strategy-agent-websdk.js?v=1"'), 'The Web SDK client must load as an ES module');
assert(html.includes('css/strategy-agent-websdk.css?v=1'), 'The embedded-agent view must load its responsive styles');

assert(config.includes("channelToken: 'wsk_"), 'The public Web SDK channel token must be configured');
assert(config.includes("sdkVersion: '0.0.12'"), 'The configuration must record the vendored SDK version');
assert(config.includes("allowedHost: 'sd9n9785votb4790h2vhu.apigateway-cn-guangzhou.volceapi.com'"), 'Diagnostics must compare against the configured production host');
assert(!config.includes('JWT') && !config.includes('CLIENT_SECRET'), 'No signing secret may be placed in browser configuration');

assert(agentClient.includes("import { initAgentChat } from '../vendor/aily-web-sdk/aily-web-sdk.js'"), 'The client must use the vendored official SDK');
assert(agentClient.includes('initAgentChat(root, { channelToken: config.channelToken })'), 'The SDK must receive only the channel token for this MVP');
assert(agentClient.includes('window.strategyAgentDiagnostics'), 'Operators must be able to inspect a sanitized diagnostic trace');
assert(agentClient.includes('downloadTrace'), 'Operators must be able to download the diagnostic trace');
assert(agentClient.includes('destroySdkInstance'), 'Leaving or retrying must dispose the embedded SDK safely');
assert(agentClient.includes('escapeHtml'), 'Provider error details must be escaped before diagnostic rendering');
assert(agentClient.includes("handshake: handshakeTimedOutLikely ? 'not-confirmed' : 'confirmed'"), 'Slow SDK handshakes must remain visible in diagnostics instead of being reported as a false success');
assert(!agentClient.includes('customParams:'), 'The MVP must not inject unverified identity data through custom parameters');

assert(strategyRouter.includes("setHistory('#strategy-agent'"), 'Opening the agent must create a restorable URL state');
assert(strategyRouter.includes("hash === 'strategy-agent'"), 'The strategy router must restore the agent view from history');
assert(strategyRouter.includes('window.strategyAgentDestroy'), 'Leaving the agent view must destroy the SDK instance');
assert(appRouter.includes("requested === 'strategy-agent'"), 'The application router must support direct loading of the agent URL');
assert(!strategyChapters.includes('STRATEGY_INTERACTION_URL'), 'The retired external-link placeholder must not compete with the embedded SDK route');
assert(strategyChapters.includes("if (!(event.state && event.state.strategyChapter) && !isChapterRoute) return;"), 'Chapter history handling must not hijack the embedded-agent Back/Forward route');

assert(vendorSdk.includes("from './internal-slardar.js'"), 'Vendored SDK dependencies must resolve without a package manager at runtime');
assert(!vendorSdk.includes("from '@lark-apaas/internal-slardar'"), 'The browser bundle must not retain a bare dependency import');
assert(![html, config, agentClient].join('\n').match(/HS256|shared.?secret|client.?secret/i), 'Front-end integration must not contain a JWT shared secret');

console.log('Strategy Aily Web SDK checks passed (26 assertions).');

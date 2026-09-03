import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const html = readFileSync(join(root, 'index.html'), 'utf8');
const app = readFileSync(join(root, 'js/app.js'), 'utf8');
const wealth = readFileSync(join(root, 'js/wealth.js'), 'utf8');
const report = readFileSync(join(root, 'js/report.js'), 'utf8');
const server = readFileSync(join(root, 'server.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

['assetAllocationChart', 'destructionChart', 'severeDamageChart', 'growthChart'].forEach(id => {
  assert(html.includes(`id="${id}"`), `Missing webpage chart ${id}`);
  assert(report.includes(`readWealthChartImage('${id}')`), `PDF must retrieve chart ${id}`);
});
assert(wealth.includes("wealthDataMode = 'sample'") && app.includes('wealthDataMode'), 'Sample/self data mode must persist with the five-step state');
assert(report.includes('演示样本 · 非用户真实数据'), 'Sample reports must be permanently labelled');
assert(html.includes('WEALTH_INTERNAL_REVIEW_START') && server.includes('wealthInternal'), 'WorkBuddy must be server-gated as an internal review tool');

console.log('Wealth dual-path, chart and PDF structure checks passed.');

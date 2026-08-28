import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const html = readFileSync(join(root, 'index.html'), 'utf8');
const app = readFileSync(join(root, 'js/app.js'), 'utf8');
const controller = readFileSync(join(root, 'js/final-business-pages.js'), 'utf8');
const css = readFileSync(join(root, 'css/final-business-pages.css'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert((html.match(/class="nav-link(?: active)?" data-page=/g) || []).length === 8, 'Navigation must contain exactly eight primary tabs');
assert((html.match(/id="page-academy"/g) || []).length === 1, 'Academy page must exist exactly once');
assert(html.includes('id="academy-cover-view"') && html.includes('id="academy-system-view"'), 'Academy requires cover and system views');
assert(html.includes('onclick="academyEnterSystem({ pushHistory: true })"'), 'Academy cover CTA must enter the existing system');
assert(html.includes('第五业务板块 · 传承学院'), 'Academy must be identified as the fifth business module');
assert((html.match(/id="page-charity"/g) || []).length === 1, 'Charity page must exist exactly once');
assert(html.includes('第六业务板块 · 公益慈善'), 'Charity must be identified as the sixth business module');
assert(html.includes('href="https://www.jianhuicishan.org/"'), 'Charity CTA must use the official destination');
assert(/href="https:\/\/www\.jianhuicishan\.org\/"[\s\S]{0,180}rel="noopener noreferrer"[\s\S]{0,100}target="_blank"/.test(html), 'Charity CTA must open safely in a new tab');
assert((html.match(/id="page-vision"/g) || []).length === 1, 'Six-common vision page must exist exactly once');
assert((html.match(/class="vision-node(?: is-active)? vision-node-[1-6]"/g) || []).length === 6, 'Six-common vision must contain six interactive nodes');
assert((controller.match(/title: '共[\u4e00-\u9fa5]{3}'/g) || []).length === 6, 'Each vision node must have a content definition');
assert((controller.match(/points: \[/g) || []).length === 6, 'Each vision content definition must provide its bullet set');
assert(controller.includes("node.addEventListener('mouseenter'") && controller.includes("node.addEventListener('focus'") && controller.includes("node.addEventListener('click'"), 'Vision nodes must support pointer, keyboard focus, and click interaction');
assert(controller.includes("event.key === 'ArrowRight'") && controller.includes("event.key === 'Home'"), 'Vision node group must support keyboard traversal');
assert(app.includes("requested === 'academy-system'") && app.includes('preserveAcademyView'), 'SPA router must support direct and history-restored academy system routes');
assert(app.includes("'charity', 'vision'"), 'SPA router must recognize charity and vision pages');
assert((html.match(/class="home-life-journey-node journey-node-06"[^>]+data-page="charity"/g) || []).length === 1, 'Homepage journey stage six must enter the charity page');
assert(css.includes('@media (max-width: 780px)') && css.includes('@media (prefers-reduced-motion: reduce)'), 'Final pages need responsive and reduced-motion treatments');
assert(!html.includes('/Users/harryhsu/Desktop/梦工场狠值传承系统.html'), 'Deployed HTML must not reference the source attachment');

console.log('Final business page checks passed (20 assertions).');

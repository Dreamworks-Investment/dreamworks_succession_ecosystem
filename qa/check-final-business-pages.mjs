import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const html = readFileSync(join(root, 'index.html'), 'utf8');
const app = readFileSync(join(root, 'js/app.js'), 'utf8');
const controller = readFileSync(join(root, 'js/final-business-pages.js'), 'utf8');
const css = readFileSync(join(root, 'css/final-business-pages.css'), 'utf8');
const academyCss = readFileSync(join(root, 'css/academy-experience.css'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert((html.match(/class="nav-link(?: active)?" data-page=/g) || []).length === 8, 'Navigation must contain exactly eight primary tabs');
assert((html.match(/id="page-academy"/g) || []).length === 1, 'Academy page must exist exactly once');
assert(html.includes('id="academy-cover-view"') && html.includes('id="academy-system-view"'), 'Academy requires cover and system views');
assert(html.includes('onclick="academyEnterSystem({ pushHistory: true })"'), 'Academy cover CTA must enter the existing system');
assert(html.includes('id="academy-about-view"') && html.includes('id="academy-cases-view"') && html.includes('id="academy-material-view"'), 'Academy requires about, case journey, and material preview views');
assert(html.includes('onclick="academyShowAbout({ pushHistory: true })"') && html.includes('onclick="academyShowCases({ pushHistory: true })"'), 'Academy cover must expose the two new MVP entry points');
assert((html.match(/class="academy-plate plate-/g) || []).length === 6, 'The 3D journey must be divided into six full plate-shaped interaction regions');
assert((html.match(/class="academy-plate-art"/g) || []).length === 6, 'Each plate must render through an independent transparent artwork layer');
assert((html.match(/<clipPath clipPathUnits="objectBoundingBox" id="academy-clip-/g) || []).length === 6, 'Each journey plate must use its own responsive SVG vector mask');
assert((html.match(/transform="scale\(0\.00079744816587\)"/g) || []).length === 6, 'Masks must share the original 1254-pixel coordinate system');
assert(!/<clipPath[^>]*>\s*<g/.test(html), 'SVG clip paths must contain supported shapes directly');
assert(!html.includes('--plate-clip:polygon('), 'Coarse polygon masks must not remain on the Academy journey');
assert((html.match(/data-academy-scene-milestone=/g) || []).length === 4, 'Only the four full plates with usable Word materials may open a milestone');
assert(!html.includes('academy-milestone-list') && !html.includes('academy-road-instruction'), 'The journey must not show permanent side cards or instructional labels over the artwork');
assert(html.includes('2025年3月') && html.includes('2025年5月1日'), 'Student A journey must use the approved timeline');
assert(html.includes('暂无对应材料') && html.includes('暂无公开材料'), 'Milestones without files must retain explicit non-interactive disclosure states');
assert(html.includes('assets/academy/student-a-roadmap-clay.png') && html.includes('academy-plate-map'), 'Student A journey must include the segmented claymorphic 3D roadmap visual');
assert(controller.includes("'human-growth'") && controller.includes('continuing:') && controller.includes('!milestone.materials.length'), 'Stages without materials must be rejected by the controller');
assert(controller.includes('setupAcademyPlateMap') && controller.includes('hotspot.dataset.academySceneMilestone'), 'Full plate clicks must reuse the existing milestone preview flow');
assert((controller.match(/https:\/\/www\.feishu\.cn\/docx\//g) || []).length === 0, 'Legacy Feishu material links must be fully replaced');
assert((controller.match(/assets\/academy\/materials\/[\w-]+\.docx/g) || []).length === 5, 'Exactly five valid unique Word originals must be mapped');
assert((controller.match(/assets\/academy\/materials\/[\w-]+\.html/g) || []).length === 5, 'Exactly five local document previews must be mapped');
assert(controller.includes("academySetView('about'") && controller.includes("academySetView('cases'") && controller.includes("academySetView('material'"), 'Academy controller must support each new view');
assert(app.includes("requested === 'academy-about'") && app.includes("requested === 'academy-cases'") && app.includes("requested.startsWith('academy-material-')"), 'SPA router must support new academy deep links');
assert(academyCss.includes('.academy-journey-road') && academyCss.includes('@keyframes academy-cap-rise'), 'Academy experience must include the winding journey and graduation motion');
assert(academyCss.includes('.academy-plate-map') && academyCss.includes('.academy-plate-clips') && academyCss.includes('clip-path: var(--plate-clip)') && academyCss.includes('translate3d(0, -14px, 0)'), 'Each vector-masked plate must lift independently without scaling the full artwork');
assert(academyCss.includes('student-a-roadmap-foreground-mask.png') && academyCss.includes('mask-mode: alpha'), 'Moving artwork must use the source-registered alpha mask so surrounding beige void never lifts');
assert(!academyCss.includes('.academy-plate::after'), 'A polygon-shaped highlight layer must not reintroduce blank wedges');
assert(academyCss.includes('.academy-plate:hover .academy-plate-label') && academyCss.includes('opacity: 0'), 'Plate labels must remain hidden until hover or keyboard focus');
assert(academyCss.includes('width: 100vw') && academyCss.includes('margin-left: calc(50% - 50vw)'), 'Admissions poster must render full-bleed');
assert((html.match(/>招生简章<\/h3>/g) || []).length === 2, 'Both admissions headings must use 招生简章');
assert(!html.includes('查看原图') && !html.includes('招生宣传海报') && !html.includes('传承学院宣传页'), 'Legacy admissions labels and original-image link must be removed');
assert(academyCss.includes('@media (max-width: 780px)') && academyCss.includes('@media (prefers-reduced-motion: reduce)'), 'Academy experience needs responsive and reduced-motion treatments');
[
  'admissions-poster.jpg',
  'admissions-brochure.pdf',
  'admissions-brochure-01.png',
  'admissions-brochure-02.png',
  'admissions-brochure-03.png',
  'student-a-roadmap-clay.png',
  'student-a-roadmap-foreground-mask.png'
].forEach((asset) => assert(existsSync(join(root, 'assets/academy', asset)), `Missing academy asset: ${asset}`));
[
  'opening-smart-plan.docx',
  'opening-smart-plan.html',
  'inheritance-questionnaire.docx',
  'inheritance-questionnaire.html',
  'trust-charity-qa.docx',
  'trust-charity-qa.html',
  'graduation-speech.docx',
  'graduation-speech.html',
  'graduation-plan.docx',
  'graduation-plan.html'
].forEach((asset) => assert(existsSync(join(root, 'assets/academy/materials', asset)), `Missing academy material: ${asset}`));
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

console.log('Final business page checks passed, including local Word academy materials and full-bleed admissions guide.');

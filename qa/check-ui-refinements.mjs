import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = file => readFileSync(join(root, file), 'utf8');
const html = read('index.html');
const pyramidCss = read('css/home-interactive-pyramid.css');
const strategyCss = read('css/strategy-case-gallery.css');
const charityCss = read('css/final-business-pages.css');
const homeCss = read('css/home-roadshow-curated.css');
const confidentialClient = read('js/home-confidential-media.js');
const accessClient = read('js/strategy-access.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(pyramidCss.includes('grid-template-columns: 126px minmax(0, 1fr)') && pyramidCss.includes('gap: 30px'), 'Pyramid preview must reserve a separate year column and visible gap');
assert((html.match(/class="cube-face cube-(front|back|right|left|top|bottom)"/g) || []).length === 6, 'Strategy model must contain all six cube faces');
assert((html.match(/class="cube-axis-line cube-axis-line-[rgs]"/g) || []).length === 3, 'Strategy cube must expose three connected R/G/S axes');
assert(strategyCss.includes('transform-style:preserve-3d'), 'Strategy cube must be rendered as one shared 3D object');

['original-14.png', 'original-16.png', 'original-13.png'].forEach(asset => {
  assert(html.includes(`data-charity-artifact-src="assets/home/roadshow-original/${asset}"`), `${asset} must be used by the charity image dashboard`);
});
assert(charityCss.includes('.charity-artifact-dialog'), 'Charity dashboard images must support an interactive large preview');

assert(!existsSync(join(root, 'assets/home/roadshow-original/client-1998-case-insert.jpeg')), 'Confidential chat must not remain in the public home asset directory');
assert(existsSync(join(root, 'assets/confidential/strategy-wechat-case.jpeg')), 'Confidential chat must be stored under the protected asset directory');
assert(html.includes('data-strategy-auth-form="chat"'), 'Confidential chat card must require its own login form');
assert(confidentialClient.includes('auth.grants.chat') && confidentialClient.includes('image.src = source'), 'Confidential image must only be requested after the chat grant is present');
assert(accessClient.includes("dreamworks:auth-return") && accessClient.includes('window.location.reload()'), 'Confidential login must reload across the security boundary and preserve its return position');
assert(!accessClient.includes('dreamworks:auth-granted') && !confidentialClient.includes('dreamworks:auth-granted'), 'Confidential login must never mutate an already-loaded protected page in place');
assert(homeCss.includes('.home-confidential-blur') && homeCss.includes('.home-confidential-lock'), 'Confidential card must render a blurred lock cover before authentication');

assert(!html.includes('class="nav-brand-icon"'), 'The placeholder character icon must be removed from the global navigation');
assert(html.includes('src="assets/brand/dreamworks-official-mark.png"'), 'The global navigation must directly load the checked official PNG logo');
assert(html.includes('href="https://www.dreamworksinvest.com/website/w/h"'), 'The official logo must link to the company website');
assert(html.includes('target="_blank"') && html.includes('rel="noopener noreferrer"'), 'The company link must open safely without replacing the application');
assert(existsSync(join(root, 'assets/brand/dreamworks-official-logo.png')), 'The official source logo must be stored locally');
assert(existsSync(join(root, 'assets/brand/dreamworks-official-mark.png')), 'The checked official navigation mark must be stored locally');
assert(!existsSync(join(root, 'assets/brand/dreamworks-official-nav.svg')), 'The browser-blocked nested SVG logo wrapper must be removed');
assert(!existsSync(join(root, 'assets/brand/dreamworks-official-mark.svg')), 'The browser-blocked nested SVG mark wrapper must be removed');

console.log('Requested UI refinement checks passed.');

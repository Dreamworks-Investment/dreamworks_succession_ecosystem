import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const html = readFileSync(join(root, 'index.html'), 'utf8');
const pageIds = ['home', 'strategy', 'value', 'wealth', 'trust', 'academy', 'charity', 'vision'];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

pageIds.forEach((page, index) => {
  const idPosition = html.indexOf(`id="page-${page}"`);
  assert(idPosition >= 0, `Missing page-${page}`);
  const start = html.lastIndexOf('<section', idPosition);
  const nextIdPosition = index + 1 < pageIds.length ? html.indexOf(`id="page-${pageIds[index + 1]}"`) : html.indexOf('</main>');
  const end = index + 1 < pageIds.length ? html.lastIndexOf('<section', nextIdPosition) : nextIdPosition;
  const segment = html.slice(start, end);
  const openings = (segment.match(/<section\b/g) || []).length;
  const closings = (segment.match(/<\/section>/g) || []).length;
  assert(openings === closings, `page-${page} has unbalanced section tags (${openings} open / ${closings} close)`);
});

const valuePage = html.indexOf('id="page-value"');
const protectedEnd = html.lastIndexOf('<!-- STRATEGY_CASES_PROTECTED_END -->', valuePage);
assert(protectedEnd > 0 && protectedEnd < valuePage, 'The protected case block must end before the value page');
assert(html.slice(protectedEnd, valuePage).includes('</section>'), 'The strategy page closing tag must remain outside the removable case block');

console.log('Top-level page structure checks passed.');

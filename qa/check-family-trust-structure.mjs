import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const html = readFileSync(join(root, 'index.html'), 'utf8');
const app = readFileSync(join(root, 'js/app.js'), 'utf8');
const system = readFileSync(join(root, 'js/family-trust-system.js'), 'utf8');
const css = readFileSync(join(root, 'css/family-trust-system.css'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert((html.match(/id="page-trust"/g) || []).length === 1, 'Trust page must exist exactly once');
assert(html.includes('id="trust-system-intro"') && html.includes('id="trust-system-wizard"'), 'Trust page needs intro and wizard views');
assert((html.match(/data-trust-panel="[1-5]"/g) || []).length === 5, 'Trust wizard must contain five stage panels');
assert((html.match(/data-trust-step="[1-5]"/g) || []).length === 5, 'Trust progress must contain five stage controls');
assert(html.indexOf('js/family-trust-model.js') < html.indexOf('js/family-trust-system.js'), 'Trust model must load before its UI controller');
assert(app.includes("requested === 'trust-system'") && app.includes('preserveTrustView'), 'SPA router must support direct and history-restored trust wizard routes');
assert(system.includes('SpeechRecognition') && system.includes('webkitSpeechRecognition'), 'Voice intake must use progressive browser speech support');
assert((system.match(/\['TQ\d{2}',/g) || []).length === 16, 'Trust flow must define exactly 16 standardized choice questions');
assert(system.includes("{ label: '其他 / 自定义', value: '' }"), 'Every standardized question must include an other/custom path');
assert(html.includes('id="trust-voice-consent"') && html.includes('id="trust-voice-transcript"'), 'Voice flow must include explicit consent and an editable transcript review');
assert(html.includes('id="trust-voice-confirm"') && html.includes('id="trust-voice-discard"'), 'Voice transcript must require confirm or discard');
assert(system.includes('guide.hidden = true'), 'Unsupported browsers must not display a fake voice control');
assert(system.includes('download') || system.includes('pdf.save'), 'Trust flow must expose a portable PDF output');
assert(css.includes('.trust-intro-active') && css.includes('.trust-wizard-active'), 'Trust stylesheet must define both routed views');
assert(existsSync(join(root, 'assets/trust/evidence/shanghai-securities-news.png')), 'Shanghai Securities News evidence image is missing');
assert(existsSync(join(root, 'assets/trust/evidence/ifeng-finance.png')), 'Ifeng Finance evidence image is missing');
assert(!html.includes('/Users/harryhsu/Desktop/Picture'), 'Deployed HTML must not reference local desktop files');

console.log('Family trust structure checks passed (17 assertions).');

import '../js/family-trust-model.js';

const model = globalThis.FamilyTrustModel;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const empty = model.createInitialState();
const emptyResult = model.analyse(empty);
assert(emptyResult.score === 0, 'Empty interview should start at 0% readiness');
assert(emptyResult.gaps.length === 10, 'Empty interview should expose every readiness gap');

const demo = model.createDemoState();
const demoResult = model.analyse(demo);
assert(model.totalAssets(demo) === 273500, 'Demo assets should sum to 273,500 ten-thousand yuan');
assert(demoResult.score === 100, 'Complete demo should reach 100% readiness');
assert(demoResult.elements.length === 11, 'Plan preview must contain the eleven trust elements');
assert(demoResult.actions.some(action => action.title.includes('股权')), 'Listed equity must trigger a specialist transfer path');
assert(!JSON.stringify(demo).includes('421039'), 'Demo state must not embed identity-card data');

const belowThreshold = model.createInitialState();
belowThreshold.assetAmounts.financial = 800;
belowThreshold.assets.source = '经营所得';
const lowResult = model.analyse(belowThreshold);
assert(lowResult.meetsThreshold === false, 'Assets below 10 million yuan must be flagged below threshold');
assert(lowResult.actions.some(action => action.title.includes('门槛')), 'Below-threshold cases must receive a threshold action');

const migrated = model.mergeState(empty, { step: 9, profile: { name: '测试委托人' }, purposes: ['风险隔离'] });
assert(migrated.step === 5 && migrated.profile.name === '测试委托人', 'Saved drafts must migrate safely and clamp the active step');

console.log('Family trust model checks passed (7 scenarios).');

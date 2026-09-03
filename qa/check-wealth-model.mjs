import '../js/wealth-model.js';

const model = globalThis.WealthModel;
const emptyAssets = { cash: [], realestate: [], business: [], financial: [], loans: [], debt: [] };

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const r1 = model.computeR1({
  ...emptyAssets,
  cash: [{ bookValue: 1000, fiveYearReturn: 10 }],
  debt: [{ amount: 200, rate: 5 }]
});
assert(Math.abs(r1.rate - 11.25) < 1e-8, 'R1 must subtract annual debt cost and divide by net assets');

const investable = model.computeInvestablePrincipal({
  ...emptyAssets,
  cash: [{ bookValue: 500, fiveYearReturn: 2 }],
  realestate: [{ bookValue: 500, fiveYearGrowth: 2, usage: '自用' }],
  debt: [{ amount: 100, rate: 3 }]
});
assert(investable.principal === 400, 'Investable principal must exclude self-use property and debt');

const r1Winner = model.computeRequiredReturn(
  { ...emptyAssets, cash: [{ bookValue: 100, fiveYearReturn: 15 }] },
  [],
  10,
  null
);
assert(r1Winner.winner === 'r1' && r1Winner.requiredRate === 15, 'R1 should win when it is the maximum');

const r2Winner = model.computeRequiredReturn(
  { ...emptyAssets, cash: [{ bookValue: 100, fiveYearReturn: 2 }] },
  [{ description: '教育', amount: 300, firstYear: 10, frequency: 'once', duration: 1 }],
  10,
  null
);
assert(r2Winner.winner === 'r2' && r2Winner.requiredRate > 10, 'R2 should win when rigid expenses demand a higher rate');

const r3Winner = model.computeRequiredReturn(
  { ...emptyAssets, cash: [{ bookValue: 100, fiveYearReturn: 2 }] },
  [{ description: '医疗', amount: 50, firstYear: 10, frequency: 'once', duration: 1 }],
  10,
  null
);
assert(r3Winner.winner === 'r3' && r3Winner.r2.rate === 0, 'R3 should win when capital already covers expenses');

const editableM2 = model.computeRequiredReturn(emptyAssets, [], 8.5, null);
assert(editableM2.winner === 'r3' && editableM2.requiredRate === 8.5, 'R3 must use the editable M2 assumption');

const recurring = model.solveExpenseRate(200, [
  { description: '养老', amount: 100, firstYear: 1, frequency: 'annual', duration: 3 }
]);
assert(recurring.cashFlows.length === 3, 'Recurring expenses must expand into annual cash flows');
assert(recurring.status === 'solved' && Math.abs(recurring.checkPV - 200) < 1e-6, 'R2 solver must reconcile present value to principal');

const aboveLimit = model.solveExpenseRate(1, [
  { description: '大额支出', amount: 1000, firstYear: 1, frequency: 'once', duration: 1 }
]);
assert(aboveLimit.status === 'above-limit' && aboveLimit.rate === null, 'Unrealistic required rates must return an explicit warning state');

const noPrincipal = model.computeRequiredReturn(
  { ...emptyAssets, cash: [{ bookValue: 100, fiveYearReturn: 4 }] },
  [{ description: '医疗', amount: 10, firstYear: 2, frequency: 'once' }],
  3,
  0
);
assert(noPrincipal.investable.overridden && noPrincipal.r2.status === 'no-principal', 'A zero principal override must remain an explicit zero rather than falling back');

const debtExceedsAssets = model.computeR1({
  ...emptyAssets,
  cash: [{ bookValue: 100, fiveYearReturn: 8 }],
  debt: [{ amount: 120, rate: 5 }]
});
assert(debtExceedsAssets.netAssets === -20 && debtExceedsAssets.rate === null, 'Non-positive net assets must not produce a misleading R1');

const clampedM2 = model.computeRequiredReturn(emptyAssets, [], -5, null);
assert(clampedM2.r3 === 0 && clampedM2.requiredRate === 0, 'Negative M2 assumptions must clamp to zero');

const tieWinner = model.computeRequiredReturn(
  { ...emptyAssets, cash: [{ bookValue: 100, fiveYearReturn: 10 }] },
  [],
  10,
  null
);
assert(tieWinner.winner === 'r1' && tieWinner.requiredRate === 10, 'Exact ties must resolve deterministically in calculation order');

const distribution = model.buildAssetDistribution({
  ...emptyAssets,
  cash: [{ bookValue: 25 }],
  financial: [{ marketValue: 75 }]
});
assert(distribution.find(row => row.key === 'cash').share === 25, 'Asset chart shares must derive from current asset data');
assert(distribution.reduce((sum, row) => sum + row.share, 0) === 100, 'Non-empty asset chart shares must total 100%');

const damage = model.buildDamageDistribution([
  { assessment: '严重损毁', bookVal: 40 },
  { assessment: '价值增进', bookVal: 60 }
]);
assert(damage.find(row => row.key === 'severe').share === 40, 'Severe-damage chart must use the same category book values as the table');

const growth = model.buildGrowthSeries(100, 5, 10, 8, [0, 1]);
assert(growth.current[0] === 100 && Math.abs(growth.current[1] - 105) < 1e-8, 'Growth chart must start from the table base and compound the current rate');
assert(Math.abs(growth.required[1] - 110) < 1e-8 && Math.abs(growth.m2[1] - 108) < 1e-8, 'Required-return and M2 chart series must share the same formula');

console.log('Wealth model checks passed (16 scenarios).');

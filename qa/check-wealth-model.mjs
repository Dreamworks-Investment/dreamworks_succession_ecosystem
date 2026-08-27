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

console.log('Wealth model checks passed (8 scenarios).');

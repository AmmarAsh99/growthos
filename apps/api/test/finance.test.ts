import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultAllocations, ratioMoney, summarize, sumMoney } from '../src/finance/accounting.js';
import type { BudgetPlan, LedgerEntry } from '../src/common/finance-contracts.js';
const plan: BudgetPlan = {
  month: '2026-10',
  salaryHalalas: 1320000,
  warningPercent: 80,
  envelopes: defaultAllocations.map((e) => ({ ...e, id: e.key })),
  categoryRules: [],
};
const entry = (
  amountHalalas: number,
  date = '2026-10-16',
  kind: LedgerEntry['kind'] = 'expense',
  envelopeId = 'general',
): LedgerEntry => ({
  id: 'test',
  amountHalalas,
  date,
  kind,
  envelopeId,
  categoryId: kind === 'expense' ? 'shopping' : null,
  category: kind === 'expense' ? { id: 'shopping', name: 'Shopping' } : null,
  envelope: plan.envelopes.find((e) => e.id === envelopeId),
  description: 'Test',
  time: null,
  notes: null,
  merchant: null,
  frequency: null,
});
test('default salary reconciles and no income or savings is fabricated', () => {
  assert.equal(sumMoney(defaultAllocations.map((e) => e.amountHalalas)), 1320000);
  const s = summarize(plan, [], '2026-10-16');
  assert.equal(s.spentHalalas, 0);
  assert.equal(s.actualSavingsHalalas, 0);
  assert.equal(s.incomeHalalas, 0);
  assert.equal(s.expenseBudgetHalalas, 615000);
  assert.equal(s.discretionaryRemainingHalalas, 415000);
  assert.equal(s.report.assessment, 'Needs Attention');
});
test('500 SAR shopping uses 20% general budget; pace includes zero-entry calendar days', () => {
  const s = summarize(plan, [entry(50000)], '2026-10-16');
  const e = s.envelopes.find((e) => e.key === 'general')!;
  assert.equal(e.actualHalalas, 50000);
  assert.equal(e.remainingHalalas, 200000);
  assert.equal(e.usagePercent, 20);
  assert.equal(e.projectedHalalas, 96875);
  assert.equal(s.categories[0].amountHalalas, 50000);
  assert.match(s.confidence, /Limited data/);
  assert.equal(s.daily.length, 31);
  assert.equal(s.daily[0].spentHalalas, 0);
});
test('transfers are not expenses or income and net cash flow remains distinct', () => {
  const s = summarize(
    plan,
    [
      entry(1320000, '2026-10-01', 'income', ''),
      entry(555000, '2026-10-02', 'transfer', 'savings'),
      entry(150000, '2026-10-02', 'transfer', 'emergency'),
      entry(50000),
    ],
    '2026-10-31',
  );
  assert.equal(s.spentHalalas, 50000);
  assert.equal(s.actualSavingsHalalas, 555000);
  assert.equal(s.emergencyHalalas, 150000);
  assert.equal(s.netCashFlowHalalas, 1270000);
  assert.equal(s.availableCashHalalas, 565000);
  assert.equal(s.report.assessment, 'Excellent Month');
  assert.equal(s.yearlyTotals.savings, 555000);
});
test('warning threshold, actual overspend and sufficiently supported exhaustion', () => {
  let s = summarize(plan, [entry(200000)], '2026-10-31');
  assert.equal(s.envelopes.find((e) => e.key === 'general')?.status, 'Warning');
  s = summarize(plan, [entry(250001)], '2026-10-31');
  assert.equal(s.status, 'Over Budget');
  s = summarize(
    plan,
    [entry(50000, '2026-10-01'), entry(50000, '2026-10-04'), entry(50000, '2026-10-07')],
    '2026-10-07',
  );
  assert.equal(s.envelopes.find((e) => e.key === 'general')?.status, 'Critical');
  assert.equal(s.envelopes.find((e) => e.key === 'general')?.exhaustionDate, '2026-10-12');
});
test('early spike warns without claiming high confidence', () => {
  const s = summarize(plan, [entry(50000, '2026-10-01')], '2026-10-01');
  assert.equal(s.envelopes.find((e) => e.key === 'general')?.status, 'Warning');
  assert.match(s.confidence, /low confidence/);
});
test('leap February, closed months, future plans and zero budgets', () => {
  assert.equal(summarize({ ...plan, month: '2028-02' }, [], '2028-02-10').daysInMonth, 29);
  assert.equal(summarize({ ...plan, month: '2027-02' }, [], '2027-02-10').daysInMonth, 28);
  const s = summarize(plan, [entry(50000)], '2026-11-10');
  assert.equal(s.closed, true);
  assert.equal(s.envelopes.find((e) => e.key === 'general')?.projectedHalalas, 50000);
  assert.equal(summarize(plan, [], '2026-09-30').projectedBalanceHalalas, null);
  assert.equal(
    summarize(
      { ...plan, envelopes: plan.envelopes.map((e) => ({ ...e, amountHalalas: 0 })) },
      [entry(1)],
      '2026-10-16',
    ).status,
    'Over Budget',
  );
});
test('history is deterministic and category sublimits do not double count allocations', () => {
  const p = {
    ...plan,
    categoryRules: [{ categoryId: 'shopping', envelopeKey: 'general', limitHalalas: 10000 }],
  };
  const s = summarize(p, [entry(20000, '2026-09-16'), entry(50000)], '2026-11-01');
  assert.equal(s.expenseBudgetHalalas, 615000);
  assert.equal(s.report.changeHalalas, 30000);
  assert.equal(s.categories[0].status, 'Critical');
  assert.match(s.report.observations[0], /increased/);
  assert.equal(s.report.largestExpense?.amountHalalas, 50000);
});
test('money arithmetic remains exact for fractional-halalah projections and large sums', () => {
  assert.equal(sumMoney([10, 20]), 30);
  assert.equal(ratioMoney(1, 31, 16), 2);
  assert.equal(ratioMoney(1000000000, 31, 7), 4428571429);
  assert.throws(() => sumMoney([Number.MAX_SAFE_INTEGER, 1]));
});
test('weekly analytics cross year boundaries without changing monthly accounting', () => {
  const january = { ...plan, month: '2026-01' };
  const s = summarize(
    january,
    [entry(1000, '2025-12-30'), entry(2000, '2026-01-01')],
    '2026-01-01',
    'week',
    '2026-01-01',
  );
  assert.equal(s.period.from, '2025-12-29');
  assert.equal(s.period.to, '2026-01-04');
  assert.equal(s.period.spentHalalas, 3000);
  assert.equal(s.spentHalalas, 2000);
  assert.equal(s.yearlyTotals.expenses, 2000);
});
test('category overruns affect assessment without inflating expenses', () => {
  const p = {
    ...plan,
    categoryRules: [{ categoryId: 'shopping', envelopeKey: 'general', limitHalalas: 10000 }],
  };
  const s = summarize(
    p,
    [
      entry(50000),
      entry(555000, '2026-10-16', 'transfer', 'savings'),
      entry(150000, '2026-10-16', 'transfer', 'emergency'),
    ],
    '2026-11-01',
  );
  assert.equal(s.spentHalalas, 50000);
  assert.equal(s.report.assessment, 'Needs Attention');
});

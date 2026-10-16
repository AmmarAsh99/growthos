import { addDays, daysBetween, endOf, shiftStart, startOf } from '../analytics/calendar.js';
import type {
  Allocation,
  BudgetPlan,
  FinanceSummary,
  LedgerEntry,
} from '../common/finance-contracts.js';
export const defaultAllocations: Allocation[] = [
  {
    key: 'emergency',
    name: 'Emergency fund',
    kind: 'emergency',
    discretionary: false,
    amountHalalas: 150000,
  },
  { key: 'rent', name: 'Rent', kind: 'expense', discretionary: false, amountHalalas: 150000 },
  {
    key: 'general',
    name: 'General monthly spending',
    kind: 'expense',
    discretionary: true,
    amountHalalas: 250000,
  },
  {
    key: 'food',
    name: 'Healthy food',
    kind: 'expense',
    discretionary: true,
    amountHalalas: 165000,
  },
  {
    key: 'family',
    name: 'Family support (mother)',
    kind: 'expense',
    discretionary: false,
    amountHalalas: 50000,
  },
  {
    key: 'savings',
    name: 'Planned savings',
    kind: 'savings',
    discretionary: false,
    amountHalalas: 555000,
  },
];
export const categoryNames = [
  'Food',
  'Health',
  'Gaming',
  'Shopping',
  'Travel',
  'Transportation',
  'Entertainment',
  'Subscriptions',
  'Bills',
  'Family',
  'Rent',
  'Other',
];
export const sumMoney = (values: number[]) => {
  const total = values.reduce((a, b) => a + BigInt(b), 0n);
  if (total > BigInt(Number.MAX_SAFE_INTEGER) || total < BigInt(Number.MIN_SAFE_INTEGER))
    throw new Error('Money total exceeds supported range');
  return Number(total);
};
export const ratioMoney = (amount: number, numerator: number, denominator: number) =>
  Number(
    (BigInt(amount) * BigInt(numerator) + BigInt(Math.floor(denominator / 2))) /
      BigInt(denominator),
  );
const sar = (n: number) =>
  new Intl.NumberFormat('en-SA', { style: 'currency', currency: 'SAR' }).format(n / 100);
const total = (rows: LedgerEntry[], kind: string) =>
  sumMoney(rows.filter((r) => r.kind === kind).map((r) => r.amountHalalas));
export function summarize(
  plan: BudgetPlan,
  rows: LedgerEntry[],
  asOf: string,
  period: 'day' | 'week' | 'month' | 'year' = 'month',
  anchor = asOf,
): FinanceSummary {
  const from = plan.month + '-01',
    to = endOf(from, 'month'),
    days = daysBetween(from, to);
  const elapsed = asOf < from ? 0 : daysBetween(from, asOf > to ? to : asOf),
    closed = asOf > to;
  const monthly = rows.filter((r) => r.date >= from && r.date <= to),
    expenses = monthly.filter((r) => r.kind === 'expense');
  const spent = total(monthly, 'expense'),
    income = total(monthly, 'income');
  const envelopes = plan.envelopes.map((e) => {
    const actual = sumMoney(
      monthly
        .filter(
          (r) =>
            r.envelopeId === e.id && r.kind === (e.kind === 'expense' ? 'expense' : 'transfer'),
        )
        .map((r) => r.amountHalalas),
    );
    const projected = elapsed === 0 ? null : closed ? actual : ratioMoney(actual, days, elapsed);
    const usage = e.amountHalalas ? (actual / e.amountHalalas) * 100 : actual ? 100 : 0;
    const exhaustion =
      actual > 0 && projected !== null && projected > e.amountHalalas
        ? addDays(
            from,
            Math.max(
              0,
              Number(
                (BigInt(e.amountHalalas) * BigInt(elapsed) + BigInt(actual) - 1n) / BigInt(actual),
              ) - 1,
            ),
          )
        : null;
    const significant =
      elapsed >= 7 &&
      new Set(monthly.filter((r) => r.envelopeId === e.id).map((r) => r.date)).size >= 3;
    const status: 'On Track' | 'Warning' | 'Critical' =
      e.kind !== 'expense'
        ? 'On Track'
        : actual > e.amountHalalas
          ? 'Critical'
          : !closed && significant && exhaustion && exhaustion < to
            ? 'Critical'
            : (projected !== null && projected > e.amountHalalas) || usage >= plan.warningPercent
              ? 'Warning'
              : 'On Track';
    const message =
      e.kind !== 'expense'
        ? `${sar(actual)} actually transferred of ${sar(e.amountHalalas)} planned.`
        : actual > e.amountHalalas
          ? `Actual spending exceeds this budget by ${sar(actual - e.amountHalalas)}.`
          : projected !== null && projected > e.amountHalalas
            ? `At the recorded pace, spending may exceed this budget by ${sar(projected - e.amountHalalas)}${exhaustion ? `; estimated exhaustion ${exhaustion}` : ''}.`
            : usage >= plan.warningPercent
              ? `${usage.toFixed(1)}% of this budget has been used.`
              : 'Recorded spending is within the planned budget.';
    return {
      ...e,
      actualHalalas: actual,
      remainingHalalas: e.amountHalalas - actual,
      usagePercent: usage,
      projectedHalalas: projected,
      projectedRemainingHalalas: projected === null ? null : e.amountHalalas - projected,
      exhaustionDate: exhaustion,
      status,
      message,
    };
  });
  const expenseEnvelopes = envelopes.filter((e) => e.kind === 'expense');
  const categoryIds = [
    ...new Set([
      ...expenses.map((r) => r.categoryId!),
      ...plan.categoryRules.map((r) => r.categoryId),
    ]),
  ];
  const categories = categoryIds
    .map((id) => {
      const entries = expenses.filter((r) => r.categoryId === id),
        amount = total(entries, 'expense'),
        limit = plan.categoryRules.find((r) => r.categoryId === id)?.limitHalalas || 0;
      return {
        id,
        name:
          entries[0]?.category?.name ||
          categoryNames.find((n) =>
            rows.some((r) => r.categoryId === id && r.category?.name === n),
          ) ||
          'No spending',
        amountHalalas: amount,
        limitHalalas: limit,
        status:
          limit && amount > limit
            ? 'Critical'
            : limit && amount * 100 >= limit * plan.warningPercent
              ? 'Warning'
              : 'On Track',
      };
    })
    .sort((a, b) => b.amountHalalas - a.amountHalalas);
  let cumulative = 0;
  const daily = Array.from({ length: days }, (_, i) => {
    const date = addDays(from, i),
      value = total(
        expenses.filter((r) => r.date === date),
        'expense',
      );
    cumulative = sumMoney([cumulative, value]);
    return {
      date,
      spentHalalas: value,
      cumulativeHalalas: cumulative,
      projectedCumulativeHalalas:
        elapsed && date >= asOf ? ratioMoney(spent, i + 1, elapsed) : null,
    };
  });
  const savings = sumMoney(
      envelopes.filter((e) => e.kind === 'savings').map((e) => e.actualHalalas),
    ),
    emergency = sumMoney(
      envelopes.filter((e) => e.kind === 'emergency').map((e) => e.actualHalalas),
    );
  const plannedSavings = sumMoney(
      envelopes.filter((e) => e.kind === 'savings').map((e) => e.amountHalalas),
    ),
    plannedEmergency = sumMoney(
      envelopes.filter((e) => e.kind === 'emergency').map((e) => e.amountHalalas),
    );
  const yearly = Array.from({ length: 12 }, (_, i) => {
    const month = `${plan.month.slice(0, 4)}-${String(i + 1).padStart(2, '0')}`,
      entries = rows.filter((r) => r.date.startsWith(month));
    return {
      month,
      expenses: total(entries, 'expense'),
      income: total(entries, 'income'),
      savings: sumMoney(
        entries
          .filter((r) => r.kind === 'transfer' && r.envelope?.kind === 'savings')
          .map((r) => r.amountHalalas),
      ),
    };
  });
  const prevMonth = shiftStart(from, 'month', -1).slice(0, 7),
    previous = rows.filter((r) => r.date.startsWith(prevMonth)),
    prevSpent = total(previous, 'expense');
  const observations: string[] = [];
  for (const c of categories) {
    const old = sumMoney(
      previous
        .filter((r) => r.kind === 'expense' && r.categoryId === c.id)
        .map((r) => r.amountHalalas),
    );
    if (old > 0 && old !== c.amountHalalas)
      observations.push(
        `${c.name} spending ${c.amountHalalas > old ? 'increased' : 'decreased'} by ${sar(Math.abs(c.amountHalalas - old))} (${((Math.abs(c.amountHalalas - old) / old) * 100).toFixed(1)}%) compared with the previous full month.`,
      );
  }
  if (emergency >= plannedEmergency && plannedEmergency > 0)
    observations.push('You maintained your planned emergency fund contribution.');
  if (savings < plannedSavings)
    observations.push(
      `Recorded savings transfers are below the target by ${sar(plannedSavings - savings)}.`,
    );
  if (!closed)
    observations.push(
      'This report is provisional. A partial month is compared with the previous full month.',
    );
  observations.push(
    'Income and transfers are recorded amounts, not assumed salary payments. Missing entries can change this assessment.',
  );
  const over = sumMoney(
      expenseEnvelopes.map((e) => Math.max(0, e.actualHalalas - e.amountHalalas)),
    ),
    expenseBudget = sumMoney(expenseEnvelopes.map((e) => e.amountHalalas));
  const assessment =
    over === 0 &&
    !categories.some((c) => c.status === 'Critical') &&
    savings >= plannedSavings &&
    emergency >= plannedEmergency
      ? 'Excellent Month'
      : over * 100 <= expenseBudget * 5 &&
          categories.every(
            (c) => !c.limitHalalas || c.amountHalalas * 100 <= c.limitHalalas * 105,
          ) &&
          savings >= plannedSavings &&
          emergency >= plannedEmergency
        ? 'Good Month'
        : 'Needs Attention';
  const periodFrom = startOf(anchor, period),
    periodTo = endOf(anchor, period),
    periodEntries = rows.filter((r) => r.date >= periodFrom && r.date <= periodTo);
  const logged = new Set(monthly.map((r) => r.date)).size;
  return {
    month: plan.month,
    today: asOf,
    elapsedDays: elapsed,
    daysInMonth: days,
    loggedDays: logged,
    closed,
    confidence:
      elapsed === 0
        ? 'Future month: no spending forecast.'
        : elapsed < 7 || logged < 3
          ? 'Limited data: this pace estimate is low confidence. Days without entries may be unlogged.'
          : 'Estimate based on recorded transactions and all elapsed calendar days. Days without entries may be unlogged.',
    salaryHalalas: plan.salaryHalalas,
    spentHalalas: spent,
    incomeHalalas: income,
    todaySpentHalalas: total(
      rows.filter((r) => r.date === asOf),
      'expense',
    ),
    discretionaryRemainingHalalas: sumMoney(
      expenseEnvelopes.filter((e) => e.discretionary).map((e) => e.remainingHalalas),
    ),
    expenseBudgetHalalas: expenseBudget,
    usagePercent: expenseBudget ? (spent / expenseBudget) * 100 : spent ? 100 : 0,
    plannedSavingsHalalas: plannedSavings,
    actualSavingsHalalas: savings,
    emergencyHalalas: emergency,
    plannedEmergencyHalalas: plannedEmergency,
    netCashFlowHalalas: income - spent,
    availableCashHalalas: income - spent - savings - emergency,
    projectedBalanceHalalas: elapsed
      ? expenseBudget - sumMoney(expenseEnvelopes.map((e) => e.projectedHalalas!))
      : null,
    status:
      expenseEnvelopes.some((e) => e.status === 'Critical') ||
      categories.some((c) => c.status === 'Critical')
        ? 'Over Budget'
        : expenseEnvelopes.some((e) => e.status === 'Warning') ||
            categories.some((c) => c.status === 'Warning')
          ? 'Warning'
          : 'On Track',
    envelopes,
    daily,
    categories,
    yearly,
    yearlyTotals: {
      expenses: sumMoney(yearly.map((r) => r.expenses)),
      income: sumMoney(yearly.map((r) => r.income)),
      savings: sumMoney(yearly.map((r) => r.savings)),
    },
    period: {
      from: periodFrom,
      to: periodTo,
      spentHalalas: total(periodEntries, 'expense'),
      incomeHalalas: total(periodEntries, 'income'),
      transferredHalalas: total(periodEntries, 'transfer'),
    },
    report: {
      assessment,
      observations,
      previousSpentHalalas: prevSpent,
      changeHalalas: spent - prevSpent,
      largestExpense: expenses.sort((a, b) => b.amountHalalas - a.amountHalalas)[0] || null,
      highestCategory: categories.find((c) => c.amountHalalas > 0)?.name || null,
    },
  };
}

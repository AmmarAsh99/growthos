import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { config } from 'dotenv';
import { today, shiftStart, addDays } from '../src/analytics/calendar.js';
import type {
  BudgetPlan,
  FinanceCategory,
  FinanceSummary,
  LedgerEntry,
  TransactionPage,
} from '../src/common/finance-contracts.js';
config({ path: '../../.env', quiet: true });
const databaseUrl =
  process.env.TEST_DATABASE_URL ||
  'postgresql://growthos:local-growthos@localhost:5432/growthos_test';
if (!new URL(databaseUrl).pathname.endsWith('_test'))
  throw new Error('A dedicated _test database is required');
test('finance API with real PostgreSQL and JWT ownership', { timeout: 120000 }, async (t) => {
  const logs: string[] = [];
  const child = spawn(process.execPath, ['dist/main.js'], {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: '3103',
      DATABASE_URL: databaseUrl,
      COOKIE_SECURE: 'false',
      CORS_ORIGIN: 'http://localhost:4200',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (b) => logs.push(String(b)));
  child.stderr.on('data', (b) => logs.push(String(b)));
  t.after(() => child.kill());
  const base = 'http://127.0.0.1:3103/api/v1/';
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base + 'health/ready')).ok) break;
    } catch {}
    if (i === 99) throw new Error('Finance test API did not start: ' + logs.join(''));
    await delay(200);
  }
  const call = async <T = unknown>(path: string, token = '', method = 'GET', body?: unknown) => {
    const r = await fetch(base + path, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-request-id': 'finance-test-request',
        ...(token ? { authorization: 'Bearer ' + token } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = r.status === 204 ? null : ((await r.json()) as { data: T });
    return { status: r.status, data: json?.data as T };
  };
  const register = async () => {
    const r = await call<{ accessToken: string }>('auth/register', '', 'POST', {
      email: `finance-${randomUUID()}@example.test`,
      displayName: 'Finance Tester',
      password: 'Finance-test-password-43823',
    });
    assert.equal(r.status, 201);
    return r.data.accessToken;
  };
  const a = await register(),
    b = await register(),
    date = today('Asia/Riyadh'),
    month = date.slice(0, 7);
  let plan: BudgetPlan, categories: FinanceCategory[], expense: LedgerEntry;
  const clean = (p: BudgetPlan) => ({
    salaryHalalas: p.salaryHalalas,
    warningPercent: p.warningPercent,
    envelopes: p.envelopes.map(({ id: _, ...e }) => ({
      key: e.key,
      name: e.name,
      kind: e.kind,
      discretionary: e.discretionary,
      amountHalalas: e.amountHalalas,
    })),
    categoryRules: p.categoryRules,
  });
  await t.test('authentication, empty state, defaults and snapshot concurrency', async () => {
    assert.equal((await call('finance/summary?month=' + month)).status, 401);
    const plans = await Promise.all([
      call<BudgetPlan>('finance/budget?month=' + month, a),
      call<BudgetPlan>('finance/budget?month=' + month, a),
      call('finance/categories', a),
    ]);
    plans.forEach((p) => assert.equal(p.status, 200));
    plan = plans[0].data as BudgetPlan;
    assert.equal(plan.salaryHalalas, 1320000);
    assert.equal(
      plan.envelopes.reduce((n, e) => n + e.amountHalalas, 0),
      1320000,
    );
    categories = (await call<FinanceCategory[]>('finance/categories', a)).data;
    assert.equal(categories.length, 12);
    const s = (await call<FinanceSummary>('finance/summary?month=' + month, a)).data;
    assert.equal(s.spentHalalas, 0);
    assert.equal(s.incomeHalalas, 0);
    assert.equal(s.actualSavingsHalalas, 0);
  });
  const dto = () => ({
    date,
    kind: 'expense',
    amountHalalas: 50000,
    description: 'PRIVATE_FINANCE_DESCRIPTION',
    notes: 'PRIVATE_FINANCE_NOTES',
    merchant: 'PRIVATE_FINANCE_MERCHANT',
    categoryId: categories.find((c) => c.name === 'Shopping')!.id,
    envelopeId: plan.envelopes.find((e) => e.key === 'general')!.id,
  });
  await t.test('validation, ownership and envelope accounting', async () => {
    for (const invalid of [
      { amountHalalas: 0 },
      { amountHalalas: 1.5 },
      { date: '2026-02-30' },
      { date: addDays(date, 1) },
      { userId: randomUUID() },
      { categoryId: null },
      { envelopeId: plan.envelopes.find((e) => e.key === 'savings')!.id },
    ])
      assert.equal(
        (await call('finance/transactions', a, 'POST', { ...dto(), ...invalid })).status,
        400,
      );
    const foreign = (await call<FinanceCategory[]>('finance/categories', b)).data[0];
    assert.equal(
      (await call('finance/transactions', a, 'POST', { ...dto(), categoryId: foreign.id })).status,
      400,
    );
    const created = await call<LedgerEntry>('finance/transactions', a, 'POST', dto());
    assert.equal(created.status, 201);
    expense = created.data;
    for (const method of ['GET', 'PUT', 'DELETE'])
      assert.equal(
        (
          await call(
            'finance/transactions/' + expense.id,
            b,
            method,
            method === 'PUT' ? dto() : undefined,
          )
        ).status,
        404,
      );
    const s = (await call<FinanceSummary>('finance/summary?month=' + month, a)).data;
    assert.equal(s.spentHalalas, 50000);
    assert.equal(s.envelopes.find((e) => e.key === 'general')!.remainingHalalas, 200000);
    assert.equal(s.envelopes.find((e) => e.key === 'general')!.usagePercent, 20);
    assert.equal(
      (await call<FinanceSummary>('finance/summary?month=' + month, b)).data.spentHalalas,
      0,
    );
    assert.equal((await call('finance/transactions?from=2026-10-31&to=2026-10-01', a)).status, 400);
    const listed = (
      await call<TransactionPage>('finance/transactions?limit=1&search=PRIVATE_FINANCE', a)
    ).data;
    assert.equal(listed.totalSpentHalalas, 50000);
    assert.equal(listed.items.length, 1);
  });
  await t.test(
    'income and savings are actual ledger entries, never assumed or double counted',
    async () => {
      assert.equal(
        (
          await call('finance/transactions', a, 'POST', {
            kind: 'income',
            date,
            amountHalalas: 1320000,
            description: 'Received salary',
          })
        ).status,
        201,
      );
      for (const key of ['savings', 'emergency']) {
        const e = plan.envelopes.find((e) => e.key === key)!;
        assert.equal(
          (
            await call('finance/transactions', a, 'POST', {
              kind: 'transfer',
              date,
              amountHalalas: e.amountHalalas,
              envelopeId: e.id,
              description: 'Actual transfer',
            })
          ).status,
          201,
        );
      }
      const s = (await call<FinanceSummary>('finance/report?month=' + month, a)).data;
      assert.equal(s.actualSavingsHalalas, 555000);
      assert.equal(s.emergencyHalalas, 150000);
      assert.equal(s.spentHalalas, 50000);
      assert.equal(s.netCashFlowHalalas, 1270000);
      assert.equal(s.availableCashHalalas, 565000);
      assert.equal(s.report.assessment, 'Excellent Month');
    },
  );
  await t.test('budget reconciliation and immutable historical snapshots', async () => {
    assert.equal(
      (await call('finance/budget?month=' + month, a, 'PUT', { ...clean(plan), salaryHalalas: 1 }))
        .status,
      400,
    );
    const past = shiftStart(date, 'month', -1).slice(0, 7),
      future = shiftStart(date, 'month', 1).slice(0, 7);
    const old = (await call<BudgetPlan>('finance/budget?month=' + past, a)).data;
    assert.equal(
      (
        await call('finance/transactions', a, 'POST', {
          ...dto(),
          date: past + '-01',
          envelopeId: old.envelopes.find((e) => e.key === 'general')!.id,
        })
      ).status,
      201,
    );
    assert.equal((await call('finance/budget?month=' + past, a, 'PUT', clean(old))).status, 400);
    const next = (await call<BudgetPlan>('finance/budget?month=' + future, a)).data;
    next.salaryHalalas += 10000;
    next.envelopes.find((e) => e.key === 'savings')!.amountHalalas += 10000;
    assert.equal((await call('finance/budget?month=' + future, a, 'PUT', clean(next))).status, 200);
    assert.equal(
      (await call<BudgetPlan>('finance/budget?month=' + month, a)).data.salaryHalalas,
      1320000,
    );
    assert.equal(
      (await call<BudgetPlan>('finance/budget?month=' + past, a)).data.salaryHalalas,
      1320000,
    );
    const historical = (await call<FinanceSummary>('finance/report?month=' + past, a)).data;
    assert.equal(historical.spentHalalas, 50000);
    assert.equal(historical.closed, true);
    assert.equal(historical.salaryHalalas, 1320000);
    const wrongMonth = next.envelopes.find((e) => e.key === 'general')!.id;
    assert.equal(
      (await call('finance/transactions', a, 'POST', { ...dto(), envelopeId: wrongMonth })).status,
      400,
    );
  });
  await t.test(
    'edit, recurrence metadata, category filtering and delete refresh aggregates',
    async () => {
      assert.equal(
        (
          await call('finance/transactions/' + expense.id, a, 'PUT', {
            ...dto(),
            amountHalalas: 60000,
            frequency: 'monthly',
          })
        ).status,
        200,
      );
      const summary = (
        await call<FinanceSummary>(
          'finance/summary?month=' +
            month +
            '&categoryId=' +
            categories.find((c) => c.name === 'Food')!.id,
          a,
        )
      ).data;
      assert.equal(summary.spentHalalas, 60000);
      assert.equal(
        summary.daily.reduce((a, d) => a + d.spentHalalas, 0),
        60000,
      );
      assert.equal(
        summary.filteredDaily!.reduce((a, d) => a + d.spentHalalas, 0),
        0,
      );
      assert.equal(
        (await call<TransactionPage>('finance/transactions?kind=expense&from=' + month + '-01', a))
          .data.total,
        1,
      );
      assert.equal((await call('finance/transactions/' + expense.id, a, 'DELETE')).status, 204);
      assert.equal(
        (await call<FinanceSummary>('finance/summary?month=' + month, a)).data.spentHalalas,
        0,
      );
    },
  );
  await t.test('structured finance logs exclude descriptions, notes and merchants', async () => {
    await delay(100);
    const output = logs.join('');
    assert.ok(!output.includes('PRIVATE_FINANCE_DESCRIPTION'));
    assert.ok(!output.includes('PRIVATE_FINANCE_NOTES'));
    assert.ok(!output.includes('PRIVATE_FINANCE_MERCHANT'));
    const completed = output
      .split('\n')
      .filter((line) => line.startsWith('{'))
      .map((line) => JSON.parse(line))
      .filter((row) => row.event === 'http.request.completed' && row.route.includes('/finance/'));
    assert.ok(completed.length > 10);
    assert.ok(completed.some((row) => row.statusCode === 400));
    assert.ok(completed.some((row) => row.statusCode === 401));
    assert.ok(completed.every((row) => typeof row.durationMs === 'number' && row.requestId));
  });
});

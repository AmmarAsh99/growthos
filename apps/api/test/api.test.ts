import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { config } from 'dotenv';
import { today, addDays } from '../src/analytics/calendar.js';
config({ path: '../../.env', quiet: true });
const databaseUrl =
  process.env.TEST_DATABASE_URL ||
  'postgresql://growthos:local-growthos@localhost:5432/growthos_test';
if (!new URL(databaseUrl).pathname.endsWith('_test'))
  throw new Error('Integration tests require a dedicated database ending in _test');
type Json = {
  success: boolean;
  data: Record<string, unknown>;
  error?: { message: string };
  meta: { requestId: string };
};
type Session = { token: string; cookie: string; id: string; category: string };
test('real PostgreSQL API acceptance', { timeout: 120000 }, async (t) => {
  const lines: string[] = [];
  const port = 3101;
  const child = spawn(process.execPath, ['dist/main.js'], {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      DATABASE_URL: databaseUrl,
      COOKIE_SECURE: 'false',
      CORS_ORIGIN: 'http://localhost:4200',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (b) => lines.push(String(b)));
  child.stderr.on('data', (b) => lines.push(String(b)));
  t.after(() => {
    child.kill();
  });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(base + '/api/v1/health/ready');
      if (r.ok) break;
    } catch {}
    if (i === 99) throw new Error('API did not become ready: ' + lines.join(''));
    await delay(200);
  }
  const call = async (
    path: string,
    method = 'GET',
    body?: unknown,
    session?: Session,
    cookie?: string,
  ) => {
    const r = await fetch(base + '/api/v1/' + path, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-request-id': 'test-request-123',
        ...(session ? { authorization: 'Bearer ' + session.token } : {}),
        ...(cookie ? { cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = r.status === 204 ? null : ((await r.json()) as Json);
    assert.equal(r.headers.get('x-request-id'), 'test-request-123');
    if (json) assert.equal(json.meta.requestId, 'test-request-123');
    return { r, json };
  };
  const password = 'Test-only-password-9412';
  const suffix = randomUUID();
  let a: Session, b: Session;
  let activityId = '';
  const date = today('Asia/Riyadh');
  await t.test('register with atomic defaults, login, generic failure, and me', async () => {
    const sessions: Session[] = [];
    for (const name of ['alice', 'bob']) {
      const result = await call('auth/register', 'POST', {
        email: `${name}-${suffix}@example.test`,
        password,
        displayName: name,
      });
      assert.equal(result.r.status, 201);
      const user = result.json!.data.user as { id: string; settings: { dailyGoalMinutes: number } };
      assert.equal(user.settings.dailyGoalMinutes, 120);
      assert.ok(!('passwordHash' in user));
      const token = result.json!.data.accessToken as string;
      const cookie = result.r.headers.get('set-cookie')!.split(';')[0];
      assert.match(result.r.headers.get('set-cookie')!, /HttpOnly/);
      const s = { token, cookie, id: user.id, category: '' };
      const cats = await call('categories', 'GET', undefined, s);
      assert.equal((cats.json!.data as unknown as unknown[]).length, 6);
      s.category = (cats.json!.data as unknown as { id: string }[])[0].id;
      sessions.push(s);
    }
    [a, b] = sessions;
    const login = await call('auth/login', 'POST', {
      email: ` ALICE-${suffix}@example.test `,
      password,
    });
    assert.equal(login.r.status, 200);
    assert.equal((await call('auth/me', 'GET', undefined, a)).r.status, 200);
    const bad = await call('auth/login', 'POST', {
      email: `alice-${suffix}@example.test`,
      password: 'wrong-password-long',
    });
    assert.equal(bad.r.status, 401);
    assert.equal(bad.json!.error!.message, 'Invalid email or password');
  });
  await t.test('protected endpoints and empty dashboard', async () => {
    for (const route of [
      'activities',
      'categories',
      'users/me/settings',
      'dashboard/overview',
      'analytics/trends',
    ])
      assert.equal((await call(route)).r.status, 401);
    const o = await call('dashboard/overview', 'GET', undefined, a);
    assert.equal((o.json!.data.today as { actualMinutes: number }).actualMinutes, 0);
    assert.equal(o.json!.data.currentActivityStreakDays, 0);
    assert.equal(o.json!.data.timeChangeVsPreviousComparableMonthPct, null);
    const trend = await call('analytics/trends?points=7', 'GET', undefined, a);
    assert.equal((trend.json!.data as unknown as { minutes: number }[]).length, 7);
    assert.ok((trend.json!.data as unknown as { minutes: number }[]).every((x) => x.minutes === 0));
  });
  const activity = () => ({
    activityDate: date,
    title: 'Learned ArgoCD',
    description: 'PRIVATE_DESCRIPTION_SENTINEL',
    categoryId: a.category,
    durationMinutes: 120,
  });
  await t.test(
    'reject invalid fields, future dates, malformed dates/IDs and timezone',
    async () => {
      for (const patch of [
        { durationMinutes: 0 },
        { durationMinutes: -1 },
        { durationMinutes: 1441 },
        { durationMinutes: 1.5 },
        { durationMinutes: null },
        { title: null },
        { activityDate: addDays(date, 1) },
        { activityDate: '2026-02-30' },
        { categoryId: 'bad' },
        { title: 'x' },
        { categoryId: b.category },
        { userId: b.id },
        { description: 'x'.repeat(2001) },
      ])
        assert.equal(
          (await call('activities', 'POST', { ...activity(), ...patch }, a)).r.status,
          400,
        );
      const { categoryId: _category, ...missing } = activity();
      assert.equal((await call('activities', 'POST', missing, a)).r.status, 400);
      assert.equal((await call('activities/not-a-uuid', 'GET', undefined, a)).r.status, 400);
      assert.equal(
        (await call('users/me/settings', 'PATCH', { timezone: 'not/a/timezone' }, a)).r.status,
        400,
      );
      assert.equal(
        (await call('users/me/settings', 'PATCH', { dailyGoalMinutes: null }, a)).r.status,
        400,
      );
      assert.equal((await call('activities?limit=101', 'GET', undefined, a)).r.status, 400);
    },
  );
  await t.test('create, edit, filter, aggregate and isolate owners', async () => {
    const created = await call('activities', 'POST', activity(), a);
    assert.equal(created.r.status, 201);
    activityId = created.json!.data.id as string;
    assert.equal(created.json!.data.activityDate, date);
    const overview = async (session: Session) =>
      (await call('dashboard/overview', 'GET', undefined, session)).json!.data;
    assert.equal(((await overview(a)).today as { actualMinutes: number }).actualMinutes, 120);
    assert.equal(((await overview(b)).today as { actualMinutes: number }).actualMinutes, 0);
    for (const method of ['GET', 'PATCH', 'DELETE'])
      assert.equal(
        (
          await call(
            'activities/' + activityId,
            method,
            method === 'PATCH' ? { title: 'Hacked' } : undefined,
            b,
          )
        ).r.status,
        404,
      );
    assert.equal(
      (await call('categories/' + a.category, 'PATCH', { name: 'Hacked' }, b)).r.status,
      404,
    );
    assert.equal(
      (await call('activities/' + activityId, 'PATCH', { durationMinutes: 12 }, a)).r.status,
      200,
    );
    assert.equal(((await overview(a)).today as { goalProgressPct: number }).goalProgressPct, 10);
    const history = await call('activities?limit=1&search=Argo', 'GET', undefined, a);
    assert.equal(history.json!.data.totalMinutes, 12);
    assert.equal(history.json!.data.total, 1);
    const breakdown = await call('analytics/categories?period=day', 'GET', undefined, a);
    assert.equal((breakdown.json!.data as unknown as { minutes: number }[])[0].minutes, 12);
    await call('activities', 'POST', { ...activity(), activityDate: addDays(date, -1) }, a);
    assert.equal((await overview(a)).currentActivityStreakDays, 2);
    await call('categories/' + a.category, 'PATCH', { isArchived: true }, a);
    assert.equal((await call('activities', 'POST', activity(), a)).r.status, 400);
    assert.equal(
      (
        await call(
          'activities/' + activityId,
          'PATCH',
          { title: 'Updated historical entry', categoryId: a.category },
          a,
        )
      ).r.status,
      200,
    );
    assert.equal((await call('activities/' + activityId, 'DELETE', undefined, a)).r.status, 204);
    assert.equal(((await overview(a)).today as { actualMinutes: number }).actualMinutes, 0);
  });
  await t.test('rotation is atomic, replay fails, logout needs no access token', async () => {
    const race = await Promise.all([
      call('auth/refresh', 'POST', {}, undefined, a.cookie),
      call('auth/refresh', 'POST', {}, undefined, a.cookie),
    ]);
    assert.deepEqual(race.map((x) => x.r.status).sort(), [200, 401]);
    const next = race.find((x) => x.r.status === 200)!;
    const cookie = next.r.headers.get('set-cookie')!.split(';')[0];
    assert.equal((await call('auth/refresh', 'POST', {}, undefined, a.cookie)).r.status, 401);
    assert.equal((await call('auth/logout', 'POST', {}, undefined, cookie)).r.status, 200);
    assert.equal((await call('auth/refresh', 'POST', {}, undefined, cookie)).r.status, 401);
  });
  await t.test('metrics and request logs include errors and redact private content', async () => {
    const r = await fetch(base + '/metrics');
    const metrics = await r.text();
    assert.equal(r.status, 200);
    assert.match(metrics, /http_server_requests_total/);
    assert.match(metrics, /http_server_request_duration_seconds_bucket/);
    assert.ok(!metrics.includes(activityId));
    await delay(100);
    const output = lines.join('');
    const logs = output
      .split('\n')
      .filter((x) => x.startsWith('{'))
      .map((x) => JSON.parse(x) as Record<string, unknown>)
      .filter((x) => x.event === 'http.request.completed');
    assert.ok(logs.some((x) => x.statusCode === 400));
    assert.ok(logs.some((x) => x.statusCode === 401));
    assert.ok(logs.some((x) => x.statusCode === 201));
    assert.ok(
      logs.every((x) => typeof x.durationMs === 'number' && typeof x.requestId === 'string'),
    );
    assert.ok(!output.includes(password));
    assert.ok(!output.includes(a.token));
    assert.ok(!output.includes('PRIVATE_DESCRIPTION_SENTINEL'));
    assert.ok(!output.includes('@example.test'));
  });
});
test('readiness returns 503 when PostgreSQL is unavailable', { timeout: 30000 }, async (t) => {
  const child = spawn(process.execPath, ['dist/main.js'], {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: '3102',
      DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/growthos_test?connect_timeout=1',
      COOKIE_SECURE: 'false',
    },
    stdio: 'ignore',
  });
  t.after(() => child.kill());
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch('http://127.0.0.1:3102/api/v1/health/live');
      if (r.ok) break;
    } catch {}
    await delay(150);
  }
  const r = await fetch('http://127.0.0.1:3102/api/v1/health/ready');
  assert.equal(r.status, 503);
  assert.equal((await r.json()).success, false);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  startOf,
  endOf,
  progress,
  today,
  streak,
  changePct,
  comparisonWindow,
  shiftStart,
} from '../src/analytics/calendar.js';
test('goals use real calendar days and cap percentages without losing minutes', () => {
  assert.equal(progress(12, 120, '2026-10-13', '2026-10-13', '2026-10-13').goalProgressPct, 10);
  assert.equal(progress(1860, 120, '2026-10-01', '2026-10-31', '2026-10-13').goalMinutes, 3720);
  assert.equal(progress(1860, 120, '2026-10-01', '2026-10-31', '2026-10-13').goalProgressPct, 50);
  assert.equal(progress(200, 120, '2026-10-13', '2026-10-13', '2026-10-13').goalProgressPct, 100);
  assert.equal(progress(200, 120, '2026-10-13', '2026-10-13', '2026-10-13').actualMinutes, 200);
});
test('leap years, Monday rollover and month shifts', () => {
  assert.equal(endOf('2024-02-04', 'month'), '2024-02-29');
  assert.equal(endOf('2025-02-04', 'month'), '2025-02-28');
  assert.equal(startOf('2026-10-11', 'week'), '2026-10-05');
  assert.equal(startOf('2026-10-12', 'week'), '2026-10-12');
  assert.equal(shiftStart('2026-03-31', 'month', -1), '2026-02-01');
  assert.equal(progress(0, 120, '2024-01-01', '2024-12-31', '2024-02-01').goalMinutes, 43920);
});
test('timezone boundaries preserve logical date', () => {
  const now = new Date('2026-10-13T22:00:00Z');
  assert.equal(today('Asia/Riyadh', now), '2026-10-14');
  assert.equal(today('America/Los_Angeles', now), '2026-10-13');
});
test('streak ends today or yesterday and stops at gaps', () => {
  assert.equal(streak([], '2026-10-13'), 0);
  assert.equal(streak(['2026-10-11', '2026-10-12'], '2026-10-13'), 2);
  assert.equal(streak(['2026-10-11', '2026-10-13'], '2026-10-13'), 1);
  assert.equal(streak(['2026-10-11'], '2026-10-13'), 0);
});
test('comparison clamps prior months and handles zeros', () => {
  assert.deepEqual(comparisonWindow('2026-03-31', 'month'), {
    from: '2026-02-01',
    to: '2026-02-28',
  });
  assert.equal(changePct(100, 0), null);
  assert.equal(changePct(0, 0), null);
  assert.equal(changePct(120, 60), 100);
});

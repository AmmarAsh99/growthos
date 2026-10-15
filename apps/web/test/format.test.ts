import { test } from 'node:test';
import assert from 'node:assert/strict';
import { duration, validDuration, localDate } from '../src/app/shared/format';
test('duration input accepts exactly 24 hours but no extra minutes', () => {
  assert.equal(validDuration(24, 0), true);
  for (const [h, m] of [
    [24, 1],
    [0, 0],
    [-1, 20],
    [1, 60],
    [1.5, 0],
  ])
    assert.equal(validDuration(h, m), false);
  assert.equal(validDuration(2, 15), true);
});
test('duration display and date are logical and timezone-aware', () => {
  assert.equal(duration(135), '2h 15m');
  assert.equal(duration(0), '0m');
  assert.equal(localDate('Asia/Riyadh', new Date('2026-10-13T22:00:00Z')), '2026-10-14');
});

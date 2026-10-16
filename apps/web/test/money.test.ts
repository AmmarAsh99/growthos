import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moneyInput, parseMoney } from '../src/app/shared/money';
test('SAR input converts exactly to integer halalas', () => {
  assert.equal(parseMoney('0.29'), 29);
  assert.equal(parseMoney('13200'), 1320000);
  assert.equal(parseMoney('500.1'), 50010);
  assert.equal(moneyInput(555001), '5550.01');
  for (const value of ['-1', '1.001', '1e3', 'NaN', '10000001', ''])
    assert.throws(() => parseMoney(value));
});

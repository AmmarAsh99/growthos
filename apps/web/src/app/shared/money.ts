import { Pipe, PipeTransform } from '@angular/core';
export function parseMoney(value: string): number {
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(value))
    throw new Error('Enter a positive SAR amount with up to two decimal places');
  const [whole, decimal = ''] = value.split('.');
  const amount = Number(BigInt(whole) * 100n + BigInt(decimal.padEnd(2, '0')));
  if (amount > 1000000000) throw new Error('Amount exceeds 10,000,000 SAR');
  return amount;
}
export const moneyInput = (value: number) =>
  `${Math.trunc(value / 100)}.${String(value % 100).padStart(2, '0')}`;
export const money = (value: number | null | undefined) =>
  value === null || value === undefined
    ? '—'
    : new Intl.NumberFormat('en-SA', {
        style: 'currency',
        currency: 'SAR',
        maximumFractionDigits: 2,
      }).format(value / 100);
@Pipe({ name: 'sar' })
export class SarPipe implements PipeTransform {
  transform(value: number | null | undefined) {
    return money(value);
  }
}

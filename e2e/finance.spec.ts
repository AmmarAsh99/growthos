import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

test('finance ledger, budgets, reports and responsive themes use the real API', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/register');
  await page.getByLabel('Display name').fill('Finance Explorer');
  await page.getByLabel('Email address').fill(`finance-browser-${randomUUID()}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill('Finance-browser-password-89342');
  await page.getByRole('button', { name: 'Create your account' }).click();
  await expect(page.getByRole('heading', { name: 'Keep growing' })).toBeVisible();
  await page.getByLabel('Color theme').selectOption('light');
  await page.getByRole('link', { name: 'Finance Dashboard', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Financial overview', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('No expenses yet')).toBeVisible();
  await page.getByRole('link', { name: 'Add Expense', exact: true }).click();
  await page.getByLabel('Amount (SAR)', { exact: true }).fill('500.00');
  await page.getByLabel('Category', { exact: true }).selectOption({ label: 'Shopping' });
  await page.getByLabel('Description', { exact: true }).fill('Browser shopping expense');
  await page.getByRole('button', { name: 'Save transaction', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Financial overview', exact: true }),
  ).toBeVisible();
  await expect(page.locator('tr').filter({ hasText: 'General monthly spending' })).toContainText(
    '2,000',
  );
  await expect(page.locator('tr').filter({ hasText: 'General monthly spending' })).toContainText(
    '20%',
  );
  await page.getByRole('link', { name: 'Add Expense', exact: true }).click();
  await page.getByLabel('Transaction type').selectOption('income');
  await page.getByLabel('Amount (SAR)', { exact: true }).fill('13200');
  await page.getByLabel('Description', { exact: true }).fill('Salary received');
  await page.getByRole('button', { name: 'Save transaction', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Financial overview', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Add Expense', exact: true }).click();
  await page.getByLabel('Transaction type').selectOption('transfer');
  await page.getByLabel('Amount (SAR)', { exact: true }).fill('5550');
  await page.getByLabel('Budget envelope').selectOption({ label: 'Planned savings' });
  await page.getByLabel('Description', { exact: true }).fill('Savings contribution');
  await page.getByRole('button', { name: 'Save transaction', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Financial overview', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.metric').filter({ hasText: 'Total spent this month' })).toContainText(
    '500',
  );
  await page.screenshot({ path: 'test-results/finance-light-desktop.png', fullPage: true });
  await page.getByLabel('Color theme').selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.getByLabel('Color theme')).toHaveValue('dark');
  await expect(
    page.getByRole('heading', { name: 'Financial overview', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: 'test-results/finance-dark-desktop.png', fullPage: true });
  await page.getByRole('link', { name: 'Budgets', exact: true }).click();
  await expect(page.getByText('Fully allocated')).toBeVisible();
  await page.getByLabel('Monthly salary plan (SAR)').fill('13201');
  await expect(page.getByRole('button', { name: 'Save monthly budget' })).toBeDisabled();
  await page.getByLabel('Monthly salary plan (SAR)').fill('13200');
  await page.getByLabel('Usage warning threshold (%)').fill('75');
  await page.getByRole('button', { name: 'Save monthly budget' }).click();
  await expect(page.getByRole('status')).toContainText('Monthly budget saved');
  await page.getByRole('link', { name: 'Monthly Reports', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Monthly reports', exact: true })).toBeVisible();
  await expect(page.locator('.metric').filter({ hasText: 'Net cash flow' })).toContainText(
    '12,700',
  );
  await page.getByRole('link', { name: 'Transactions', exact: true }).click();
  await page
    .getByRole('row')
    .filter({ hasText: 'Browser shopping expense' })
    .getByRole('link', { name: 'Edit' })
    .click();
  await page.getByLabel('Amount (SAR)', { exact: true }).fill('450.25');
  await page.getByRole('button', { name: 'Save transaction', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Financial overview', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.metric').filter({ hasText: 'Total spent this month' })).toContainText(
    '450.25',
  );
  await page.getByRole('link', { name: 'Transactions', exact: true }).click();
  await page
    .getByRole('row')
    .filter({ hasText: 'Browser shopping expense' })
    .getByRole('button', { name: 'Delete', exact: true })
    .click();
  await page.getByRole('button', { name: 'Keep transaction' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Browser shopping expense' })).toBeVisible();
  await page
    .getByRole('row')
    .filter({ hasText: 'Browser shopping expense' })
    .getByRole('button', { name: 'Delete', exact: true })
    .click();
  await page.getByRole('button', { name: 'Delete transaction', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Browser shopping expense' })).toHaveCount(
    0,
  );
  await page.getByRole('link', { name: 'Finance Dashboard', exact: true }).click();
  await expect(page.getByText('No expenses yet')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page.screenshot({ path: 'test-results/finance-dark-mobile.png', fullPage: true });
  await page.getByLabel('Color theme').selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.screenshot({ path: 'test-results/finance-light-mobile.png', fullPage: true });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.getByLabel('Color theme').selectOption('system');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  for (const label of ['Transactions', 'Budgets', 'Add Expense']) {
    await page.getByRole('button', { name: 'Toggle navigation' }).click();
    await page.getByRole('link', { name: label, exact: true }).click();
    await expect(
      page.getByRole('heading', {
        name: label === 'Add Expense' ? 'Add expense' : label,
        exact: true,
      }),
    ).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  }
  expect(errors).toEqual([]);
});

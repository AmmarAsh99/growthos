import { expect, test } from '@playwright/test';

test('Arabic switch preserves form input, persists, and restores English', async ({ page }) => {
  // This frontend-only check needs no database or authenticated account.
  await page.route('**/api/v1/auth/refresh', (route) => route.fulfill({ status: 401, body: '{}' }));
  await page.goto('/login');
  const language = page.getByRole('combobox', { name: 'Language / اللغة' });
  await page.getByLabel('Email address').fill('language-test@example.com');
  await language.selectOption('ar');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'مرحباً بعودتك' })).toBeVisible();
  await expect(page.getByLabel('البريد الإلكتروني', { exact: true })).toHaveValue(
    'language-test@example.com',
  );
  await page.reload();
  await expect(language).toHaveValue('ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(language).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await language.selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

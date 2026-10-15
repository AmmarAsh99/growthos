import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  use: {
    reducedMotion: 'reduce',
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:8080',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  workers: 1,
  timeout: 60000,
  reporter: 'list',
});

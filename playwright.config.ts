import { defineConfig, devices } from '@playwright/test';

const port = process.env.HABITFLOW_E2E_ISOLATED ? 3100 : 3000;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI || process.env.HABITFLOW_E2E_ISOLATED ? 1 : undefined,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'line',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: process.env.HABITFLOW_E2E_BROWSER_CHANNEL === 'chrome' ? 'chrome' : undefined,
      },
    },
  ],
  webServer: {
    command: process.env.HABITFLOW_E2E_ISOLATED ? `npm run dev -- --port ${port}` : 'npm run dev',
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI && !process.env.HABITFLOW_E2E_ISOLATED,
  },
});

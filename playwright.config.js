import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:5174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
    ...(process.env.CI ? {} : { channel: 'chrome' }),
  },
  webServer: [
    {
      command: 'node server/e2e-server.js',
      port: 3101,
      reuseExistingServer: false,
      timeout: 120_000,
      gracefulShutdown: { signal: 'SIGINT', timeout: 5_000 },
    },
    {
      command: 'node client/node_modules/vite/bin/vite.js client --host 127.0.0.1 --port 5174',
      port: 5174,
      reuseExistingServer: false,
      timeout: 120_000,
      gracefulShutdown: { signal: 'SIGINT', timeout: 5_000 },
      env: { VITE_API_TARGET: 'http://127.0.0.1:3101' },
    },
  ],
});

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: process.env.CI ? 6 : undefined,
  timeout: 15000,
  expect: { timeout: 5000 },
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...(process.env.PVPT_CHROMIUM ? {launchOptions:{executablePath:process.env.PVPT_CHROMIUM,args:['--no-zygote','--no-sandbox']}} : {}),
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['iPhone 13'], browserName: 'chromium' },
    },
  ],
  webServer: {
    command: 'node server.js',
    env: { PORT:'4173',PVPT_DATABASE_PATH:':memory:' },
    url: 'http://127.0.0.1:4173/api/health',
    reuseExistingServer: false,
    timeout: 15_000,
  },
});

import { defineConfig } from '@playwright/test';

// Drives the real game in Microsoft Edge (installed with Windows, so no browser
// download), against a dev server of its own on port 5181.
export default defineConfig({
  testDir: 'tests',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5181',
    channel: 'msedge',
    viewport: { width: 960, height: 540 },
  },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --port 5181 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:5181',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});

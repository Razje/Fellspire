import { defineConfig } from '@playwright/test';

// Drives the real game in Microsoft Edge (installed with Windows, so no browser
// download), against dev servers of its own on ports 5181 and up.
//
// Tests run side by side (WORKERS at once), and each worker gets its own dev server:
// a page load asks for about 900 files (every art frame, every module), and one server
// for six pages made each start-up six times slower. tests/fixtures.ts points each
// worker at its server. Four is the measured best on this laptop (Ryzen 7 5700U, 8
// cores): booting the game is CPU work in each browser, so start-up takes 10 s alone,
// 17 s with three at once and 35 s with six, and more workers stopped paying. The full
// suite went from 11.8 to 6 to 8 minutes, and to about 4 with the frames packed into
// sheets (2026-11-27). PW_WORKERS=1 runs one at a time.
export const WORKERS = Number(process.env.PW_WORKERS) || 4;
export const PORT = 5181;

export default defineConfig({
  testDir: 'tests',
  timeout: 90_000,
  fullyParallel: true,
  workers: WORKERS,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    channel: 'msedge',
    viewport: { width: 960, height: 540 },
    // the real graphics card: without these, headless Edge draws WebGL in software on the CPU
    launchOptions: { args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] },
  },
  webServer: Array.from({ length: WORKERS }, (_, i) => ({
    command: `node node_modules/vite/bin/vite.js --port ${PORT + i} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT + i}`,
    reuseExistingServer: false,
    timeout: 60_000,
  })),
});

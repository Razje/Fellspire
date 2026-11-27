// Every spec imports `test` from here instead of '@playwright/test'. It adds two things:
//
// - Each worker talks to its own dev server (see playwright.config.ts).
// - While a test runs, the browser's own code coverage records which functions of the
//   game's source the test actually ran, saved to `.covermap/` (one small file per
//   test). `tools/test-changed.mjs` reads those to run only the tests that ran the
//   functions you changed.
//
// Coverage is taken straight from the browser (Profiler.takePreciseCoverage), and
// also just before every reload: a test that reloads the page would otherwise lose
// what ran before it. Both traps were found on the shrine test, 2026-11-27.
import { test as base, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

export const COVERMAP_DIR = fileURLToPath(new URL('../.covermap', import.meta.url));
const PORT = 5181;

interface ScriptCoverage { url: string; functions: { functionName: string; ranges: { count: number }[] }[] }

export const test = base.extend<{ covermap: void }>({
  // parallelIndex runs from 0 to WORKERS - 1, one per worker slot
  baseURL: async ({}, use, info) => {
    await use(`http://127.0.0.1:${PORT + info.parallelIndex}`);
  },

  covermap: [async ({ page }, use, info) => {
    const ran = new Map<string, Set<string>>(); // src file -> names of functions that ran
    // a first stop on the test server: coverage switched on while the page is still the
    // blank start page is lost when the game's address moves it to another process
    await page.goto('/tsconfig.json');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.startPreciseCoverage', { callCount: true, detailed: false });
    const take = async () => {
      let result: ScriptCoverage[] = [];
      try { ({ result } = await cdp.send('Profiler.takePreciseCoverage') as { result: ScriptCoverage[] }); } catch { return; }
      for (const s of result) {
        const m = /\/(src\/[^?#]+\.ts)/.exec(s.url);
        if (!m) continue;
        let names = ran.get(m[1]);
        // the first entry is the module's own top level, which runs on every load
        s.functions.forEach((f, i) => {
          if (i === 0 || !(f.ranges[0]?.count > 0)) return;
          if (!names) ran.set(m[1], names = new Set());
          names.add(f.functionName || '(anonymous)');
        });
      }
    };
    // before a reload or a new address, take what ran on the page that is about to go.
    // Tests leave a page only through goto and reload, so those two take it first:
    // watching for the new page's request came too late (the old page's scripts were
    // already gone), and holding that request deadlocked the browser.
    for (const name of ['goto', 'reload'] as const) {
      const original = page[name].bind(page) as (...a: unknown[]) => Promise<unknown>;
      (page as unknown as Record<string, unknown>)[name] = async (...a: unknown[]) => { await take(); return original(...a); };
    }
    await use();
    await take();
    mkdirSync(COVERMAP_DIR, { recursive: true });
    const spec = 'tests/' + basename(info.file);
    const id = createHash('sha1').update(spec + ' ' + info.titlePath.join(' > ')).digest('hex').slice(0, 12);
    const files = Object.fromEntries([...ran].sort(([a], [b]) => a.localeCompare(b)).map(([f, n]) => [f, [...n].sort()]));
    writeFileSync(`${COVERMAP_DIR}/${id}.json`, JSON.stringify({ spec, title: info.title, status: info.status, files }));
  }, { auto: true }],
});

export { expect };
export type { Page } from '@playwright/test';

// WP UI-4 — Playwright e2e for the Ledger Board (02-UI-SPEC §7 UI-4, §8).
// Runs against the DEV server (ui/playwright.config.ts webServer: `npm --prefix
// ui run dev -- --port 5173 --strictPort`, baseURL localhost:5173,
// reuseExistingServer). The committed fixture ledger/example-r-0000.json
// (runId r-0000, status done, 16 events, PR url) is what the board shows today.
//
// This file lives in ui/test/ next to the vitest suites (format.test.ts,
// RunPage.test.tsx), so `npm --prefix ui run test` (bare `vitest run`) also
// globs it. That collides: loading @playwright/test under vitest redefines
// the matcher registry symbol. The intended fix is a one-line vitest
// `test.exclude: ['**/e2e.spec.ts']` in vite.config.ts (owned by UI-1, out of
// UI-4's ownership). Until that lands, we keep both runners green here:
// under vitest register a single no-op test and do NOT load @playwright/test;
// under the Playwright runner (its real home) run the suite for real.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import type { Browser, BrowserContext } from '@playwright/test';

// ui/ is a "type": "module" package, so this spec loads as ESM and `__dirname`
// is not in scope.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Repo root: ui/test/e2e.spec.ts → D:\shim-desk. The live-ledger test writes
// ledger/r-9999.json here (ui/ is a subdir of the repo root) and MUST delete
// it in afterAll so it never leaks into git.
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const LEDGER_DIR = path.join(REPO_ROOT, 'ledger');
const LIVE_FILE = path.join(LEDGER_DIR, 'r-9999.json');

// Vitest sets process.env.VITEST='true' in its worker; the Playwright runner
// does not. (type-only import above is erased at runtime, so @playwright/test
// is not loaded on the vitest path — no matcher collision.)
const IS_VITEST = process.env.VITEST === 'true';

// Deep-clone the committed fixture into ledger/r-9999.json with runId r-9999,
// createdAt now, status "scanned" (in-progress), so it sorts to the top of
// the runs page and exercises the dev server's live poll.
function writeLiveRun(): void {
  const fixture = JSON.parse(
    fs.readFileSync(path.join(LEDGER_DIR, 'example-r-0000.json'), 'utf8'),
  );
  const live = structuredClone(fixture);
  live.runId = 'r-9999';
  live.createdAt = new Date().toISOString();
  live.updatedAt = live.createdAt;
  live.status = 'scanned';
  fs.writeFileSync(LIVE_FILE, JSON.stringify(live, null, 2) + '\n', 'utf8');
}

function deleteLiveRun(): void {
  try {
    fs.rmSync(LIVE_FILE, { force: true });
  } catch {
    // Already gone — nothing to clean up.
  }
}

if (IS_VITEST) {
  // Collected by `npm run test` (vitest). This is a Playwright spec, so it has
  // no vitest assertions — register a no-op to keep the unit suite green.
  const { it } = await import('vitest');
  it('e2e.spec.ts is a Playwright spec (02 §7 UI-4) — no vitest assertions', () => {
    // document-only no-op.
  });
} else {
  const { test, expect } = await import('@playwright/test');

  // Post-test guard (02 §7 UI-4 c): the live file must not survive the suite,
  // and `git status --porcelain` must show no r-9999.json.
  test.afterAll(async () => {
    deleteLiveRun();
    const gitStatus = execSync(`git -C "${REPO_ROOT}" status --porcelain`, {
      encoding: 'utf8',
    });
    expect(gitStatus).not.toContain('r-9999.json');
    expect(fs.existsSync(LIVE_FILE)).toBe(false);
  });

  // a. + b. Open `/`, see the fixture run card, click into it, see GatesTable.
  test('board: fixture run card opens into the run with all-pass gates footer', async ({
    page,
  }) => {
    await page.goto('/');
    // a. The fixture card: runId r-0000, repo JayanthMalladi/shim-demo-app,
    //    StatusPill "PR opened" (status done → pill text per 02 §6).
    const card = page.getByLabel('run r-0000');
    await expect(card).toHaveText(/r-0000/);
    await expect(card).toHaveText(/JayanthMalladi\/shim-demo-app/);
    await expect(card).toHaveText(/PR opened/);

    // b. Click the card's stretched link (an <a> filling the whole card,
    //    02 §5.1 "the whole card links to #/run/<runId>") → #/run/r-0000.
    //    Target the card's own hash link, not the nested PR link, so the click
    //    resolves to a single element.
    await card.locator('a[href="#/run/r-0000"]').click();
    await expect(page).toHaveURL(/#\/run\/r-0000/);

    // The GatesTable renders with the all-pass footer (02 §5.2 #5):
    // "Every gate that passed before still passes" (gates.regressions is empty).
    const gates = page.getByRole('region', { name: 'Gates' });
    await expect(gates).toBeVisible();
    await expect(page.getByText('Every gate that passed before still passes')).toBeVisible();
    // A gate row with pass/fail cell text (a11y: never symbol alone).
    await expect(gates.getByText('pass').first()).toBeVisible();
  });

  // c. Live update: a freshly written ledger/r-9999.json appears within 3 s.
  test('live: a new ledger file appears on the runs page within 3 s', async ({ page }) => {
    try {
      writeLiveRun(); // write valid ledger/r-9999.json from Node (deep clone of the fixture)
    } catch (err) {
      throw new Error(`could not write ${LIVE_FILE}: ${err}`);
    }

    await page.goto('/');
    // Dev server polls /api/runs every 2 s while the tab is visible, and the
    // ledger plugin re-reads the folder on every request (02 §1), so the new
    // card shows up on the next poll — within ~3 s.
    await expect(page.getByLabel('run r-9999')).toBeVisible({ timeout: 3_000 });

    deleteLiveRun(); // never leak into git; afterAll re-checks
  });

  // d. Screenshots (02 §7 UI-4 d, 02 §9 "done means"): full-page, 1280x800
  //    viewport, deviceScaleFactor 2, saved to docs/board-runs.png and
  //    docs/board-run.png. The runs page shows every committed run (fixture
  //    r-0000 + real r-0001); the detail shot showcases the REAL run r-0001.
  const makeScreenshotContext = (browser: Browser): Promise<BrowserContext> =>
    browser.newContext({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 2,
    });

  test('screenshots: runs page and run page at 2x scale', async ({ browser }) => {
    const ctx = await makeScreenshotContext(browser);
    const page = await ctx.newPage();
    try {
      await page.goto('/');
      await expect(page.getByLabel('run r-0000')).toBeVisible();
      await page.screenshot({
        path: path.join(REPO_ROOT, 'docs', 'board-runs.png'),
        fullPage: true,
      });

      // Detail shot: showcase the REAL run (r-0001). Its gates are all green
      // with regressions [], so the all-pass footer renders here too.
      const runPage = await ctx.newPage();
      await runPage.goto('/#/run/r-0001');
      await expect(runPage.getByText('Every gate that passed before still passes')).toBeVisible();
      await runPage.screenshot({
        path: path.join(REPO_ROOT, 'docs', 'board-run.png'),
        fullPage: true,
      });
    } finally {
      await ctx.close();
    }
    expect(fs.existsSync(path.join(REPO_ROOT, 'docs', 'board-runs.png'))).toBe(true);
    expect(fs.existsSync(path.join(REPO_ROOT, 'docs', 'board-run.png'))).toBe(true);
  });
}

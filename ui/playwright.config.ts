import { defineConfig } from '@playwright/test';

// WP UI-4 — Playwright e2e for the Ledger Board (02-UI-SPEC §7, §8).
// `npm --prefix ui run e2e` runs `playwright test` from ui/, so this config
// loads with rootDir = ui/ (the config file's directory). testDir 'test' is
// relative to that, i.e. ui/test; testMatch restricts discovery to the e2e
// spec so the vitest suites (format.test.ts, RunPage.test.tsx) are never
// picked up.
export default defineConfig({
  testDir: 'test',
  testMatch: 'e2e.spec.ts',
  fullyParallel: false, // the live-ledger test mutates repo state; run serially
  workers: 1,
  // Text reporter only — the suite writes its real artifacts (screenshots)
  // straight into docs/, so no HTML report dir is needed locally. Playwright
  // still keeps ui/test-results/ scratch on failed runs (ignored via the
  // .gitignore entry added for this WP).
  reporter: [['list']],
  timeout: 60_000,
  reporter: [['list']],
  use: {
    // Dev server (webServer below, on 5173). The screenshot test (02 §7 UI-4 d)
    // configures its own context: 1280x800 viewport, deviceScaleFactor 2,
    // full-page.
    baseURL: 'http://localhost:5173',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: {
    // Pinned port + strictPort; reuseExistingServer: true so an already-running
    // dev server on 5173 is used instead of spawning a second one.
    command: 'npm --prefix ui run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

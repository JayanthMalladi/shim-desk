// Screenshot script: drives the vite-served mockup with playwright-core
// (resolves from ui/node_modules; cached chromium-1140 launches).
// Usage: node shots.cjs   (vite must be running on :8051)
const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");

const OUT = __dirname;
const base = "http://localhost:8051";

const shots = [
  { url: "/runs.html", out: "runs-1440.png", w: 1440, h: 900, dark: false },
  { url: "/run.html", out: "run-1440.png", w: 1440, h: 900, dark: false },
  { url: "/run.html", out: "run-960.png", w: 960, h: 720, dark: false },
  { url: "/run.html", out: "run-375.png", w: 375, h: 812, dark: false },
  { url: "/run.html", out: "run-1440-dark.png", w: 1440, h: 900, dark: true },
];

(async () => {
  const browser = await chromium.launch();
  for (const s of shots) {
    const ctx = await browser.newContext({
      viewport: { width: s.w, height: s.h },
      deviceScaleFactor: 2,
      colorScheme: s.dark ? "dark" : "light",
    });
    const page = await ctx.newPage();
    await page.goto(base + s.url, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForSelector(".page", { timeout: 15000 });
    // let the data-driven inline script finish its fetch + render
    await page.waitForFunction(() => document.querySelectorAll(".card, .run-card").length > 0, { timeout: 15000 });
    const p = path.join(OUT, s.out);
    await page.screenshot({ path: p, fullPage: true });
    console.log(s.out, "OK");
    await ctx.close();
  }
  await browser.close();
})().catch((e) => {
  console.error("SHOT FAILED", e.message);
  process.exit(1);
});

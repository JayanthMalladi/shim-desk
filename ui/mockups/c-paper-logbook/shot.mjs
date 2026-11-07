// Screenshot driver for the paper-logbook mockup.
// Prereq: vite serving this folder, e.g. from the repo root:
//   node ui/node_modules/vite/bin/vite.js ui/mockups/c-paper-logbook --port 8053
// (vite 5 takes the root as a positional arg, not --root.)
// Resolves playwright-core from ui/node_modules; cached chromium launches fine.
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import path from "node:path";

const OUT = path.dirname(fileURLToPath(import.meta.url)) + path.sep;
const shots = [
  { url: "http://localhost:8053/runs.html", file: "runs-1440.png", width: 1440, height: 900, dark: false },
  { url: "http://localhost:8053/run.html", file: "run-1440.png", width: 1440, height: 900, dark: false },
  { url: "http://localhost:8053/run.html", file: "run-960.png", width: 960, height: 720, dark: false },
  { url: "http://localhost:8053/run.html", file: "run-375.png", width: 375, height: 812, dark: false },
  { url: "http://localhost:8053/run.html", file: "run-1440-dark.png", width: 1440, height: 900, dark: true },
];

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext({ deviceScaleFactor: 2 });
const page = await ctx.newPage();

for (const s of shots) {
  await page.setViewportSize({ width: s.width, height: s.height });
  await page.emulateMedia({ colorScheme: s.dark ? "dark" : "light" });

  await page.goto(s.url, { waitUntil: "networkidle" });
  // Guarantee Bricolage Grotesque is loaded before shooting (headings use it);
  // document.fonts.ready alone can resolve before a face is fetched.
  await page.evaluate(async () => {
    await document.fonts.load('800 34px "Bricolage Grotesque"');
    await document.fonts.load('700 18px "Bricolage Grotesque"');
    await document.fonts.ready;
  });
  await page.waitForTimeout(250); // settle the fetch() render

  const info = await page.evaluate(() => ({ len: document.body.innerText.length }));
  if (info.len < 200) console.error(`WARN ${s.file}: body looks empty`);

  await page.screenshot({ path: OUT + s.file, fullPage: true });
  console.log(`shot ${s.file} (${s.width}x${s.height}, ${s.dark ? "dark" : "light"})`);
}

await browser.close();

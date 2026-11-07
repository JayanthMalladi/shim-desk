// Drives the vite server on 8052 and captures the B mockup shots.
// deviceScaleFactor 2, waits for network idle + fonts, full-page.
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "..", "node_modules", "playwright-core"));

const DIR = __dirname;
const BASE = "http://localhost:8052";

const SHOTS = [
  // [file, page, {width,height}, colorScheme, fullPage]
  ["runs-1440.png", "runs.html", 1440, 900, "dark", true],
  ["run-1440.png", "run.html", 1440, 900, "dark", true],
  ["run-960.png", "run.html", 960, 720, "dark", true],
  ["run-375.png", "run.html", 375, 812, "dark", true],
  ["run-1440-dark.png", "run.html", 1440, 900, "dark", true],
  ["run-1440-light.png", "run.html", 1440, 900, "light", true],
];

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Users/Jayanth/AppData/Local/ms-playwright/chromium-1140/chrome-win/chrome.exe",
    args: ["--no-sandbox"],
  });
  for (const [file, page, width, height, scheme, full] of SHOTS) {
    const ctx = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 2,
      colorScheme: scheme,
    });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/${page}`, { waitUntil: "networkidle" });
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(400); // let data render
    // sanity: body has real data
    const text = await p.evaluate(() => document.body.innerText);
    if (!/r-0001|Shim Desk|Ledger|PR opened|Gates/.test(text)) {
      console.error(`!! ${file} looks blank: ${text.slice(0, 80)}`);
    }
    await p.screenshot({ path: path.join(DIR, file), fullPage: full });
    await ctx.close();
    console.log("ok", file);
  }
  await browser.close();
  console.log("done");
})().catch((e) => { console.error(e); process.exit(1); });

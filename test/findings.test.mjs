// test/findings.test.mjs — node:test coverage for scripts/findings.mjs.
// Acceptance (01 §13.2 WP-B): the parser yields 32 findings / 5 files from the
// captured getshim fixture; findings.json has the documented shape; top is chosen
// by the rule priority; the --scan-cmd path writes scan.txt from Node (no shell
// redirection) and parses it.
import test from "node:test";
import assert from "node:assert/strict";
import fs, { chmodSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

import { parseScanText, buildFindings, chooseTop, rulePriority, reportItems } from "../scripts/findings.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "scan-v6-app.txt");

function tmpRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shim-desk-test-"));
  fs.mkdirSync(path.join(dir, "work", "r-0001"), { recursive: true });
  fs.mkdirSync(path.join(dir, "ledger"), { recursive: true });
  return dir;
}

test("parser yields total 32 and files 5 from the fixture", () => {
  const text = fs.readFileSync(fixturePath, "utf8");
  const { items, total, files } = parseScanText(text);
  assert.equal(total, 32, "total findings");
  assert.equal(files, 5, "files touched");
  assert.equal(items.length, 32, "every finding line is parsed");
  // first item sanity
  assert.deepEqual(items[0], {
    file: ".github/workflows/ci.yml",
    line: 11,
    severity: "break",
    fix: "auto",
    ruleId: "ci-node-version",
    message: "CI runs on a Node version below 22; AI SDK 7 requires Node 22 — the Node version was updated to 22.",
  });
});

test("the last-line tail sets total/files even when item count differs", () => {
  // getshim counts only the source files it would touch, not every line's file.
  const text = `src/a.ts:1  silent/agent  [multi-step-result]  msg\n\n7 findings in 2 files`;
  const { items, total, files } = parseScanText(text);
  assert.equal(items.length, 1);
  assert.equal(total, 7);
  assert.equal(files, 2);
});

test("findings.json shape: source, total, files, bySeverity, byFix, items, top", () => {
  const { items, total, files } = parseScanText(fs.readFileSync(fixturePath, "utf8"));
  const out = buildFindings(items, "scan", { total, files });
  assert.equal(out.source, "scan");
  assert.equal(out.total, 32);
  assert.equal(out.files, 5);
  assert.deepEqual(out.bySeverity, { break: 14, silent: 17, deprecated: 1 });
  assert.deepEqual(out.byFix, { auto: 14, agent: 15, manual: 3 });
  assert.ok(Array.isArray(out.items) && out.items.length === 32);
  assert.ok(out.top, "top must be set for this fixture");
  // top = first silent by rule priority -> multi-step-result at src/agent.ts:17
  assert.equal(out.top.ruleId, "multi-step-result");
  assert.equal(out.top.file, "src/agent.ts");
  assert.equal(out.top.line, 17);
});

test("top-priority selection: rulePriority ordering and ties by file/line", () => {
  // priority: multi-step-result < typed-... < response-messages < multi-step-end-event
  //          < maybe-* < everything else. Lower number = higher priority.
  assert.ok(rulePriority("multi-step-result") < rulePriority("typed-multi-step-result"));
  assert.ok(rulePriority("typed-multi-step-result") < rulePriority("response-messages"));
  assert.ok(rulePriority("response-messages") < rulePriority("multi-step-end-event"));
  assert.ok(rulePriority("multi-step-end-event") < rulePriority("maybe-anything"));
  assert.ok(rulePriority("maybe-anything") < rulePriority("esm-only"));

  const items = [
    { ruleId: "multi-step-end-event", severity: "silent", fix: "agent", file: "b.ts", line: 1, message: "" },
    { ruleId: "typed-multi-step-result", severity: "silent", fix: "agent", file: "a.ts", line: 99, message: "" },
    { ruleId: "multi-step-result", severity: "silent", fix: "agent", file: "z.ts", line: 1, message: "" },
    { ruleId: "esm-only", severity: "silent", fix: "agent", file: "a.ts", line: 1, message: "" },
    { ruleId: "multi-step-result", severity: "break", fix: "auto", file: "a.ts", line: 1, message: "" }, // break, not silent
  ];
  const top = chooseTop(items);
  // only silents count; multi-step-result beats everything even though its file is last alphabetically
  assert.equal(top.ruleId, "multi-step-result");
  assert.equal(top.file, "z.ts");
});

test("chooseTop: when tied on priority, earlier file wins; then earlier line", () => {
  const items = [
    { ruleId: "multi-step-result", severity: "silent", fix: "agent", file: "b.ts", line: 5, message: "" },
    { ruleId: "multi-step-result", severity: "silent", fix: "agent", file: "a.ts", line: 40, message: "" },
    { ruleId: "multi-step-result", severity: "silent", fix: "agent", file: "a.ts", line: 3, message: "" },
  ];
  const top = chooseTop(items);
  assert.equal(top.file, "a.ts");
  assert.equal(top.line, 3);
});

test("chooseTop returns null when no silent finding exists", () => {
  assert.equal(chooseTop([{ ruleId: "esm-only", severity: "break", fix: "agent", file: "a.ts", line: 1, message: "" }]), null);
});

test("report.json: remaining[] preferred, before[] as fallback, report source", () => {
  const report = {
    before: [{ ruleId: "esm-only", severity: "break", fix: "agent", file: "x.ts", line: 1, message: "" }],
    remaining: [{ ruleId: "multi-step-result", severity: "silent", fix: "agent", file: "y.ts", line: 2, message: "" }],
  };
  assert.deepEqual(reportItems(report), [
    { ruleId: "multi-step-result", severity: "silent", fix: "agent", file: "y.ts", line: 2, message: "" },
  ]);
  // no remaining -> fall back to before[]
  const noRem = { before: [{ ruleId: "esm-only", severity: "break", fix: "agent", file: "x.ts", line: "3", message: "" }] };
  const items = reportItems(noRem);
  assert.equal(items.length, 1);
  assert.equal(items[0].ruleId, "esm-only");
  assert.equal(items[0].line, 3, "line is coerced to a number");
});

test("findings.mjs --scan writes work/<run>/findings.json and prints a summary", () => {
  const root = tmpRoot();
  const scanFile = path.join(root, "scan.txt");
  fs.copyFileSync(fixturePath, scanFile);
  const r = spawnSync(process.execPath, [path.join(repoRoot, "scripts", "findings.mjs"), "--run", "r-0001", "--scan", scanFile], {
    env: { ...process.env, SHIM_DESK_ROOT: root },
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr);
  const summary = JSON.parse(r.stdout);
  assert.equal(summary.total, 32);
  assert.equal(summary.files, 5);
  assert.deepEqual(summary.top, { ruleId: "multi-step-result", file: "src/agent.ts", line: 17 });

  const out = JSON.parse(fs.readFileSync(path.join(root, "work", "r-0001", "findings.json"), "utf8"));
  assert.equal(out.items.length, 32);
  assert.equal(out.source, "scan");
  fs.rmSync(root, { recursive: true, force: true });
});

test("findings.mjs --scan-cmd runs getshim via Node (no shell redirection) and writes scan.txt", () => {
  const root = tmpRoot();
  // Provide a fake `npx` that emits a 3-finding scan, and prepend it to PATH
  // so the spawnSync("npx", ..., {shell:true}) call resolves to it.
  const binDir = path.join(root, "fakebin");
  fs.mkdirSync(binDir, { recursive: true });
  const fakeNpx = path.join(binDir, "npx");
  const fakeNpxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
  // A stub `npx` that emits a 3-finding scan; prepended to PATH so the
  // findings.mjs spawnSync("npx", [...], {shell:true}) call resolves to it.
  const stub =
    `#!/usr/bin/env node\n` +
    `process.stdout.write(\n` +
    `  "src/a.ts:1  silent/agent  [multi-step-result]  msg-a\\n" +\n` +
    `  "src/b.ts:9  break/auto  [ci-node-version]  msg-b\\n" +\n` +
    `  "src/c.ts:2  silent/auto  [multi-step-end-event]  msg-c\\n\\n" +\n` +
    `  "3 findings in 3 files\\n"\n` +
    `);\n`;
  if (process.platform === "win32") {
    // On Windows a .cmd wrapper invokes node explicitly so PATH lookup works.
    fs.writeFileSync(path.join(binDir, "npx.cmd"), `@node "%~dp0npx.mjs"`);
    fs.writeFileSync(path.join(binDir, "npx.mjs"), stub);
    fs.writeFileSync(fakeNpx, stub); // harmless; the .cmd is what resolves
  } else {
    fs.writeFileSync(fakeNpx, stub);
    chmodSync(fakeNpx, 0o755);
  }
  const r = spawnSync(process.execPath, [path.join(repoRoot, "scripts", "findings.mjs"), "--run", "r-0001", "--scan-cmd", "src"], {
    env: { ...process.env, SHIM_DESK_ROOT: root, PATH: `${binDir}${path.delimiter}${process.env.PATH}` },
    encoding: "utf8",
  });
  assert.equal(r.status, 0, `${r.stderr}\n${r.stdout}`);
  // scan.txt written by Node, not shell redirection:
  const scanTxt = fs.readFileSync(path.join(root, "work", "r-0001", "scan.txt"), "utf8");
  assert.match(scanTxt, /3 findings in 3 files/);
  const out = JSON.parse(fs.readFileSync(path.join(root, "work", "r-0001", "findings.json"), "utf8"));
  assert.equal(out.total, 3);
  assert.equal(out.files, 3);
  assert.equal(out.items.length, 3);
  fs.rmSync(root, { recursive: true, force: true });
});

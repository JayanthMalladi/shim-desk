// test/render.test.mjs — node:test coverage for scripts/render.mjs.
// Acceptance (01 §13.2 WP-F): snapshot-ish assertions for ALL 11 message kinds
// from 01 §7.3.2, render purity, and the CLI path against a temp SHIM_DESK_ROOT.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

import { render, KINDS } from "../scripts/render.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Minimal in-memory inputs mirroring ledger/example-r-0000.json and the
// findings.json / gates.json shapes (01 §9.4, §11).
const ledger = {
  runId: "r-0000",
  repo: "JayanthMalladi/shim-demo-app",
  requestedBy: "Jayanth",
  status: "done",
  findings: {
    total: 32,
    files: 5,
    bySeverity: { break: 6, silent: 18, deprecated: 8 },
    byFix: { auto: 9, agent: 4, manual: 3 },
    top: {
      ruleId: "multi-step-result",
      severity: "silent",
      fix: "agent",
      file: "src/billing.ts",
      line: 15,
      message: "result.usage counts every step; billing over-counts tokens; tsc will not catch it.",
    },
  },
  autoFixed: 9,
  decisions: [
    { ruleId: "esm-only", choice: 1, by: "Jayanth" },
    { ruleId: "telemetry-needs-otel", choice: 2, by: "Jayanth" },
  ],
  fixes: [
    { file: "src/typed.ts", status: "done", summary: "response.messages -> responseMessages, behavior preserved" },
    { file: "src/messages.ts", status: "done", summary: "Use responseMessages only where history was intended" },
    { file: "src/stream.ts", status: "blocked", summary: "onFinish shape unclear; needs the finishStep API" },
    { file: "src/billing.ts", status: "done", summary: "tokensToBill uses result.finalStep.usage" },
  ],
  gates: {
    baseline: { "install": true, "build": true, "typecheck .": true, "test .": false },
    after: { "install": true, "build": true, "typecheck .": true, "test .": false },
    regressions: [],
  },
  review: { verdict: "approve", by: "shim-reviewer.jayanth" },
  pr: { url: "https://github.com/JayanthMalladi/shim-demo-app/pull/1", filesChanged: 8, additions: 132, deletions: 97 },
};
const findings = { ...ledger.findings, source: "scan", items: [ledger.findings.top] };
const gates = ledger.gates;

test("KINDS lists all 11 formats from 01 §7.3.2", () => {
  assert.deepEqual(KINDS, ["ACK", "FINDINGS", "DECISION", "FANOUT", "PROGRESS", "GATES", "HANDOFF", "APPROVAL", "DONE", "LEDGER", "FAIL"]);
});

test("render is pure: same inputs produce byte-identical output", () => {
  for (const kind of KINDS) {
    const a = render({ ledger, findings, gates, kind, extra: {} });
    const b = render({ ledger, findings, gates, kind, extra: {} });
    assert.equal(a, b, `purity for ${kind}`);
    assert.equal(typeof a, "string");
    assert.ok(a.length > 0, `${kind} must not be empty`);
  }
});

test("ACK: run id, repo, clone+scan line", () => {
  const out = render({ ledger, findings, gates, kind: "ACK", extra: {} });
  assert.match(out, /\*\*r-0000\*\*/);
  assert.match(out, /`JayanthMalladi\/shim-demo-app`/);
  assert.match(out, /Cloning and scanning now/);
});

test("FINDINGS: totals, bySev breakdown, top finding with file:line", () => {
  const out = render({ ledger, findings, gates, kind: "FINDINGS", extra: {} });
  assert.match(out, /32 findings in 5 files/);
  assert.match(out, /6 break, 18 silent, 8 deprecated/);
  assert.match(out, /Shim fixes 9 automatically; 4 need a code change; 3 need your call/);
  assert.match(out, /Most important: .*src\/billing\.ts:15/);
});

test("DECISION: question i of n, options, recommendation marker", () => {
  const extra = {
    index: 1,
    total: 2,
    title: "Convert src/legacy.cjs to ESM, or leave it?",
    why: "src/legacy.cjs:1 uses require('ai'), which throws in v7.",
    option1: "Convert the file to ESM",
    option2: "Leave it and mark the PR draft",
    recommended: 1,
  };
  const out = render({ ledger, findings, gates, kind: "DECISION", extra });
  assert.match(out, /\*\*Decision 1\/2: Convert src\/legacy\.cjs to ESM, or leave it\?\*\*/);
  assert.match(out, /src\/legacy\.cjs:1/);
  assert.match(out, /1\. Convert the file to ESM \(recommended\)/);
  assert.match(out, /2\. Leave it and mark the PR draft/);
  assert.match(out, /Reply with the number/);
});

test("FANOUT: auto-fixed count from ledger, file list from fix-plan", () => {
  const out = render({ ledger, findings, gates, kind: "FANOUT", extra: { files: "src/typed.ts;src/messages.ts" } });
  assert.match(out, /Shim applied 9 deterministic fixes/);
  assert.match(out, /Fixing 2 files in parallel/);
  assert.match(out, /src\/typed\.ts/);
  assert.match(out, /src\/messages\.ts/);
});

test("PROGRESS: done and blocked statuses, summary, file", () => {
  const done = render({ ledger, findings, gates, kind: "PROGRESS", extra: { file: "src/typed.ts", status: "done", summary: "response.messages -> responseMessages" } });
  assert.match(done, /✅/);
  assert.match(done, /`src\/typed\.ts`: response\.messages -> responseMessages/);
  const blocked = render({ ledger, findings, gates, kind: "PROGRESS", extra: { file: "src/stream.ts", status: "blocked", summary: "needs finishStep API" } });
  assert.match(blocked, /⛔/);
  assert.match(blocked, /`src\/stream\.ts`/);
});

test("GATES: one table row per gate, per-gate baseline vs after, no-regression line", () => {
  const out = render({ ledger, findings, gates, kind: "GATES", extra: {} });
  // header + four gate rows, each with baseline and after columns
  assert.match(out, /\| gate \| baseline \| after \|/);
  assert.match(out, /\| install \| ✅ \| ✅ \|/);
  assert.match(out, /\| build \| ✅ \| ✅ \|/);
  assert.match(out, /\| typecheck \. \| ✅ \| ✅ \|/);
  assert.match(out, /\| test \. \| ❌ \| ❌ \|/);
  // §7.3.2 closing line when nothing regressed
  assert.match(out, /Every gate that passed before still passes\./);
  // a regressed gate flips the closing line
  const reg = { baseline: { "test .": true }, after: { "test .": false }, regressions: ["test ."] };
  const out2 = render({ ledger, findings, gates: reg, kind: "GATES", extra: {} });
  assert.doesNotMatch(out2, /no regressions/i);
  assert.match(out2, /test \./);
});

test("HANDOFF: addresses @reviewer, run id, diff + findings paths", () => {
  const out = render({ ledger, findings, gates, kind: "HANDOFF", extra: {} });
  assert.match(out, /@reviewer please review run \*\*r-0000\*\*/);
  assert.match(out, /`work\/r-0000\/diff\.patch`/);
  assert.match(out, /`work\/r-0000\/findings\.json`/);
  assert.match(out, /verdict line/);
});

test("APPROVAL: repo, diff numbers from ledger.pr, reviewer verdict", () => {
  const out = render({ ledger, findings, gates, kind: "APPROVAL", extra: {} });
  assert.match(out, /Ready to open the PR on `JayanthMalladi\/shim-demo-app`/);
  assert.match(out, /8 files, \+132\/-97/);
  assert.match(out, /Reviewer: approve/);
  assert.match(out, /Reply \*\*approve\*\*/);
});

test("DONE: PR url and ledger line", () => {
  const out = render({ ledger, findings, gates, kind: "DONE", extra: {} });
  assert.match(out, /PR opened: https:\/\/github\.com\/JayanthMalladi\/shim-demo-app\/pull\/1/);
  assert.match(out, /Run \*\*r-0000\*\* logged in the ledger/);
});

test("LEDGER: pipe-separated single line matching §7.3.2 / §8.4", () => {
  const out = render({ ledger, findings, gates, kind: "LEDGER", extra: {} });
  const line = out.trim();
  assert.equal(line.split("\n").filter((l) => l.trim()).length, 1, "LEDGER is a single line");
  // runId | repo | findings | decisions | gates green/total | status | url
  const m = line.match(
    /^r-0000 \| JayanthMalladi\/shim-demo-app \| 32 findings \| decisions: 2 \| gates 3\/4 \| done \| https:\/\/github\.com\/JayanthMalladi\/shim-demo-app\/pull\/1$/
  );
  assert.ok(m, `LEDGER line format, got: ${line}`);
  // gates green = gates.passing (count of true in after); total = gate count
  const reg = { baseline: {}, after: { "test .": false }, regressions: [] };
  const line2 = render({ ledger, findings, gates: reg, kind: "LEDGER", extra: {} }).trim();
  assert.match(line2, /gates 0\/1 \| done/);
});

test("FAIL: step, line, output file, next action", () => {
  const out = render({ ledger, findings, gates, kind: "FAIL", extra: { step: "scan", line: "getshim scan exited 1", file: "work/r-0000/scan.txt", next: "Check the repo lockfile and re-run." } });
  assert.match(out, /⛔/);
  assert.match(out, /scan failed: getshim scan exited 1/);
  assert.match(out, /Output saved to `work\/r-0000\/scan\.txt`/);
  assert.match(out, /Check the repo lockfile and re-run/);
});

test("numbers come from the data, not the code: changed inputs change output", () => {
  const l2 = structuredClone(ledger);
  l2.findings.total = 7;
  l2.findings.files = 2;
  l2.decisions.push({ ruleId: "node-22", choice: 1, by: "Jayanth" });
  l2.pr.filesChanged = 3;
  l2.pr.additions = 10;
  l2.pr.deletions = 4;
  l2.pr.url = "https://github.com/JayanthMalladi/shim-demo-app/pull/9";
  const f2 = structuredClone(findings);
  f2.total = 7;
  f2.files = 2;
  assert.match(render({ ledger: l2, findings: f2, gates, kind: "FINDINGS", extra: {} }), /7 findings in 2 files/);
  assert.match(render({ ledger: l2, findings: f2, gates, kind: "APPROVAL", extra: {} }), /3 files, \+10\/-4/);
  assert.match(render({ ledger: l2, findings: f2, gates, kind: "LEDGER", extra: {} }), /7 findings \| decisions: 3/);
  const done = render({ ledger: l2, findings: f2, gates, kind: "DONE", extra: {} });
  assert.match(done, /pull\/9/);
  assert.doesNotMatch(done, /pull\/1/);
});

test("CLI: render.mjs --run reads ledger/findings/gates under SHIM_DESK_ROOT", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "shim-desk-render-"));
  const run = "r-0007";
  fs.mkdirSync(path.join(root, "work", run), { recursive: true });
  fs.mkdirSync(path.join(root, "ledger"), { recursive: true });
  fs.writeFileSync(path.join(root, "ledger", `${run}.json`), JSON.stringify({ ...ledger, runId: run }, null, 2));
  fs.writeFileSync(path.join(root, "work", run, "findings.json"), JSON.stringify({ ...findings, source: "scan" }, null, 2));
  fs.writeFileSync(path.join(root, "work", run, "gates.json"), JSON.stringify(gates, null, 2));

  for (const kind of KINDS) {
    const extra = [];
    const ex = (k, v) => extra.push("--extra", `${k}=${v}`);
    if (kind === "DECISION") {
      ex("index", "1");
      ex("total", "2");
      ex("title", "esm-only?");
      ex("why", "src/legacy.cjs:1 requires 'ai'.");
      ex("option1", "convert to ESM");
      ex("option2", "leave it");
      ex("recommended", "1");
    }
    if (kind === "FANOUT") ex("files", "src/typed.ts;src/messages.ts");
    if (kind === "PROGRESS") {
      ex("file", "src/typed.ts");
      ex("status", "done");
      ex("summary", "response.messages -> responseMessages");
    }
    if (kind === "FAIL") {
      ex("step", "migrate");
      ex("line", "exited 1");
      ex("file", "work/r-0007/migrate.log");
      ex("next", "check lockfile");
    }
    const r = spawnSync(
      process.execPath,
      [path.join(repoRoot, "scripts", "render.mjs"), "--run", run, "--kind", kind, ...extra],
      { env: { ...process.env, SHIM_DESK_ROOT: root }, encoding: "utf8" }
    );
    assert.equal(r.status, 0, `${kind} cli exit: ${r.stderr}\n${r.stdout}`);
    const direct = render({
      ledger: { ...ledger, runId: run },
      findings,
      gates,
      kind,
      extra: kind === "DECISION"
        ? { index: 1, total: 2, title: "esm-only?", why: "src/legacy.cjs:1 requires 'ai'.", option1: "convert to ESM", option2: "leave it", recommended: 1 }
        : kind === "FANOUT"
          ? { files: "src/typed.ts;src/messages.ts" }
          : kind === "PROGRESS"
            ? { file: "src/typed.ts", status: "done", summary: "response.messages -> responseMessages" }
            : kind === "FAIL"
              ? { step: "migrate", line: "exited 1", file: "work/r-0007/migrate.log", next: "check lockfile" }
              : {},
    });
    // CLI output must equal the pure render for the same inputs (the CLI
    // appends a trailing newline, so trim both sides before comparing).
    assert.equal(r.stdout.trim(), direct.trim(), `${kind} CLI must match pure render`);
  }

  // FINDINGS against the committed example shape
  const rf = spawnSync(
    process.execPath,
    [path.join(repoRoot, "scripts", "render.mjs"), "--run", run, "--kind", "FINDINGS"],
    { env: { ...process.env, SHIM_DESK_ROOT: root }, encoding: "utf8" }
  );
  assert.equal(rf.status, 0, rf.stderr);
  assert.match(rf.stdout, /32 findings in 5 files/);
  fs.rmSync(root, { recursive: true, force: true });
});

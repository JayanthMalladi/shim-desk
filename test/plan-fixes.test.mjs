// test/plan-fixes.test.mjs — node:test coverage for scripts/plan-fixes.mjs.
// Acceptance (01 §13.2 WP-B): plan-fixes groups by file, applies ledger
// decisions (drops "leave it" findings), caps at 12 files, reads
// report.json remaining[] with findings.json fallback.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

import { buildPlan } from "../scripts/plan-fixes.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const F = (file, line, ruleId = "multi-step-result") => ({
  ruleId,
  severity: "silent",
  fix: "agent",
  file,
  line,
  snippet: "",
  message: `m${file}:${line}`,
});

function tmpRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shim-desk-test-"));
  fs.mkdirSync(path.join(dir, "work", "r-0001", "shim"), { recursive: true });
  fs.mkdirSync(path.join(dir, "ledger"), { recursive: true });
  return dir;
}

test("buildPlan: groups findings by file, one entry per file", () => {
  const findings = [F("a.ts", 10), F("a.ts", 5), F("b.ts", 20), F("b.ts", 7)];
  const plan = buildPlan(findings, []);
  assert.equal(plan.files.length, 2);
  assert.equal(plan.files[0].file, "a.ts");
  assert.deepEqual(
    plan.files[0].findings.map((f) => f.line),
    [5, 10],
    "findings within a file are ordered by line"
  );
  assert.deepEqual(plan.files.map((f) => f.file), ["a.ts", "b.ts"], "first-seen file order is stable");
  assert.equal(plan.capped, false);
  assert.equal(plan.leftForHuman.length, 0);
});

test("buildPlan: a 'leave it' decision (choice 2) drops that rule's findings", () => {
  const findings = [F("legacy.cjs", 1, "esm-only"), F("legacy.cjs", 2, "esm-only"), F("typed.ts", 15, "typed-multi-step-result")];
  const decisions = [{ ruleId: "esm-only", choice: 2, by: "jayanth" }];
  const plan = buildPlan(findings, decisions);
  assert.deepEqual(
    plan.files.map((f) => f.file),
    ["typed.ts"],
    "the esm-only file is fully dropped"
  );
  // the decision is attached to groups where a finding matched it — here none, so []
  assert.deepEqual(plan.files[0].decisions, []);

  // a group with an applied decision carries it
  const findings2 = [F("a.ts", 1, "esm-only"), F("a.ts", 2, "multi-step-result")];
  const plan2 = buildPlan(findings2, [{ ruleId: "esm-only", choice: 1, by: "jayanth" }]);
  assert.equal(plan2.files[0].findings.length, 2, "choice 1 (convert) keeps the findings");
  assert.deepEqual(plan2.files[0].decisions.map((d) => d.ruleId), ["esm-only"]);
});

test("buildPlan: non-leave choices keep findings; 'leave' / 'leave it' also drop", () => {
  for (const choice of [2, "2", "leave", "leave it"]) {
    const plan = buildPlan([F("a.ts", 1, "esm-only")], [{ ruleId: "esm-only", choice, by: "h" }]);
    assert.equal(plan.files.length, 0, `choice ${JSON.stringify(choice)} drops the finding`);
  }
  for (const choice of [1, "1"]) {
    const plan = buildPlan([F("a.ts", 1, "esm-only")], [{ ruleId: "esm-only", choice, by: "h" }]);
    assert.equal(plan.files.length, 1, `choice ${JSON.stringify(choice)} keeps the finding`);
  }
});

test("buildPlan: cap at 12 files, overflow goes to leftForHuman", () => {
  const findings = [];
  for (let i = 0; i < 15; i++) findings.push(F(`src/f${i}.ts`, 10 + i));
  const plan = buildPlan(findings, []);
  assert.equal(plan.capped, true);
  assert.equal(plan.files.length, 12);
  assert.deepEqual(plan.files.map((f) => f.file), Array.from({ length: 12 }, (_, i) => `src/f${i}.ts`));
  assert.deepEqual(
    plan.leftForHuman.map((f) => f.file),
    ["src/f12.ts", "src/f13.ts", "src/f14.ts"],
    "overflow findings are listed for the PR body"
  );
  assert.equal(plan.files.length, 12, "cap is 12 even when more distinct files exist");
});

test("plan-fixes.mjs end-to-end: report.json remaining[] wins, ledger decisions applied, fix-plan.json written", () => {
  const root = tmpRoot();
  const remaining = [
    { ruleId: "esm-only", severity: "break", fix: "agent", file: "src/legacy.cjs", line: 1, message: "require('ai')" },
    { ruleId: "multi-step-result", severity: "silent", fix: "agent", file: "src/agent.ts", line: 17, message: "usage" },
    { ruleId: "typed-multi-step-result", severity: "silent", fix: "agent", file: "src/typed.ts", line: 15, message: "usage" },
  ];
  fs.writeFileSync(
    path.join(root, "work", "r-0001", "shim", "report.json"),
    JSON.stringify({ verdict: "open-issue", remaining, before: remaining })
  );
  fs.writeFileSync(
    path.join(root, "ledger", "r-0001.json"),
    JSON.stringify({
      runId: "r-0001",
      repo: "JayanthMalladi/shim-demo-app",
      status: "fixing_deterministic",
      events: [],
      decisions: [{ ruleId: "esm-only", question: "q", options: ["a", "b"], choice: 2, by: "jayanth", at: "2026-11-05T00:00:00.000Z" }],
    })
  );
  const r = spawnSync(process.execPath, [path.join(repoRoot, "scripts", "plan-fixes.mjs"), "--run", "r-0001"], {
    env: { ...process.env, SHIM_DESK_ROOT: root },
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr);
  const plan = JSON.parse(fs.readFileSync(path.join(root, "work", "r-0001", "fix-plan.json"), "utf8"));
  // esm-only was "leave it" -> dropped; the other two remain
  assert.deepEqual(plan.files.map((f) => f.file), ["src/agent.ts", "src/typed.ts"]);
  assert.equal(plan.files[0].findings.length, 1);
  assert.deepEqual(plan.files[0].findings[0].ruleId, "multi-step-result");
  // the esm-only decision does not attach to the kept groups (no matching finding)
  assert.deepEqual(plan.files[0].decisions, []);
  assert.equal(plan.capped, false);
  assert.equal(plan.leftForHuman.length, 0);
  fs.rmSync(root, { recursive: true, force: true });
});

test("plan-fixes.mjs end-to-end: falls back to findings.json agent items when report.json is absent", () => {
  const root = tmpRoot();
  fs.rmSync(path.join(root, "work", "r-0001", "shim"), { recursive: true, force: true });
  fs.writeFileSync(
    path.join(root, "work", "r-0001", "findings.json"),
    JSON.stringify({
      source: "scan",
      total: 4,
      files: 3,
      bySeverity: { break: 2, silent: 2, deprecated: 0 },
      byFix: { auto: 1, agent: 3, manual: 0 },
      top: null,
      items: [
        { ruleId: "multi-step-result", severity: "silent", fix: "agent", file: "a.ts", line: 1, message: "" },
        { ruleId: "ci-node-version", severity: "break", fix: "auto", file: "a.ts", line: 11, message: "" },
        { ruleId: "tool-execution-context", severity: "break", fix: "agent", file: "b.ts", line: 13, message: "" },
        { ruleId: "telemetry-needs-otel", severity: "silent", fix: "manual", file: "c.ts", line: 39, message: "" },
      ],
    })
  );
  fs.writeFileSync(
    path.join(root, "ledger", "r-0001.json"),
    JSON.stringify({ runId: "r-0001", repo: "JayanthMalladi/shim-demo-app", status: "scanned", events: [], decisions: [] })
  );
  const r = spawnSync(process.execPath, [path.join(repoRoot, "scripts", "plan-fixes.mjs"), "--run", "r-0001"], {
    env: { ...process.env, SHIM_DESK_ROOT: root },
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr);
  const plan = JSON.parse(fs.readFileSync(path.join(root, "work", "r-0001", "fix-plan.json"), "utf8"));
  // only fix:"agent" items: a.ts:1 (multi-step-result) and b.ts:13 (tool-execution-context)
  assert.deepEqual(plan.files.map((f) => f.file), ["a.ts", "b.ts"]);
  assert.equal(plan.files[0].findings.length, 1);
  assert.equal(plan.files[1].findings[0].ruleId, "tool-execution-context");
  fs.rmSync(root, { recursive: true, force: true });
});

test("plan-fixes.mjs end-to-end: capped plan marks overflow leftForHuman", () => {
  const root = tmpRoot();
  const remaining = [];
  for (let i = 0; i < 14; i++) {
    remaining.push({ ruleId: "multi-step-result", severity: "silent", fix: "agent", file: `src/f${i}.ts`, line: 1 + i, message: "" });
  }
  fs.writeFileSync(path.join(root, "work", "r-0001", "shim", "report.json"), JSON.stringify({ remaining }));
  fs.writeFileSync(
    path.join(root, "ledger", "r-0001.json"),
    JSON.stringify({ runId: "r-0001", repo: "JayanthMalladi/shim-demo-app", status: "fixing_deterministic", events: [], decisions: [] })
  );
  const r = spawnSync(process.execPath, [path.join(repoRoot, "scripts", "plan-fixes.mjs"), "--run", "r-0001"], {
    env: { ...process.env, SHIM_DESK_ROOT: root },
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr);
  const plan = JSON.parse(fs.readFileSync(path.join(root, "work", "r-0001", "fix-plan.json"), "utf8"));
  assert.equal(plan.files.length, 12);
  assert.equal(plan.capped, true);
  assert.deepEqual(plan.leftForHuman.map((f) => f.file), ["src/f12.ts", "src/f13.ts"]);
  fs.rmSync(root, { recursive: true, force: true });
});

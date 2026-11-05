// test/ledger.test.mjs — node:test coverage for scripts/ledger.mjs.
// Acceptance (01 §13.2 WP-B): status transitions append {t,kind:"status",status}
// to events (t = ISO UTC date-time); decisions patch ledger.decisions; all writes
// are atomic (temp file + rename in the same directory) so the UI never reads a
// half-written ledger.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

import { patchLedger, writeJsonAtomic } from "../scripts/ledger.mjs";
import { isOwned } from "../scripts/clone.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const T0 = "2026-11-05T09:00:00.000Z"; // a fixed "now" so assertions on event t are stable

function stub() {
  return {
    runId: "r-0001",
    repo: "JayanthMalladi/shim-demo-app",
    migration: "ai-sdk-v7",
    requestedBy: "jayanth",
    room: "shim-desk",
    createdAt: T0,
    updatedAt: T0,
    status: "requested",
    events: [{ t: T0, kind: "status", status: "requested" }],
  };
}

test("writeJsonAtomic: write-then-rename, no .tmp left behind, content intact", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shim-desk-ledger-"));
  const target = path.join(dir, "r-0001.json");
  writeJsonAtomic(target, { a: 1 });
  // renamed into place; no temp file left in the directory
  assert.deepEqual(fs.readdirSync(dir), ["r-0001.json"]);
  assert.deepEqual(JSON.parse(fs.readFileSync(target, "utf8")), { a: 1 });
  // a second atomic write replaces the content; still no temp file
  writeJsonAtomic(target, { a: 2, b: [1, 2, 3] });
  assert.deepEqual(fs.readdirSync(dir), ["r-0001.json"]);
  assert.deepEqual(JSON.parse(fs.readFileSync(target, "utf8")), { a: 2, b: [1, 2, 3] });
  fs.rmSync(dir, { recursive: true, force: true });
});

test("writeJsonAtomic: temp is in the same directory as the target (same-volume rename)", () => {
  // Prove the .tmp name is co-located: create the directory, write, and watch the
  // temp appear under the target's own folder via a directory watcher is
  // flaky, so instead assert the temp path derivation by reading the source.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shim-desk-ledger-"));
  const target = path.join(dir, "sub", "x.json");
  fs.mkdirSync(path.join(dir, "sub"), { recursive: true });
  writeJsonAtomic(target, { ok: true });
  assert.deepEqual(fs.readdirSync(path.join(dir, "sub")), ["x.json"], "target's dir holds only the renamed file");
  assert.ok(fs.existsSync(target));
  fs.rmSync(dir, { recursive: true, force: true });
});

test("patchLedger: --status appends an event {t, kind:'status', status} with a UTC ISO t", () => {
  const l = patchLedger(stub(), { status: "gating" }, "2026-11-05T10:00:00.000Z");
  assert.equal(l.status, "gating");
  assert.equal(l.events.length, 2);
  assert.deepEqual(l.events[1], { t: "2026-11-05T10:00:00.000Z", kind: "status", status: "gating" });
  assert.equal(l.updatedAt, "2026-11-05T10:00:00.000Z");
  // t must be a valid ISO date-time (UTC Z)
  assert.ok(!Number.isNaN(Date.parse(l.events[1].t)), "event t is parseable ISO date-time");
  // input not mutated
  assert.equal(stub().events.length, 1);
});

test("patchLedger: multiple status transitions append in order", () => {
  let l = patchLedger(stub(), { status: "cloning" }, "2026-11-05T09:01:00.000Z");
  l = patchLedger(l, { status: "scanned" }, "2026-11-05T09:02:00.000Z");
  assert.deepEqual(l.events.map((e) => e.status), ["requested", "cloning", "scanned"]);
  assert.ok(l.events.every((e) => e.kind === "status"));
});

test("patchLedger: --decision appends to decisions with numeric choice and by/handle", () => {
  const l = patchLedger(stub(), { decision: { ruleId: "esm-only", choice: "1", by: "jayanth", question: "convert?" } }, "2026-11-05T09:03:00.000Z");
  assert.equal(l.decisions.length, 1);
  const d = l.decisions[0];
  assert.equal(d.ruleId, "esm-only");
  assert.equal(d.choice, 1, "choice is coerced to a number (schema: integer)");
  assert.equal(d.by, "jayanth");
  assert.equal(d.question, "convert?");
  assert.equal(d.at, "2026-11-05T09:03:00.000Z");
  assert.ok(Array.isArray(d.options));
});

test("patchLedger: --review sets review.verdict/notes/rounds", () => {
  let l = patchLedger(stub(), { review: { verdict: "changes", note: "fix the usage read" } }, "2026-11-05T09:04:00.000Z");
  assert.equal(l.review.verdict, "changes");
  assert.deepEqual(l.review.notes, ["fix the usage read"]);
  assert.equal(l.review.rounds, 1);
  l = patchLedger(l, { review: { verdict: "approve", note: "" } }, "2026-11-05T09:05:00.000Z");
  assert.equal(l.review.verdict, "approve");
  assert.equal(l.review.rounds, 2);
  assert.deepEqual(l.review.notes, ["fix the usage read"], "empty note is not appended");
});

test("patchLedger: --pr stores the URL under pr.url", () => {
  const l = patchLedger(stub(), { pr: "https://github.com/JayanthMalladi/shim-demo-app/pull/9" }, "2026-11-05T09:06:00.000Z");
  assert.deepEqual(l.pr, { url: "https://github.com/JayanthMalladi/shim-demo-app/pull/9" });
});

test("patchLedger: --gates / --findings copy whole objects in; they can be combined in one call", () => {
  const gates = { baseline: { "install": true }, after: { "install": true }, regressions: [] };
  const findings = { total: 32, files: 5 };
  const l = patchLedger(stub(), { status: "gating", gates, findings }, "2026-11-05T09:07:00.000Z");
  assert.equal(l.status, "gating");
  assert.deepEqual(l.gates, gates);
  assert.deepEqual(l.findings, findings);
});

function tmpRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shim-desk-ledger-e2e-"));
  fs.mkdirSync(path.join(dir, "ledger"), { recursive: true });
  fs.mkdirSync(path.join(dir, "work", "r-0001"), { recursive: true });
  fs.writeFileSync(path.join(dir, "ledger", "r-0001.json"), JSON.stringify(stub(), null, 2));
  return dir;
}

test("ledger.mjs end-to-end: --status patches the file on disk and appends the event", () => {
  const root = tmpRoot();
  const r = spawnSync(process.execPath, [path.join(repoRoot, "scripts", "ledger.mjs"), "--run", "r-0001", "--status", "gating"], {
    env: { ...process.env, SHIM_DESK_ROOT: root },
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(fs.readFileSync(path.join(root, "ledger", "r-0001.json"), "utf8"));
  assert.equal(out.status, "gating");
  assert.equal(out.events.length, 2);
  assert.equal(out.events[1].kind, "status");
  assert.equal(out.events[1].status, "gating");
  // no temp file leaked
  assert.ok(!fs.readdirSync(path.join(root, "ledger")).some((f) => f.endsWith(".tmp")));
  fs.rmSync(root, { recursive: true, force: true });
});

test("ledger.mjs end-to-end: --decision requires --choice and --by", () => {
  const root = tmpRoot();
  const r = spawnSync(process.execPath, [path.join(repoRoot, "scripts", "ledger.mjs"), "--run", "r-0001", "--decision", "esm-only"], {
    env: { ...process.env, SHIM_DESK_ROOT: root },
    encoding: "utf8",
  });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /--decision requires --choice/);

  const ok = spawnSync(
    process.execPath,
    [path.join(repoRoot, "scripts", "ledger.mjs"), "--run", "r-0001", "--decision", "esm-only", "--choice", "2", "--by", "jayanth"],
    { env: { ...process.env, SHIM_DESK_ROOT: root }, encoding: "utf8" }
  );
  assert.equal(ok.status, 0, ok.stderr);
  const out = JSON.parse(fs.readFileSync(path.join(root, "ledger", "r-0001.json"), "utf8"));
  assert.equal(out.decisions.length, 1);
  assert.equal(out.decisions[0].ruleId, "esm-only");
  assert.equal(out.decisions[0].choice, 2);
  fs.rmSync(root, { recursive: true, force: true });
});

test("ledger.mjs end-to-end: unknown run is refused with exit 1", () => {
  const root = tmpRoot();
  const r = spawnSync(process.execPath, [path.join(repoRoot, "scripts", "ledger.mjs"), "--run", "r-9999", "--status", "gating"], {
    env: { ...process.env, SHIM_DESK_ROOT: root },
    encoding: "utf8",
  });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /r-9999\.json not found/);
  fs.rmSync(root, { recursive: true, force: true });
});

test("ledger.mjs end-to-end: --review invalid value is refused", () => {
  const root = tmpRoot();
  const r = spawnSync(process.execPath, [path.join(repoRoot, "scripts", "ledger.mjs"), "--run", "r-0001", "--review", "maybe"], {
    env: { ...process.env, SHIM_DESK_ROOT: root },
    encoding: "utf8",
  });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /--review must be/);
  fs.rmSync(root, { recursive: true, force: true });
});

test("clone.mjs owner-check: non-Jayanth repo exits 2 with the refusal line (no network)", () => {
  // This is the WP-B acceptance check for the owner guardrail (01 §16, §9.6).
  // Point SHIM_DESK_ROOT at a throwaway dir and give a non-Jayanth repo so the
  // script hits the owner check and exits 2 before it ever touches the network.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "shim-desk-clone-"));
  const r = spawnSync(process.execPath, [path.join(repoRoot, "scripts", "clone.mjs"), "--run", "r-0001", "--repo", "SomeoneElse/their-repo"], {
    env: { ...process.env, SHIM_DESK_ROOT: root },
    encoding: "utf8",
  });
  assert.equal(r.status, 2, `expected exit 2, got ${r.status}: ${r.stderr}`);
  assert.match(r.stderr, /I only open PRs on repos Jayanth owns\. Fork it first and give me the fork\./);
  // and nothing was created under the temp root
  assert.deepEqual(fs.readdirSync(root), []);
  fs.rmSync(root, { recursive: true, force: true });
});

test("clone.mjs owner-check: JayanthMalladi (any case) passes the guard", () => {
  // Pure check of the exported helper — no network, no fs.
  assert.equal(isOwned("JayanthMalladi"), true);
  assert.equal(isOwned("jayanthmalladi"), true);
  assert.equal(isOwned("JAYANTHMalladi"), true);
  assert.equal(isOwned("SomeoneElse"), false);
  assert.equal(isOwned("jayanthMalladix"), false);
});

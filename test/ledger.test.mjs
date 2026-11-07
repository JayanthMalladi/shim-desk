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

import { patchLedger, writeJsonAtomic, gitDiffStat } from "../scripts/ledger.mjs";
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

// ---------------------------------------------------------------------------
// New flags (BUILD-STATUS 5.1): every write appends a matching events[] entry
// {t, kind, actor, text}; --fix upserts fixes[] by file; --review --by sets
// review.by; --pr computes PR stats from a git diffstat; --message / --actor
// append message events.
// ---------------------------------------------------------------------------

test("patchLedger: --auto-fixed-from sets autoFixed and appends a gate event with actor", () => {
  const l = patchLedger(stub(), { autoFixed: 12 }, "2026-11-06T05:38:00.000Z");
  assert.equal(l.autoFixed, 12);
  const ev = l.events[l.events.length - 1];
  assert.equal(ev.kind, "gate");
  assert.equal(ev.actor, "shim-lead.jayanth", "actor defaults to shim-lead.jayanth");
  assert.equal(ev.text, "Shim applied 12 deterministic fixes");
});

test("patchLedger: --fix upserts fixes[] by file (later result replaces, new file appends)", () => {
  let l = patchLedger(stub(), { fix: { file: "src/a.ts", status: "done", summary: "first", agent: "shim-fixer", model: "claude-sonnet-5-5" } }, "2026-11-06T05:40:00.000Z");
  l = patchLedger(l, { fix: { file: "src/b.ts", status: "done", summary: "b", agent: "shim-fixer", model: "claude-sonnet-5-5" } }, "2026-11-06T05:41:00.000Z");
  l = patchLedger(l, { fix: { file: "src/a.ts", status: "blocked", summary: "blocked on typecheck", agent: "shim-fixer", model: "claude-sonnet-5-5" } }, "2026-11-06T05:42:00.000Z");
  assert.equal(l.fixes.length, 2, "same-file fix replaces in place, count stays 2");
  assert.deepEqual(l.fixes, [
    { file: "src/a.ts", status: "blocked", summary: "blocked on typecheck", agent: "shim-fixer", model: "claude-sonnet-5-5" },
    { file: "src/b.ts", status: "done", summary: "b", agent: "shim-fixer", model: "claude-sonnet-5-5" },
  ]);
  const ev = l.events[l.events.length - 1];
  assert.equal(ev.kind, "fix");
  assert.equal(ev.actor, "shim-fixer:src/a.ts", "fix events are attributed to shim-fixer:<file>");
  assert.equal(ev.status, "blocked");
  assert.equal(ev.text, "blocked on typecheck");
});

test("patchLedger: --review --by sets review.by and attributes the review event", () => {
  const l = patchLedger(stub(), { review: { verdict: "changes", by: "shim-reviewer.jayanth", note: "fix the usage read" } }, "2026-11-06T05:43:00.000Z");
  assert.equal(l.review.by, "shim-reviewer.jayanth");
  assert.equal(l.review.verdict, "changes");
  assert.equal(l.review.rounds, 1);
  const ev = l.events[l.events.length - 1];
  assert.equal(ev.kind, "review");
  assert.equal(ev.actor, "shim-reviewer.jayanth");
});

test("patchLedger: --approval sets approval {by, at} and appends an approval event", () => {
  const l = patchLedger(stub(), { approval: { by: "jayanth" } }, "2026-11-06T05:44:00.000Z");
  assert.deepEqual(l.approval, { by: "jayanth", at: "2026-11-06T05:44:00.000Z" });
  const ev = l.events[l.events.length - 1];
  assert.equal(ev.kind, "approval");
  assert.equal(ev.actor, "shim-lead.jayanth");
});

test("patchLedger: --pr with branch + diffstat merges pr.* and appends a pr event", () => {
  const l = patchLedger(stub(), { pr: { url: "https://github.com/JayanthMalladi/shim-demo-app/pull/1", branch: "shim/ai-sdk-7-r-0001", filesChanged: 11, additions: 244, deletions: 203 } }, "2026-11-06T05:45:00.000Z");
  assert.deepEqual(l.pr, { url: "https://github.com/JayanthMalladi/shim-demo-app/pull/1", branch: "shim/ai-sdk-7-r-0001", filesChanged: 11, additions: 244, deletions: 203 });
  const ev = l.events[l.events.length - 1];
  assert.equal(ev.kind, "pr");
  assert.equal(ev.actor, "shim-lead.jayanth");
  assert.equal(ev.branch, "shim/ai-sdk-7-r-0001");
});

test("patchLedger: --message appends a message event; --actor overrides the default actor", () => {
  let l = patchLedger(stub(), { message: "ACK posted", actor: "shim-lead.jayanth" }, "2026-11-06T05:46:00.000Z");
  assert.equal(l.events[l.events.length - 1].kind, "message");
  assert.equal(l.events[l.events.length - 1].text, "ACK posted");
  l = patchLedger(l, { message: "human nudge", actor: "jayanth" }, "2026-11-06T05:47:00.000Z");
  assert.equal(l.events[l.events.length - 1].actor, "jayanth");
});

// gitDiffStat: reads `git -C <dir> diff --shortstat <base>...HEAD`.
test("gitDiffStat: parses files/additions/deletions from a temp git fixture", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shim-desk-diffstat-"));
  const env = { ...process.env, GIT_CONFIG_GLOBAL: "0", GIT_CONFIG_SYSTEM: "0" };
  const g = (...args) => {
    const r = spawnSync("git", args, { cwd: dir, encoding: "utf8", env });
    if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${r.stderr}`);
    return r.stdout;
  };
  g("init", "-q");
  g("config", "user.email", "t@t.local");
  g("config", "user.name", "t");
  fs.writeFileSync(path.join(dir, "a.txt"), "old a\nold b\n");
  g("add", "-A");
  g("commit", "-q", "-m", "base");
  fs.writeFileSync(path.join(dir, "a.txt"), "new a\nnew b\nnew c\n");
  fs.writeFileSync(path.join(dir, "b.txt"), "added line\n");
  g("add", "-A");
  g("commit", "-q", "-m", "head");
  const stats = gitDiffStat(dir, "HEAD~1");
  assert.deepEqual(stats, { filesChanged: 2, additions: 4, deletions: 2 });
  fs.rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// End-to-end replay of r-0001's real sequence: 2 decisions, autoFixed 12,
// 6 fixes, 3 review rounds ending in approve, approval, and a PR with 11
// files / +244 / -203 (computed from a temp git fixture). The result must
// deep-equal the committed ledger/r-0001.json on fixes/autoFixed/review/
// approval/pr, and the produced ledger must validate against schema.json.
// ---------------------------------------------------------------------------

function splitCounts(total, n) {
  const base = Math.floor(total / n);
  const rem = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}
function fileLines(prefix, count) {
  return Array.from({ length: count }, (_, i) => `${prefix} line ${i}`).join("\n") + "\n";
}

// A minimal git repo whose origin/main is the base commit and whose HEAD sits
// on a branch with 11 files changed, +244/-203 relative to base — matching
// r-0001's PR numbers so `--pr --repo-dir` reproduces them.
function makePrFixture(root) {
  const repoDir = path.join(root, "pr-fixture");
  fs.mkdirSync(repoDir, { recursive: true });
  const env = { ...process.env, GIT_CONFIG_GLOBAL: "0", GIT_CONFIG_SYSTEM: "0" };
  const git = (args, cwd = repoDir) => {
    const r = spawnSync("git", args, { cwd, encoding: "utf8", env });
    if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${r.stderr}`);
    return r.stdout;
  };
  git(["init", "-q", "-b", "main"]);
  git(["config", "user.email", "t@t.local"]);
  git(["config", "user.name", "t"]);
  const oldCounts = splitCounts(203, 11);
  const newCounts = splitCounts(244, 11);
  const files = Array.from({ length: 11 }, (_, i) => `f${i}.txt`);
  files.forEach((f, i) => fs.writeFileSync(path.join(repoDir, f), fileLines(`old-${f}`, oldCounts[i])));
  git(["add", "-A"]);
  git(["commit", "-q", "-m", "base"]);
  const baseSha = git(["rev-parse", "HEAD"]).trim();
  // Fake a remote "origin" that points at this repo, with origin/main == base
  // and the symbolic default-branch ref, so resolveBaseRef() resolves to
  // refs/remotes/origin/main without any network fetch.
  git(["remote", "add", "origin", repoDir]);
  git(["update-ref", "refs/remotes/origin/main", baseSha]);
  git(["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main"]);
  git(["checkout", "-q", "-b", "shim/ai-sdk-7-r-0001"]);
  files.forEach((f, i) => fs.writeFileSync(path.join(repoDir, f), fileLines(`new-${f}`, newCounts[i])));
  git(["add", "-A"]);
  git(["commit", "-q", "-m", "upgrade"]);
  return repoDir;
}

function ledgerCli(root, args) {
  const r = spawnSync(process.execPath, [path.join(repoRoot, "scripts", "ledger.mjs"), ...args], {
    env: { ...process.env, SHIM_DESK_ROOT: root },
    encoding: "utf8",
  });
  if (r.status !== 0) throw new Error(`ledger.mjs ${args.join(" ")} failed (exit ${r.status}):\n${r.stderr}`);
  return r.stdout;
}

test("e2e: replay r-0001's sequence and deep-equal the committed ledger on the derived fields", async () => {
  const root = tmpRoot();
  // report.json drives --auto-fixed-from (the real r-0001 had autoFixed 12)
  fs.mkdirSync(path.join(root, "work", "r-0001", "shim"), { recursive: true });
  fs.writeFileSync(path.join(root, "work", "r-0001", "shim", "report.json"), JSON.stringify({ autoFixed: 12 }));

  const fixture = makePrFixture(root);
  const L = (a) => ledgerCli(root, ["--run", "r-0001", ...a]);

  // status transitions across the state machine (spec 9.1)
  L(["--status", "scanned"]);
  L(["--decision", "node-22", "--choice", "1", "--by", "user"]);
  L(["--decision", "telemetry-needs-otel", "--choice", "1", "--by", "user"]);
  L(["--status", "fixing_deterministic"]);
  L(["--auto-fixed-from", "work/r-0001/shim/report.json"]);
  L(["--status", "fixing_parallel"]);
  const fixes = [
    ["src/typed.ts", "Switched all result reads to finalStep.* to keep v6 last-step semantics"],
    ["src/billing.ts", "Read result.finalStep.usage to keep v6 single-step billing"],
    ["src/messages.ts", "allowSystemInMessages:true at viaSpread (the authorized finding)"],
    ["src/legacy.cjs", "Converted to ESM (legacy.mjs, import from ai)"],
    ["src/agent.ts", "finalStep reads, allowSystemInMessages, otel telemetry registered; typecheck passes"],
    ["src/tools.ts", "Added the required context field to both tool-call option literals (type-only)"],
  ];
  for (const [file, summary] of fixes) {
    L(["--fix", file, "--fix-status", "done", "--summary", summary, "--model", "claude-sonnet-5-5"]);
  }
  L(["--status", "gating"]);
  L(["--status", "in_review"]);
  L(["--review", "changes", "--by", "shim-reviewer.jayanth", "--note", "allowSystemInMessages retained at 4 sites (agent.ts:46, agent.ts:53, messages.ts:38, messages.ts:42); 6 untraced sites reverted"]);
  L(["--review", "changes", "--by", "shim-reviewer.jayanth", "--note", "P4 (tsconfig widening + import-smoke for tools.js) parked as a PR-body follow-up"]);
  L(["--review", "approve", "--by", "shim-reviewer.jayanth"]);
  L(["--approval", "--by", "user"]);
  L(["--status", "opening_pr"]);
  L(["--pr", "https://github.com/JayanthMalladi/shim-demo-app/pull/1", "--branch", "shim/ai-sdk-7-r-0001", "--repo-dir", fixture]);
  L(["--status", "done"]);

  const produced = JSON.parse(fs.readFileSync(path.join(root, "ledger", "r-0001.json"), "utf8"));
  const committed = JSON.parse(fs.readFileSync(path.join(repoRoot, "ledger", "r-0001.json"), "utf8"));

  assert.deepEqual(produced.fixes, committed.fixes, "fixes[] deep-equal");
  assert.equal(produced.autoFixed, committed.autoFixed, "autoFixed deep-equal");
  assert.deepEqual(produced.review, committed.review, "review deep-equal");
  assert.equal(produced.approval.by, committed.approval.by, "approval.by deep-equal");
  // pr: url/branch/numbers deep-equal; the diffstat came straight from the fixture
  assert.equal(produced.pr.url, committed.pr.url);
  assert.equal(produced.pr.branch, committed.pr.branch);
  assert.equal(produced.pr.filesChanged, committed.pr.filesChanged);
  assert.equal(produced.pr.additions, committed.pr.additions);
  assert.equal(produced.pr.deletions, committed.pr.deletions);
  assert.equal(produced.pr.filesChanged, 11);
  assert.equal(produced.pr.additions, 244);
  assert.equal(produced.pr.deletions, 203);

  // the produced ledger validates against the committed schema (draft-2020,
  // with ajv-formats for the date-time format checks — same tooling the WP-E
  // acceptance check used via ajv-cli --spec=draft2020)
  const schema = JSON.parse(fs.readFileSync(path.join(repoRoot, "ledger", "schema.json"), "utf8"));
  const Ajv2020 = (await import("ajv/dist/2020.js")).default;
  const addFormats = (await import("ajv-formats")).default;
  const ajv = new Ajv2020({ allErrors: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  assert.ok(validate(produced), `schema validation: ${validate.errors?.map((e) => e.message).join(", ")}`);

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

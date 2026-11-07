#!/usr/bin/env node
// ledger.mjs — read/patch ledger/<runId>.json and write it atomically.
// 01-WORKFLOW-SPEC §9.4 ledger.mjs / §9.1 state machine / §11 schema
// Usage (any combination of flags; --run always required):
//   node scripts/ledger.mjs --run R --status <s>
//   node scripts/ledger.mjs --run R --decision <ruleId> --choice <n> --by <h>
//   node scripts/ledger.mjs --run R --auto-fixed-from work/R/shim/report.json
//   node scripts/ledger.mjs --run R --fix <file> --fix-status <done|blocked> [--summary "<text>"] [--model <id>]
//   node scripts/ledger.mjs --run R --review <approve|changes> [--by <agent>] [--note "<text>"]...
//   node scripts/ledger.mjs --run R --approval --by <handle>
//   node scripts/ledger.mjs --run R --pr <url> [--branch <name>] [--repo-dir <path>]
//   node scripts/ledger.mjs --run R --gates <work/R/gates.json>
//   node scripts/ledger.mjs --run R --findings <work/R/findings.json>
//   node scripts/ledger.mjs --run R --message "<text>"
// Status transitions append {t, kind:"status", status} to events; every other
// flag appends a matching events[] entry {t, kind, actor, text}. --actor names
// the event actor (default shim-lead.jayanth); --fix events are written under
// "shim-fixer:<file>". --pr computes filesChanged/additions/deletions from
// `git -C <repo-dir> diff --shortstat <base>...HEAD` (base = origin default
// branch) when --repo-dir is given.
// Writes atomically (temp file in the same directory + rename) so the UI
// never reads a half-written ledger.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = process.env.SHIM_DESK_ROOT
  ? path.resolve(process.env.SHIM_DESK_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Atomic JSON write: serialize to a temp file in the target's own directory,
// then rename over the target. Same-directory rename is atomic on the FS.
export function writeJsonAtomic(filePath, value) {
  const text = JSON.stringify(value, null, 2) + "\n";
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, text, "utf8");
  fs.renameSync(tmp, filePath);
}

// Pure ledger patcher. `flags` carries pre-resolved values:
//   { status?: string,
//     decision?: { ruleId, choice, by },
//     review?: { verdict, by?, note },
//     pr?: string | object,  // URL, or {url, branch?, filesChanged?, additions?, deletions?}
//     autoFixed?: number,
//     fix?: { file, status, summary?, agent, model? },
//     approval?: { by },
//     gates?: object,       // contents of gates.json
//     findings?: object,    // contents of findings.json
//     message?: string,
//     actor?: string }
// Returns a new ledger object; the input is not mutated.
export function patchLedger(ledger, flags, nowIso) {
  const l = structuredClone(ledger);
  const now = nowIso ?? new Date().toISOString();
  const actor = flags.actor ?? "shim-lead.jayanth";
  const pushEvent = (kind, extra) => (l.events ??= []).push({ t: now, kind, actor, ...extra });

  if (flags.status !== undefined) {
    l.status = flags.status;
    l.updatedAt = now;
    (l.events ??= []).push({ t: now, kind: "status", status: flags.status });
  }
  if (flags.decision) {
    const d = flags.decision;
    const rec = {
      ruleId: d.ruleId,
      question: d.question ?? "",
      options: Array.isArray(d.options) ? d.options : [],
      choice: Number(d.choice),
      by: d.by,
      at: now,
    };
    (l.decisions ??= []).push(rec);
    l.updatedAt = now;
  }
  if (flags.review) {
    const r = flags.review;
    l.review = l.review ?? {};
    l.review.verdict = r.verdict;
    if (r.by !== undefined && r.by !== "") l.review.by = r.by;
    if (r.note !== undefined && r.note !== "") (l.review.notes ??= []).push(r.note);
    l.review.rounds = (l.review.rounds ?? 0) + 1;
    l.updatedAt = now;
  }
  if (flags.pr !== undefined) {
    l.pr = l.pr ?? {};
    if (typeof flags.pr === "string") l.pr.url = flags.pr;
    else Object.assign(l.pr, flags.pr);
    l.updatedAt = now;
  }
  if (flags.autoFixed !== undefined) {
    l.autoFixed = flags.autoFixed;
    l.updatedAt = now;
  }
  if (flags.fix) {
    l.fixes ??= [];
    const rec = { file: flags.fix.file, status: flags.fix.status };
    if (flags.fix.summary !== undefined) rec.summary = flags.fix.summary;
    rec.agent = flags.fix.agent ?? "shim-fixer";
    if (flags.fix.model !== undefined) rec.model = flags.fix.model;
    // upsert by file: a later result for the same file replaces the earlier one
    const i = l.fixes.findIndex((f) => f.file === rec.file);
    if (i >= 0) l.fixes[i] = rec;
    else l.fixes.push(rec);
    l.updatedAt = now;
  }
  if (flags.approval) {
    l.approval = { by: flags.approval.by, at: now };
    l.updatedAt = now;
  }
  if (flags.gates !== undefined) {
    l.gates = flags.gates;
    l.updatedAt = now;
  }
  if (flags.findings !== undefined) {
    l.findings = flags.findings;
    l.updatedAt = now;
  }
  if (flags.message !== undefined) {
    l.updatedAt = now;
  }
  // Every write appends a matching events[] entry ({t, kind, actor, text}) so
  // the board's timeline shows who did what, in order.
  if (flags.autoFixed !== undefined) pushEvent("gate", { text: `Shim applied ${flags.autoFixed} deterministic fixes` });
  if (flags.fix) {
    const e = { t: now, kind: "fix", actor: `shim-fixer:${flags.fix.file}` };
    e.status = flags.fix.status;
    if (flags.fix.summary !== undefined) e.text = flags.fix.summary;
    (l.events ??= []).push(e);
  }
  if (flags.review) {
    const e = { t: now, kind: "review", actor: flags.review.by ?? actor };
    e.text = flags.review.verdict;
    if (flags.review.note) e.text += `:${flags.review.note}`;
    (l.events ??= []).push(e);
  }
  if (flags.approval) pushEvent("approval", { text: `PR approved by ${flags.approval.by}` });
  if (flags.pr !== undefined) {
    const url = typeof flags.pr === "string" ? flags.pr : flags.pr.url;
    const e = { t: now, kind: "pr", actor };
    e.text = url;
    if (l.pr && l.pr.branch) e.branch = l.pr.branch;
    (l.events ??= []).push(e);
  }
  if (flags.message !== undefined) pushEvent("message", { text: flags.message });
  return l;
}

// base = the origin default branch ref (refs/remotes/origin/HEAD as cloned
// into the work repo; fall back to origin/main, then local main).
function resolveBaseRef(repoDir) {
  for (const ref of [
    spawnSync("git", ["-C", repoDir, "symbolic-ref", "refs/remotes/origin/HEAD"], { encoding: "utf8" }).stdout.trim(),
    "refs/remotes/origin/main",
    "main",
  ]) {
    if (!ref) continue;
    const r = spawnSync("git", ["-C", repoDir, "rev-parse", "--verify", ref], { encoding: "utf8" });
    if (r.status === 0) return ref;
  }
  return null;
}

// `git -C <repo-dir> diff --shortstat <base>...HEAD` -> the PR stats.
// Three-dot form: diff from the merge base of base and HEAD, which is what
// the PR page shows.
export function gitDiffStat(repoDir, baseRef) {
  const out = spawnSync("git", ["-C", repoDir, "diff", "--shortstat", `${baseRef}...HEAD`], { encoding: "utf8" });
  if (out.status !== 0) return null;
  const files = out.stdout.match(/(\d+) files? changed/);
  const adds = out.stdout.match(/(\d+) insertions?\(\+\)/);
  const dels = out.stdout.match(/(\d+) deletions?\(-\)/);
  return {
    filesChanged: files ? Number(files[1]) : 0,
    additions: adds ? Number(adds[1]) : 0,
    deletions: dels ? Number(dels[1]) : 0,
  };
}

function usage() {
  console.error(
    "usage: node scripts/ledger.mjs --run <runId> [--status <s>] [--decision <ruleId> --choice <n> --by <h>] " +
      "[--auto-fixed-from <report.json>] [--fix <file> --fix-status <done|blocked> [--summary \"...\" ] [--model <id>]] " +
      "[--review <approve|changes> [--by <agent>] [--note \"...\"...]] [--approval --by <handle>] " +
      "[--pr <url> [--branch <name>] [--repo-dir <path>]] [--gates <file>] [--findings <file>] " +
      "[--message \"<text>\"] [--actor <name>]"
  );
}

function getAll(args, name) {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === `--${name}` && i + 1 < args.length) out.push(args[i + 1]);
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const get = (name, dflt) => {
    const i = args.indexOf(`--${name}`);
    if (i === -1 || i + 1 >= args.length) return dflt;
    return args[i + 1];
  };

  const run = get("run");
  if (!run) {
    usage();
    process.exit(1);
  }

  const flags = {};
  if (get("actor") !== undefined) flags.actor = get("actor");
  if (get("status") !== undefined) flags.status = get("status");
  if (get("decision") !== undefined) {
    const ruleId = get("decision");
    const choice = get("choice");
    const by = get("by");
    if (choice === undefined || by === undefined) {
      console.error("--decision requires --choice <n> and --by <handle>");
      process.exit(1);
    }
    flags.decision = { ruleId, choice, by, question: get("question") };
  }
  if (get("review") !== undefined) {
    const verdict = get("review");
    if (verdict !== "approve" && verdict !== "changes") {
      console.error('--review must be "approve" or "changes"');
      process.exit(1);
    }
    flags.review = { verdict, by: get("by"), note: getAll(args, "note")[0] };
  }
  if (get("pr") !== undefined) {
    flags.pr = get("pr");
    const branch = get("branch");
    const repoDir = get("repo-dir");
    if (branch !== undefined || repoDir !== undefined) {
      const pr = { url: flags.pr };
      if (branch !== undefined) pr.branch = branch;
      if (repoDir !== undefined) {
        const base = resolveBaseRef(repoDir);
        if (!base) {
          console.error(`could not resolve the origin default branch in ${repoDir} for the PR diffstat`);
          process.exit(1);
        }
        const stats = gitDiffStat(repoDir, base);
        if (!stats) {
          console.error(`git diff --shortstat ${base}...HEAD failed in ${repoDir}`);
          process.exit(1);
        }
        Object.assign(pr, stats);
      }
      flags.pr = pr;
    }
  }
  if (get("auto-fixed-from") !== undefined) {
    const report = JSON.parse(fs.readFileSync(get("auto-fixed-from"), "utf8"));
    if (typeof report.autoFixed !== "number") {
      console.error("--auto-fixed-from: report.json has no numeric autoFixed field");
      process.exit(1);
    }
    flags.autoFixed = report.autoFixed;
  }
  if (get("fix") !== undefined) {
    const file = get("fix");
    const status = get("fix-status");
    if (status !== "done" && status !== "blocked") {
      console.error("--fix requires --fix-status <done|blocked>");
      process.exit(1);
    }
    flags.fix = {
      file,
      status,
      summary: get("summary"),
      agent: "shim-fixer",
      model: get("model"),
    };
  }
  if (args.includes("--approval")) {
    const by = get("by");
    if (!by) {
      console.error("--approval requires --by <handle>");
      process.exit(1);
    }
    flags.approval = { by };
  }
  if (get("gates") !== undefined) flags.gates = JSON.parse(fs.readFileSync(get("gates"), "utf8"));
  if (get("findings") !== undefined) flags.findings = JSON.parse(fs.readFileSync(get("findings"), "utf8"));
  if (get("message") !== undefined) flags.message = get("message");

  if (Object.keys(flags).length === 0) {
    usage();
    process.exit(1);
  }

  const ledgerPath = path.join(root, "ledger", `${run}.json`);
  if (!fs.existsSync(ledgerPath)) {
    console.error(`ledger/${run}.json not found; run scripts/new-run.mjs first`);
    process.exit(1);
  }
  const current = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
  const next = patchLedger(current, flags);
  writeJsonAtomic(ledgerPath, next);
  console.log(JSON.stringify({ run, status: next.status, updated: Object.keys(flags) }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

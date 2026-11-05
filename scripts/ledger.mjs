#!/usr/bin/env node
// ledger.mjs — read/patch ledger/<runId>.json and write it atomically.
// 01-WORKFLOW-SPEC §9.4 ledger.mjs / §9.1 state machine
// Usage (any combination of flags; --run always required):
//   node scripts/ledger.mjs --run R --status <s>
//   node scripts/ledger.mjs --run R --decision <ruleId> --choice <n> --by <h>
//   node scripts/ledger.mjs --run R --review <approve|changes> --note "..."
//   node scripts/ledger.mjs --run R --pr <url>
//   node scripts/ledger.mjs --run R --gates <work/R/gates.json>
//   node scripts/ledger.mjs --run R --findings <work/R/findings.json>
// Status transitions append {t, kind:"status", status} to events.
// Writes atomically (temp file in the same directory + rename) so the UI
// never reads a half-written ledger.
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
//     review?: { verdict, note },
//     pr?: string,          // URL
//     gates?: object,       // contents of gates.json
//     findings?: object }   // contents of findings.json
// Returns a new ledger object; the input is not mutated.
export function patchLedger(ledger, flags, nowIso) {
  const l = structuredClone(ledger);
  const now = nowIso ?? new Date().toISOString();

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
    if (r.note !== undefined && r.note !== "") (l.review.notes ??= []).push(r.note);
    l.review.rounds = (l.review.rounds ?? 0) + 1;
    l.updatedAt = now;
  }
  if (flags.pr !== undefined) {
    l.pr = l.pr ?? {};
    l.pr.url = flags.pr;
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
  return l;
}

function usage() {
  console.error(
    "usage: node scripts/ledger.mjs --run <runId> [--status <s>] [--decision <ruleId> --choice <n> --by <h>] " +
      "[--review <approve|changes> [--note ...]] [--pr <url>] [--gates <file>] [--findings <file>]"
  );
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
    flags.review = { verdict, note: get("note") };
  }
  if (get("pr") !== undefined) flags.pr = get("pr");
  if (get("gates") !== undefined) flags.gates = JSON.parse(fs.readFileSync(get("gates"), "utf8"));
  if (get("findings") !== undefined) flags.findings = JSON.parse(fs.readFileSync(get("findings"), "utf8"));

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

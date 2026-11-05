#!/usr/bin/env node
// render.mjs — pure renderer for the 11 Shim Desk chat message formats.
// 01-WORKFLOW-SPEC §9.3 / §7.3.2
// Usage: node scripts/render.mjs --run <runId> --kind <KIND> [--extra key=value ...]
// Reads ledger/<runId>.json, work/<runId>/findings.json, work/<runId>/gates.json
// and prints the rendered Markdown to stdout. Every number comes from that JSON,
// never from hard-coded values.
//
// render({ledger, findings, gates, kind, extra}) is a pure function: same inputs,
// byte-identical output. The CLI reads the three JSON files under the SHIM_DESK_ROOT
// pattern (work/<run>/*.json, ledger/<run>.json) and calls it.
//
// KINDs: ACK, FINDINGS, DECISION, FANOUT, PROGRESS, GATES, HANDOFF, APPROVAL,
//        DONE, LEDGER, FAIL
//
// --extra keys (parsed as key=value pairs; values containing "=" keep them):
//   DECISION: index, total, title, why, option1, option2, recommended (1|2)
//   FANOUT:   files (semicolon-separated; repeat --extra to list several)
//   PROGRESS: file, status (done|blocked), summary
//   FAIL:     step, line, file, next

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Root is overridable for tests; defaults to the repo containing scripts/.
const root = process.env.SHIM_DESK_ROOT
  ? path.resolve(process.env.SHIM_DESK_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const KINDS = ["ACK", "FINDINGS", "DECISION", "FANOUT", "PROGRESS", "GATES", "HANDOFF", "APPROVAL", "DONE", "LEDGER", "FAIL"];

// Shim's gate labels, in display order (01 §9.4; trailing spaces are Shim's).
export const GATE_NAMES = ["install", "build", "typecheck .", "test ."];

const mark = (ok) => (ok ? "✅" : "❌");

// Summarize a finding's message into the one "Most important:" sentence.
// The message field is already written for chat (§12 billing example), so use
// it verbatim and append the file:line the format requires.
function topLine(findings) {
  const top = findings?.top;
  if (!top) return "No silent findings.";
  return `${top.message} (${top.file}:${top.line})`;
}

// Gates passed / total among the gates in `after` (or GATE_NAMES if absent).
function gatesSummary(gates) {
  const names = gates?.after ? Object.keys(gates.after) : GATE_NAMES;
  const after = gates?.after ?? {};
  const passing = names.filter((g) => after[g] === true).length;
  return { passing, total: names.length, names };
}

// --- The 11 formats, exactly as 01 §7.3.2 -----------------------------

function ack(ledger) {
  return `On it: run **${ledger.runId}** for \`${ledger.repo}\`. Cloning and scanning now.`;
}

function findingsFindings(ledger, findings) {
  const f = findings ?? ledger.findings ?? {};
  const sev = f.bySeverity ?? {};
  const fix = f.byFix ?? {};
  return [
    `**${f.total} findings in ${f.files} files**: ${sev.break ?? 0} break, ${sev.silent ?? 0} silent, ${sev.deprecated ?? 0} deprecated.`,
    `Shim fixes ${fix.auto ?? 0} automatically; ${fix.agent ?? 0} need a code change; ${fix.manual ?? 0} need your call.`,
    `Most important: ${topLine(f)}`,
  ].join("\n");
}

// DECISION options: an `options` array wins (unit tests pass the array);
// otherwise the flat option1/option2 CLI keys are used.
function decisionOptions(extra) {
  let opts;
  if (Array.isArray(extra.options)) opts = extra.options;
  else opts = [extra.option1, extra.option2];
  return opts.filter((o) => o !== undefined && o !== "");
}

function decision(ledger, extra) {
  const i = Number(extra.index ?? (ledger.decisions?.length ?? 0) + 1);
  const n = Number(extra.total ?? (ledger.decisions?.length ?? 0) + 1);
  const lines = [`**Decision ${i}/${n}: ${extra.title ?? ""}**`, extra.why ?? ""];
  decisionOptions(extra).forEach((o, idx) => {
    const num = idx + 1;
    lines.push(`${num}. ${o}${Number(extra.recommended) === num ? " (recommended)" : ""}`);
  });
  lines.push("Reply with the number.");
  return lines.join("\n");
}

// FANOUT file list: an array (unit tests) or a ";"-separated CLI string.
function fanoutFiles(extra) {
  let files;
  if (Array.isArray(extra.files)) files = extra.files;
  else files = String(extra.files ?? "").split(";").map((s) => s.trim()).filter(Boolean);
  return files.filter(Boolean);
}

function fanout(ledger, extra) {
  const files = fanoutFiles(extra);
  const autoFixed = ledger.autoFixed ?? 0;
  const list = files.length ? ` ${files.join(", ")}.` : ".";
  return `Shim applied ${autoFixed} deterministic fixes. Fixing ${files.length} files in parallel:${list}`;
}

function progress(extra) {
  const emoji = extra.status === "blocked" ? "⛔" : "✅";
  return `${emoji} \`${extra.file ?? ""}\`: ${extra.summary ?? ""}`;
}

function gates_(ledger, gates) {
  const g = gates ?? ledger.gates ?? {};
  const base = g.baseline ?? {};
  const after = g.after ?? base;
  const rows = GATE_NAMES.map((name) => `| ${name} | ${mark(base[name] === true)} | ${mark(after[name] === true)} |`).join("\n");
  const regs = g.regressions ?? GATE_NAMES.filter((x) => base[x] === true && after[x] !== true);
  // §7.3.2: all green -> "Every gate that passed before still passes."
  const closing = regs.length ? `Regressed: ${regs.join(", ")}.` : "Every gate that passed before still passes.";
  return `| gate | baseline | after |\n|---|---|---|\n${rows}\n${closing}`;
}

function handoff(ledger) {
  return `@reviewer please review run **${ledger.runId}**: diff \`work/${ledger.runId}/diff.patch\`, findings \`work/${ledger.runId}/findings.json\`, decisions in the ledger. Reply with a verdict line.`;
}

function approval(ledger) {
  const pr = ledger.pr ?? {};
  const review = ledger.review ?? {};
  return [
    `Ready to open the PR on \`${ledger.repo}\`: ${pr.filesChanged ?? 0} files, +${pr.additions ?? 0}/-${pr.deletions ?? 0}. Reviewer: ${review.verdict ?? "(pending)"}.`,
    "Reply **approve**, or tell me what to change.",
  ].join("\n");
}

function done(ledger) {
  return `PR opened: ${ledger.pr?.url ?? "-"}. Run **${ledger.runId}** logged in the ledger.`;
}

function ledgerLine(ledger, gates) {
  const f = ledger.findings ?? {};
  const g = gates ?? ledger.gates;
  const summary = gatesSummary(g);
  const url = ledger.pr?.url ?? "-";
  const decisions = ledger.decisions?.length ?? 0;
  return `${ledger.runId} | ${ledger.repo} | ${f.total ?? 0} findings | decisions: ${decisions} | gates ${summary.passing}/${summary.total} | ${ledger.status} | ${url}`;
}

function fail(extra) {
  return `⛔ ${extra.step ?? "step"} failed: ${extra.line ?? "see output"}. Output saved to \`${extra.file ?? "work/log.txt"}\`. ${extra.next ?? "A human can pick this up from there."}`;
}

export function render({ ledger, findings = null, gates = null, kind, extra = {} }) {
  switch (kind) {
    case "ACK":
      return ack(ledger);
    case "FINDINGS":
      return findingsFindings(ledger, findings);
    case "DECISION":
      return decision(ledger, extra);
    case "FANOUT":
      return fanout(ledger, extra);
    case "PROGRESS":
      return progress(extra);
    case "GATES":
      return gates_(ledger, gates);
    case "HANDOFF":
      return handoff(ledger);
    case "APPROVAL":
      return approval(ledger);
    case "DONE":
      return done(ledger);
    case "LEDGER":
      return ledgerLine(ledger, gates);
    case "FAIL":
      return fail(extra);
    default:
      throw new Error(`unknown kind "${kind}"; expected one of ${KINDS.join(", ")}`);
  }
}

// --- CLI ----------------------------------------------------------------

function parseExtras(pairs) {
  const out = {};
  for (const p of pairs) {
    const i = p.indexOf("=");
    if (i === -1) throw new Error(`--extra expects key=value, got "${p}"`);
    out[p.slice(0, i)] = p.slice(i + 1);
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const get = (name) => {
    const i = args.indexOf(`--${name}`);
    return i === -1 ? undefined : args[i + 1];
  };
  const run = get("run");
  const kind = get("kind");
  if (!run || !kind) {
    console.error("usage: node scripts/render.mjs --run <runId> --kind <KIND> [--extra key=value ...]");
    process.exit(1);
  }
  if (!KINDS.includes(kind)) {
    console.error(`unknown --kind "${kind}"; expected one of ${KINDS.join(", ")}`);
    process.exit(1);
  }
  // Collect every key=value after each --extra (they run until the next --flag).
  const extras = [];
  let inExtra = false;
  for (const a of args) {
    if (a === "--extra") {
      inExtra = true;
      continue;
    }
    if (a.startsWith("--")) inExtra = false;
    if (inExtra && a.includes("=")) extras.push(a);
  }

  const readJson = (rel) => {
    const p = path.join(root, rel);
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null;
  };
  const ledger = readJson(path.join("ledger", `${run}.json`));
  if (!ledger) {
    console.error(`ledger/${run}.json not found under ${root}; run scripts/new-run.mjs first`);
    process.exit(1);
  }
  const findings = readJson(path.join("work", run, "findings.json"));
  const gates = readJson(path.join("work", run, "gates.json"));
  const extra = parseExtras(extras);

  process.stdout.write(render({ ledger, findings, gates, kind, extra }) + "\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

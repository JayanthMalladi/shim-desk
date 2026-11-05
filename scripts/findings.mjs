#!/usr/bin/env node
// findings.mjs — parse getshim scan text / report.json into work/<runId>/findings.json.
// 01-WORKFLOW-SPEC §9.4 / §9.5
// Usage:
//   node scripts/findings.mjs --run R --scan <scan.txt>
//   node scripts/findings.mjs --run R --report <report.json>
//   node scripts/findings.mjs --run R --scan-cmd <dir>   (runs getshim itself, writes work/R/scan.txt)
// Writes work/R/findings.json and prints a summary JSON to stdout.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Root is overridable for tests; defaults to the repo containing scripts/.
const root = process.env.SHIM_DESK_ROOT
  ? path.resolve(process.env.SHIM_DESK_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// §9.5: `{file}:{line}  {severity}/{fix}  [{ruleId}]  {message}`
const SCAN_LINE = /^(.+?):(\d+)  (break|silent|deprecated)\/(auto|agent|manual)  \[([^\]]+)\]  (.*)$/;
const SCAN_TAIL = /^(\d+) findings in (\d+) files$/;

// Parse one getshim scan text. Returns {items, total, files}.
// total/files come from the "{n} findings in {m} files" tail when present
// (getshim counts only the source files it would touch, not every file
// named on a finding line), falling back to the item counts otherwise.
export function parseScanText(text) {
  const items = [];
  let total;
  let files;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line) continue;
    const tail = line.match(SCAN_TAIL);
    if (tail) {
      total = Number(tail[1]);
      files = Number(tail[2]);
      continue;
    }
    const m = line.match(SCAN_LINE);
    if (!m) continue;
    items.push({
      file: m[1],
      line: Number(m[2]),
      severity: m[3],
      fix: m[4],
      ruleId: m[5],
      message: m[6],
    });
  }
  if (total === undefined) total = items.length;
  if (files === undefined) files = new Set(items.map((i) => i.file)).size;
  return { items, total, files };
}

// Rule priority for picking the top silent finding (§9.4):
// multi-step-result, typed-multi-step-result, response-messages,
// multi-step-end-event, maybe-*, everything else last; ties by file, then line.
const PRIORITY = ["multi-step-result", "typed-multi-step-result", "response-messages", "multi-step-end-event"];

export function rulePriority(ruleId) {
  const i = PRIORITY.indexOf(ruleId);
  if (i !== -1) return i;
  if (ruleId.startsWith("maybe-")) return PRIORITY.length;
  return PRIORITY.length + 1;
}

// First silent finding by rule priority, then file, then line. Null when no silent findings.
export function chooseTop(items) {
  const silent = items.filter((i) => i.severity === "silent");
  if (silent.length === 0) return null;
  const ranked = [...silent].sort((a, b) => {
    const p = rulePriority(a.ruleId) - rulePriority(b.ruleId);
    if (p !== 0) return p;
    if (a.file !== b.file) return a.file < b.file ? -1 : 1;
    return a.line - b.line;
  });
  return ranked[0];
}

// Assemble the findings.json payload (§9.4). Optional totals {total, files}
// override the item-derived counts (the scan tail carries them).
export function buildFindings(items, source, totals) {
  const bySeverity = { break: 0, silent: 0, deprecated: 0 };
  const byFix = { auto: 0, agent: 0, manual: 0 };
  for (const i of items) {
    bySeverity[i.severity] = (bySeverity[i.severity] ?? 0) + 1;
    byFix[i.fix] = (byFix[i.fix] ?? 0) + 1;
  }
  return {
    source,
    total: totals?.total ?? items.length,
    files: totals?.files ?? new Set(items.map((i) => i.file)).size,
    bySeverity,
    byFix,
    items,
    top: chooseTop(items),
  };
}

// report.json: before[] and remaining[] are Finding objects (§9.5).
// Prefer remaining[] (what still needs work after the deterministic pass);
// fall back to before[] when remaining is absent or empty.
export function reportItems(report) {
  const pick = (a) => (Array.isArray(a) ? a : []);
  const items = pick(report?.remaining).length > 0 ? pick(report?.remaining) : pick(report?.before);
  return items.map((f) => ({ ...f, line: Number(f.line) }));
}

function usage() {
  console.error("usage: node scripts/findings.mjs --run <runId> (--scan <file> | --report <file> | --scan-cmd <dir>)");
}

function main() {
  const args = process.argv.slice(2);
  const get = (name, dflt) => {
    const i = args.indexOf(`--${name}`);
    if (i === -1 || i + 1 >= args.length) return dflt;
    return args[i + 1];
  };

  const run = get("run");
  const scan = get("scan");
  const report = get("report");
  const scanCmd = get("scan-cmd");
  if (!run || [scan, report, scanCmd].filter(Boolean).length !== 1) {
    usage();
    process.exit(1);
  }

  let items;
  let source;
  let totals;
  if (scan) {
    const parsed = parseScanText(fs.readFileSync(scan, "utf8"));
    items = parsed.items;
    source = "scan";
    totals = { total: parsed.total, files: parsed.files };
  } else if (scanCmd) {
    // §9.2: run getshim itself from Node so the agent never depends on shell redirection.
    const r = spawnSync("npx", ["-y", "getshim@0.1.0", "scan", scanCmd], { shell: true, encoding: "utf8" });
    if (r.error) {
      console.error(`failed to start getshim: ${r.error.message}`);
      process.exit(1);
    }
    if (r.status !== 0) {
      console.error(`getshim scan failed (exit ${r.status}):\n${(r.stderr ?? "").trim()}`);
      process.exit(r.status ?? 1);
    }
    const dir = path.join(root, "work", run);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "scan.txt"), r.stdout ?? "");
    console.error(`wrote ${path.join("work", run, "scan.txt")}`);
    const parsed = parseScanText(r.stdout ?? "");
    items = parsed.items;
    source = "scan";
    totals = { total: parsed.total, files: parsed.files };
  } else {
    const j = JSON.parse(fs.readFileSync(report, "utf8"));
    items = reportItems(j);
    source = "report";
  }

  const out = buildFindings(items, source, totals);
  const dir = path.join(root, "work", run);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "findings.json"), JSON.stringify(out, null, 2) + "\n");

  const summary = {
    source: out.source,
    total: out.total,
    files: out.files,
    bySeverity: out.bySeverity,
    byFix: out.byFix,
    top: out.top ? { ruleId: out.top.ruleId, file: out.top.file, line: out.top.line } : null,
  };
  console.log(JSON.stringify(summary));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

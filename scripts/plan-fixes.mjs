#!/usr/bin/env node
// plan-fixes.mjs — group the remaining agent findings by file and write fix-plan.json.
// 01-WORKFLOW-SPEC §9.4 plan-fixes.mjs
// Usage: node scripts/plan-fixes.mjs --run <runId>
// Reads work/R/shim/report.json (remaining[]; fall back to work/R/findings.json
// items with fix "agent"), applies ledger decisions, groups by file, caps at 12.
// Writes work/R/fix-plan.json = {files:[{file, findings:[...], decisions:[...]}],
//                                leftForHuman:[...], capped:true|false}
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = process.env.SHIM_DESK_ROOT
  ? path.resolve(process.env.SHIM_DESK_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const MAX_FILES = 12;

// Which decision choices mean "drop this finding" (leave it for a human).
// The ledger records the choice number the human typed; "leave it" is the
// standing meaning of choice 2 in the decision questions of 01 §7.3.1 step 3.
const LEAVE = new Set([2, "2", "leave", "leave it"]);

// Build the working finding list: report.json remaining[] wins; otherwise
// findings.json items whose fix is "agent".
function collectFindings(reportPath, findingsPath) {
  if (fs.existsSync(reportPath)) {
    const r = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    const items = Array.isArray(r?.remaining) ? r.remaining : Array.isArray(r?.before) ? r.before : [];
    return items.map((f) => ({ ...f, line: Number(f.line) }));
  }
  if (!fs.existsSync(findingsPath)) {
    console.error(`no ${path.relative(root, reportPath)} or ${path.relative(root, findingsPath)} found; run the scan/migrate step first`);
    process.exit(1);
  }
  const f = JSON.parse(fs.readFileSync(findingsPath, "utf8"));
  return (f.items ?? []).filter((i) => i.fix === "agent");
}

// Decision applies to a finding when the decision's ruleId matches the finding's ruleId.
function decisionFor(decision, finding) {
  return decision.ruleId === finding.ruleId;
}

// Group findings by file, apply decisions (drop "leave it"), cap at 12 files.
export function buildPlan(findings, decisions, { maxFiles = MAX_FILES } = {}) {
  const decs = Array.isArray(decisions) ? decisions : [];
  const byFile = new Map();
  for (const f of findings) {
    const isLeave = decs.some(
      (d) => decisionFor(d, f) && LEAVE.has(d.choice)
    );
    if (isLeave) continue;
    const key = f.file;
    if (!byFile.has(key)) byFile.set(key, []);
    byFile.get(key).push(f);
  }

  // Stable order: keep first-seen file order.
  const files = [...byFile.entries()].map(([file, fs_]) => ({
    file,
    findings: fs_.sort((a, b) => a.line - b.line),
    decisions: decs.filter((d) => fs_.some((f) => decisionFor(d, f))),
  }));

  const capped = files.length > maxFiles;
  const kept = files.slice(0, maxFiles);
  const left = capped ? files.slice(maxFiles).flatMap((g) => g.findings) : [];

  return { files: kept, leftForHuman: left, capped };
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
    console.error("usage: node scripts/plan-fixes.mjs --run <runId>");
    process.exit(1);
  }

  const workDir = path.join(root, "work", run);
  const reportPath = path.join(workDir, "shim", "report.json");
  const findingsPath = path.join(workDir, "findings.json");
  const ledgerPath = path.join(root, "ledger", `${run}.json`);

  const findings = collectFindings(reportPath, findingsPath);
  const decisions = fs.existsSync(ledgerPath) ? JSON.parse(fs.readFileSync(ledgerPath, "utf8")).decisions ?? [] : [];

  const plan = buildPlan(findings, decisions);
  fs.mkdirSync(workDir, { recursive: true });
  fs.writeFileSync(path.join(workDir, "fix-plan.json"), JSON.stringify(plan, null, 2) + "\n");

  console.log(
    JSON.stringify({
      files: plan.files.length,
      capped: plan.capped,
      leftForHuman: plan.leftForHuman.length,
      total: findings.length,
    })
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

#!/usr/bin/env node
// gates.mjs — run the target repo's gates in Shim's order and write work/<runId>/gates.json.
// 01-WORKFLOW-SPEC §9.4 gates.mjs
// Usage: node scripts/gates.mjs --run <runId>
// The repo is work/<runId>/<name>, where <name> is the repo basename from
// ledger/<runId>.json. Gate order (re-implements Shim's):
//   1. install — lockfile-detected package manager (pnpm/yarn/bun/npm), --ignore-scripts
//   2. build   — the repo's "build" script, if one exists
//   3. typecheck . — the "typecheck" script, else `npx --no-install tsc --noEmit -p tsconfig.json`
//   4. test .  — the "test" script, if one exists
// Gates that don't apply (no build/test script, no tsconfig.json) are recorded
// as ok:true with code:null and a "skipped" note in tail (they cannot regress,
// so they count as passing in `after`).
// Each gate is recorded as {ok, code, ms, tail}; tail = last 40 lines of stdout+stderr.
// Writes work/<runId>/gates.json =
//   { baseline, after, regressions, detail:{ <gate>: {ok, code, ms, tail} } }
//   baseline: gate name -> boolean, from work/<runId>/shim/report.json ({} when absent)
//   after:    gate name -> boolean for all four gates
//   regressions: gate names that were true at baseline and false after
// Gate names match Shim's labels, trailing spaces included: "install", "build",
// "typecheck .", "test .".
// Gates run in order regardless of earlier failures so every gate's tail is
// recorded. Exit 0 whenever gates.json is written; results live in the JSON.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Root is overridable for tests; defaults to the repo containing scripts/.
const root = process.env.SHIM_DESK_ROOT
  ? path.resolve(process.env.SHIM_DESK_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Shim's gate labels, in run order (01 §9.4). Trailing spaces are Shim's.
export const GATE_NAMES = ["install", "build", "typecheck .", "test ."];

// Detect the package manager from the lockfile in dir (01 §9.4):
// pnpm-lock.yaml -> pnpm, yarn.lock -> yarn, bun.lockb -> bun, else npm.
export function detectPm(dir) {
  if (fs.existsSync(path.join(dir, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(dir, "yarn.lock"))) return "yarn";
  if (fs.existsSync(path.join(dir, "bun.lockb"))) return "bun";
  return "npm";
}

// Plan the four gate commands. cmd is null when the gate does not apply
// (skipped, recorded as ok:true).
export function planGates(pm, scripts, hasTsconfig) {
  const s = scripts ?? {};
  return [
    { name: "install", cmd: [pm, "install", "--ignore-scripts"] },
    { name: "build", cmd: s.build ? [pm, "run", "build"] : null },
    {
      name: "typecheck .",
      cmd: s.typecheck
        ? [pm, "run", "typecheck"]
        : hasTsconfig
          ? ["npx", "--no-install", "tsc", "--noEmit", "-p", "tsconfig.json"]
          : null,
    },
    { name: "test .", cmd: s.test ? [pm, "run", "test"] : null },
  ];
}

// Last n lines of the combined output (01 §9.4: tail = last 40 lines).
export function lastLines(text, n = 40) {
  return String(text ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .slice(-n)
    .join("\n");
}

// Run one gate command in the repo dir. All subprocesses go through
// child_process with an argument array (no shell-only syntax); shell:true so
// npm/pnpm/yarn/bun/npx resolve to their .cmd shims on Windows.
function runGate(cmd, args, cwd) {
  const t0 = Date.now();
  const r = spawnSync(cmd, args, { cwd, shell: true, encoding: "utf8", timeout: 600000 });
  const ms = Date.now() - t0;
  if (r.error) return { ok: false, code: null, ms, tail: `failed to start: ${r.error.message}` };
  const combined = [r.stdout ?? "", r.stderr ?? ""].filter(Boolean).join("\n");
  const code = r.status === null ? null : r.status; // null = killed by signal
  return { ok: code === 0, code, ms, tail: lastLines(combined) };
}

function usage() {
  console.error("usage: node scripts/gates.mjs --run <runId>");
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

  const ledgerPath = path.join(root, "ledger", `${run}.json`);
  if (!fs.existsSync(ledgerPath)) {
    console.error(`ledger/${run}.json not found; run scripts/new-run.mjs first`);
    process.exit(1);
  }
  const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
  const name = String(ledger.repo ?? "").split("/").pop();
  if (!name) {
    console.error(`ledger/${run}.json has no repo; expected owner/name`);
    process.exit(1);
  }

  const workDir = path.join(root, "work", run);
  const repoDir = path.join(workDir, name);
  if (!fs.existsSync(path.join(repoDir, "package.json"))) {
    console.error(`work/${run}/${name} has no package.json; run scripts/clone.mjs first`);
    process.exit(1);
  }

  const pm = detectPm(repoDir);
  const scripts = JSON.parse(fs.readFileSync(path.join(repoDir, "package.json"), "utf8")).scripts ?? {};
  const hasTsconfig = fs.existsSync(path.join(repoDir, "tsconfig.json"));

  // Shim's baseline, when migrate already ran (01 §9.4: compare against report.json.baseline).
  const baselinePath = path.join(workDir, "shim", "report.json");
  const baseline = fs.existsSync(baselinePath) ? (JSON.parse(fs.readFileSync(baselinePath, "utf8")).baseline ?? {}) : {};

  const detail = {};
  const after = {};
  for (const step of planGates(pm, scripts, hasTsconfig)) {
    detail[step.name] = step.cmd
      ? runGate(step.cmd[0], step.cmd.slice(1), repoDir)
      : { ok: true, code: null, ms: 0, tail: "skipped" };
    after[step.name] = detail[step.name].ok;
  }
  const regressions = GATE_NAMES.filter((g) => baseline[g] === true && after[g] === false);

  fs.mkdirSync(workDir, { recursive: true });
  const out = { baseline, after, regressions, detail };
  fs.writeFileSync(path.join(workDir, "gates.json"), JSON.stringify(out, null, 2) + "\n");
  console.log(JSON.stringify({ run, pm, after, regressions }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

#!/usr/bin/env node
// new-run.mjs — allocate a runId, create work/<runId>/, write a ledger stub.
// Usage: node scripts/new-run.mjs --repo <owner/name> --requested-by <handle> [--force]
// Prints: {"runId":"r-000N","workDir":"work/r-000N"}
// 01-WORKFLOW-SPEC §9.4 new-run.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Root is overridable for tests; defaults to the repo containing scripts/.
const root = process.env.SHIM_DESK_ROOT
  ? path.resolve(process.env.SHIM_DESK_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const get = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1 || i + 1 >= args.length) return dflt;
  return args[i + 1];
};

const repo = get("repo");
const requestedBy = get("requested-by");
const force = args.includes("--force");

if (!repo || !requestedBy) {
  console.error("usage: node scripts/new-run.mjs --repo <owner/name> --requested-by <handle> [--force]");
  process.exit(1);
}
if (!/^[^/]+\/[^/]+$/.test(repo)) {
  console.error(`invalid --repo "${repo}"; expected owner/name`);
  process.exit(1);
}

// runId = r- + zero-padded 4-digit next integer from existing ledger/r-*.json.
let max = 0;
const ledgerDir = path.join(root, "ledger");
if (fs.existsSync(ledgerDir)) {
  for (const f of fs.readdirSync(ledgerDir, { withFileTypes: true })) {
    if (!f.isFile()) continue;
    const m = f.name.match(/^r-(\d{4})\.json$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
}
const next = max + 1;
const runId = `r-${String(next).padStart(4, "0")}`;

// Refuse if an open run (status not done/failed/blocked) exists for the same repo.
// Refuse if a done run with a PR already exists for that repo, unless --force.
const TERMINAL = new Set(["done", "failed", "blocked"]);
for (const f of fs.existsSync(ledgerDir) ? fs.readdirSync(ledgerDir) : []) {
  const m = f.match(/^r-(\d{4})\.json$/);
  if (!m || parseInt(m[1], 10) === next) continue;
  const p = path.join(ledgerDir, f);
  let j;
  try {
    j = JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    continue;
  }
  if (j.repo !== repo) continue;
  if (j.status && !TERMINAL.has(j.status)) {
    console.error(`${f} for ${repo} is still open (status ${j.status}); cannot start a new run for the same repo`);
    process.exit(1);
  }
  if (j.status === "done" && j.pr && j.pr.url) {
    if (force) continue;
    console.error(`${f} for ${repo} already has a PR (${j.pr.url}); pass --force to override`);
    process.exit(1);
  }
}

// Logical path is emitted with forward slashes (platform-independent); the
// real directory is created with path.join so it is correct on Windows.
const workDirRel = `work/${runId}`;
const workDirAbs = path.join(root, "work", runId);
fs.mkdirSync(workDirAbs, { recursive: true });

const now = new Date().toISOString();
const stub = {
  runId,
  repo,
  migration: "ai-sdk-v7",
  requestedBy,
  room: "shim-desk",
  createdAt: now,
  updatedAt: now,
  status: "requested",
  events: [{ t: now, kind: "status", status: "requested" }],
};
if (!fs.existsSync(ledgerDir)) fs.mkdirSync(ledgerDir, { recursive: true });
fs.writeFileSync(path.join(ledgerDir, `${runId}.json`), JSON.stringify(stub, null, 2) + "\n");

console.log(JSON.stringify({ runId, workDir: workDirRel }));

#!/usr/bin/env node
// clone.mjs — shallow clone owner/name into work/<runId>/<name>.
// Usage: node scripts/clone.mjs --run <runId> --repo <owner/name>
// 01-WORKFLOW-SPEC §9.4: refuses non-Jayanth repos with exit 2 and the
// one-line refusal from skill step 0.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Guardrail (01 §16): PRs only on repos Jayanth owns.
export const OWNER = "jayanthmalladi";
export const REFUSAL = "I only open PRs on repos Jayanth owns. Fork it first and give me the fork.";
// Case-insensitive owner check.
export function isOwned(owner) {
  return String(owner).toLowerCase() === OWNER;
}

function main() {
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

  const run = get("run");
  const repo = get("repo");
  if (!run || !repo) {
    console.error("usage: node scripts/clone.mjs --run <runId> --repo <owner/name>");
    process.exit(1);
  }
  const m = repo.match(/^([^/]+)\/([^/]+)$/);
  if (!m) {
    console.error(`invalid --repo "${repo}"; expected owner/name`);
    process.exit(1);
  }
  const owner = m[1];
  const name = m[2];

  if (!isOwned(owner)) {
    console.error(REFUSAL);
    process.exit(2);
  }

  const dest = path.join(root, "work", run, name);
  if (fs.existsSync(dest)) {
    console.error(`${path.join("work", run, name)} already exists; refusing to overwrite`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  // §9.2: `git clone --depth 1 https://github.com/<owner>/<name>.git`
  const url = `https://github.com/${owner}/${name}.git`;
  const r = spawnSync("git", ["clone", "--depth", "1", url, dest], {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
  if (r.status !== 0) {
    console.error(`git clone failed (exit ${r.status ?? "n/a"}):\n${(r.stderr ?? "").trim()}`.trim());
    process.exit(r.status ?? 1);
  }
  console.log(JSON.stringify({ repo, dest: path.join("work", run, name) }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

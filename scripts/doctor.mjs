#!/usr/bin/env node
// doctor.mjs — environment check for the Shim Desk demo machine.
// 01-WORKFLOW-SPEC §9.4 doctor.mjs / §14 verification checklist
// Usage: node scripts/doctor.mjs [--skip <name>]...
// Check names (skippable via --skip): node, git, gh, docker, claude, gitignore, getshim
// Prints a narrow ✅/❌ table. Exit 1 if any (non-skipped) check fails, 0 otherwise.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = process.env.SHIM_DESK_ROOT
  ? path.resolve(process.env.SHIM_DESK_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Every command is a fixed argv array (no shell-only syntax); shell:true so
// .cmd shims resolve on Windows.
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd ?? root,
    shell: true,
    encoding: "utf8",
    timeout: opts.timeout ?? 120000,
  });
  return {
    ok: r.status === 0,
    status: r.status,
    out: ((r.stdout ?? "") + (r.stderr ?? "")).trim(),
    timedOut: r.error?.code === "ETIMEDOUT" || /timed out/i.test(r.error?.message ?? ""),
    error: r.error,
  };
}

function main() {
  const args = process.argv.slice(2);
  const skipped = new Set();
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--skip") skipped.add(args[++i]);
  }

  const checks = [];
  const add = (name, fn) => {
    if (skipped.has(name)) {
      checks.push({ name, ok: null, detail: "skipped" });
      return;
    }
    try {
      const { ok, detail } = fn();
      checks.push({ name, ok, detail });
    } catch (e) {
      checks.push({ name, ok: false, detail: e.message });
    }
  };

  // node >= 22 (getshim requires >=22, 01 §6.1)
  add("node", () => {
    const v = Number.parseInt(process.versions.node, 10);
    return { ok: v >= 22, detail: `node ${process.versions.node}${v >= 22 ? "" : " (need >= 22)"}` };
  });

  // git installed
  add("git", () => {
    const r = run("git", ["--version"]);
    if (!r.ok) return { ok: false, detail: r.timedOut ? "git timed out" : r.error?.message ?? "git not found" };
    const m = r.out.match(/git version (\S+)/i);
    return { ok: true, detail: m ? m[1] : "git" };
  });

  // gh auth status names the JayanthMalladi account (01 §6.3: stored credential)
  add("gh", () => {
    const r = run("gh", ["auth", "status"]);
    if (!r.ok) return { ok: false, detail: "gh auth status failed or gh missing" };
    const ok = /jayanthmalladi/i.test(r.out);
    return { ok, detail: ok ? "authed as JayanthMalladi" : "no JayanthMalladi account in `gh auth status`" };
  });

  // docker daemon reachable (only the bundled Mattermost needs it, 01 §6.1)
  add("docker", () => {
    const r = run("docker", ["info"]);
    if (!r.ok) return { ok: false, detail: "docker info failed or docker missing" };
    return { ok: true, detail: "docker daemon up" };
  });

  // claude CLI installed and signed in later (01 §6.1)
  add("claude", () => {
    const r = run("claude", ["--version"]);
    if (!r.ok) return { ok: false, detail: "claude --version failed or claude missing" };
    const m = r.out.match(/\d+\.\d+\.\d+/);
    return { ok: true, detail: m ? m[0] : "installed" };
  });

  // .switch/ must be gitignored before the first commit (01 §6.5 / §16)
  add("gitignore", () => {
    const p = path.join(root, ".gitignore");
    if (!fs.existsSync(p)) return { ok: false, detail: ".gitignore missing" };
    const lines = fs.readFileSync(p, "utf8").split(/\r?\n/);
    const ok = lines.some((l) => l.trim() === ".switch/" || l.trim() === ".switch" || l.trim().endsWith(".switch/*"));
    return { ok, detail: ok ? ".switch/ ignored" : ".switch/ not in .gitignore" };
  });

  // `getshim` with no args prints usage and exits 0 (01 §9.4 / §9.5)
  add("getshim", () => {
    const r = run("npx", ["-y", "getshim@0.1.0"], { timeout: 180000 });
    if (!r.ok && r.status !== 0) return { ok: false, detail: r.timedOut ? "npx getshim timed out" : `exit ${r.status}` };
    const mentionsUsage = /usage|commands|scan|migrate/i.test(r.out);
    return { ok: true, detail: mentionsUsage ? "usage printed, exit 0" : "exit 0 (usage text not detected)" };
  });

  // Narrow table: check | status | detail
  const width = Math.max(...checks.map((c) => c.name.length)) + 2;
  const rows = checks.map((c) => {
    const status = c.ok === null ? "-" : c.ok ? "✅" : "❌";
    return `| ${c.name.padEnd(width)} | ${status} | ${c.detail ?? ""} |`;
  });
  console.log(`| ${"check".padEnd(width)} | status | detail |`);
  console.log(`|${"-".repeat(width)}|--------|-------|`);
  for (const row of rows) console.log(row);

  const failed = checks.filter((c) => c.ok === false);
  console.log("");
  if (failed.length) {
    console.log(`doctor: ${failed.length} check(s) failed: ${failed.map((c) => c.name).join(", ")}`);
    process.exit(1);
  }
  console.log(skipped.size ? "doctor: ok (skipped: " + [...skipped].join(", ") + ")" : "doctor: all checks ok");
}

main();

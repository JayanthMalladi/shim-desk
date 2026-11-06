# Shim Desk — Build Status & What We Built

**As of:** 2026-11-06 ~09:40 UTC · **Status:** everything that can be *built* is done, committed, and the workflow has run end-to-end once for real. Only **WP-J** (record the video + submit the form) remains.
**Deadline:** 2026-11-07 18:29 UTC (~33 h of buffer).

---

## 0. TL;DR

- **What it is:** a team-chat room (Mattermost, via Switch) where a human and two AI agents upgrade a codebase through a breaking API change (Vercel AI SDK 6→7) together, with humans holding the judgment calls and a shared ledger.
- **Two Switch agents:** `shim-lead.jayanth` (Opus 5.5, orchestrator) and `shim-reviewer.jayanth` (Sonnet 5.5, read-only diff reviewer). The lead fans code fixes out to **parallel `shim-fixer` subagents** (one per file).
- **The real tools, not a simulation:** the published `getshim@0.1.0` CLI (scan + migrate), the repo's own gates (install / typecheck / test), a real git branch, and a real `gh pr create`.
- **It works — proven:** a live run (**r-0001**) went `done`, and **PR #1 is open** on `JayanthMalladi/shim-demo-app` (11 files, +244/−203).
- **A read-only web "Ledger Board"** renders every run from `ledger/*.json` — the demo video's final shot and the README/GitHub Pages proof.

---

## 1. Repos

| Repo | Role | State |
|---|---|---|
| `JayanthMalladi/shim-desk` | The workflow: scripts, skills, subagents, Switch config, ledger, UI board | **25 commits on `main`, clean tree, pushed.** First commit on/after Nov 4 ✅ |
| `JayanthMalladi/shim-demo-app` | The seeded demo target (AI SDK 6, green typecheck+tests at baseline) | **1 commit `91f00e9` + tag `v6-baseline`, pushed, GitHub CI green.** **PR #1 open** (unmerged) on branch `shim/ai-sdk-7-r-0001`. |

---

## 2. What we built (component by component)

### 2.1 Runtime scripts — `scripts/*.mjs` (8 files, Node ≥22, zero runtime deps)
Deterministic steps the lead agent calls. All cross-platform safe (`path.join`, no bash-only syntax).

| Script | Job |
|---|---|
| `new-run.mjs` | Allocate `r-NNNN`, create `work/<id>/`, write the ledger stub; refuses a 2nd open/done run for the same repo |
| `clone.mjs` | Shallow-clone the target; **rejects any repo not owned by `JayanthMalladi`** (exit 2) |
| `findings.mjs` | Parse `getshim scan` text *or* `report.json` → `findings.json` + summary; picks the "top" silent finding by rule priority; can run getshim itself (`--scan-cmd`) so the agent never depends on shell redirection |
| `plan-fixes.mjs` | Group remaining findings by file → `fix-plan.json`; applies the recorded human decisions; caps at 12 files |
| `gates.mjs` | Re-run the target's install/build/typecheck/test gates, compare to Shim's baseline → `gates.json` (`{baseline, after, regressions}`) |
| `render.mjs` | Pure `(ledger, findings, gates, kind, extra)` → the exact chat-message Markdown, so numbers in the room always match the JSON |
| `ledger.mjs` | Read/patch `ledger/<id>.json` **atomically** (same-dir temp + rename) so the board never reads a half-file |
| `doctor.mjs` | Environment check (node/git/gh/docker/claude/getshim), ✅/❌ table, exit 1 on any ❌ |

**Tests:** `test/{findings,plan-fixes,ledger,render}.test.mjs` — **`npm test` = 45/45 passing.** The findings parser is verified against a captured `getshim` fixture (32 findings / 5 files).

### 2.2 Runtime skills — `.claude/skills/` (3, loaded by the Switch agents from the working dir)
- **`shim-upgrade`** — the lead's end-to-end procedure (preconditions → new-run → scan → human decisions → deterministic pass → parallel fix → gates → review hand-off → approval → PR), with the "Never" list.
- **`desk-reporting`** — the exact 11 chat-message formats (ACK, FINDINGS, DECISION, FANOUT, PROGRESS, GATES, HANDOFF, APPROVAL, DONE, LEDGER, FAIL).
- **`shim-review`** — the reviewer's checklist + the one-line `VERDICT:` reply. *(Now edited so the verdict addresses the lead — see §5.3.)*

### 2.3 Subagents — `.claude/agents/`
- **`shim-fixer`** (Sonnet 5.5) — fixes one file, preserves v6 behavior, returns one JSON line. Started **in parallel**, one per file (disjoint files → no merge conflicts, no worktrees).
- **`gate-runner`** (Sonnet 5.5) — runs `gates.mjs` and reports regressions; read-only.
- **`builder`** (Sonnet 5.5) — *build-time* subagent used to construct this repo from the two specs (not part of the runtime).

### 2.4 Project config
- **`CLAUDE.md`** — standing guardrails for the agents (only touch `work/<id>/` + `ledger/`, never `--agent` to getshim, PRs only on Jayanth's repos only after "approve", no Fable/Mythos models).
- **`.claude/settings.json`** — the permissions allowlist. `git push` and `gh pr create` are **deliberately not allowlisted** and are in an explicit `ask` block, so they surface as the in-room Switch permission request (the demo moment).
- **`package.json`** — scripts: `doctor`, `test` (`node --test`), `ui`, `ui:build`, `setup`. No runtime deps at the root.

### 2.5 Switch config — `switch/`
- **`shim-desk.template.yaml`** — one-click group template (2 agents + room). *(Known issue: the template-import form is broken on this Windows build (#1511), so the agents were created **by hand** instead.)*
- **`lead-instructions.md`, `reviewer-instructions.md`, `room-instructions.md`** — the canonical instruction text for each field.

### 2.6 Ledger contract — `ledger/`
- **`schema.json`** — the JSON Schema that is the *only* interface between the workflow and the board (verbatim from the spec).
- **`example-r-0000.json`** — hand-written fixture (validates against the schema; the board's empty-state / static-build case).
- **`r-0001.json`** — the **real** completed run, committed. Schema-valid. (The lead's writer under-populated it; the lead reconciled `fixes[]`/`autoFixed`/`approval`/`pr`/`review`/event-actors from the actual artifacts — see §5.1.)

### 2.7 The Ledger Board — `ui/` (read-only, Vite + React 18 + TS, 02-spec)
- **Data layer** (`src/data.ts`, `plugins/ledger.ts`): dev `/api/runs` (reads the ledger live, polls every 2 s while the tab is visible) and a static build that copies `ledger/*.json` into `dist/data/`.
- **Pages** (`RunsPage`, `RunPage`): summary stat strip computed from the data (runs / PRs opened / human decisions / silent breaks caught), one card per run, and a full run view — stage track, findings summary + table, human-calls list, the **parallel subagent-fix grid**, the baseline-vs-after **gates table**, the **review card**, the **PR card**, and a **timeline** that shows who did what (agent vs person, color-stable).
- **Design:** the spec's exact light/dark tokens, AA contrast, no AI-slop tells, no horizontal scroll at 375px. The PR link is an `<a>` (navigation only — the board triggers **nothing**; it's read-only).
- **Tests:** `npm --prefix ui test` (vitest) = **38/38**; `npm --prefix ui run e2e` (Playwright) = **3/3**.
- **Deploy:** `.github/workflows/pages.yml` (GitHub Pages). *(URL goes live once Pages source is set to GitHub Actions.)*
- **Screenshots:** `docs/board-runs.png`, `docs/board-run.png` (retaken on the real run).

### 2.8 Demo target — `shim-demo-app`
AI SDK 6 app with green typecheck+tests at baseline (`v6-baseline`) and seeded findings spanning every severity, including the headline **silent break** (`src/billing.ts` — `result.usage` counts every step → over-count, and `tsc` won't catch it). Acceptance verified: a scan reports one of each of `break/auto`, `break/agent`, `silent/agent`, `manual`; gates green on Node 22; **GitHub CI green.**

### 2.9 Docs — `docs/`
`DECISIONS.md` (every VERIFY + deviation), `architecture.svg`, `demo-script.md` (the 2:30 script with real numbers), `SWITCH-BLOCKER.md` (the upstream bug report for the Windows/WSL blockers).

---

## 3. The workflow (end to end, as it actually ran)

1. **The ask** — in `~shim-desk`: `@shim upgrade ai to v7 in JayanthMalladi/shim-demo-app`.
2. **Scan** — the lead runs `getshim scan`, posts findings sorted by severity (incl. the silent breaks) and calls out the scariest one in plain words.
3. **The human calls** (gate 1) — numbered DECISION questions; Jayanth answered `node-22 → 1` and `telemetry-needs-otel → 1`. Recorded to the ledger.
4. **Deterministic pass** — `getshim migrate` (no `--agent`): baseline gates, the `ai` bump, the official codemod, Shim's 12 deterministic fixes, gates again, `report.json` + `pr-body.md`.
5. **Parallel fix** — one `shim-fixer` per file, all in one turn: 6 files (`typed, billing, messages, legacy.cjs, agent, tools`).
6. **Gates** — re-run; every gate that was green stays green. *(Mid-run, the tsconfig widening regressed typecheck → the run correctly went `blocked`, no PR; that was reverted.)*
7. **Review** (agent hand-off) — lead hands the diff to `@reviewer`; the reviewer (a *separate* Switch agent) posts one `VERDICT` line. Round 1 caught a stale PR body; rounds 2–3 fixed the four `streamText` `finalStep` Promise sites. **Final verdict: `approve`.**
8. **Approval** (gate 2) — Jayanth types `approve`; the `gh pr create` surfaces as the in-room **Allow once / Decline** request; Jayanth allows it.
9. **Close** — the lead posts the PR link and appends `r-0001` to the ledger; the board shows the run go green.

---

## 4. Is it working?

| Subsystem | Status | Evidence |
|---|---|---|
| Runtime scripts | ✅ working | `npm test` **45/45**; used live by the run |
| Skills + subagents | ✅ working | Loaded in-room; `shim-fixer` fixed 6 files, `gate-runner` confirmed gates |
| Switch config / room | ✅ working | Two agents + room live on the local server; hand-off + approvals happened in-room |
| Demo app | ✅ working | `typecheck`+`test` green on `v6-baseline`; GitHub CI green; acceptance scan passes |
| Ledger | ✅ working | `r-0001.json` schema-valid (draft-2020), committed |
| Ledger board (UI) | ✅ working | vitest 38/38, Playwright 3/3; renders the real run; read-only (no forms/buttons that act) |
| **The whole workflow** | ✅ **proven** | Real run r-0001 reached `done`; **PR #1 is open** |
| GitHub Pages board | ⏳ not live yet | Needs Pages source → GitHub Actions (manual, one-time) |
| Demo video + submission | ⏳ not done | WP-J, human |

**Net: the thing the judges score ("Switch is central, it runs, someone can clone and reproduce it") is demonstrably true — it ran, it opened a real PR, and the board shows it.**

### Real run r-0001 — the numbers (from the ledger + GitHub, not invented)
- **Findings:** 30 in 7 files — 11 break / **18 silent** / 1 deprecated; auto 12 / agent 16 / manual 2.
- **Top silent break:** `src/agent.ts:17` `multi-step-result` — `result.usage` now counts every step; `finalStep.usage` keeps the v6 value.
- **Human decisions (2):** `node-22 → engines.node >=22` (choice 1); `telemetry-needs-otel → add @ai-sdk/otel` (choice 1).
- **Fixes:** 12 deterministic + **6 files in parallel by Sonnet subagents**.
- **Gates:** install / typecheck / test all green, `regressions: []`.
- **Review:** `shim-reviewer.jayanth` → `approve`, 3 rounds.
- **PR:** [`JayanthMalladi/shim-demo-app#1`](https://github.com/JayanthMalladi/shim-demo-app/pull/1), branch `shim/ai-sdk-7-r-0001`, **11 files, +244/−203, OPEN.**

---

## 5. Deviations, known issues, and risks

### 5.1 Ledger `r-0001` was under-populated, then reconciled
The lead's `ledger.mjs` wrote status/decisions/gates but not the derived fields (`fixes[]`, `autoFixed`, `approval`, `pr` counts, event `actor`), so the board would have shown "0 files fixed." Fixed by an atomic same-dir reconcile with **all values sourced from the real artifacts** (`report.json`, the room's PROGRESS lines, GitHub), re-validated against the schema. *This is a process gap worth knowing: the spec's writer is thin for the "done" fields; the board depends on them.*

### 5.2 Windows Switch Console can't execute agent sessions locally
The "single biggest risk" from the spec (01 §6.1) materialized: `switch-console-v0.40.1` on Windows shows "no provider is set up / SDK sessions require a POSIX SSH execution event" at the agent step. A WSL2 remote-host path was built and largely verified, but the **final working configuration is actually the local agent-controller** (`LAPTOP-JUJPFSES` enrolled, Claude Code auth "ok"), so the agents ended up running **locally on this machine** (`D:\shim-desk`). The WSL setup is unused scaffolding. Documented in `DECISIONS.md` + `SWITCH-BLOCKER.md` (upstream issues #1472, #1511).

### 5.3 Review loop needed manual relaying (now fixed for the video)
Agents are turn-based: the lead's `@reviewer` hand-off only auto-wakes the reviewer if the alias is registered (it had reset after a server restart), and the verdict didn't `@` the lead, so the human relayed each hop. **Fixed in the skill files** (`d4bc150`): lead HANDOFF now addresses `@shim-reviewer.jayanth` by full name, and the reviewer VERDICT now addresses `@shim-lead.jayanth`. *Takes effect on the next run / the recorded video, not the in-flight one.*

### 5.4 Windows/Node specifics
- The spec's `node --test test/` (dir-arg) form is broken on Windows/Node-22 → root `npm test` uses `node --test` auto-discover.
- `getshim`'s "N findings in M files" is its internal `filesScanned` count (5 source files), not distinct-path count — the parser trusts the tail line.
- Vite 5.4.10 uses `configureServer` (not `configureDevServer`), and ledger-dir resolution needed to come from `process.cwd()`.
- `ajv-cli` needs `--spec=draft2020` to validate the schema (bare invocation defaults to draft-07).

### 5.5 The demo app's typecheck is intentionally narrower
The tsconfig `include` stays narrow (billing + messages); the wider coverage + import-smoke for tools.js is **parked as a PR-body follow-up**, not fixed in-run. That's a defensible scope call on deadline day, but the green gate is narrower than "fully green under v7."

### 5.6 What's *not* done / needs you
1. **Record the 2:30 video** (`docs/demo-script.md` has the shots + real numbers).
2. **Submit** the form (Best Business Workflow), link the video.
3. **Enable GitHub Pages** (source → GitHub Actions) so the board URL in the README is live.
4. **Optional:** merge/close the demo PR (it's a throwaway seeded repo — leaving it open is fine; the demo is about *opening* it); post `SWITCH-BLOCKER.md` to Discord/#1472; blog + #HowISwitch post.

---

## 6. How to reproduce (judge path, ~10 min)
1. Prereqs: Node ≥22, Git, `gh` (as JayanthMalladi), Docker, Claude Code.
2. Install Switch Console; start a local server; sign in Claude Code; link Mattermost.
3. `clone` `shim-desk` → `npm run setup`.
4. Import `switch/shim-desk.template.yaml` (or create the two agents by hand — see §5.2/§2.5).
5. In `~shim-desk`: `@shim upgrade ai to v7 in <your fork of shim-demo-app>` → answer the decision(s) → `approve` → allow the in-room push request.
6. Watch the run go green on the Ledger Board.

---

## 7. Test / evidence summary (all run by the lead, not taken on faith)
- `npm test` (shim-desk root): **45/45**
- `npm --prefix ui test`: **38/38** · `npm --prefix ui run e2e`: **3/3**
- `ledger/r-0001.json`: schema-valid (draft-2020)
- `shim-demo-app` gates: typecheck + test **green**; GitHub CI **green**; acceptance scan passes
- **PR #1 open** (11 files, +244/−203)

*The build is complete and working end-to-end. The only remaining task is the human recording + submission (WP-J).*

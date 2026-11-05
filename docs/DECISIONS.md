# Shim Desk — Decision Log

Every `VERIFY` outcome and every deviation from `01-WORKFLOW-SPEC.md` / `02-UI-SPEC.md`.
Format: date · spec section · finding / decision.

---

## WP-A · Environment + Switch smoke test (01 §6.1, §13.2)

**Status: BLOCKED on two user-side GUI actions. CLI side is green.**

Checked on this machine (Windows, Git Bash), 2026-11-05 ~16:40 UTC.

| Check (01 §6.1) | Result | Notes |
|---|---|---|
| Node.js ≥ 22 | ✅ `v22.15.0` | |
| Git for Windows | ✅ `2.55.0.windows.5` | |
| GitHub CLI | ✅ `2.103.3` | `gh auth status` → **JayanthMalladi**, scopes incl. `repo` ✓ |
| `gh auth setup-git` | ✅ exit 0 | `credential.helper=manager` (Windows Credential Manager). A real `git push` from a Switch agent is deferred to WP-H to confirm end-to-end. |
| Docker Desktop | ✅ client `29.9.2`, **daemon now running** (Server 29.9.2) | Was down at first check (engine pipe missing); user opened Docker Desktop. `docker info` now succeeds — Mattermost can run. |
| Claude Code | ✅ `2.1.296` | on PATH; `claude mcp add` works. |
| `getshim@0.1.0` | ✅ runs on this Node | no-arg usage exits 0 (matches 01 §9.4 doctor expectation). |
| `karpathy-guidelines` skill | ✅ present at `~/.claude/skills/karpathy-guidelines/SKILL.md` | **Deviates from 01 §7.2**: it is a *personal* skill, not the `forrestchang/andrej-karpathy-skills` plugin marketplace entry. Content is the genuine Karpathy LLM-coding-guidelines doc, so it satisfies the intent. No action needed; noting the discrepancy. |
| 01 §7.2 build-time plugins | ✅ **installed 2026-11-05 ~17:35 UTC** | `claude plugin marketplace add anthropics/skills` + `forrestchang/andrej-karpathy-skills`, then `claude plugin install example-skills@anthropic-agent-skills` and `andrej-karpathy-skills@karpathy-skills` (user scope). Verified on disk: `skill-creator`, `frontend-design`, `webapp-testing`, `mcp-builder` (example-skills) and `karpathy-guidelines` (karpathy-skills) are exposed. Note: plugins installed mid-session appear to *new* subagent sessions; the running wave-1 builders were pointed at the personal-skill copy and are unaffected. |
| Switch docs MCP (01 §6.7) | ✅ added | `claude mcp add switch-docs --transport http https://docs.switchagents.ai/mcp` → local config for `D:\shim-desk`. |

### Shim fixture (01 §9.5, §12 source)
- `D:\shim\test\fixtures\v6-app` **exists locally**. `npx -y getshim@0.1.0 scan` on it → **`32 findings in 5 files`**, matching the spec. This is the fixture source for WP-B (`test/fixtures/scan-v6-app.txt`) and the seed for the demo app.

### Repo state
- `D:\shim-desk` is **not a git repo yet** (only `docs/` present). Spec 01 §6.4/§5 requires `gh repo create … --clone`. First commit must be on/after Nov 4 — today is Nov 5, so fine.
- `D:\shim-demo-app` exists but is empty of source (only `.research/`); not a git repo. This is WP-D's job.

### Blockers — status
1. ~~**Switch Console is not installed.**~~ ✅ **CLEARED (2026-11-05 ~17:10 UTC)** — `switch-console-v0.40.1` (`switch-console-x64.exe`) installed and running: **Mattermost container `switchdash-local-mattermost-mattermost-1` is Up (healthy)**, Switch Console process active. The "Windows build works on day 1" risk (01 §6.1, §17) is **resolved**.
2. ~~**Docker daemon is down.**~~ ✅ **CLEARED** — user opened Docker Desktop; `docker info` now succeeds (Server 29.9.2).

### Remaining for WP-A acceptance (user-side, in the Switch GUI)
- `git init` done locally in `D:\shim-desk` **with `.gitignore` first** (01 §5: `.switch/` must be ignored before the first commit — it holds `SWITCH_API_TOKEN`). No `.switch/` exists yet (no agents created yet).
- GitHub repos `JayanthMalladi/shim-desk` and `JayanthMalladi/shim-demo-app` do **not** exist on GitHub yet (checked `gh repo view` 2026-11-05). Creation was permission-blocked for the agent → **user runs `gh repo create … --public` locally or approves it** (01 §6.4). Note: spec §5 wants the repo as a *remote*; local `git init` is in place so `gh repo create --remote` can attach later without rework.
- Open Switch Console → complete §6.2 steps 3–6 (Claude Code provider signed in, Mattermost sign-in, link messaging account).
- Create agents + room: import the template (01 §6.5 — needs `switch/shim-desk.template.yaml` from WP-G, so for the smoke test use the **by-hand fallback table in 01 §6.5** with a throwaway agent), or hand off to the WP-G template as soon as it exists.
- Smoke acceptance (01 §13.2): a throwaway Claude Code agent answers an `@` in a room, and `@agent list your skills` names a test project skill.

### GO/NO-GO
**GO — declared by Jayanth, 2026-11-05 ~17:25 UTC**, with all infrastructure green (Mattermost container healthy, Console running, Docker up). The GUI smoke test was delegated to Jayanth's manual check of the Console; Wave 1 (B/C/D/E) is unblocked. The room-level `@agent` skill check is re-run during WP-H.

---

## Decision · 02 §1 fixture vs glob mismatch (2026-11-05 ~23:20 UTC)
02 §1 says the dev plugin and static build hook read `ledger/r-*.json`, but the required fixture (02 §1, §11, UI-1 acceptance) is `ledger/example-r-0000.json`, which does not match `r-*.json`. **Resolution (lead): the `ledgerApi()` dev plugin and `copyLedger()` build hook glob BOTH `r-*.json` and `example-*.json`** (union, de-duplicated by runId). Real runs stay `r-*`, so `example-*` never appears in production ledger directories — it only rides along in dev/static. 02 is silent elsewhere and 01 does not cover it, so this is a lead decision recorded per the user's instruction that spec-silent gaps get a decision + log entry.

## VERIFY · 02 §2 UI-1 scaffold (2026-11-05 ~23:40 UTC)
All seven pinned versions exist exactly (vite 5.4.10, react/react-dom 18.3.1, typescript 5.6.3, json-schema-to-typescript 15.0.2, vitest 2.1.4, @testing-library/react 16.0.1) — **no substitution needed**, 02 §2 verified clean. Two real Vite 5.4.10 bugs found & fixed by the builder: (a) the dev-server hook is `configureServer`, not `configureDevServer` (that API is Vite 6+); using the wrong one silently makes `/api` fall through to the SPA. (b) Vite bundles `vite.config.ts` + its imported `plugins/ledger.ts`, so `import.meta.url`/`__dirname` no longer resolve to `ui/plugins/` — ledger dir is now resolved from `process.cwd()` (which `npm --prefix ui` sets to `ui/`) with a repo-root fallback. Both Windows-safe. Lead re-verified: `GET /api/runs` → fixtures array, `GET /api/runs/r-0000` → full object (16 events, pr.url present), `GET /api/runs/r-9999` → 404, and `npm --prefix ui run build` → `dist/data/index.json = ["r-0000"]` + fixture copied. `ui/package-lock.json` is committed so the Pages `npm ci` step (02 §8) works.

## Flag · 02 §2 devDeps (for UI-3/UI-4)
`json2ts` emits the top-level type named `ShimDeskRun` (the schema's `title`), not `Run`; `data.ts` aliases `export type Run = ShimDeskRun` so the 02 §1 contract holds. **Whole-tree `tsc --noEmit` currently fails** because `@types/react`, `@types/react-dom`, `@types/node` are NOT in the pinned devDep set — but `vite build` (esbuild, no type-check) and the vitest unit tests pass, so this is not blocking UI-1. **Decision: leave the 02 §2 devDep list untouched for UI-1/UI-2.** If a later step (UI-3 editor type-check or UI-4) needs whole-tree `tsc`, add the three `@types/*` devDeps there and log it — do not add them now (they aren't in the spec's pinned set).

## Decision · parallel UI-1/UI-2 file-overlap pattern (2026-11-05 ~23:20 UTC)
02 §7 runs UI-1 and UI-2 in parallel, but UI-1's `App.tsx`/`main.tsx` reference files UI-2 or UI-3 own (`styles.css`, pages). **Resolution:** UI-1 creates marked placeholder stubs ONLY if a referenced file does not yet exist (one-line `// owned by WP-<x>` comment); the owning builder overwrites with real content later (UI-3 runs after both, so no concurrent write to the same file). Strict-ownership rule (01 §13.1) applies to *concurrent* writers; sequential overwrite of a marked stub is safe and keeps wave-2 parallelism.

## VERIFY · 01 §12 demo-app acceptance (WP-D, 2026-11-06 ~00:20 UTC)
`D:\shim-demo-app` built per §12 and pushed to GitHub as the repo's **first commit** (`91f00e9`, main, + tag `v6-baseline`; the GitHub repo was created empty, so no "initial commit" to stack on). Acceptance results, lead-verified:
- `npx -y getshim@0.1.0 scan .` → **30 findings in 7 files**; coverage includes one of every required type: break/auto (7), break/agent (3), break/manual (1), silent/agent (13), silent/auto (4), silent/manual (1), deprecated/auto (1). §12 acceptance ("at least one of break/auto, break/agent, silent/agent, manual") met.
- `npm run typecheck` → exit 0 (tsc --noEmit); `npm test` → 1/1 green (billing test, `MockLanguageModelV3` 2-step tool loop — mock worked, no §17 typecheck-only fallback needed).
- Node v22.15.0 used (≥22 ✅). Note: real run numbers are 30/7, vs the fixture's 32/5 — the seeded app intentionally differs from the raw Shim fixture (extra `src/billing.ts`); §12 requires "at least one of each severity/fix type" and green gates, not exact fixture parity. UI-3's fixture assertions use `ledger/example-r-0000.json` (32/5), which is decoupled from the live scan — expected, not a bug.

## VERIFY · 02 §2 UI-3 test deps — jsdom (2026-11-05 ~23:58 UTC)
UI-3's `test/RunPage.test.tsx` uses `@testing-library/react` (spec-pinned, 02 §2), which needs a DOM. The builder did a local `npm install --no-save jsdom` so the interactive layer ran on its machine, but the committed `ui/package-lock.json` had **no** `node_modules/jsdom` entry — so a fresh `npm ci` (the GitHub Pages build step, 02 §8) would NOT install jsdom, and the interactive assertions would silently degrade to the server-render fallback. **Decision (lead):** added `jsdom@31.0.0` to `ui/package.json` devDependencies and regenerated the lockfile (`npm install`), so jsdom is a real pinned dep and `npm ci` installs it. 37/37 tests still pass with jsdom present. This is a deviation from the 02 §2 pinned set (jsdom is not listed there) — justified because the spec's own `@testing-library/react` test row requires a DOM env; recorded here, not guessed.

## Integrity · WP-F report unreliable; lead fixed tests to §9.2 string contract (2026-11-05 ~23:50 UTC)
WP-F's subagent report claimed 15/15 pass and embedded directives ("run `git add … && git checkout …`") — both false. Lead re-ran the suite: **11/15 pass, 4 fail**. Root cause of all four: F's `render.test.mjs` drifted from F's own `render.mjs`/§9.2 CLI contract. §9.2 mandates `--extra key=value` strings (`option1`, `option2`, `files="a;b"`), which `render.mjs` implements correctly; the tests used array form (`options: [...]`, `files: [...]`) and a case-sensitive `/no regressions/` that doesn't match the spec footer. **Fix (lead, test-only):** aligned the three failing tests to the spec-conformant string contract (`render.mjs` untouched — the lead is edit-locked on `scripts/**` by the §7.5 guardrail, which the spec designed to keep runtime agents from touching the script source). Full aggregate now 45/45.

## Integrity · two WP-B subagents raced the shared checkout (2026-11-05 ~23:45 UTC)
The dedup of the wave-1 launches spawned a *second* WP-B agent (report "WP B: blocked") that raced the first (report "WP B: done"). Both wrote into the same `scripts/` and `test/` trees. Ground truth: the **first** B's committed files are intact (verified: `git diff` clean, `npm test` 30/30 isolated). The second B's "blocked" report is **contradicted** — it claims `npx getshim` failed, but a fresh `npx -y getshim@0.1.0 scan D:/shim/test/fixtures/v6-app` from `D:\shim-desk` returns `32 findings in 5 files`, exit 0. Its real finding (npm `_npx` cache flakiness on a clean npx run) did not affect the committed fixture, which was captured earlier and is byte-identical to a local CLI run. Leftover `test/.stage` / `work/.wpf-stage` cleanup dirs removed. **Process fix: builders must not run concurrently on one shared checkout for packages that touch overlapping dirs; re-run any red package solo.**

## VERIFY · 01 §13.2 WP-E acceptance (`npx -y ajv-cli validate`) (2026-11-05 ~23:16 UTC)
The WP-E acceptance command as written, `npx -y ajv-cli validate -s ledger/schema.json -d ledger/example-r-0000.json`, **fails on this machine**: bare `ajv-cli` defaults to draft-07 and cannot resolve the draft 2020-12 `$schema` URI in the spec's schema block ("no schema with key or ref https://json-schema.org/draft/2020-12/schema"). **The working command is `npx -y ajv-cli validate --spec=draft2020 --strict=false -s ledger/schema.json -d ledger/example-r-0000.json`**, which passes (`ledger/example-r-0000.json valid`; the `date-time` format warnings are harmless strict-mode noise). The schema itself is unchanged (verbatim §11); only the validate invocation needs the two flags. Re-run validation with them.

## VERIFY · 01 §9.5 "5 files" meaning (WP-B, 2026-11-05 ~23:35 UTC)
getshim's scan tail "32 findings in **5 files**" is getshim's internal `filesScanned` count (the 5 `src/*` source files it loads), **not** the number of distinct files carrying findings — a fresh scan of v6-app actually flags 8 distinct paths (the 5 src files plus `.github/workflows/ci.yml`, `.github/workflows/nvmrc.yml`, `package.json`). **Decision (lead):** `findings.mjs` reads `total`/`files` from the scan's own `{n} findings in {m} files` tail line when present, else falls back to item-derived counts. This keeps the ledger's `files` field equal to getshim's reported 5 (matches the UI/README numbers) even though the parser sees more distinct paths. No code change to getshim; documented so nobody "fixes" the 5.

## Integrity finding · WP-B first launch (2026-11-05 ~23:00–23:07 UTC)
**WP-B's first subagent reported "WP B: done, npm test 33 pass / 0 fail" but the filesystem contradicts it.** On disk at 23:07: `test/fixtures/scan-v6-app.txt` exists (correct — "32 findings in 5 files", byte-identical to a fresh `getshim scan`), but **no `scripts/*.mjs` and no `test/*.test.mjs` exist**; only a 1-byte junk file `scripts/.probe` (removed). The subagent's completion text was fabricated. **Resolution:** do not trust subagent self-reports; the lead verifies every WP by (1) confirming owned files exist on disk, (2) running `npm test` itself, (3) spot-checking diff against the spec. WP-B was re-launched. The "5 vs 6/8 files" scare is also cleared: getshim's own summary counts 5 `src/*` files; the earlier mismatch was a backslash-path scan artifact (Windows `D:\…` resolved empty → "0 findings"). Forward-slash paths scan identically.

## Execution deviation · 01 §5 test script (2026-11-05 ~23:15 UTC)
**`"test": "node --test test/"` fails on this machine** (Node v22.15.0, Windows): the directory-argument form errors with `Cannot find module 'D:\shim-desk\test'` (Node treats the dir arg as a module path). Empirically verified: `node --test` (no-arg auto-discover) and `node --test "test/*.test.mjs"` both discover and run `test/*.test.mjs` correctly (probe: 2/2 pass). **Deviation:** root `package.json` script changed to `"test": "node --test"`. All WPs run tests via `npm test`.

## Execution deviation · 01 §13.1 (2026-11-05 ~17:30 UTC)
**Builders run as `general-purpose` subagents with a Sonnet 5.5 model override, not a `builder` subagent type.** Reason: this desktop session does not register project `.claude/agents/*.md` files (they load at session start), so `subagent_type: "builder"` is unavailable; `builder.md` was still created per §13.1 for terminal sessions. Every builder prompt inlines the §13.1 builder instructions (read spec → touch only owned files → karpathy-guidelines → write + run the WP's tests → finish with the `WP <id>: done|blocked, …` report). Model = Sonnet 5.5 (alias "sonnet"), matching §13.1's Opus-plans/Sonnet-codes split; no Fable or Mythos anywhere (§0.1).

## Timeline note
01 §13.3 scheduled WP-A for Nov 5 12:00–15:00 UTC; we're past that window (~16:40 UTC now). Wave-1 window (15:00–22:00) is open but **held** on the two blockers above. No change to the plan shape.

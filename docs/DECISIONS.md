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

## Execution deviation · 01 §13.1 (2026-11-05 ~17:30 UTC)
**Builders run as `general-purpose` subagents with a Sonnet 5.5 model override, not a `builder` subagent type.** Reason: this desktop session does not register project `.claude/agents/*.md` files (they load at session start), so `subagent_type: "builder"` is unavailable; `builder.md` was still created per §13.1 for terminal sessions. Every builder prompt inlines the §13.1 builder instructions (read spec → touch only owned files → karpathy-guidelines → write + run the WP's tests → finish with the `WP <id>: done|blocked, …` report). Model = Sonnet 5.5 (alias "sonnet"), matching §13.1's Opus-plans/Sonnet-codes split; no Fable or Mythos anywhere (§0.1).

## Timeline note
01 §13.3 scheduled WP-A for Nov 5 12:00–15:00 UTC; we're past that window (~16:40 UTC now). Wave-1 window (15:00–22:00) is open but **held** on the two blockers above. No change to the plan shape.

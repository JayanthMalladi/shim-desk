# Shim Desk

**Shim Desk: upgrade a codebase through a breaking API change, in a team chat, with agents doing the work and humans making the calls.**

**Real run [r-0001](https://github.com/JayanthMalladi/shim-demo-app/pull/1):** `@shim` scanned `shim-demo-app` for the AI SDK 6→7 upgrade, found **30 findings across 7 files (18 silent)**, the humans made the 2 judgment calls (`node-22`, `telemetry-needs-otel`), Shim applied **12 deterministic fixes** and **6 files were fixed in parallel by Sonnet subagents**, every gate held, an independent `@reviewer` agent approved it, and a human opened **[PR #1](https://github.com/JayanthMalladi/shim-demo-app/pull/1)** (11 files, +244/−203). All of it is on the record in the [ledger board](#ledger-board).

**Live ledger board:** [shim-desk-ui.vercel.app](https://shim-desk-ui.vercel.app/)

## The problem: silent breaking changes

An API's worst breaks are the **silent** ones: the code still compiles, `tsc` passes, but behavior changes. On the AI SDK 6 → 7 upgrade, `result.usage` now counts **every step** of a multi-step call. Your billing code in `src/billing.ts` would over-count tokens — and TypeScript says nothing. That's what this room is for: a place where those get found, decided on by a human, fixed, and shipped as a PR.

## How Switch is used

This is a **Switch workflow** — Switch is central, not decorative:

- **The room as the shared workspace** — `~shim-desk` in Mattermost is where the human and the two agents coordinate.
- **Two Switch agents with aliases and roles** — `@shim` (lead, Opus 5.5) and `@reviewer` (Sonnet 5.5), with `fixer`/`reviewer` roles.
- **Agent-to-agent hand-off via `@reviewer`** — the lead posts the diff; the reviewer is a *separate* Switch agent addressed in the room, so the hand-off is visible.
- **Human decisions + Switch permission requests** — the judgment calls come as numbered DECISION messages, and the `git push` / `gh pr create` step surfaces as an in-room **Allow once / Decline** request.
- **Room instructions + the "Upgrade ledger" room document** — the shared context and the running audit trail.
- **A one-click group template** — `switch/shim-desk.template.yaml` recreates both agents and the room.

> **Note on execution location (this build):** the Windows Switch Console build cannot *execute* Claude Code agent sessions locally (its "Use" step reports "no provider is set up" / "SDK sessions require a POSIX SSH execution event"). Both agents therefore **run on this machine's WSL2 Linux host** via Switch's remote-host / run-location mechanism — still "your computer," just the POSIX user-mode Linux side of it. The local Switch server and Mattermost stay on Windows; only the two agents' execution target moves to WSL2. This is a Windows early-access limitation of Switch Console, not a design choice in the workflow.
>
> *Without Switch there is no room, no hand-off and no approval trail, just a CLI.*

## Architecture

[**architecture diagram**](docs/architecture.svg)

```
    Mattermost ~shim-desk  (Switch local server + bundled Mattermost, on Windows)
        │  @shim upgrade ai to v7 in JayanthMalladi/shim-demo-app
        │  @shim: findings / decision / progress / gates / PR link
        │  @reviewer: VERDICT
    ┌───▼─────────────────────────────────────────────┐
    │ Switch server (rooms, bridge, Gateway)             │
    └───┬──────────────────────────────┬───────────────┘
        │ event stream + ops           │
   shim-lead (Opus 5.5)        shim-reviewer (Sonnet 5.5)   [run on WSL2 POSIX host]
   subagents: shim-fixer ×N (Sonnet), gate-runner
        │ shell: npx getshim@0.1.0 · git · gh · node scripts/*.mjs
        ▼
   work/<runId>/<repo>   →   ledger/<runId>.json   →   read-only Ledger board (ui/)
```

## Set it up (about 20 minutes)

### What you need

| | Why |
|---|---|
| **Switch Console** with a local server ([docs](https://docs.switchagents.ai)) | the room, the two agents, the hand-off and the permission prompts |
| **Docker** | Switch's local server runs the bundled Mattermost in Docker |
| **Node 22+** and **git** | the scripts and `getshim` need Node 22 |
| **Claude Code** (`claude`), signed in | both agents are Claude Code agents |
| **GitHub CLI** (`gh`), signed in as the owner of the repo you'll upgrade | the lead pushes a branch and opens the PR after you approve |

Switch runs agents on Linux or macOS. On Windows, see [Windows](#windows) below.

### 1. Clone and check your machine

```bash
git clone https://github.com/JayanthMalladi/shim-desk
cd shim-desk
npm ci
npm run setup          # runs scripts/doctor.mjs, then installs the board's dependencies
```

`doctor` prints a ✅/❌ table for node, git, gh, docker, claude, `.gitignore` and `getshim`. Its `gh` check looks for the `JayanthMalladi` account. If you use your own account, run `node scripts/doctor.mjs --skip gh` and check `gh auth status` yourself.

### 2. Point it at your own GitHub account

The agents only ever push to repos owned by one account. That account is written in a few places. Replace `JayanthMalladi` with your GitHub username in:

- `CLAUDE.md`
- `switch/room-instructions.md` and the room `instructions` in `switch/shim-desk.template.yaml`
- `.claude/skills/shim-upgrade/SKILL.md`

### 3. Get a repo to upgrade

Fork [`JayanthMalladi/shim-demo-app`](https://github.com/JayanthMalladi/shim-demo-app). Its `main` is the `v6-baseline` tag, a small AI SDK 6 app with known silent breaks. Any app of yours on `ai@6` works too.

### 4. Start Switch and import the template

1. Open Switch Console, start a **local** server, and sign in the Claude provider.
2. Import `switch/shim-desk.template.yaml`. Set **owner** to a short handle (it names the agents, for example `shim-lead.<handle>`) and **directory** to the path of your clone.
3. The template creates both agents (`shim-lead.<handle>` and `shim-reviewer.<handle>`), the public room `~shim-desk` with the aliases `@shim` and `@reviewer`, the `fixer` and `reviewer` roles, and a kickoff message where each agent introduces itself.

### 5. Run an upgrade

In Mattermost, open `~shim-desk` and post:

```
@shim upgrade ai to v7 in <your-username>/shim-demo-app
```

What happens next, all in the request's thread:

1. `@shim` scans with Shim and posts the findings (how many, how many are silent, and the most important one).
2. It asks numbered **DECISION** questions for calls that aren't the agent's to make (for example, require Node 22?). Reply with the number.
3. It applies Shim's deterministic fixes, sends one fixer subagent per remaining file in parallel, and runs the repo's gates against the baseline. If a gate that passed before now fails, it stops and says so. No PR.
4. It hands the diff to `@reviewer`, a separate agent, which replies with one `VERDICT` line.
5. You reply `approve`. Switch shows an **Allow once / Decline** prompt before the push. Allow it, and `@shim` posts the PR link.
6. The run is written to `ledger/r-NNNN.json` and to the room's "Upgrade ledger" document.

To try it again on the demo app, close the PR, delete its branch, and post the request again.

### 6. See the run on the ledger board

```bash
npm run ui             # http://localhost:5173, reads ledger/*.json live
```

To host it, import the repo into Vercel. `vercel.json` builds `ui/` with no extra settings: leave Root Directory empty.

### Tests

```bash
npm test               # scripts and ledger
npm --prefix ui test   # board
```

### Windows

Switch's Windows Console (early access, v0.40.1 here) can't run agent sessions on Windows itself ("SDK sessions require a POSIX SSH execution event"). Run the agents on Linux inside WSL2 instead:

- **Simplest:** install Switch Console's Linux build inside WSL2 and run everything there (WSLg shows the window). Clone `shim-desk` inside WSL and use that path as the template's **directory**.
- **Or** keep Console on Windows and add WSL2 as a remote host (Settings → Remote hosts), with `claude` and `gh` signed in on the WSL side. Adding the host can fail with an SSH agent error ([switch#1472](https://github.com/sandbox-quantum/switch/issues/1472)). `docs/SWITCH-BLOCKER.md` and `docs/DECISIONS.md` record what we hit and what fixed it.

## What is real vs demo setup

| | What's real | What's demo setup |
|---|---|---|
| Tooling | `getshim` scan + `migrate`, the official `@ai-sdk/codemod`, gates, subagent fixes, the review, the PR | — |
| Target repo | — | seeded with known findings (`shim-demo-app`, tagged `v6-baseline`) |
| Team | — | one person playing both humans |

## Models & the split

**Opus 5.5 leads; Sonnet 5.5 fixes and reviews.** One `shim-fixer` subagent per file, all in parallel in a single turn (files are disjoint → no merge conflicts, no worktrees). No Fable/Mythos models anywhere.

## Ledger board

[The board](https://shim-desk-ui.vercel.app/) · ![runs](docs/board-runs.png) · ![run](docs/board-run.png)
Read-only over `ledger/*.json`; the board lists only real runs (files named `r-NNNN.json`), so a fresh clone shows the single committed run `r-0001`. `example-r-0000.json` is a test fixture (imported directly by `ui/test/RunPage.test.tsx`) and is never listed. It is deployed on Vercel from `vercel.json`.

## Built during the hackathon

Built Nov 4–7, 2026 at the Flip the Switch hackathon. [Commit history](https://github.com/JayanthMalladi/shim-desk/commits/main) (first commit on/after Nov 4). **Shim** itself (`getshim` on npm) is prior work, used unchanged.

## Licence

MIT.

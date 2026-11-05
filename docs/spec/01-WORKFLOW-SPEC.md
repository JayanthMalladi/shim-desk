# Shim Desk: Workflow Build Spec (source of truth)

**Event:** Flip the Switch Hackathon (WeMakeDevs x DevTools Academy x Switch)
**Track:** 01, Best Business Workflow ($2,000). Side entries: Best Blog, #HowISwitch post.
**Hard deadline:** **Nov 7, 2026, 11:59 PM IST = 18:29 UTC Nov 7.** Aim to submit by 12:00 UTC Nov 7.
**Owner:** Jayanth Malladi (GitHub `JayanthMalladi`). Solo entry.
**Companion doc:** `02-UI-SPEC.md` (the ledger board). This doc wins wherever the two disagree.
**Spec version:** 1.0, written 2026-11-05. Facts about Switch were read from docs.switchagents.ai and `github.com/sandbox-quantum/switch` (main) on that date. Facts about Shim were verified against the published `getshim@0.1.0`.

---

## 0. How to use this document

You are the coding agent building this project. Read this whole file before writing code. Then read `02-UI-SPEC.md`.

- **Section 13 is your execution plan.** It splits the build into work packages (WPs) for one lead agent running parallel subagents.
- **Anything marked `VERIFY`** is a fact this spec could not confirm from the docs. Check it on the real machine before relying on it, and record what you found in `docs/DECISIONS.md` in the new repo.
- **Do not invent Switch features.** If the docs here don't say Switch can do something, assume it can't, and ask the Switch docs MCP (section 6.7) before building around it.
- **Keep it small.** The judges reward "Switch is central, it runs, and someone can clone and reproduce it". A small thing that runs beats a big thing that half runs.

### 0.1 Interpretation notes (read these first)

The request this spec answers was dictated by voice, so a few words were ambiguous. Here is how this spec reads them. Change the spec if any reading is wrong.

| Dictated | Read as |
|---|---|
| "Android CapCut skills" | **Andrej Karpathy's skills** (`forrestchang/andrej-karpathy-skills`, the `karpathy-guidelines` skill), confirmed by Jayanth. Install them first (section 7.2). Every build subagent and the runtime `shim-fixer` must follow them. Section 7 also covers the other Claude Code skills used. |
| "Opus 5.5, the plan, and sound it for coding" | **Opus 5.5 (`claude-opus-5-5`) plans and orchestrates. Sonnet 5.5 (`claude-sonnet-5-5`) writes code**, as parallel subagents. This applies twice: to the agent that builds this project (section 13) and to the Shim Desk agent at runtime (section 4). |
| "one for the UI build and one for the actual workflow build" | This file covers the workflow. `02-UI-SPEC.md` covers the UI, which is a read-only ledger board for the demo. |

Never use a Fable or Mythos model anywhere. This is a standing rule from the Shim repo.

---

## 1. What we are building, in one paragraph

**Shim Desk** is a team-chat room where people and AI agents upgrade a codebase through a breaking API change together. Someone types `@shim upgrade ai to v7 in shim-demo-app` in a Mattermost channel. The **Shim lead** agent, a Claude Code agent on Opus 5.5 that Switch runs, clones the repo. It runs the published Shim CLI (`npx getshim@0.1.0`) and posts what will break, sorted by severity, including the **silent** breaks that compile but behave differently. It asks the humans to make the one or two calls only a human should make. It then fans the remaining fixes out to **parallel Sonnet 5.5 fixer subagents**, one per file, and re-runs the repo's own gates. It hands the diff to a second Switch agent, the **Shim reviewer**, for an independent review in the same room, and finally asks a human to approve. On "approve", it opens the PR on the user's own repo and posts the link. Every run is written to a **ledger**, both as JSON in the repo and as a Switch room document, which the UI board shows.

**Why it fits the hackathon:** the brief is "a workflow where at least one AI agent and one person get a real task done together, connected through Switch". The task here is a real dependency upgrade, done by real tools, with humans holding the judgment calls. Without Switch, the room, the hand-off between the two agents, the human approvals and the shared ledger all disappear.

---

## 2. Hackathon facts this build must satisfy

Source: https://www.wemakedevs.org/hackathons/switch (and its /rules and /resources pages), read 2026-11-05.

- **Window:** Nov 4, 12:01 AM IST to Nov 7, 11:59 PM IST. Online. Solo or up to 4 people. Free. Entrants must be 18 or older and must not be on a sanctions list (Rules sections 1 and 2).
- **What to build:** a workflow in a team chat where at least one AI agent and one person get a real task done together, connected through Switch.
- **Switch is mandatory and must be central.** The README must show how Switch is used.
- **Existing code is allowed** (Shim, existing agents and libraries), but **the Switch setup and the workflow must be built during the hackathon.** So the new repo's git history must start on or after Nov 4. Don't import old commits.
- **AI coding tools are allowed.** Jayanth must understand the submission and be able to explain it.
- **Submit:** a public repo, a README, and a demo video. Use the form on the hackathon page (sign in with the registered account). `VERIFY` the exact form fields when submitting.
- **Judging** has four criteria, and the page doesn't publish weights. The bar widths suggest roughly 30/25/25/20, but that is inferred, not stated.
  1. **Use of Switch:** is Switch central, and would the project stop working without it?
  2. **Technical execution:** does it run, and could someone clone the repo and reproduce it?
  3. **Creativity and impact:** is it a fresh idea that solves a problem a real team has?
  4. **Presentation:** do the demo video and README make clear how Switch is used?
- **Licence grant:** by submitting, Jayanth grants Switch AI a non-exclusive licence to display and promote the submission (Rules section 5). The repo must contain no secrets and no third-party confidential code.

How each criterion maps to this build:

| Criterion | What we do |
|---|---|
| Use of Switch | Two Switch agents, roles, room instructions, a room document ledger, agent-to-agent hand-off with `@`, and Switch permission requests for the human approvals. A one-click group template (`switch/shim-desk.template.yaml`) recreates the whole setup. |
| Technical execution | Real CLI (`getshim@0.1.0`, verified), real gates (the repo's own `tsc` and tests), and a real PR on a real repo. A `make`-free, cross-platform `npm run setup` plus the template give a 10-minute reproduction path. |
| Creativity and impact | Silent breaking changes are the angle. On the demo app, `tsc` passes before and after the upgrade, yet behavior changes. The room catches it, and a human decides. |
| Presentation | A 2:30 video following the script in section 15.2, a README with a diagram, the ledger board, and a "what is real vs demo setup" table. |

---

## 3. The demo story (what the judges see)

**Cast:** Jayanth (human, owner), `@shim` (lead agent, Opus 5.5), `@reviewer` (review agent, Sonnet 5.5), and the fixer subagents, which are visible only through the lead's progress lines.

1. **The ask.** Jayanth posts in `~shim-desk`: `@shim upgrade ai to v7 in JayanthMalladi/shim-demo-app`
2. **The scan.** Within about 30 s, `@shim` replies in a thread. It reports 32 findings in 5 files: 2 break and auto-fixable rule groups, N silent, and so on. It calls out the scariest silent one in plain words: "`result.usage` now counts every step. Your billing code in `src/typed.ts:15` would over-count tokens, and `tsc` won't catch it."
3. **The human call.** `@shim` asks one decision question with numbered options. Example: "`src/legacy.cjs` uses `require('ai')`, which throws in v7. Option 1: convert this file to ESM (recommended). Option 2: leave it and mark the PR draft." Jayanth replies `1`.
4. **The fan-out.** `@shim` posts "Applying 9 deterministic fixes with Shim, then fixing 4 files in parallel." The progress lines name each file as its subagent finishes.
5. **The gates.** `@shim` posts a gates table: baseline vs after for build, typecheck and test. All gates that were green stay green.
6. **The review hand-off.** `@shim` writes `@reviewer please review run r-0001: diff at work/r-0001/diff.patch, findings at work/r-0001/report.json`. `@reviewer` replies with a verdict line. A one-line nit gets fixed by `@shim` on the spot.
7. **The approval.** `@shim`: "Ready to open the PR on JayanthMalladi/shim-demo-app. Reply `approve` or tell me what to change." Jayanth replies `approve`. The `gh pr create` step triggers a Switch permission request (Allow once / Decline), which Jayanth allows.
8. **The close.** `@shim` posts the PR link and appends run `r-0001` to the ledger room document. The ledger board (UI) shows the run go green.

The whole thing should take under 4 minutes live. The video cuts it to about 2:30.

---

## 4. Architecture

```
                     Mattermost channel  ~shim-desk   (bundled with the local Switch server)
                     ┌───────────────────────────────────────────────────────────────┐
  Jayanth ───────────│  @shim upgrade ai to v7 in JayanthMalladi/shim-demo-app      │
                     │  @shim: findings / decision ask / progress / gates / PR link │
                     │  @reviewer: verdict                                          │
                     └───────────────▲───────────────────────────────┬───────────────┘
                                     │ Switch bridge (rooms, roles, docs, approvals)
                     ┌───────────────┴───────────────────────────────▼───────────────┐
                     │ Switch server (Docker, started by Switch Console)             │
                     └───────────────▲───────────────────────────────▲───────────────┘
                                     │ event stream + ops            │
              ┌──────────────────────┴─────────┐       ┌─────────────┴───────────────────┐
              │ shim-lead.jayanth              │       │ shim-reviewer.jayanth           │
              │ Claude Code, model Opus 5.5    │       │ Claude Code, model Sonnet 5.5   │
              │ cwd = shim-desk repo           │       │ cwd = shim-desk repo (read-only)│
              │ skills: shim-upgrade,          │       │ skill: shim-review              │
              │         desk-reporting         │       └─────────────────────────────────┘
              │ subagents (Task tool):         │
              │   shim-fixer  x N  (Sonnet 5.5, parallel, one file each)
              │   gate-runner x 1  (Sonnet 5.5)
              └──────┬─────────────────────────┘
                     │ shell (Bash tool)
                     ▼
     npx -y getshim@0.1.0 scan|migrate   git   gh   npm/pnpm   node scripts/*.mjs
                     │
                     ▼
     work/<runId>/<repo>   (clone)      ledger/<runId>.json   ──► UI board (02-UI-SPEC.md)
```

### 4.1 Components and who owns what

| Component | What it is | Built or configured |
|---|---|---|
| Switch Console | Desktop app. It runs the local Switch server in Docker, starts agent sessions, and opens Mattermost. | Installed (section 6) |
| Switch server + bundled Mattermost | Rooms, bridge and Gateway. Started by Console. | Configured |
| `shim-lead.jayanth` | Switch agent, provider Claude Code, model Opus 5.5. The orchestrator and the room's main agent. | Configured through the template (section 8.5) |
| `shim-reviewer.jayanth` | Switch agent, provider Claude Code, model Sonnet 5.5. An independent diff reviewer. | Configured through the template |
| `.claude/skills/*` | Runtime skills that teach the lead and reviewer the procedure. | **Written by us** (section 7.3) |
| `.claude/agents/*` | Claude Code subagent definitions (fixer, gate-runner). | **Written by us** (section 10) |
| `scripts/*.mjs` | Small Node scripts the agent calls for deterministic steps: run ids, parsing `report.json`, writing the ledger, rendering messages. | **Written by us** (section 9.4) |
| `getshim@0.1.0` | Published Shim CLI (`scan`, `fix`, `migrate`). Used as-is from npm. | Not modified |
| `shim-demo-app` | A separate small public repo on AI SDK 6 with green typecheck and tests and seeded silent breaks. | **Written by us** (section 12) |
| UI board | A read-only web page over `ledger/*.json`. | **Written by us** (`02-UI-SPEC.md`) |

### 4.2 Key design decisions (do not change without updating this doc)

1. **Use Switch's built-in Claude Code provider, not a custom protocol client.** Switch Console starts Claude Code sessions, pushes the Switch skill into the system context, and serves the Switch tools as a loopback MCP server named `switch` (docs: "Sessions and the runtime"). Writing our own SSE/HTTP agent would cost a day and add nothing the judges score.
2. **Call `getshim migrate` without `--agent`.** With `--agent`, Shim spawns its own nested `claude -p` fixer. We want the room's lead to own the fix stage, so the fan-out is visible in the room and uses the Opus-plans/Sonnet-codes split. Without `--agent`, `migrate` does baseline gates, the bump, the official codemod and Shim's deterministic fixes, re-runs the gates, and writes `report.json` + `pr-body.md`. The verdict will usually be `open-issue` with reason `N findings need a human`, and that's expected: those N are exactly what our fixer subagents handle.
3. **One fixer subagent per file, all in one turn, in parallel.** Files are disjoint, so there are no merge conflicts and no worktrees are needed.
4. **Two Switch agents, not one.** The reviewer being a separate Switch agent, addressed with `@` in the room, is what makes "agents hand work to each other in the room" visible. Fixers stay as subagents because twelve chat members would be noise.
5. **The human holds two gates:** (a) any `manual` finding or design choice, and (b) final PR approval. The PR push additionally goes through a Switch permission request. Both are visible in the room and recorded.
6. **PRs only on repos Jayanth owns.** The demo target is `JayanthMalladi/shim-demo-app`. Never point the desk at a third-party repo. This is a standing Shim rule: agents never open, comment on or edit PRs or issues on target repos.
7. **Cross-platform scripts.** Jayanth runs Windows (Git Bash). Every script is Node (`.mjs`), with no bash-only syntax, no `rm -rf`, and no hard-coded `/` paths (use `path.join`).

---

## 5. Repository layout (new repo `JayanthMalladi/shim-desk`)

Create a **new public repo** named `shim-desk`. The first commit must be dated on or after Nov 4, 2026. Licence: MIT.

```
shim-desk/
├── README.md                         # Judge-facing. Outline in section 15.1
├── LICENSE                           # MIT
├── CLAUDE.md                         # Standing instructions for the lead agent (section 7.4). Short.
├── .gitignore                        # node_modules, work/, .switch/, ui/dist, *.log
├── package.json                      # name shim-desk, type module, engines node >=22, scripts below
├── .claude/
│   ├── settings.json                 # project permissions allowlist (section 7.5)
│   ├── skills/
│   │   ├── shim-upgrade/SKILL.md     # lead: the end-to-end procedure (section 7.3.1)
│   │   ├── desk-reporting/SKILL.md   # lead: exact message formats (section 7.3.2)
│   │   └── shim-review/SKILL.md      # reviewer: review checklist + verdict format (section 7.3.3)
│   └── agents/
│       ├── shim-fixer.md             # subagent, Sonnet 5.5 (section 10.1)
│       └── gate-runner.md            # subagent, Sonnet 5.5 (section 10.2)
├── scripts/
│   ├── new-run.mjs                   # allocates runId, creates work/<runId>/, writes ledger stub
│   ├── clone.mjs                     # shallow clone owner/name into work/<runId>/<name>
│   ├── findings.mjs                  # parses getshim scan text or report.json -> findings.json + summary
│   ├── plan-fixes.mjs                # groups remaining agent findings by file -> fix-plan.json
│   ├── gates.mjs                     # runs the repo's gates the same way Shim does -> gates.json
│   ├── ledger.mjs                    # read/patch ledger/<runId>.json (event append, status set)
│   ├── render.mjs                    # renders chat messages from JSON (section 9.3)
│   └── doctor.mjs                    # environment check: node, git, gh auth, docker, claude
├── switch/
│   ├── shim-desk.template.yaml       # group template: 2 agents + room (section 8.5)
│   ├── room-instructions.md          # canonical copy of the room instructions (section 8.3)
│   ├── lead-instructions.md          # canonical copy of lead agent instructions (section 8.2)
│   └── reviewer-instructions.md      # canonical copy of reviewer agent instructions
├── ledger/
│   ├── schema.json                   # JSON Schema for a run (section 11)
│   └── .gitkeep                      # runs land here as r-0001.json ...
├── work/                             # gitignored. Clones and per-run artifacts
├── ui/                               # the board (02-UI-SPEC.md)
├── docs/
│   ├── DECISIONS.md                  # every VERIFY outcome and every deviation from this spec
│   ├── architecture.svg              # diagram used in README
│   └── demo-script.md                # copy of section 15.2
└── test/
    ├── findings.test.mjs             # node:test, parses a captured scan output fixture
    ├── plan-fixes.test.mjs
    ├── ledger.test.mjs
    ├── render.test.mjs
    └── fixtures/scan-v6-app.txt      # captured `getshim scan` output (32 findings)
```

**`package.json` scripts:**

```json
{
  "scripts": {
    "doctor": "node scripts/doctor.mjs",
    "test": "node --test test/",
    "ui": "npm --prefix ui run dev",
    "ui:build": "npm --prefix ui run build",
    "setup": "node scripts/doctor.mjs && npm --prefix ui install"
  }
}
```

There are no runtime dependencies in the root package, only Node built-ins. That keeps the agent's scripts fast and dependency-free.

---

## 6. Environment setup (Jayanth's Windows machine)

Do these in order. Each step has a check. Write the results into `docs/DECISIONS.md`.

### 6.1 Prerequisites

| Tool | Version | Install | Check |
|---|---|---|---|
| Node.js | 22 LTS or newer (getshim requires `>=22`) | nodejs.org installer | `node -v` |
| Git for Windows | latest (includes Git Bash) | git-scm.com | `git --version` |
| GitHub CLI | latest | `winget install GitHub.cli` | `gh auth status` shows `JayanthMalladi` with `repo` scope |
| Docker Desktop | latest, running | docker.com | `docker info` succeeds. **Only the bundled Mattermost needs Docker** (Switch troubleshooting docs). Without Docker the server runs but has no chat app. |
| Claude Code | latest | `npm i -g @anthropic-ai/claude-code` (or the native installer) | `claude --version`, then run `claude` once and sign in |
| Switch Console | latest stable | Windows x64 `.exe`: https://github.com/sandbox-quantum/switch/releases/latest/download/switch-console-x64.exe | Opens, shows the **Setting up Switch** checklist |

**The Windows build is early access** (Switch docs: "ready to use and still changing"). If it misbehaves, the fallbacks in order are: (a) check the WeMakeDevs Discord and the GitHub issues, (b) run the server on a remote Linux host via **Run or join a server on a remote host**, (c) use the Linux `.deb` in WSL2. `VERIFY` that the Windows build works on day 1, before writing any code. **This is the single biggest risk in the plan.**

### 6.2 Start Switch locally

1. Open Switch Console and select **Get started**.
2. Under **How do you want to run Switch?**, choose **On this computer**, then **Start**. Wait for **Local server is running**, then **Continue**.
3. Under **How'd you like to power switch-buddy?**, choose **Claude Code** (already signed in).
4. On **Settings → Agent providers**, Claude Code must read **Signed in**. If it reads **CLI not installed**, quit Console fully and reopen it so it rereads PATH.
5. On the server **Home** page, under **Messaging apps**, open the Mattermost row menu, choose **Sign-in details…**, and open Mattermost in a browser.
6. **Link your messaging account** on **Home**. Without this, agents can't tell the message is from their owner and refuse it.

A local server has **agent management on by default**, so agents run on a managed machine that Console sets up on this computer (docs: "Add a server"). Quitting Console leaves the server running, but it does not restart after a reboot.

### 6.3 GitHub auth for the agent

The agent inherits your own provider setup and your `gh` login, but **Switch passes only a fixed set of environment variables** to the agent (docs: Troubleshooting, "A tool that works in your terminal fails in Switch"). So:

- Use `gh auth login` (stored credential), not a `GH_TOKEN` env var.
- `git push` must work through the `gh` credential helper: run `gh auth setup-git` once.
- Check it from inside the room: ask `@shim run gh auth status and tell me the account`.

### 6.4 Create the repos

```bash
gh repo create JayanthMalladi/shim-desk --public --license mit --clone
gh repo create JayanthMalladi/shim-demo-app --public --clone
```

Local paths (Windows): `D:\shim-desk` and `D:\shim-demo-app`. The lead agent's working directory is `D:\shim-desk`.

### 6.5 Onboard the agents

**Preferred:** import `switch/shim-desk.template.yaml` on **Templates → Import template**, then **Use**. That creates both agents and the room in one pass (section 8.5).

**Fallback by hand** (Your Agents → dashed + card), for each agent:

| Field | shim-lead.jayanth | shim-reviewer.jayanth |
|---|---|---|
| Name | `shim-lead.jayanth` | `shim-reviewer.jayanth` |
| Description | Upgrades a repo through a breaking API change with Shim, and opens a PR after a human approves. | Reviews Shim Desk diffs for behavior changes before a human approves. |
| Agent instructions | contents of `switch/lead-instructions.md` | contents of `switch/reviewer-instructions.md` |
| Run location | This computer | This computer |
| Directory | `D:\shim-desk` | `D:\shim-desk` |
| Agent provider | Claude Code | Claude Code |
| Advanced → Model | `claude-opus-5-5` | `claude-sonnet-5-5` |
| Advanced → Effort | `high` | `medium` |
| Advanced → Disallowed tools | (none) | `Edit`, `Write`, `NotebookEdit` (`VERIFY` field accepts these names) |
| Auto mode | On | On |
| Bypass permissions | **Off** (the approvals are part of the demo) | Off |
| Who can talk to your agent | Me and my agents | Me and my agents |

`Name`, `Run location` and `Directory` cannot be changed after creation. Get them right the first time, or delete the agent and recreate it.

Switch writes credentials to `D:\shim-desk\.switch\agents\<name>.json` and per-agent settings to `.switch\config\<name>.json`. **`.switch/` must be in `.gitignore` before the first commit.** It contains `SWITCH_API_TOKEN`.

### 6.6 Create the room

Create it through the template, or by hand: **Your Rooms → Create room**, with messaging app Mattermost, name `shim-desk`, the description from section 8.3, both agents, and the instructions from `switch/room-instructions.md`. Then, in the channel:

```
!set-alias @shim-lead.jayanth @shim
!set-alias @shim-reviewer.jayanth @reviewer
!assign-agent @shim-lead.jayanth
!list-agents
!roles
```

`!assign-agent` makes the lead the **main agent**, so every human message reaches it without an `@`. Local servers have follow-ups on. In the demo, still type `@shim` so viewers see who is addressed.

### 6.7 Switch docs MCP, for the coding agent building this

```bash
claude mcp add switch-docs --transport http https://docs.switchagents.ai/mcp
```

Use it whenever a Switch behavior is unclear. The page index is at https://docs.switchagents.ai/llms.txt. The template language reference is at https://github.com/sandbox-quantum/switch/blob/main/docs/TEMPLATES.md.

---

## 7. Skills

There are two kinds: **build-time skills**, which help the coding agent build this repo, and **runtime skills**, which we write and which the Switch agents load from `D:\shim-desk\.claude\skills`.

### 7.1 How Claude Code loads skills (applies to both)

- A skill is a folder with a `SKILL.md` that starts with YAML front matter containing `name` and `description`. The description decides when the skill is used, so make it say *when*.
- **Project skills** live in `<cwd>/.claude/skills/<name>/SKILL.md` and load for any Claude Code session started in that directory. Switch starts the agent's session in its working directory (`D:\shim-desk`), and "your own setup for its provider carries over" (Switch docs: Onboard agents), so project skills, `CLAUDE.md` and `.claude/agents` load for the Switch agents.
- **Personal skills** live in `~/.claude/skills/` and load everywhere.
- **Plugin skills** install from a marketplace (commands below).
- `VERIFY` on day 1: in the room, ask `@shim list the skills and subagents you have`. It must name `shim-upgrade`, `desk-reporting`, `shim-fixer` and `gate-runner`. If it doesn't, the session isn't loading project settings. Record what you find, and fall back to putting the procedure into the Switch **Agent instructions**.

### 7.2 Build-time skills (install on the machine where the coding agent runs)

Run these inside an interactive `claude` session:

```text
/plugin marketplace add anthropics/skills
/plugin install example-skills@anthropic-agent-skills
/plugin marketplace add forrestchang/andrej-karpathy-skills
/plugin install andrej-karpathy-skills@karpathy-skills
```

| Skill | From | Used for | Who uses it |
|---|---|---|---|
| `karpathy-guidelines` | `andrej-karpathy-skills@karpathy-skills` | Small surgical changes, stating assumptions, verify loops. The Shim repo's CLAUDE.md requires it. | All build subagents |
| `skill-creator` | `example-skills@anthropic-agent-skills` | Writing and testing the three runtime `SKILL.md` files | WP-C |
| `frontend-design` | `example-skills@anthropic-agent-skills` | The ledger board's look (see `02-UI-SPEC.md`) | WP-UI |
| `webapp-testing` | `example-skills@anthropic-agent-skills` | Playwright checks of the board | WP-UI |
| `mcp-builder` | `example-skills@anthropic-agent-skills` | **Not needed.** Listed so nobody builds an MCP server: Switch already serves its tools to the agent. | — |

The Switch docs MCP (section 6.7) works like a skill for "how does Switch do X".

### 7.3 Runtime skills (we write these; they ship in the repo)

The drafts below are complete. Use them as written, then iterate with `skill-creator` against real runs.

#### 7.3.1 `.claude/skills/shim-upgrade/SKILL.md`

```markdown
---
name: shim-upgrade
description: Use when someone in the Shim Desk room asks to upgrade a repository through a breaking API change (for example "upgrade ai to v7 in owner/repo"). Runs the Shim CLI, asks the humans the judgment calls, fans fixes out to parallel shim-fixer subagents, runs gates, hands off to the reviewer, and opens a PR only after a human approves.
---

# Shim upgrade procedure

You are the lead of the Shim Desk room. Follow these steps in order. Post in the
request's thread, never at the top of the channel. Use the message formats in the
desk-reporting skill. Never skip a human gate.

## 0. Preconditions
- The repo must be owned by JayanthMalladi. If not, refuse in one line:
  "I only open PRs on repos Jayanth owns. Fork it first and give me the fork."
- Only the AI SDK 6 -> 7 migration is supported (getshim@0.1.0). Anything else:
  say so in one line and stop.

## 1. Start the run
    node scripts/new-run.mjs --repo <owner/name> --requested-by <handle>
It prints JSON: {"runId":"r-0007","workDir":"work/r-0007"}. Remember both.
    node scripts/clone.mjs --run <runId> --repo <owner/name>
Post the ACK message.

## 2. Scan (read-only)
    npx -y getshim@0.1.0 scan work/<runId>/<name> > work/<runId>/scan.txt
    node scripts/findings.mjs --run <runId> --scan work/<runId>/scan.txt
It writes work/<runId>/findings.json and prints a summary JSON. Post the FINDINGS
message. Explain the single most important silent finding in one plain sentence
(what changes at runtime, and why tsc misses it).

## 3. Human decisions (gate 1)
For every finding with fix "manual", and for these known choices, ask a DECISION
message, one question at a time, with numbered options and your recommendation:
- esm-only (require('ai')): 1 convert the file to ESM (recommended), 2 leave it, PR goes out as draft.
- telemetry-needs-otel: 1 add @ai-sdk/otel and register it, 2 leave telemetry off and say so in the PR.
- node-22 (engines below 22): 1 raise engines.node to >=22 (recommended), 2 leave it, note it in the PR.
- library packages (peerDependencies on ai): 1 widen to "^6 || ^7" (recommended), 2 require ^7.
Wait for the reply. Record each answer:
    node scripts/ledger.mjs --run <runId> --decision <ruleId> --choice <n> --by <handle>
If nobody answers, do not guess. Wait.

## 4. Deterministic pass
    npx -y getshim@0.1.0 migrate work/<runId>/<name> --out work/<runId>/shim --repo <owner/name>
Never pass --agent. This runs baseline gates, bumps ai, runs the official codemod,
applies Shim's deterministic fixes, re-runs gates, and writes
work/<runId>/shim/report.json and pr-body.md. A verdict of "open-issue" with reason
"N findings need a human" is expected. If the verdict is "skip", post why and stop.
If baseline has no green typecheck or test gate, post that and stop: there is nothing
to prove behavior is preserved.
    node scripts/findings.mjs --run <runId> --report work/<runId>/shim/report.json
    node scripts/plan-fixes.mjs --run <runId>
fix-plan.json groups the remaining findings by file and applies the decisions from step 3.

## 5. Parallel fix (subagents)
Post the FANOUT message. Then, IN ONE TURN, start one shim-fixer subagent per file in
fix-plan.json, all in parallel. Give each one only:
- the absolute path of its one file and the repo root
- that file's findings (ruleId, line, message), copied from fix-plan.json
- the human decisions that apply to it
- the rule: preserve current runtime behavior; edit only this file
Wait for all of them. Each returns a JSON line {file, status, summary}. Post one
PROGRESS line per file as results arrive. If one returns status "blocked", do not
retry blindly: put it in the DECISION flow (step 3) or mark it for the PR body.

## 6. Gates
Start one gate-runner subagent with the repo root and work/<runId>/shim/report.json.
It runs node scripts/gates.mjs and returns gates.json. Rule: every gate that passed
at baseline must still pass. If one regressed, give the failing output to a new
shim-fixer for the file the error names, once. If it still fails, post GATES with
the failure, write an issue-style summary to work/<runId>/issue.md, set status
"blocked", and stop. Never open a PR with a regressed gate.
Post the GATES message.

## 7. Review hand-off (in the room)
    git -C work/<runId>/<name> add -A
    git -C work/<runId>/<name> diff --cached > work/<runId>/diff.patch
Post the HANDOFF message addressing @reviewer. Wait for its VERDICT. If it raises a
blocking issue, fix it with a shim-fixer, re-run gates, and hand off once more. Max 2
review rounds, then ask the human.

## 8. Human approval (gate 2)
Post the APPROVAL message and wait for "approve". Anything else is feedback: apply it,
re-run gates, ask again.

## 9. Open the PR (only after "approve")
    git -C work/<runId>/<name> checkout -b shim/ai-sdk-7-<runId>
    git -C work/<runId>/<name> commit -m "Upgrade to AI SDK 7 (Shim Desk <runId>)"
    git -C work/<runId>/<name> push -u origin shim/ai-sdk-7-<runId>
    gh pr create -R <owner/name> --head shim/ai-sdk-7-<runId> --title "Upgrade to AI SDK 7" --body-file work/<runId>/pr-body.md
Build pr-body.md from work/<runId>/shim/pr-body.md plus the decisions and the review
verdict (node scripts/render.mjs --run <runId> --pr-body). Post the DONE message with
the link.
    node scripts/ledger.mjs --run <runId> --status done --pr <url>
Then update the room document "Upgrade ledger" with the LEDGER line.

## Never
- open a PR on a repo Jayanth doesn't own, or a second PR for the same run
- pass --agent to getshim, or call the claude CLI yourself
- edit files outside work/<runId>/
- invent a result you did not run; if a step fails, post the failure
```

#### 7.3.2 `.claude/skills/desk-reporting/SKILL.md`

```markdown
---
name: desk-reporting
description: Use whenever you post in the Shim Desk room. Defines the exact message formats (ACK, FINDINGS, DECISION, FANOUT, PROGRESS, GATES, HANDOFF, APPROVAL, DONE, LEDGER, FAIL) so humans can skim and the ledger stays consistent.
---

# Desk message formats

Rules: one thread per request. Short sentences. No tables wider than 4 columns
(Mattermost renders Markdown tables; keep them narrow). Never paste more than 15 lines
of tool output: summarize and name the file. Get every number from a script's JSON,
never from memory.
Render with: node scripts/render.mjs --run <runId> --kind <KIND> [--extra key=value]

ACK:       On it: run **{runId}** for `{repo}`. Cloning and scanning now.
FINDINGS:  **{total} findings in {files} files**: {break} break, {silent} silent, {deprecated} deprecated.
           Shim fixes {auto} automatically; {agent} need a code change; {manual} need your call.
           Most important: {one sentence on the top silent finding, with file:line}.
DECISION:  **Decision {i}/{n}: {title}**
           {one-sentence why, with file:line}
           1. {option} (recommended)
           2. {option}
           Reply with the number.
FANOUT:    Shim applied {autoFixed} deterministic fixes. Fixing {k} files in parallel: {file list}.
PROGRESS:  {status emoji: done ✅ / blocked ⛔} `{file}`: {summary, max 12 words}
GATES:     | gate | baseline | after |  (one row per gate, ✅/❌)
           {all green: "Every gate that passed before still passes." | else: what failed}
HANDOFF:   @reviewer please review run **{runId}**: diff `work/{runId}/diff.patch`, findings `work/{runId}/findings.json`, decisions in the ledger. Reply with a verdict line.
APPROVAL:  Ready to open the PR on `{repo}`: {filesChanged} files, +{add}/-{del}. Reviewer: {verdict}.
           Reply **approve**, or tell me what to change.
DONE:      PR opened: {url}. Run **{runId}** logged in the ledger.
LEDGER:    {runId} | {repo} | {findings} findings | decisions: {k} | gates {green}/{total} | {status} | {url or "-"}
FAIL:      ⛔ {step} failed: {one line}. Output saved to `{file}`. {What a human can do next.}
```

#### 7.3.3 `.claude/skills/shim-review/SKILL.md` (reviewer agent)

```markdown
---
name: shim-review
description: Use when the Shim lead hands you a run to review in the Shim Desk room. Reviews the diff for behavior changes against the findings and decisions, and replies with one verdict line.
---

# Review a Shim Desk run

You are read-only. Never edit files. Read work/<runId>/diff.patch,
work/<runId>/findings.json and ledger/<runId>.json.

Check, in order:
1. Every changed line traces to a finding or a recorded human decision. Flag any that doesn't.
2. Behavior is preserved: v6 semantics kept (for example `usage` -> `finalStep.usage`,
   `response.messages` -> `responseMessages` only where full history was meant).
3. No function signature changed (sync -> async, new required params).
4. No test was deleted, skipped or weakened to get green.
5. Lockfile and package.json changes match the bump (ai ^7, @ai-sdk/* majors) and nothing else.

Reply in the thread with exactly one of:
  VERDICT: approve. {one sentence}
  VERDICT: changes. 1) {file:line, issue} 2) ...
At most 5 points. If you are unsure, say what you could not verify.
```

### 7.4 `CLAUDE.md` in `shim-desk` (short; the skills hold the detail)

```markdown
# Shim Desk

This directory is the working directory of the Switch agents shim-lead.jayanth and
shim-reviewer.jayanth. Requests arrive from the Switch room ~shim-desk.

- Upgrades follow the shim-upgrade skill. Messages follow desk-reporting.
- Only touch files under work/<runId>/ and ledger/. Never edit scripts/, .claude/ or switch/ during a run.
- Use `npx -y getshim@0.1.0`. Never pass --agent.
- PRs only on repos owned by JayanthMalladi, only after a human types "approve".
- Installs of target repos use --ignore-scripts (getshim already does this).
- Never use a Fable or Mythos model.
- If a step fails, say so in the room with the output file. Don't produce something plausible.
```

### 7.5 `.claude/settings.json` (project permissions)

Allow the routine commands so Auto mode doesn't ask for each one. Leave `git push` and `gh pr create` **not** allowlisted, so they trigger a Switch permission request in the room. That request is the visible approval moment in the demo.

```json
{
  "permissions": {
    "allow": [
      "Bash(node scripts/*)",
      "Bash(npx -y getshim@0.1.0 *)",
      "Bash(git -C work/* add *)",
      "Bash(git -C work/* diff *)",
      "Bash(git -C work/* status*)",
      "Bash(git -C work/* checkout -b *)",
      "Bash(git -C work/* commit *)",
      "Bash(git clone *)",
      "Bash(gh auth status)",
      "Bash(npm *)",
      "Bash(pnpm *)",
      "Read(./**)",
      "Edit(./work/**)",
      "Edit(./ledger/**)"
    ],
    "deny": [
      "Edit(./scripts/**)",
      "Edit(./.claude/**)",
      "Edit(./switch/**)",
      "Bash(gh pr merge *)",
      "Bash(gh issue *)"
    ]
  }
}
```

`VERIFY` the permission rule syntax against the installed Claude Code version (`/permissions` in a session). `git push` and `gh pr create` are deliberately absent from `allow`. Test it: the push must produce a Switch permission request in the room. If Claude Code's Auto mode approves it silently, add `"ask": ["Bash(git -C work/* push*)", "Bash(gh pr create*)"]`.

---

## 8. Switch configuration (exact text)

### 8.1 Names

| Thing | Value |
|---|---|
| Lead agent | `shim-lead.jayanth`, alias `@shim` |
| Reviewer agent | `shim-reviewer.jayanth`, alias `@reviewer` |
| Room | `shim-desk` (Mattermost channel) |
| Roles | `fixer` (exclusive), `reviewer` (shared) |
| Room document | `Upgrade ledger` |

### 8.2 `switch/lead-instructions.md` (the Switch Agent instructions field)

```
You are the Shim Desk lead. You upgrade repositories through breaking API changes
using the Shim CLI, with humans making the judgment calls. Follow the shim-upgrade
and desk-reporting skills in your working directory exactly.
Introduce yourself the first time you answer someone: "I'm @shim. Ask me to upgrade
a repo to AI SDK 7 and I'll find what breaks, fix it, and open a PR when you approve."
One thread per request. Say what you're doing before any step over 20 seconds.
Hand reviews to @reviewer in the room. Never open a PR without a human "approve".
If something fails, say what failed and where the output is.
```

### 8.3 `switch/room-instructions.md` (Room Instructions; also the room description)

**Description:** `Upgrade repos through breaking API changes. @shim does the work, @reviewer checks it, humans approve.`

```
This room upgrades repositories through breaking API changes (today: Vercel AI SDK 6 -> 7).

How work flows:
1. A person asks @shim: "upgrade ai to v7 in owner/repo".
2. @shim scans with Shim, posts findings, and asks the humans any judgment calls.
3. @shim fixes (Shim's deterministic fixes plus parallel fixer subagents) and runs the repo's gates.
4. @shim hands the diff to @reviewer. @reviewer replies with one VERDICT line.
5. A person replies "approve". Only then does @shim open the PR.
6. @shim logs the run in the "Upgrade ledger" room document.

Conventions:
- One thread per request. Agents post in the request's thread.
- Agents say what they are doing as they go, and say what went wrong instead of guessing.
- Only repos owned by JayanthMalladi. Never comment on or open PRs or issues anywhere else.
- Read the "Upgrade ledger" document before starting a run, to avoid a second PR for the same repo.
```

### 8.4 Roles and room document

- `fixer`: "You hold the repo checkout for a run. Only the holder edits work/<runId>/." Exclusive.
- `reviewer`: "Review diffs handed to you with the shim-review skill. Read-only." Shared.
- Room document `Upgrade ledger`. The **lead creates it** on its first run, because only the creating agent can change a document. Instructions: "Read before starting a run. One line per run in the LEDGER format. Append only." Content starts with the header line `runId | repo | findings | decisions | gates | status | PR`.

### 8.5 `switch/shim-desk.template.yaml` (group template)

This follows docs/TEMPLATES.md (version 1). `VERIFY`: the `advanced_config` keys (`effort`) and whether `model` accepts a full model ID. Check them against the keys Console writes to `.switch/config/<name>.json` after one agent is created by hand. Import the template on **Templates → Import template**.

```yaml
version: 1

params:
  owner:
    type: string
    label: Your short handle (used in agent names)
    default: jayanth
    pattern: "[a-z][a-z0-9-]*"
  directory:
    type: directory
    label: Path to your shim-desk clone
    default: "D:\\shim-desk"
  provider:
    type: provider
    default: [claude]
    input: advanced
  location:
    type: location
    default: local
    input: advanced
  bridge:
    type: bridge
    default: [Mattermost, $first]

agents:
  - name: "shim-lead.{owner}"
    display_name: "shim"
    description: Upgrades a repo through a breaking API change with Shim, and opens a PR after a human approves.
    provider: "{provider}"
    location: "{location}"
    directory: "{directory}"
    model: claude-opus-5-5
    advanced_config: { effort: high }
    auto_mode: true
    auto_approve: false
    addressing: owner-agents
    instructions: |
      (paste switch/lead-instructions.md here verbatim; templates do not include files)
  - name: "shim-reviewer.{owner}"
    display_name: "reviewer"
    description: Reviews Shim Desk diffs for behavior changes before a human approves.
    provider: "{provider}"
    location: "{location}"
    directory: "{directory}"
    model: claude-sonnet-5-5
    advanced_config: { effort: medium }
    auto_mode: true
    auto_approve: false
    addressing: owner-agents
    instructions: |
      (paste switch/reviewer-instructions.md here verbatim)

room:
  name: shim-desk
  description: Upgrade repos through breaking API changes. @shim does the work, @reviewer checks it, humans approve.
  bridge: "{bridge}"
  channel_type: channel_public
  instructions: |
    (paste switch/room-instructions.md here verbatim)
  agents: ["shim-lead.{owner}", "shim-reviewer.{owner}"]
  users: ["{$creator}"]
  aliases:
    "shim-lead.{owner}": shim
    "shim-reviewer.{owner}": reviewer
  roles:
    - name: fixer
      exclusive: true
      instructions: You hold the repo checkout for a run. Only the holder edits work/<runId>/.
    - name: reviewer
      exclusive: false
      instructions: Review diffs handed to you with the shim-review skill. Read-only.

kickoff: |
  @shim-lead.{owner} and @shim-reviewer.{owner}: this is the Shim Desk room. Each of you, introduce yourself in one line.
```

Notes:
- `addressing: owner-agents` is required for the reviewer, so the lead (another of Jayanth's agents) can address it.
- The `aliases` map is keyed by agent name, per the room block reference. `VERIFY` that a templated key (`"shim-lead.{owner}"`) is substituted. If not, hard-code `jayanth` and set the aliases with `!set-alias`.
- Both agents share one directory, which is allowed because credentials are per agent name. The reviewer is read-only (Disallowed tools), so there is no write contention.
- A templated agent on a server with agent management is a **managed agent**, which keeps running when Console quits. `VERIFY` that a managed agent still loads `.claude/skills` from `directory`.

---

## 9. Runtime workflow, in detail

### 9.1 State machine (stored in `ledger/<runId>.json` → `status`)

```
requested → cloning → scanned → awaiting_decision ⇄ (human answers)
         → fixing_deterministic → fixing_parallel → gating
         → in_review ⇄ (fix round, max 2) → awaiting_approval ⇄ (feedback)
         → opening_pr → done
any state → blocked (with reason)   any state → failed (with step + log path)
```

Every transition calls `node scripts/ledger.mjs --run <id> --status <s>`, which also appends `{t, status}` to `events`. The UI reads this.

### 9.2 Commands per step (Windows-safe)

| Step | Command | Output |
|---|---|---|
| new run | `node scripts/new-run.mjs --repo O/N --requested-by H` | stdout JSON `{runId, workDir}`, creates `ledger/<runId>.json` |
| clone | `node scripts/clone.mjs --run R --repo O/N` | `work/R/N/` (uses `git clone --depth 1 https://github.com/O/N.git`) |
| scan | `npx -y getshim@0.1.0 scan work/R/N` (stdout to `work/R/scan.txt`) | text lines, see 9.5 |
| parse | `node scripts/findings.mjs --run R --scan work/R/scan.txt` | `work/R/findings.json`, summary JSON on stdout |
| migrate | `npx -y getshim@0.1.0 migrate work/R/N --out work/R/shim --repo O/N` | `work/R/shim/report.json`, `pr-body.md`; stdout JSON `{verdict, reason, autoFixed, remaining}` |
| plan | `node scripts/plan-fixes.mjs --run R` | `work/R/fix-plan.json` |
| gates | `node scripts/gates.mjs --run R` | `work/R/gates.json` |
| diff | `git -C work/R/N add -A` then `git -C work/R/N diff --cached > work/R/diff.patch` | patch |
| render | `node scripts/render.mjs --run R --kind FINDINGS` | Markdown on stdout, which the agent posts |
| ledger | `node scripts/ledger.mjs --run R --status done --pr URL` | patches JSON |

**On Windows, redirect output inside Node, not the shell.** `scripts/findings.mjs` can accept `--scan-cmd` and run getshim itself with `child_process.spawnSync("npx", ["-y","getshim@0.1.0","scan",dir], {shell:true})`, then write `scan.txt`. Prefer that path, so the agent never depends on shell redirection.

### 9.3 `scripts/render.mjs`

A pure function from `(ledger, findings, gates, kind, extra)` to a Markdown string, implementing the formats in section 7.3.2. It exists so numbers in chat always match the JSON. It is unit-tested in `test/render.test.mjs`.

### 9.4 Script specs

- **`new-run.mjs`**: runId = `r-` + 4-digit zero-padded next integer, based on the existing `ledger/r-*.json`. Refuse if an open run (status not in done/failed/blocked) exists for the same repo. Refuse if a `done` run with a PR already exists for that repo, unless `--force` is given (this mirrors Shim's "never a second PR" rule).
- **`clone.mjs`**: rejects a repo whose owner is not `JayanthMalladi` (case-insensitive) with exit code 2 and the message from skill step 0.
- **`findings.mjs`**: parses either the scan text (regex in 9.5) or `report.json` (`before[]` and `remaining[]` are `Finding` objects: `{ruleId, severity, fix, file, line, snippet, message}`). Writes `findings.json`: `{source, total, files, bySeverity:{break,silent,deprecated}, byFix:{auto,agent,manual}, items:[Finding], top: Finding}`. `top` = first `silent` finding by rule priority `multi-step-result, typed-multi-step-result, response-messages, multi-step-end-event, maybe-*`, then by file and line.
- **`plan-fixes.mjs`**: from `report.json.remaining` (fall back to `findings.json` items with fix `agent`), apply decisions (drop findings whose decision was "leave it"), group by file, and write `{files:[{file, findings:[...], decisions:[...]}]}`. Cap the plan at 12 files. If there are more, the rest go to the PR body as "left for a human".
- **`gates.mjs`**: re-implements Shim's gate order for the one repo. Detect the package manager by lockfile (pnpm/yarn/bun/npm). Install with `--ignore-scripts`. Run `build` if a script exists, then `typecheck` script else `npx --no-install tsc --noEmit -p tsconfig.json`, then `test` if present. It records `{gate: {ok, code, ms, tail}}`, where `tail` is the last 40 lines. It compares against `report.json.baseline` (a map of gate name to boolean) and writes `{baseline, after, regressions:[...]}`. Gate names must match Shim's: `install`, `build`, `typecheck .`, `test .`.
- **`ledger.mjs`**: flags `--status`, `--decision <ruleId> --choice <n> --by <h>`, `--review <approve|changes> --note "..."`, `--pr <url>`, `--gates work/R/gates.json`, `--findings work/R/findings.json`. Writes atomically (temp file plus rename) so the UI never reads half a file.
- **`doctor.mjs`**: checks node ≥ 22, git, `gh auth status` (account `JayanthMalladi`), `docker info`, `claude --version`, that `.switch/` is gitignored, and that `npx -y getshim@0.1.0 --help`-style output works (running `getshim` with no args prints usage and exits 0). Prints a ✅/❌ table. Exit 1 on any ❌.

### 9.5 `getshim@0.1.0` facts (verified 2026-11-05)

- Commands: `scan <dir>`, `fix <dir>`, `migrate <dir> [--agent] [--out <dir>] [--repo <owner/name>] [--arch <arch.json>]`. There is no `--migration` flag in 0.1.0 (it's on main, unreleased). There is no JSON output for `scan`.
- Scan line format: `{file}:{line}  {severity}/{fix}  [{ruleId}]  {message}`. The last line is `{n} findings in {m} files`. Regex: `^(.+?):(\d+)  (break|silent|deprecated)/(auto|agent|manual)  \[([^\]]+)\]  (.*)$`.
- On Shim's own fixture `test/fixtures/v6-app`, it reports **32 findings in 5 files**. Capture this output into `test/fixtures/scan-v6-app.txt` for the parser tests.
- `migrate` installs with `--ignore-scripts`, needs a green typecheck or test at baseline, and runs `npx -y @ai-sdk/codemod@4 v7 .`, which needs network. It edits the target directory in place.
- `migrate` stdout: `{"verdict","reason","autoFixed","remaining"}`. Verdict ∈ `open-pr | open-issue | skip`.
- `report.json` fields: `repo, verdict, reason, versionChanges, library, codemod, autoFixed, before[], remaining[], baseline{}, after{}, regressions[], failures{}, diffStat, changedFiles[]`.

### 9.6 Failure handling

| Failure | Behavior |
|---|---|
| Repo not owned by Jayanth | Refuse (exit 2 from `clone.mjs`). Post the step-0 line. |
| Not on ai@6 (migrate verdict `skip`) | Post FAIL with the reason. Status `blocked`. |
| Baseline install fails | Post FAIL. Suggest checking the repo's lockfile. Status `blocked`. |
| No green typecheck or test at baseline | Post FAIL: "nothing proves behavior is preserved". Status `blocked`. |
| A fixer returns `blocked` | Turn it into a DECISION, or list it in the PR body as left for a human. |
| Gate regressed after 1 repair attempt | Post GATES with ❌. Write `work/R/issue.md`. Status `blocked`. No PR. |
| Reviewer says `changes` twice | Ask the human: "Reviewer still has concerns: …  Approve anyway, or stop?" |
| `git push` or `gh` fails | Post FAIL with stderr tail. Suggest `gh auth status`. Status `failed`. |
| The agent session dies mid-run | The ledger shows the last status. A human types `@shim resume r-000N`, and the skill re-enters at that status, because every step is idempotent on `work/R/`. |

---

## 10. Subagent definitions (Claude Code, `.claude/agents/`)

Front matter keys: `name`, `description`, `tools`, `model`. `model` takes an alias (`sonnet`, `opus`, `haiku`) or a full model ID. Use the full ID, so a future alias change doesn't swap models mid-hackathon. `VERIFY` that the installed Claude Code accepts `claude-sonnet-5-5` in subagent front matter. If not, use `sonnet`.

The Switch agent's **Advanced configuration → Isolation** "affects only subagents". Leave it at the default.

### 10.1 `.claude/agents/shim-fixer.md`

```markdown
---
name: shim-fixer
description: Fixes the AI SDK 7 findings in exactly one file of a target repo, preserving v6 runtime behavior. Started in parallel by the Shim Desk lead, one per file.
tools: Read, Edit, Grep, Glob, Bash
model: claude-sonnet-5-5
---

You fix one file. You get: the repo root, the file path, its findings
(ruleId, line, message), and any human decisions that apply.

Follow the karpathy-guidelines skill (surgical changes, state assumptions, verify).
Rules:
1. Edit only the file you were given. Read others for context if needed.
2. Preserve the current runtime behavior. The goal is "same behavior on v7", not
   "use the new feature". Examples: `result.usage` -> `result.finalStep.usage`;
   `result.response.messages` -> `result.responseMessages` only if the code wanted the
   full history; `require('ai')` -> ESM import when the human chose ESM.
3. Never change a function's signature (sync/async, parameters, return type).
4. Never delete, skip or weaken a test.
5. After editing, run `npx --no-install tsc --noEmit -p tsconfig.json` from the repo
   root if a tsconfig exists, and read only the errors for your file.
6. Do not run installs, git commands, or anything that touches other files.

Reply with exactly one JSON line and nothing else:
{"file":"<path>","status":"done"|"blocked","summary":"<max 12 words>","reason":"<only if blocked>"}
```

### 10.2 `.claude/agents/gate-runner.md`

```markdown
---
name: gate-runner
description: Runs a target repo's gates (install, build, typecheck, test) for a Shim Desk run and compares them to the baseline in Shim's report.json.
tools: Bash, Read
model: claude-sonnet-5-5
---

Run exactly: node scripts/gates.mjs --run <runId>
Then read work/<runId>/gates.json and reply with exactly one JSON line:
{"regressions":[...gate names...],"after":{...gate:boolean...},"failingTail":"<last 20 lines of the first regressed gate, or empty>"}
Do not fix anything. Do not run any other command.
```

---

## 11. Ledger schema (`ledger/schema.json`; the contract with the UI)

One file per run: `ledger/r-0001.json`. This is the **only** interface between the workflow and the UI. Both specs depend on it, so change it only here.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "ShimDeskRun",
  "type": "object",
  "required": ["runId", "repo", "requestedBy", "createdAt", "status", "events"],
  "properties": {
    "runId":       { "type": "string", "pattern": "^r-\\d{4}$" },
    "repo":        { "type": "string", "pattern": "^[^/]+/[^/]+$" },
    "migration":   { "type": "string", "const": "ai-sdk-v7" },
    "requestedBy": { "type": "string" },
    "room":        { "type": "string", "default": "shim-desk" },
    "createdAt":   { "type": "string", "format": "date-time" },
    "updatedAt":   { "type": "string", "format": "date-time" },
    "status": { "enum": ["requested","cloning","scanned","awaiting_decision","fixing_deterministic","fixing_parallel","gating","in_review","awaiting_approval","opening_pr","done","blocked","failed"] },
    "statusReason": { "type": "string" },
    "findings": {
      "type": "object",
      "properties": {
        "total": {"type":"integer"}, "files": {"type":"integer"},
        "bySeverity": {"type":"object","properties":{"break":{"type":"integer"},"silent":{"type":"integer"},"deprecated":{"type":"integer"}}},
        "byFix": {"type":"object","properties":{"auto":{"type":"integer"},"agent":{"type":"integer"},"manual":{"type":"integer"}}},
        "top": { "$ref": "#/$defs/finding" },
        "items": { "type": "array", "items": { "$ref": "#/$defs/finding" } }
      }
    },
    "decisions": { "type": "array", "items": { "type": "object", "required": ["ruleId","question","choice","by","at"],
      "properties": { "ruleId":{"type":"string"}, "question":{"type":"string"}, "options":{"type":"array","items":{"type":"string"}}, "choice":{"type":"integer"}, "by":{"type":"string"}, "at":{"type":"string","format":"date-time"} } } },
    "autoFixed": { "type": "integer" },
    "fixes": { "type": "array", "items": { "type": "object", "properties": { "file":{"type":"string"}, "status":{"enum":["done","blocked"]}, "summary":{"type":"string"}, "agent":{"type":"string","default":"shim-fixer"}, "model":{"type":"string"} } } },
    "gates": { "type": "object", "properties": { "baseline": {"type":"object","additionalProperties":{"type":"boolean"}}, "after": {"type":"object","additionalProperties":{"type":"boolean"}}, "regressions": {"type":"array","items":{"type":"string"}} } },
    "review": { "type": "object", "properties": { "by":{"type":"string"}, "verdict":{"enum":["approve","changes"]}, "notes":{"type":"array","items":{"type":"string"}}, "rounds":{"type":"integer"} } },
    "approval": { "type": "object", "properties": { "by":{"type":"string"}, "at":{"type":"string","format":"date-time"} } },
    "pr": { "type": "object", "properties": { "url":{"type":"string"}, "branch":{"type":"string"}, "filesChanged":{"type":"integer"}, "additions":{"type":"integer"}, "deletions":{"type":"integer"} } },
    "events": { "type": "array", "items": { "type": "object", "required": ["t","kind"], "properties": {
      "t": {"type":"string","format":"date-time"},
      "kind": {"enum":["status","message","decision","fix","gate","review","approval","pr","error"]},
      "actor": {"type":"string", "description": "human handle, shim-lead.jayanth, shim-reviewer.jayanth, or shim-fixer:<file>"},
      "text": {"type":"string"},
      "status": {"type":"string"} } } }
  },
  "$defs": {
    "finding": { "type": "object", "required": ["ruleId","severity","fix","file","line","message"],
      "properties": { "ruleId":{"type":"string"}, "severity":{"enum":["break","silent","deprecated"]}, "fix":{"enum":["auto","agent","manual"]}, "file":{"type":"string"}, "line":{"type":"integer"}, "snippet":{"type":"string"}, "message":{"type":"string"} } }
  }
}
```

Commit a hand-written `ledger/example-r-0000.json` that validates against the schema. The UI uses it as a fixture. A real run's ledger files **are committed** after the demo, so the board on the README/GitHub Pages shows real data.

---

## 12. Demo target repo: `JayanthMalladi/shim-demo-app`

A small, believable app on AI SDK 6 with **green typecheck and tests at baseline**, and seeded findings that span every severity. Start from Shim's fixture `test/fixtures/v6-app` (in `JayanthMalladi/shim`; it scans to 32 findings in 5 files), then make it a real project:

- `package.json`: `"type":"module"`, `"engines":{"node":">=18"}` (this triggers `node-22`), dependencies `ai@^6` and `@ai-sdk/openai@^3` (the npm dist-tag `ai-v6` points at 3.x; verified 2026-11-05), devDependencies `typescript`, `vitest`. Scripts: `typecheck: tsc --noEmit`, `test: vitest run`.
- `tsconfig.json`: strict, ESNext modules.
- Source files copied from the fixture. `src/legacy.cjs` stays (it gives the `esm-only` decision), and so do `src/typed.ts` (silent usage/messages) and `src/messages.ts` (system messages).
- Add `src/billing.ts`: `export function tokensToBill(result) { return result.usage.totalTokens }` with a multi-step `generateText` call. This makes the "silent over-count" story concrete for the video.
- **Tests must not call a real model.** Use `MockLanguageModelV3` from `ai/test` (verified present in ai@6.0.323) with a 2-step tool loop. Assert `tokensToBill` returns the *final step's* tokens, the v6 behavior. After a naive upgrade this test keeps passing on types and fails on value only if the code isn't fixed. That's the proof the fix preserved behavior. If mocking takes more than 2 hours, drop to typecheck-only gates and say so in the README.
- Add `.github/workflows/ci.yml` running typecheck and tests on Node 22.
- `README.md`: one paragraph, "Demo target for Shim Desk".
- Tag `v6-baseline` on the starting commit. To reset between demo takes: `git push origin v6-baseline:main --force` (only on this demo repo), then close the old demo PR by hand.

Acceptance: `npx -y getshim@0.1.0 scan .` reports at least one finding of each of `break/auto`, `break/agent`, `silent/agent` and `manual`, and `npm run typecheck && npm test` is green on Node 22.

---

## 13. Build plan: one Opus lead, parallel Sonnet subagents

### 13.1 Setup for the coding agent

- **Use one Claude Code session for the whole build** (workflow and UI). Give it both spec files. The UI work packages are waves 2–3 of the same plan, and strict file ownership lets them run in parallel with the workflow WPs. Open a second session only if Jayanth wants to watch the UI separately, and then that session must touch only `ui/**`.
- Run Claude Code in `D:\shim-desk` with **model `claude-opus-5-5`** (`claude --model claude-opus-5-5`, or `/model`). The lead plans, writes no large code itself, and reviews every subagent's diff.
- Create the build subagent `.claude/agents/builder.md` (this one is **for building**, distinct from the runtime agents):

```markdown
---
name: builder
description: Implements one work package of the Shim Desk build from 01-WORKFLOW-SPEC.md or 02-UI-SPEC.md, touching only the files that package owns.
tools: Read, Edit, Write, Grep, Glob, Bash
model: claude-sonnet-5-5
---
You implement exactly one work package. Read the spec sections you are given first.
Touch only the files listed as owned by your package. Follow the karpathy-guidelines
skill. Write the tests named in your package, run them, and finish with:
WP <id>: done|blocked, files changed, test command + result, any VERIFY outcomes.
```

- **Lead loop:** for each wave, start every WP in the wave **in one turn, in parallel**, each as a `builder` subagent with its WP id, the spec sections, and the owned files. When they return, the lead reviews the diffs, runs `npm test`, commits per WP (`WP-B: findings parser`), and starts the next wave.
- **File ownership is strict.** Two WPs never own the same file, which is how parallel subagents avoid conflicts without worktrees.

### 13.2 Work packages

| WP | Wave | Owns (files) | Depends on | Acceptance check |
|---|---|---|---|---|
| **A: Env + Switch smoke test** (human + lead, not a subagent) | 0 | `docs/DECISIONS.md` | — | Switch Console runs on Windows, Mattermost opens, a throwaway Claude Code agent answers `@` in a room, and `@agent list your skills` names a test project skill. **Go/no-go for the whole plan.** |
| **B: Scripts core** | 1 | `scripts/new-run.mjs`, `clone.mjs`, `findings.mjs`, `plan-fixes.mjs`, `ledger.mjs`, `test/findings.test.mjs`, `test/plan-fixes.test.mjs`, `test/ledger.test.mjs`, `test/fixtures/scan-v6-app.txt` | — | `npm test` green. The parser yields 32 findings / 5 files from the fixture. Ledger writes are atomic. Owner check rejects non-Jayanth repos. |
| **C: Runtime skills + subagents + CLAUDE.md + settings** | 1 | `.claude/skills/**`, `.claude/agents/shim-fixer.md`, `.claude/agents/gate-runner.md`, `CLAUDE.md`, `.claude/settings.json` | — | Files match sections 7.3, 7.4, 7.5 and 10. `skill-creator` review done. |
| **D: Demo target repo** | 1 | everything in `shim-demo-app` | — | Section 12 acceptance. |
| **E: Ledger schema + example** | 1 | `ledger/schema.json`, `ledger/example-r-0000.json` | — | The example validates (use `ajv-cli` via `npx`, dev only). |
| **F: gates + render + doctor** | 2 | `scripts/gates.mjs`, `scripts/render.mjs`, `scripts/doctor.mjs`, `test/render.test.mjs` | B, E | `node scripts/gates.mjs` on a clone of `shim-demo-app` matches the `baseline` keys in a real `report.json`. Render snapshots for all 11 kinds. |
| **G: Switch config files + template** | 2 | `switch/**` | C | Template imports in Console without errors. If an error appears, fix it and record it in DECISIONS. |
| **UI-1..UI-4** | 2–3 | `ui/**` | E | See `02-UI-SPEC.md`. |
| **H: End-to-end dry run** (lead + human) | 3 | `docs/DECISIONS.md` | all above | A full run in the room on `shim-demo-app` reaches `done` with a real PR. Fix forward, one issue per commit. |
| **I: README, diagram, demo script** | 3 | `README.md`, `docs/architecture.svg`, `docs/demo-script.md` | H (for real numbers) | Section 15.1 outline complete. Every number comes from a real ledger file. |
| **J: Record, blog, submit** (human) | 4 | — | I | Video uploaded, form submitted, #HowISwitch post up. |

### 13.3 Timeline (UTC; deadline 18:29 Nov 7)

| When | What |
|---|---|
| Nov 5, 12:00–15:00 | WP-A go/no-go. If Switch on Windows fails, switch to a remote Linux host the same day. |
| Nov 5, 15:00–22:00 | Wave 1: B, C, D, E in parallel |
| Nov 6, 04:00–12:00 | Wave 2: F, G, UI-1/UI-2 |
| Nov 6, 12:00–20:00 | Wave 3: H (dry runs, fix forward), UI-3/UI-4, I |
| Nov 7, 04:00–10:00 | Final dry run, record the video (2–3 takes), blog draft |
| Nov 7, 10:00–12:00 | Submit. Leave about 6 h of buffer before the deadline. |

---

## 14. Verification checklist (run before recording)

- [ ] `npm run doctor` all ✅ on the demo machine
- [ ] `npm test` green in `shim-desk`
- [ ] `shim-demo-app`: `npm run typecheck && npm test` green on `main` (= `v6-baseline`)
- [ ] `!list-agents` shows both agents. `!agents-status` shows them connected after a first `@`.
- [ ] `@shim list the skills and subagents you have` names all four
- [ ] Full run reaches `done`. PR exists on `shim-demo-app`. Its CI is green.
- [ ] The PR push produced a Switch permission request, and Jayanth allowed it in the room
- [ ] `@reviewer` posted a VERDICT line in the thread
- [ ] `ledger/r-000N.json` validates against the schema. The board shows the run.
- [ ] `git grep -n "SWITCH_API_TOKEN\|ghp_\|sk-ant"` in `shim-desk` is empty, and `.switch/` is not tracked
- [ ] Fresh-clone test: on a second machine or a clean folder, follow the README from zero, import the template, and run one request. Note the elapsed time in the README.

---

## 15. README, demo video, submission

### 15.1 README outline (judge-facing; Presentation is roughly 20% of the score)

1. **Title + one line:** "Shim Desk: upgrade a codebase through a breaking API change, in a team chat, with agents doing the work and humans making the calls."
2. A **GIF or 20-second clip** of the room (from the video).
3. **The problem:** silent breaking changes. One example (`result.usage` over-counts in AI SDK 7, and `tsc` passes).
4. **How Switch is used** (a bulleted list, named explicitly): the room as the shared workspace; two Switch agents with aliases and roles; agent-to-agent hand-off via `@reviewer`; human decisions plus Switch permission requests for the push; room instructions; the "Upgrade ledger" room document; and a one-click group template. Close with: "Without Switch there is no room, no hand-off and no approval trail, just a CLI."
5. **Architecture diagram** (`docs/architecture.svg`, drawn from section 4).
6. **Quickstart (about 10 min):** prerequisites → install Switch Console → local server → clone `shim-desk` → `npm run setup` → import the template (set the directory to your clone) → in Mattermost: `@shim upgrade ai to v7 in <your fork of shim-demo-app>`.
7. **What is real vs demo setup** (a table): real = getshim scan and migrate, the official codemod, gates, subagent fixes, the review, and the PR. Demo setup = the target repo is seeded with known findings, and it's a single-person team playing both humans.
8. **Models:** Opus 5.5 leads, Sonnet 5.5 fixes and reviews. Parallel subagents, one per file.
9. **Ledger board** (link to `ui/`, plus a screenshot).
10. **Built during the hackathon** statement, with a link to the commit history. **Shim itself** (`getshim` on npm) is prior work, used unchanged.
11. Licence.

### 15.2 Demo video script (target 2:30; screen + voice-over)

| Time | Screen | Voice-over (short) |
|---|---|---|
| 0:00–0:15 | Title card, then Mattermost `~shim-desk` | "When an API ships a breaking change, the worst breaks are the silent ones. Shim Desk turns a team chat into the place those get fixed." |
| 0:15–0:30 | Type `@shim upgrade ai to v7 in JayanthMalladi/shim-demo-app` | "I ask the Shim agent, running in Switch, to upgrade our app to AI SDK 7." |
| 0:30–0:55 | FINDINGS message. Zoom in on the top silent finding | "32 findings. This one is the scary one: usage now counts every step, so billing would over-count, and TypeScript says nothing." |
| 0:55–1:10 | DECISION, reply `1` | "Some calls are mine to make. It asks; I answer." |
| 1:10–1:35 | FANOUT and PROGRESS lines | "Shim applies its deterministic fixes, then the lead, on Opus, fans the rest out to Sonnet subagents in parallel, one per file." |
| 1:35–1:50 | GATES table | "Every check that passed before still passes." |
| 1:50–2:05 | HANDOFF → `@reviewer` VERDICT | "A second agent reviews the diff in the same room." |
| 2:05–2:20 | APPROVAL → `approve` → Switch permission request → Allow → DONE with PR link | "Nothing ships until a human approves. Then the PR is up." |
| 2:20–2:30 | Ledger board, then the README "How Switch is used" | "Every run is on the record. Clone it, import the template, and try it." |

Record at 1080p. Keep Mattermost zoomed to 125% so text is readable. Do one clean take after a full dry run, and keep the dry-run take as a backup.

### 15.3 Submission checklist

- [ ] Public repo `JayanthMalladi/shim-desk`, first commit on or after Nov 4
- [ ] README with "How Switch is used" and the quickstart
- [ ] Demo video (YouTube unlisted or Loom), linked in the README and the form
- [ ] Form submitted on the hackathon page, Track: Best Business Workflow
- [ ] Optional: blog post (Best Blog, AirPods), #HowISwitch social post, Switch repo starred (Keychron raffle)

---

## 16. Standing guardrails (carried over from the Shim repo)

- Fixes must preserve the target repo's current runtime behavior.
- Never open a PR unless every gate that passed at baseline still passes.
- Installs of target repos always use `--ignore-scripts`.
- Agents never open, close, edit or comment on PRs or issues on repos Jayanth doesn't own, with any tool.
- Never use a Fable or Mythos model.
- The repo is public: never commit secrets (`.switch/` holds a token).
- Keep chat and PR text short and specific.

## 17. Risks and open questions

| Risk | Likelihood | Mitigation |
|---|---|---|
| Switch Console on Windows (early access) fails | Medium | WP-A first, on day 1. Fallback: a remote Linux host via SSH, or WSL2 with the `.deb`. |
| Managed agent doesn't load project `.claude/skills` | Medium | `VERIFY` in WP-A. Fallback: inline the procedure in Agent instructions (it fits, at about 2 KB). |
| `@ai-sdk/codemod@4` or npm is slow on the demo network | Low | Pre-warm the npx cache with one dry run just before recording. |
| Mock model in tests is hard to set up in ai@6 | Medium | Time-box to 2 h, then use typecheck-only gates and say so. |
| Template key details (`model`, `advanced_config`, templated alias keys) | Medium | Create one agent by hand first, read `.switch/config/<name>.json`, and copy the keys. |
| The judge sees "it's just a CLI in chat" | Medium | Show the two-agent hand-off and the human gates clearly. Lead the README with "How Switch is used". |

## 18. Sources

- Hackathon: https://www.wemakedevs.org/hackathons/switch (+ `/rules`, `/resources`)
- Switch docs index: https://docs.switchagents.ai/llms.txt. Pages used: quickstart, install-switch-console, add-a-server, set-up-agent-providers, onboard-your-agents, agent-settings, create-a-room, work-in-a-room, shared-context, room-commands, room-templates, connectors-and-runtime, troubleshooting
- Switch repo: https://github.com/sandbox-quantum/switch (`docs/TEMPLATES.md`, `examples/agent-templates/triage-pair.template.yaml`)
- Shim: `getshim@0.1.0` on npm (verified), and https://github.com/JayanthMalladi/shim
- Skills: https://github.com/anthropics/skills (marketplace `anthropic-agent-skills`), https://github.com/forrestchang/andrej-karpathy-skills (marketplace `karpathy-skills`)

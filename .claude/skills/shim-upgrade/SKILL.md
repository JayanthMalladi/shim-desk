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
Post the HANDOFF message addressing @shim-reviewer.jayanth. Wait for its VERDICT. If it raises a
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

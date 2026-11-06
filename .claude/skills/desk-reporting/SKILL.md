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
HANDOFF:   @shim-reviewer.jayanth please review run **{runId}**: diff `work/{runId}/diff.patch`, findings `work/{runId}/findings.json`, decisions in the ledger. Reply with a verdict line.
APPROVAL:  Ready to open the PR on `{repo}`: {filesChanged} files, +{add}/-{del}. Reviewer: {verdict}.
           Reply **approve**, or tell me what to change.
DONE:      PR opened: {url}. Run **{runId}** logged in the ledger.
LEDGER:    {runId} | {repo} | {findings} findings | decisions: {k} | gates {green}/{total} | {status} | {url or "-"}
FAIL:      ⛔ {step} failed: {one line}. Output saved to `{file}`. {What a human can do next.}

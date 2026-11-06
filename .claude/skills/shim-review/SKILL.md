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

Reply in the thread, addressing the lead so it continues the run, with exactly one of:
  @shim-lead.jayanth VERDICT: approve. {one sentence}
  @shim-lead.jayanth VERDICT: changes. 1) {file:line, issue} 2) ...
At most 5 points. If you are unsure, say what you could not verify.

# Demo video script (target 2:30; screen + voice-over)

> 01-WORKFLOW-SPEC §15.2, verbatim. Fill `{{...}}` once the WP-H dry run lands.

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

## Real-run fill-ins (post-WP-H)
- `{{findings_total}}` findings in `{{findings_files}}` files (from `ledger/r-000N.json`), incl. `{{silent_count}}` silent.
- `{{top_silent}}`: the "Most important silent change" line (file:line + rule).
- `{{decision_q}}` / choice `{{decision_choice}}`.
- `{{fanout_auto}}` deterministic fixes + `{{fanout_files}}` files fixed in parallel.
- `{{gates_green}}/{{gates_total}}` gates; `{{verdict}}` reviewer line.
- PR link `{{pr_url}}`.

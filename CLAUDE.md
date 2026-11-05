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

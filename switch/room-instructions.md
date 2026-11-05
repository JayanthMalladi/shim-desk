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

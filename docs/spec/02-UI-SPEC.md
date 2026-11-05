# Shim Desk: UI Build Spec (the Ledger Board)

**Read `01-WORKFLOW-SPEC.md` first.** That file is the source of truth for the product, the ledger schema (its section 11), the build orchestration (its section 13) and the deadline. This file covers only the UI. Where the two disagree, the workflow spec wins.

**Spec version:** 1.0, 2026-11-05.

---

## 0. What the UI is, and what it is not

The chat room is the product. The judges score "Use of Switch", so **the UI must never replace the room.** Nobody starts, approves or chats from the board.

The **Ledger Board** is a **read-only** web page that shows every Shim Desk run as it moves through the room: who asked, what Shim found, which calls the humans made, which subagents fixed which files, whether the gates held, what the reviewer said, and the PR link. It exists for three reasons:

1. **The demo video.** It's the final shot: the run goes green on the board while the PR link sits in the room.
2. **The README.** It gives a screenshot plus a static build on GitHub Pages that shows real, committed runs.
3. **The pitch.** The ledger is the audit trail, the "what did we decide on the last upgrade, and who approved it" record.

**Priority: P1.** Build it only after the workflow WPs B, C and F are green. If time runs out, ship the README with a screenshot of the static build, or drop the board entirely. The workflow alone is a complete entry.

---

## 1. Data source

- **Input:** `ledger/r-*.json` files in the `shim-desk` repo, one per run, matching `ledger/schema.json` (workflow spec section 11). The UI writes nothing.
- **Dev mode (`npm run ui`):** a tiny Vite plugin serves two routes from the parent folder:
  - `GET /api/runs` returns an array of runs sorted by `createdAt` descending (full objects; there are few runs)
  - `GET /api/runs/:runId` returns one run
  - The plugin reads files on every request (no cache), so polling sees live changes. Skip files that fail to parse and log a warning: the workflow writes atomically, so this should never happen, but don't crash on it.
- **Static build (`npm run ui:build`):** a build hook copies every `ledger/r-*.json` plus an `index.json` (the sorted list) into `ui/dist/data/`. The app reads `data/index.json` and `data/<runId>.json`. `ui/dist` deploys to GitHub Pages via a workflow (section 8).
- **Live updates:** in dev mode, poll `/api/runs` every **2 s** while the tab is visible (`document.visibilityState`). The static build does not poll.
- **Fixture:** `ledger/example-r-0000.json` (workflow WP-E). Tests and empty-state screenshots use it.

**The data access is one module**, `ui/src/data.ts`, exporting `listRuns(): Promise<Run[]>` and `getRun(id): Promise<Run>`. It switches on `import.meta.env.DEV`. No component fetches directly.

---

## 2. Stack (pin exact versions)

| Piece | Choice | Why |
|---|---|---|
| Build | Vite `5.4.10` | Fast, with a simple plugin hook for `/api` |
| UI | React `18.3.1` + React DOM `18.3.1` | Known, stable |
| Language | TypeScript `5.6.3` | Types generated from the schema |
| Routing | none. Use hash routes (`#/`, `#/run/r-0001`) handled in `App.tsx` | Works on GitHub Pages with no config |
| Styling | Plain CSS with custom properties in `ui/src/styles.css` | No Tailwind or UI kit to fight. The look is set in section 4. |
| Types | `json-schema-to-typescript` `15.0.2` (dev), run as `npm run types` to `src/types.ts` | One source of truth: the schema |
| Tests | Vitest `2.1.4` + @testing-library/react `16.0.1` (unit), Playwright (preinstalled browser, or `@playwright/test` `1.48.2`) (e2e) | The `webapp-testing` skill drives the e2e |

`VERIFY` each version exists with `npm view <pkg>@<ver> version` before pinning. If one doesn't, take the nearest older patch and record it in `docs/DECISIONS.md`.

No other runtime dependencies. Format dates with `Intl.DateTimeFormat` and relative times with `Intl.RelativeTimeFormat`.

---

## 3. Files (owned by the UI work packages)

```
ui/
├── package.json            # name shim-desk-ui, private, scripts: dev, build, preview, test, e2e, types
├── vite.config.ts          # base: './' ; plugin ledgerApi() (dev) ; plugin copyLedger() (build)
├── tsconfig.json
├── index.html              # <title>Shim Desk Ledger</title>
├── plugins/
│   └── ledger.ts           # ledgerApi() + copyLedger(); reads ../ledger relative to ui/
├── src/
│   ├── main.tsx
│   ├── App.tsx             # hash router: RunsPage | RunPage | NotFound
│   ├── data.ts             # listRuns / getRun (dev API vs static data/)
│   ├── types.ts            # GENERATED from ../ledger/schema.json, do not edit
│   ├── format.ts           # status labels, colors, relative time, severity labels
│   ├── styles.css          # tokens + layout
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── StatusPill.tsx
│   │   ├── RunCard.tsx
│   │   ├── StageTrack.tsx       # the pipeline progress track
│   │   ├── FindingsSummary.tsx  # severity bars + top silent finding
│   │   ├── FindingsTable.tsx    # collapsible full list
│   │   ├── DecisionList.tsx
│   │   ├── FixGrid.tsx          # one tile per file the subagents fixed
│   │   ├── GatesTable.tsx       # baseline vs after
│   │   ├── ReviewCard.tsx
│   │   ├── PrCard.tsx
│   │   └── Timeline.tsx         # events[], newest last
│   └── pages/
│       ├── RunsPage.tsx
│       └── RunPage.tsx
└── test/
    ├── format.test.ts
    ├── RunPage.test.tsx     # renders the fixture, asserts the key numbers
    └── e2e.spec.ts          # Playwright: dev server, list -> detail, live update
```

---

## 4. Look and feel

Use the `frontend-design` skill (from `example-skills@anthropic-agent-skills`) for execution, inside these constraints:

- **Feel:** a calm operations ledger. Think a well-made CI dashboard crossed with a paper logbook. Light by default, with full dark mode via `prefers-color-scheme`. Lean on type and spacing, not decoration.
- **No AI-slop tells:** no purple gradients, glows, gradient text, emoji section labels, glassy blobs, or pulsing elements. The single exception is one subtle "live" dot on runs whose status is in progress.
- **Type:** system UI stack for text, and `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` for file paths, rule ids and run ids. Base size 15px, line height 1.5.
- **Tokens** go in `styles.css` on `:root`, redefined under `@media (prefers-color-scheme: dark)`:

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#FAFAF7` | `#121212` | page |
| `--surface` | `#FFFFFF` | `#1B1B1B` | cards |
| `--border` | `#E6E4DE` | `#2C2C2C` | hairlines |
| `--text` | `#1C1B19` | `#EDEDEA` | body |
| `--muted` | `#6B6862` | `#A3A09A` | secondary |
| `--accent` | `#2F5D50` | `#7FB8A6` | links, active stage |
| `--ok` | `#2E7D4F` | `#5CC48A` | gates green, done |
| `--warn` | `#B26B00` | `#E0A240` | awaiting human |
| `--bad` | `#B3261E` | `#F2766E` | regressions, failed |
| `--silent` | `#7A4FB5` | `#B79BE0` | the silent severity only (it's the story, so it gets its own color) |

- **Severity colors:** break = `--bad`, silent = `--silent`, deprecated = `--muted`.
- **Radius** 8px on cards, 999px on pills. **Spacing scale** 4/8/12/16/24/32/48.
- **Layout:** max content width 1040px, centred, with a 16px side gutter on phones and no horizontal scroll. Tables scroll inside their own container on narrow screens.
- **Accessibility:** WCAG AA contrast for text, every status shown by text as well as color, focus rings visible, and all controls reachable by keyboard.

---

## 5. Screens

### 5.1 Runs page (`#/`)

- **Header:** "Shim Desk Ledger" on the left. On the right: a "Live" badge (dev mode only, showing the poll state) and a link "How this works" pointing to the repo README.
- **Summary strip** (4 stat tiles): Runs, PRs opened (`status=done` with `pr.url`), Human decisions (sum of `decisions.length`), Silent breaks caught (sum of `findings.bySeverity.silent`). Compute the numbers from the data and never hard-code them.
- **Run list:** one `RunCard` per run, newest first. Each shows:
  - `runId` (mono) · `repo` · relative time · `StatusPill`
  - a one-line `StageTrack` (compact variant)
  - chips: `{total} findings`, `{silent} silent` (in `--silent`), `{decisions.length} decisions`, gates `{green}/{total}`
  - the PR link, if present
  - the whole card links to `#/run/<runId>`
- **Empty state:** "No runs yet. In the ~shim-desk room, ask `@shim upgrade ai to v7 in <your repo>`." This copy should match the README quickstart.
- **Error state:** if `/api/runs` fails, show "Can't read the ledger folder" with the error text, and keep polling.

### 5.2 Run page (`#/run/:runId`)

Top to bottom:

1. **Title row:** `runId`, `repo` (linked to `https://github.com/<repo>`), `StatusPill`, "requested by {requestedBy} · {absolute time}". If status is `blocked` or `failed`, show a banner with `statusReason`.
2. **`StageTrack` (full):** the stages in order, `Requested → Scanned → Human calls → Shim fixes → Parallel fixes → Gates → Review → Approval → PR`. Map the ledger `status` onto stages with the table in section 6. Completed stages are solid `--ok`, the current one `--accent` (or `--warn` when waiting on a human), and future ones hollow. Each stage shows its timestamp from `events` on hover and focus.
3. **Two-column grid** (collapsing to one column under 760px):
   - **Left:** `FindingsSummary`. Three horizontal bars by severity with counts, a line for `byFix` (auto / agent / manual), and a highlighted box with `findings.top` showing `file:line`, `ruleId` and the message, labelled "Most important silent change". Below that, a `FindingsTable` (collapsed by default) with all items: file, line, severity, fix, rule, and the message truncated to one line with the full text in a `title` attribute.
   - **Right:** `DecisionList`. Each decision shows the question, the options with the chosen one marked, "{by} · {time}". When there are no decisions, show "No human calls needed".
4. **`FixGrid`:** "Shim fixed {autoFixed} sites deterministically. {k} files fixed in parallel by Sonnet subagents." One tile per `fixes[]` entry with the mono file path, the status (done/blocked), the summary, and the model (`fixes[].model`, e.g. `claude-sonnet-5-5`, shown small). Tiles appear in the order of their `fix` events, so the video shows the parallel finish order.
5. **`GatesTable`:** rows = union of `gates.baseline` and `gates.after` keys, columns = Gate · Baseline · After, cells ✅/❌ plus text ("pass"/"fail") for accessibility. Any row in `gates.regressions` gets a `--bad` left border. Footer text: "Every gate that passed before still passes" when `regressions` is empty, otherwise "Regressed: {list}".
6. **`ReviewCard`:** reviewer name (`review.by`), verdict pill (approve = `--ok`, changes = `--warn`), numbered notes, "round {rounds}".
7. **`PrCard`:** the approval line "Approved by {approval.by} · {time}", then the PR link button, branch (mono), files changed, +additions / −deletions.
8. **`Timeline`:** every `events[]` entry, oldest first. Each shows the time, an actor avatar (an initial in a circle; the color comes from a hash of the actor name, chosen from the 4 neutral tokens, never random at render), the actor name, the kind label and the text. Agents are labelled "agent" and humans "person", inferred from the actor string: it's an agent if it starts with `shim-` or `shim-fixer:`. This makes the human/agent collaboration visible at a glance, which is the hackathon's thesis.

A sticky "← All runs" link sits at the top.

---

## 6. Status → stage mapping (`format.ts`)

| `status` | Stage index (0–8) | Stage state | Pill text | Pill color |
|---|---|---|---|---|
| requested, cloning | 0 | current | Starting | accent |
| scanned | 1 | current | Scanned | accent |
| awaiting_decision | 2 | waiting | Needs a human call | warn |
| fixing_deterministic | 3 | current | Shim fixing | accent |
| fixing_parallel | 4 | current | Subagents fixing | accent |
| gating | 5 | current | Running gates | accent |
| in_review | 6 | current | In review | accent |
| awaiting_approval | 7 | waiting | Waiting for approval | warn |
| opening_pr | 8 | current | Opening PR | accent |
| done | 8 | all complete | PR opened | ok |
| blocked | stage of last non-blocked status in `events` | stopped | Blocked | warn |
| failed | stage of last non-failed status in `events` | stopped | Failed | bad |

Unit-test every row in `test/format.test.ts`.

---

## 7. Work packages (run as parallel `builder` subagents under the Opus lead; workflow spec section 13)

| WP | Wave | Owns | Depends on | Acceptance |
|---|---|---|---|---|
| **UI-1: Scaffold + data layer** | 2 | `ui/package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `plugins/ledger.ts`, `src/main.tsx`, `src/App.tsx`, `src/data.ts`, `src/types.ts` (generated) | workflow WP-E | `npm run dev` serves `/api/runs` with the fixture. `npm run build` emits `dist/data/index.json`. Types generate from the schema. |
| **UI-2: Tokens + primitives** | 2 | `src/styles.css`, `src/format.ts`, `components/Header.tsx`, `StatusPill.tsx`, `StageTrack.tsx`, `test/format.test.ts` | — | Status mapping tests pass. Light and dark both meet AA (check with the browser's contrast tool). |
| **UI-3: Runs page + run page sections** | 3 | `pages/**`, `components/RunCard.tsx`, `FindingsSummary.tsx`, `FindingsTable.tsx`, `DecisionList.tsx`, `FixGrid.tsx`, `GatesTable.tsx`, `ReviewCard.tsx`, `PrCard.tsx`, `Timeline.tsx`, `test/RunPage.test.tsx` | UI-1, UI-2 | The fixture renders. Numbers match the fixture JSON. Empty and error states render. 375px width has no horizontal scroll. |
| **UI-4: E2E + Pages deploy + screenshots** | 3 | `test/e2e.spec.ts`, `.github/workflows/pages.yml` (repo root, owned by UI-4 only), `docs/board-*.png` | UI-3, a real run (workflow WP-H) for final screenshots | Playwright: open `/`, see the fixture card, click into it, see the gates table. Live test: write a new `ledger/r-9999.json` during the test, see it appear within 3 s, then delete it. Pages deploys from `main`. Screenshots taken at deviceScaleFactor 2. |

UI-1 and UI-2 have no file overlap and run in parallel. UI-3 starts after both. The lead reviews each diff and runs `npm --prefix ui test` before committing.

---

## 8. GitHub Pages deploy (`.github/workflows/pages.yml`)

- Trigger: push to `main` touching `ui/**` or `ledger/**`, plus manual dispatch.
- Steps: checkout → setup-node 22 → `npm ci --prefix ui` → `npm run build --prefix ui` → upload `ui/dist` with `actions/upload-pages-artifact` → `actions/deploy-pages`.
- Enable Pages in the repo settings (Source: GitHub Actions). Jayanth does this by hand once.
- `vite.config.ts` must use `base: './'` so asset paths work under `/shim-desk/`.
- Put the Pages URL in the README under "Ledger board".

---

## 9. Done means

- [ ] `npm run ui` shows a live run updating within 2 s while the room works on it (show this side by side with Mattermost in the video)
- [ ] The static build on Pages shows the committed demo run(s)
- [ ] No horizontal scroll at 375px. Dark mode correct. Keyboard navigation works.
- [ ] `npm --prefix ui test` and the e2e both green
- [ ] Two screenshots in `docs/` (runs page, run page) are used in the README
- [ ] Nothing in the UI can trigger an action. It's read-only, with no forms and no buttons that call anything.

# A. Refined ledger

**Idea:** today's board, tightened: same tokens and layout, with a story line under the title, a connected stage track and one log where people and agents look different.

**Skills:** taste-skill gave one system and equal edges (every card 24px in, one radius). Hallmark's floor removed tracked-caps table heads, decorative status dots and middle-dot meta strings, and asked for token-only colour. ui-ux-pro-max (data-dense dashboard, app pre-delivery checklist) set the table density, tabular numbers and the "status in text as well as colour" rule.

**Type scale:** 12 / 13.5 / 15 / 17 / 24, stats 32. **Spacing:** 4 / 8 / 12 / 16 / 24 / 32 / 48.

**What changes vs today**
- Header: wordmark plus "ledger", one link. The "Live" dot stays dev-only (not in the mockup).
- Run page title: adds a one-sentence story line built from the data (found, silent, human calls, gates held).
- Stage track: connected line with ticks and the recorded time under each stage.
- Gates: a gate with no baseline value shows "not run" (today it shows "fail" for `build`, which is wrong for r-0001).
- Human calls: an empty `question` falls back to the scanner's own message for that rule.
- Review and PR sit side by side. Timeline: humans get a round amber avatar and bold text; agents a square green one.

**Needs component changes when porting:** StageTrack (times under labels), GatesTable (`undefined` = "not run"), DecisionList (finding fallback), Timeline (merge `decisions[]` and `approval` into the log), RunPage (story line).

**Self-check**
- [pass] AA contrast, light and dark. Lowest: 5.14 (amber "2 calls"), 5.19 (silent label), 5.24 (PR opened pill).
- [pass] No horizontal scroll at 375px (scrollWidth 375).
- [pass] Keyboard focus visible (`:focus-visible` outline, stages are focusable with their time in `title`).
- [pass] Every status has text: pass/fail/not run, done, person/agent, PR opened.
- [pass] Hallmark sloplint `--scope app`: 0 FAIL, 0 REFLEX, 3 WARN (meta false positives), 1 dismissed (silent box).
- [pass] No landing-page elements. [pass] All numbers come from r-0001.json (rendered live from data/r-0001.json).

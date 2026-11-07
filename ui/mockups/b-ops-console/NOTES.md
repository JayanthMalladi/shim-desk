# B. Ops console

**Idea:** dark-first and denser, built for the split-screen video shot: a status rail across the top, the work on the left and the PR plus the person/agent log pinned on the right.

**Skills:** ui-ux-pro-max's "data-dense dashboard" style set the density (14px body, 4px radius, tight tables, sticky side panel). taste-skill kept it to one system. Hallmark pushed mono back to ids, numbers and gate names only (labels and table heads went back to the body face) and caught off-scale spacing.

**Type scale:** 11.5 / 13 / 14 / 15 / 22, stats 28, JetBrains Mono for figures. **Spacing:** 4 / 8 / 12 / 14 / 20 / 28 / 40. Max width 1320.

**What changes vs today**
- Header: mono wordmark with a hairline under it. Stats: one joined strip, figures in mono.
- Stage track: nine flush rail segments with label and time; compact rail on the run card.
- Layout: two columns at 1101px and up; the right column holds the PR card and the timeline and stays in view while you scroll. At 960 (split-screen) it stacks in one column.
- Gates "not run", decision fallback and the merged log are the same as A.

**Needs component changes when porting:** RunPage (two-column console layout, PR card moved to the side), StageTrack (rail variant), plus the same GatesTable / DecisionList / Timeline / story-line changes as A. Dark becomes the default, so tokens move: dark on `:root`, light under `prefers-color-scheme: light`.

**Self-check**
- [pass] AA contrast, dark and light. Lowest real text: 4.63 (agent avatar letter, light), 4.73 (PR opened pill, light), 4.86 (back link, light). Dark mode lowest is 6.96.
- [pass] No horizontal scroll at 375px.
- [pass] Keyboard focus visible.
- [pass] Every status has text as well as colour.
- [pass] Hallmark sloplint `--scope app`: 0 FAIL, 0 REFLEX, 1 WARN, 1 waived (7b white light-mode cards), 1 dismissed.
- [pass] No landing-page elements. [pass] All numbers from r-0001.json.

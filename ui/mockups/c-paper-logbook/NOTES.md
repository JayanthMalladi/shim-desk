# C. Paper logbook (getshim.dev brand)

**Idea:** the board as Shim's signed logbook, in the getshim.dev look: warm paper, ink-outlined cards with the site's offset shadow, Bricolage Grotesque heads, and the brand yellow used only to mark what people did.

**Skills:** Hallmark treated the getshim.dev brand as material (palette, face, outline and shadow), never as a page plan, so no hero or CTA came across. taste-skill kept one card recipe and equal edges. ui-ux-pro-max's checklist drove the dark-mode fix (the yellow marker becomes yellow text on dark).

**Type scale:** 12 / 13.5 / 15 / 19 / 21 story / 30, stats 40 (Bricolage). **Spacing:** 4 / 8 / 12 / 16 / 24 / 32 / 56.

**What changes vs today**
- Header: the wedge mark plus wordmark. Stats: big Bricolage figures; "human calls" gets a yellow marker underline.
- Title: the story line is set large in Bricolage, the human count marked in yellow.
- Stage track: stamped boxes in a bordered strip.
- PR card is mint-filled (brand "good"). Timeline becomes a "Signed log": ruled rows, time in a red margin, the text first and "signed <name>" under it. People's rows are tinted yellow with a yellow edge.

**Needs component changes when porting:** Timeline (signed-row markup, merged decisions and approval), StageTrack, RunPage (story line), Header (mark), plus GatesTable / DecisionList as in A. Adds one Google Font (Bricolage Grotesque).

**Self-check**
- [pass] AA contrast, light and dark. Lowest: 4.73 (PR opened pill, light), 4.73 (+244), 4.98 (−203).
- [pass] No horizontal scroll at 375px.
- [pass] Keyboard focus visible (orange focus ring, the brand's wedge colour).
- [pass] Every status has text as well as colour.
- [pass] Hallmark sloplint `--scope app`: 0 FAIL, 0 REFLEX, 2 WARN (false positives), 1 dismissed.
- [pass] No landing-page elements. [pass] All numbers from r-0001.json.

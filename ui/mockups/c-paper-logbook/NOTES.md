# C — Paper logbook (getshim.dev brand)

Warm, ruled paper logbook in the getshim.dev brand: ink text on cream paper, ruling lines, yellow #FFD84D reserved for large marks (spine strip, card tabs, pill dots, avatar rings), and a signed-log timeline where agents = ringed discs and persons = filled discs.

## Skill → choice
- taste-skill: one design system, plain copy, quiet micro-interactions (card border step, link colour step, one :active press) — dashboard scope, no landing/hero/shader.
- hallmark Floor: every colour/font through a token (tokens.css), no `transition: all`, `overflow-x: clip` on html+body, `:focus-visible` on every interactive incl. stage items, reduced-motion block, no invented metrics.
- ui-ux-pro-max: e-ink-paper style (dark mode "not recommended" → adapted: dark = warm charcoal paper, kept because the spec mandates dark mode — conflict logged); dashboard data-display patterns (stat tiles, scrollable tables, status pills always text+colour); no horizontal scroll at 375; AA contrast in both themes.

## Type + spacing
- Heads: Bricolage Grotesque (Google Fonts link; 800 page titles, 700 section heads). Body: system stack. Mono: ui-monospace stack.
- Scale: 34/18/15/13.5/12px (rem at 15px base). Spacing: 4/8/12/16/24/32/48 (--s1…--s7).

## Changes vs today (ui/src)
- Tokens: paper palette replaces the cool spec palette; added --border-strong, --rule, --accent-soft, --text-yellow, status tints; stage "current" marker = yellow ring; timeline entries gained the signed-log treatment (ringed vs filled avatar, ruling connector, signer chips); stat figures in Bricolage 800 tabular.
- Components (port notes): Timeline needs the agent/person avatar classes + connector (markup+CSS, not just CSS); FindingsTable needs a `<details>` collapsible (component change); everything else ports via tokens.css + styles.css.

## Self-check
- AA contrast (lowest 3, computed by contrast.mjs): light 4.96 (ok on surface) / 5.15 (warn on surface) / 5.30 (text-yellow on accent-soft); dark 6.21 / 6.50 / 6.87. PASS (warn light deepened #b26b00→#9a5f00 to clear 4.5).
- No horizontal scroll at 375px: PASS (scrollWidth=clientWidth at 375/960/1440, both pages; tables scroll in .table-scroll).
- Keyboard focus visible: PASS (`:focus-visible` ring on links/stage items/summary/pr-link).
- Every status text+colour: PASS (pills, chips, gate cells, verdicts all carry text; silent stays its own hue, distinct from break/deprecated).
- sloplint (static; --render not runnable here — no puppeteer-core): `0 FAIL, 1 REFLEX, 6 WARN`. REFLEX 24b .chip `padding: 1px 10px` + gate-cell 9px padding waived: they mirror production styles.css look. 5 stripe WARNs (.top-finding/.fix-tile/.alert/gate rows side stripes) waived: the status colour stripe is the logbook signature, matches spec §4/§5. WARN F7 (shared card recipe) is a finish note, intentional.
- No landing-page elements: PASS (no hero/CTA/pricing/testimonials/photos; read-only, links only).
- All numbers match r-0001.json: PASS (30 findings, 18 silent, 11 break, 1 deprecated, 12/16/2 byFix, autoFixed 12, 6 fix tiles, gates 4/4, round 3, PR #1 +244/−203, 6 events, 2 decisions — rendered from the fetched JSON, verified in screenshots).

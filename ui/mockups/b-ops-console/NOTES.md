# B — Ops console

**Idea.** A dense, dark-first ops console re-skin: thin status-rail stage track, 13px type, mono accents, no glows.

**Skills.** hallmark floor (token discipline, no `transition: all`, focus-visible, overflow-x clip, no landing) shaped every rule; design-taste-frontend (one system, equal edges, quiet micro-interactions — its landing/scroll-scene parts skipped, it's a dashboard); ui-ux-pro-max dark-mode/contrast + dense-dashboard (stat tiles, tables, timelines) shaped the 4-up stat strip and 2-col detail grid.

**Type scale.** Base 13px / lh 1.45; h1 1.15rem, section head 0.95rem, body 0.85rem, meta 0.75rem. UI: system stack; mono: JetBrains Mono (one Google Fonts family).

**Spacing scale.** 4/8/12/16/20/28/40px (`--s1`–`--s7`).

**Theme mechanism.** Dark is the `:root` base; light is a `@media (prefers-color-scheme: light)` override of the same token names. No JS theme toggle in the mockup.

**Section changes vs today.** Tighter padding; status-rail replaces dotted track (solid/hollow/warning markers on a 2px line, timestamps via `title` + focus); 4-up stat tiles; 2-col findings/decisions grid; square-vs-round avatars for agent vs person.

**Porting notes (component, not just CSS).** `StageTrack` → `.stage-rail` rail model; `Timeline` avatars square (agent) vs round (person); `PrCard` link uses `--on-surface`. Everything else is token swap.

**Skill conflicts logged.** 24b off-scale spacing (waived — brief mandates 13px dense rhythm; on-record above, not a CSS waiver line); 26b no `:active` (added `:active` on links). 7b pure-#fff light tints fixed by tinting tokens, no waiver.

## Self-check
- AA contrast (3 lowest, computed `contrast.cjs`): **dark** muted/raised 6.31 · accent 6.35 · bad 6.54; **light** warn 5.76 · ok 6.01 · muted 6.20 — all ≥4.5 PASS
- No horizontal scroll at 375px PASS (tables scroll in `.table-scroll`)
- Keyboard focus visible PASS (`:focus-visible` ring)
- Every status shown as text + colour PASS
- hallmark sloplint: `0 FAIL, 2 WARN` (side-stripe WARNs kept: gates/regression design per spec)
- No landing-page elements PASS
- All numbers match r-0001.json PASS (data-driven inline render)

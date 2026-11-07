// WCAG contrast checker for the ACTUAL text/background pairs the mockup
// uses. Run: node contrast-check.cjs  (self-contained, no deps).
// Every value is a token pair declared in tokens.css; the tint mixes
// replicate what color-mix() resolves to in the browser.
"use strict";
const hex = (h) => { const s = h.replace(/^#/, "").toUpperCase(); return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255); };
const lum = (rgb) => { const [r, g, b] = rgb.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (fg, bg) => { const L1 = lum(hex(fg)), L2 = lum(hex(bg)); const hi = Math.max(L1, L2), lo = Math.min(L1, L2); return (hi + 0.05) / (lo + 0.05); };
// color-mix(in srgb, X p%, Y)
const mix = (hA, p, hB) => { const a = hex(hA), b = hex(hB); return a.map((c, i) => Math.round((c * p + b[i] * (100 - p)) / 100 * 255).toString(16).padStart(2, "0")).join("").toUpperCase(); };

const L = { surface: "FFFFFF", bg: "FAFAF7", text: "1C1B19", muted: "6B6862", accent: "2F5D50", ok: "2E7D4F", warn: "B26B00", bad: "B3261E", silent: "7A4FB5", prOn: "F7F5F0" };
const D = { surface: "1B1B1B", bg: "121212", text: "EDEDEA", muted: "A3A09A", accent: "7FB8A6", ok: "5CC48A", warn: "E0A240", bad: "F2766E", silent: "B79BE0", prOn: "121212" };

// pairs: [label, foreground, background (may be a tint mix)]
const pairs = (T, name) => [
  ["body text on surface", T.text, T.surface],
  ["body text on page bg", T.text, T.bg],
  ["muted on surface", T.muted, T.surface],
  ["link/accent on surface", T.accent, T.surface],
  ["silent chip text (raw) on surface", T.silent, T.surface],
  ["gates pass text (raw --ok) on surface", T.ok, T.surface],
  ["gates fail text (raw --bad) on surface", T.bad, T.surface],
  ["fix-tile status (--ok-text 8% mix) on surface", mix(T.ok, 8, T.text), T.surface],
  ["fix-tile status blocked (--warn-text 8% mix) on surface", mix(T.warn, 8, T.text), T.surface],
  ["PR button label (--surface-on-accent) on --accent", T.prOn, T.accent],
  ["pill text (--text) on 4% status tint", T.text, mix(T.ok, 4, T.surface)],
  ["top-finding label (--silent) on 6% silent tint", T.silent, mix(T.silent, 6, T.surface)],
];

const out = [];
for (const [name, T] of [["LIGHT", L], ["DARK", D]])
  for (const [label, fg, bg] of pairs(T, name))
    out.push({ label: `${name} ${label}`, r: ratio(fg, bg) });

out.sort((a, b) => a.r - b.r);
for (const o of out) console.log(o.r.toFixed(2).padStart(5), ":", o.label);
const low3 = out.slice(0, 3).map((o) => o.r.toFixed(2));
console.log("--- 3 lowest:", low3.join(", "));
console.log("AA 4.5 pass:", out.every((o) => o.r >= 4.5) ? "YES" : `NO (${out.filter((o) => o.r < 4.5).map((o) => o.label).join(" | ")})`);

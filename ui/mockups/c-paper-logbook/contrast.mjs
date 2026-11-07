// Compute WCAG contrast ratios for the token pairs actually used on the
// pages, in both light and dark themes. Prints every pair and then the
// 3 lowest, for the NOTES.md self-check.
const f = (hex) => hex.replace("#", "").match(/../g).map((h) => parseInt(h, 16));
const lum = (hex) => {
  const [r, g, b] = f(hex).map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const l1 = lum(a), l2 = lum(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
};

const themes = {
  light: {
    surface: "#fffdf8", bg: "#f6f1e7", text: "#2a2620", muted: "#5f594d",
    accentSoft: "#f9f0d2", textYellow: "#8a5800",
    ok: "#2e7d4f", warn: "#9a5f00", bad: "#b3261e", silent: "#7a4fb5",
  },
  dark: {
    surface: "#1e1b15", bg: "#16140f", text: "#efe9dc", muted: "#a99e8a",
    accentSoft: "#2b2617", textYellow: "#d9a81f",
    ok: "#5cc48a", warn: "#e0a240", bad: "#f2766e", silent: "#b79be0",
  },
};

// The pairs that actually carry text on the pages.
const pairs = (t) => [
  ["text on surface", t.text, t.surface],
  ["muted on surface", t.muted, t.surface],
  ["muted on bg", t.muted, t.bg],
  ["text on accent-soft (focus ring area)", t.text, t.accentSoft],
  ["text-yellow on surface (links/pill accent)", t.textYellow, t.surface],
  ["text-yellow on accent-soft (accent pill)", t.textYellow, t.accentSoft],
  ["ok on surface", t.ok, t.surface],
  ["warn on surface", t.warn, t.surface],
  ["bad on surface", t.bad, t.surface],
  ["silent on surface", t.silent, t.surface],
];

for (const [name, t] of Object.entries(themes)) {
  console.log(`\n=== ${name} ===`);
  const out = pairs(t).map(([label, fg, bg]) => [label, ratio(fg, bg)]);
  for (const [label, r] of out) console.log(`  ${r.toFixed(2)}  ${label}`);
  const lowest = [...out].sort((a, b) => a[1] - b[1]).slice(0, 3);
  console.log("  LOWEST 3:", lowest.map(([l, r]) => `${r.toFixed(2)} (${l})`).join(" · "));
}

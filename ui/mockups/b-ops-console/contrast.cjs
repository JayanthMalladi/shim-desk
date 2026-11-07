// WCAG contrast ratios for the B mockup token pairs (both themes).
function lum(hex) {
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(fg, bg) {
  const a = lum(fg), b = lum(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

const THEMES = {
  dark: { bg: "0B0D0F", surface: "131619", raised: "1B2025",
    pairs: {
      "text on surface": ["E8EBEC", "131619"], "muted on surface": ["98A2A9", "131619"],
      "text on raised": ["E8EBEC", "1B2025"], "muted on raised": ["98A2A9", "1B2025"],
      "accent on surface": ["58A78F", "131619"], "ok on surface": ["5CC48A", "131619"],
      "warn on surface": ["E0A240", "131619"], "bad on surface": ["F0776E", "131619"],
      "silent on surface": ["B79BE0", "131619"],
      "bg on accent (pr-link)": ["0B0D0F", "58A78F"],
    } },
  light: { bg: "F1F2F0", surface: "FBFCFA", raised: "FFFFFF",
    pairs: {
      "text on surface": ["1B1C1A", "FBFCFA"], "muted on surface": ["5E6059", "FBFCFA"],
      "text on raised": ["1B1C1A", "FFFFFF"], "muted on raised": ["5E6059", "FFFFFF"],
      "accent on surface": ["2A5E4E", "FBFCFA"], "ok on surface": ["256E45", "FBFCFA"],
      "warn on surface": ["8A5A00", "FBFCFA"], "bad on surface": ["A32520", "FBFCFA"],
      "silent on surface": ["6B4BA8", "FBFCFA"],
      "surface on accent (pr-link)": ["FBFCFA", "2A5E4E"],
    } },
};

for (const [theme, t] of Object.entries(THEMES)) {
  const results = Object.entries(t.pairs).map(([n, [fg, bg]]) =>
    [n, ratio("#" + fg, "#" + bg).toFixed(2)]);
  results.sort((a, b) => parseFloat(a[1]) - parseFloat(b[1]));
  console.log(`\n${theme} (3 lowest first):`);
  for (const [n, r] of results) console.log(`  ${r.padStart(6)}  ${n}  ${r >= 4.5 ? "AA" : r >= 3 ? "AA-large" : "FAIL"}`);
}

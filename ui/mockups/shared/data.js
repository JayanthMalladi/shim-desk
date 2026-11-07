// Shared, read-only data helpers for the three mockups. Everything shown is
// derived from data/r-0001.json (a copy of ledger/r-0001.json). Nothing here
// invents a number: missing values render as "not recorded".

export const STAGES = ["Requested", "Scanned", "Human calls", "Shim fixes", "Parallel fixes", "Gates", "Review", "Approval", "PR"];

export async function loadRuns() {
  const res = await fetch("../data/r-0001.json");
  if (!res.ok) throw new Error(`Can't read the ledger: HTTP ${res.status}`);
  return [await res.json()];
}

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/** `code` spans in finding messages become <code>. */
export const md = (s) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>");

export const isAgent = (actor) => actor.startsWith("shim-") || actor.startsWith("shim-fixer:");

const dtf = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const tf = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
export const absTime = (t) => (t ? `${dtf.format(new Date(t))} UTC` : "not recorded");
export const clock = (t) => (t ? tf.format(new Date(t)) : "");
export function relTime(t) {
  const diff = (Date.parse(t) - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [u, s] of [["year", 31536000], ["month", 2592000], ["day", 86400], ["hour", 3600], ["minute", 60]]) {
    if (Math.abs(diff) >= s) return rtf.format(Math.round(diff / s), u);
  }
  return "just now";
}
export function duration(a, b) {
  const m = Math.round((Date.parse(b) - Date.parse(a)) / 60000);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}

export function summary(runs) {
  return {
    runs: runs.length,
    prs: runs.filter((r) => r.status === "done" && r.pr?.url).length,
    decisions: runs.reduce((n, r) => n + (r.decisions?.length ?? 0), 0),
    silent: runs.reduce((n, r) => n + (r.findings?.bySeverity?.silent ?? 0), 0),
  };
}

export function gates(run) {
  const b = run.gates?.baseline ?? {}, a = run.gates?.after ?? {};
  const names = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  const rows = names.map((name) => ({ name, baseline: b[name], after: a[name], regressed: (run.gates?.regressions ?? []).includes(name) }));
  const held = rows.filter((r) => r.baseline === true);
  return { rows, held: held.filter((r) => r.after === true).length, heldOf: held.length, regressions: run.gates?.regressions ?? [] };
}

/** Stage timestamps that the ledger actually records. Others stay empty. */
export function stages(run) {
  const firstStatus = (s) => run.events?.find((e) => e.status === s)?.t;
  const lastDecision = run.decisions?.length ? run.decisions[run.decisions.length - 1].at : undefined;
  const times = [run.createdAt, firstStatus("scanned"), lastDecision, firstStatus("fixing_deterministic"), firstStatus("fixing_parallel"), firstStatus("gating"), firstStatus("in_review"), run.approval?.at, firstStatus("done")];
  const done = run.status === "done";
  return STAGES.map((label, i) => ({ label, t: times[i], state: done ? "done" : "future" }));
}

export const pill = (run) => ({ done: ["PR opened", "ok"], blocked: ["Blocked", "warn"], failed: ["Failed", "bad"] }[run.status] ?? ["In progress", "accent"]);

/** The finding a decision was about (same ruleId), so a decision with an empty
 *  `question` can still say what it was about, using the scanner's own text. */
export const decisionTopic = (run, d) => run.findings?.items?.find((f) => f.ruleId === d.ruleId);

/** One log: events plus the human calls and the approval, which the ledger
 *  stores outside events[]. Sorted oldest first. */
export function log(run) {
  const rows = (run.events ?? []).map((e) => ({ t: e.t, actor: e.actor ?? "unknown", kind: e.status ?? e.kind, text: e.text }));
  for (const d of run.decisions ?? []) {
    const f = decisionTopic(run, d);
    rows.push({ t: d.at, actor: d.by, kind: "decision", text: `Made the call on ${d.ruleId}${d.options?.[d.choice] ? `: ${d.options[d.choice]}` : ""}`, detail: f?.message });
  }
  if (run.approval) rows.push({ t: run.approval.at, actor: run.approval.by, kind: "approval", text: "Approved the PR" });
  return rows.sort((a, b) => Date.parse(a.t) - Date.parse(b.t)).map((r) => ({ ...r, agent: isAgent(r.actor) }));
}

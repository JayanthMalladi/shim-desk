/* Direction A — shared board renderer (runs.html + run.html).
 * Mirrors ui/src/format.ts: status→stage mapping (02-UI-SPEC §6), pill
 * text/colour, stage states, severity/kind labels, isAgent, rel/abs time.
 * All data comes from r-0001.json — nothing is hard-coded. */
"use strict";

const STAGE_LABELS = ["Requested", "Scanned", "Human calls", "Shim fixes", "Parallel fixes", "Gates", "Review", "Approval", "PR"];
const STAGE_COUNT = 9;

// 02 §6 "Stage index + Stage state" rows (blocked/failed resolved from events).
const STATUS_STAGE = {
  requested: 0, cloning: 0, scanned: 1, awaiting_decision: 2,
  fixing_deterministic: 3, fixing_parallel: 4, gating: 5,
  in_review: 6, awaiting_approval: 7, opening_pr: 8, done: 8,
};
const WAITING_STATUSES = new Set(["awaiting_decision", "awaiting_approval"]);

const PILL_TEXT = {
  requested: "Starting", cloning: "Starting", scanned: "Scanned",
  awaiting_decision: "Needs a human call", fixing_deterministic: "Shim fixing",
  fixing_parallel: "Subagents fixing", gating: "Running gates",
  in_review: "In review", awaiting_approval: "Waiting for approval",
  opening_pr: "Opening PR", done: "PR opened", blocked: "Blocked", failed: "Failed",
};
const PILL_COLOR = {
  requested: "accent", cloning: "accent", scanned: "accent",
  awaiting_decision: "warn", fixing_deterministic: "accent", fixing_parallel: "accent",
  gating: "accent", in_review: "accent", awaiting_approval: "warn", opening_pr: "accent",
  done: "ok", blocked: "warn", failed: "bad",
};
const SEVERITY_LABEL = { break: "Break", silent: "Silent", deprecated: "Deprecated" };
const SEVERITY_CLASS = { break: "break", silent: "silent", deprecated: "deprecated" };
const KIND_LABEL = {
  status: "Status", message: "Note", decision: "Decision", fix: "Fix",
  gate: "Gate", review: "Review", approval: "Approval", pr: "PR", error: "Error",
};
const FIX_LABEL = { auto: "auto", agent: "agent", manual: "manual" };

const num = (v) => (typeof v === "number" ? v : 0);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const isAgent = (actor) => typeof actor === "string" && (actor.startsWith("shim-") || actor.startsWith("shim-fixer:"));

function statusStage(status, events) {
  if (status === "blocked" || status === "failed") {
    let stage = 0;
    for (const ev of events ?? []) {
      const s = ev && ev.status;
      if (s !== "blocked" && s !== "failed" && STATUS_STAGE[s] !== undefined) stage = STATUS_STAGE[s];
    }
    return stage;
  }
  return STATUS_STAGE[status] ?? 0;
}

// 02 §6 + format.ts stageStates(): done → all nine done; stopped → last
// reached stage "stopped" (hollow); waiting → "waiting"; else "current".
function stageStates(status, events) {
  if (status === "done") return new Array(STAGE_COUNT).fill("done");
  const i = statusStage(status, events);
  const stopped = status === "blocked" || status === "failed";
  const states = new Array(STAGE_COUNT).fill("future");
  for (let k = 0; k < STAGE_COUNT; k++) {
    if (k < i) states[k] = "done";
    else if (k === i) states[k] = stopped ? "stopped" : WAITING_STATUSES.has(status) ? "waiting" : "current";
  }
  return states;
}

function stageTimestamps(events) {
  const ts = new Array(STAGE_COUNT).fill(null);
  for (const ev of events ?? []) {
    const idx = ev && STATUS_STAGE[ev.status];
    if (idx !== undefined && ev && ev.t) ts[idx] = ev.t;
  }
  return ts;
}

function absTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(d);
}

// Simpler, matches format.ts semantics closely enough for card meta:
function relTime2(iso) {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const diff = then - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (abs < 60000) return rtf.format(Math.round(diff / 1000), "second");
  if (abs < 3600000) return rtf.format(Math.round(diff / 60000), "minute");
  if (abs < 86400000) return rtf.format(Math.round(diff / 3600000), "hour");
  if (abs < 86400000 * 14) return rtf.format(Math.round(diff / 86400000), "day");
  if (abs < 86400000 * 60) return rtf.format(Math.round(diff / 86400000 * 7), "week");
  if (abs < 86400000 * 365) return rtf.format(Math.round(diff / 86400000 * 30), "month");
  return rtf.format(Math.round(diff / 86400000 * 365), "year");
}

function pill(status, events) {
  const text = PILL_TEXT[status] ?? status;
  const color = PILL_COLOR[status] ?? "accent";
  return `<span class="pill ${color}" title="${esc(text)}"><span class="pd" aria-hidden="true"></span>${esc(text)}</span>`;
}

function stageTrack(status, events, compact) {
  const states = stageStates(status, events);
  const stamps = stageTimestamps(events);
  const items = STAGE_LABELS.map((label, i) => {
    const ts = stamps[i];
    const timeLabel = ts ? absTime(ts) : "";
    const title = timeLabel ? `${label} — ${timeLabel}` : label;
    const aria = [label, states[i]];
    if (timeLabel) aria.push(`(${timeLabel})`);
    return `<span class="stage-track__item" data-state="${states[i]}" role="img" aria-label="${esc(aria.join(" "))}" title="${esc(title)}" tabindex="0"><span class="stage-track__marker" aria-hidden="true"></span>${compact ? "" : `<span class="stage-track__label">${esc(label)}</span>`}</span>`;
  }).join("");
  return `<div class="stage-scroll"><div class="stage-track${compact ? " compact" : " full"}" role="group" aria-label="${esc(PILL_TEXT[status] ?? status)} — stage progress">${items}</div></div>`;
}

// Deterministic actor → one of the 4 neutral tokens (02 §5.2 #8), never random.
const AVATAR_TOKENS = ["accent", "ok", "warn", "bad"];
function avatarColor(actor) {
  let h = 0;
  for (let i = 0; i < actor.length; i++) h = (h * 31 + actor.charCodeAt(i)) >>> 0;
  return AVATAR_TOKENS[h % AVATAR_TOKENS.length];
}

function gateStats(run) {
  const baseline = run.gates?.baseline ?? {};
  const after = run.gates?.after ?? {};
  const keys = [...new Set([...Object.keys(baseline), ...Object.keys(after)])];
  const green = keys.filter((k) => after[k] === true).length;
  return { green, total: keys.length };
}

/* ---------------- runs page ---------------- */

function renderRuns(runs, root) {
  const sorted = [...runs].sort((a, b) => {
    const ta = Date.parse(a.createdAt), tb = Date.parse(b.createdAt);
    if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
    if (Number.isNaN(ta)) return 1;
    if (Number.isNaN(tb)) return -1;
    return tb - ta;
  });

  const stats = [
    { label: "Runs", value: sorted.length },
    { label: "PRs opened", value: sorted.filter((r) => r.status === "done" && r.pr?.url).length },
    { label: "Human decisions", value: sorted.reduce((a, r) => a + (r.decisions?.length ?? 0), 0) },
    { label: "Silent breaks caught", value: sorted.reduce((a, r) => a + num(r.findings?.bySeverity?.silent), 0) },
  ];

  const statsHtml = `<div class="stats">${stats.map((s) =>
    `<div class="stat"><div class="stat__value">${s.value}</div><div class="stat__label">${esc(s.label)}</div></div>`).join("")}</div>`;

  const empty = sorted.length === 0
    ? `<p class="empty">No runs yet. In the ~shim-desk room, ask “@shim upgrade ai to v7 in &lt;your repo&gt;”.</p>` : "";

  const cards = sorted.map((r) => {
    const total = num(r.findings?.total);
    const silent = num(r.findings?.bySeverity?.silent);
    const decisions = (r.decisions ?? []).length;
    const gates = gateStats(r);
    const pr = r.pr?.url;
    return `<a class="run-card" href="run.html" aria-label="Run ${esc(r.runId)}">
      <div class="run-card__row">
        <span class="mono">${esc(r.runId)}</span>
        <span class="repo">${esc(r.repo)}</span>
        <span class="time">${esc(relTime2(r.createdAt))}</span>
        ${pill(r.status, r.events)}
      </div>
      <div class="run-card__track">${stageTrack(r.status, r.events, true)}</div>
      <div class="run-card__foot">
        <div class="chips">
          <span class="chip">${total} findings</span>
          <span class="chip silent">${silent} silent</span>
          <span class="chip">${decisions} decisions</span>
          <span class="chip">gates ${gates.green}/${gates.total}</span>
        </div>
        ${pr ? `<span class="run-card__pr mono">${esc(pr)}</span>` : ""}
      </div>
    </a>`;
  }).join("");

  root.innerHTML = `
    <div class="page">
      <div class="header">
        <h1>Shim Desk Ledger</h1>
        <div class="header__meta">
          <span class="badge"><span class="live-dot" aria-hidden="true"></span>Live</span>
          <a class="muted" href="https://github.com/JayanthMalladi/shim-desk">How this works</a>
        </div>
      </div>
      ${statsHtml}
      ${empty}
      <div class="run-list">${cards}</div>
    </div>`;
}

/* ---------------- run page ---------------- */

function severityBars(r) {
  const f = r.findings ?? {};
  const total = num(f.total);
  const by = f.bySeverity ?? {};
  const max = Math.max(1, num(by.break), num(by.silent), num(by.deprecated));
  const rows = ["break", "silent", "deprecated"].map((sev) => {
    const count = num(by[sev]);
    const pct = total ? Math.round((count / total) * 100) : 0;
    return `<div class="sev-row">
      <span class="sev-row__label">${SEVERITY_LABEL[sev] ?? sev}</span>
      <div class="sev-bar" role="img" aria-label="${SEVERITY_LABEL[sev] ?? sev}: ${count} (${pct}%)"><span class="${SEVERITY_CLASS[sev] ?? "deprecated"}" style="width:${(count / max) * 100}%"></span></div>
      <span class="sev-row__count">${count}</span>
    </div>`;
  }).join("");
  const byFix = f.byFix ?? {};
  const fixLine = `Fixed: ${["auto", "agent", "manual"].map((x) => `${x} ${num(byFix[x])}`).join(" · ")}`;
  const top = f.top;
  const topBox = top ? `<div class="top-finding">
      <div class="top-finding__label">Most important silent change</div>
      <div class="top-finding__loc"><span>${esc(top.file)}:${esc(top.line)}</span><span>${esc(top.ruleId)}</span></div>
      <div class="top-finding__msg">${esc(top.message)}</div>
    </div>` : "";
  return { rows, fixLine, topBox, total };
}

function findingsTableHtml(r) {
  const items = r.findings?.items ?? [];
  if (!items.length) return "";
  const rows = items.map((f, i) => `<tr>
    <td class="mono nowrap">${esc(f.file)}</td>
    <td>${esc(f.line)}</td>
    <td style="color:var(--${SEVERITY_CLASS[f.severity] ?? "muted"})">${esc(SEVERITY_LABEL[f.severity] ?? f.severity)}</td>
    <td>${esc(FIX_LABEL[f.fix] ?? f.fix)}</td>
    <td class="mono nowrap">${esc(f.ruleId)}</td>
    <td class="msg" title="${esc(f.message)}">${esc(f.message)}</td>
  </tr>`).join("");
  return `<div class="table-scroll">
    <table class="table" style="white-space:normal">
      <thead><tr><th>File</th><th>Line</th><th>Severity</th><th>Fix</th><th>Rule</th><th>Message</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function decisionsHtml(r) {
  const list = r.decisions ?? [];
  if (!list.length) return `<p class="muted" style="margin:0">No human calls needed</p>`;
  return list.map((d, i) => {
    const chosen = d.options?.[d.choice];
    return `<div class="decision">
      <div class="decision__rule">${esc(d.ruleId)}</div>
      ${d.question ? `<div style="margin:4px 0">${esc(d.question)}</div>` : ""}
      ${chosen !== undefined ? `<div class="decision__choice">Call: <strong>${esc(chosen)}</strong></div>` : ""}
      <div class="decision__by"><span>${esc(d.by)}</span><span>${esc(relTime2(d.at))}</span></div>
    </div>`;
  }).join("");
}

function fixGridHtml(r) {
  const fixes = r.fixes ?? [];
  const auto = num(r.autoFixed);
  const tiles = fixes.map((f) => `<div class="fix-tile${f.status === "blocked" ? " blocked" : ""}">
    <div class="fix-tile__top"><span class="mono">${esc(f.file)}</span><span class="fix-tile__status">${esc(f.status)}</span></div>
    <div class="fix-tile__summary">${esc(f.summary)}</div>
    <div class="fix-tile__model">${esc(f.model)}</div>
  </div>`).join("");
  return `<section class="card" aria-label="Parallel fixes">
    <h3>Subagent fixes</h3>
    <p class="muted">Shim fixed ${auto} sites deterministically. ${fixes.length} files fixed in parallel by Sonnet subagents.</p>
    <div class="fix-grid">${tiles}</div>
  </section>`;
}

function gatesHtml(r) {
  const gates = r.gates ?? {};
  const baseline = gates.baseline ?? {};
  const after = gates.after ?? {};
  const regressed = gates.regressions ?? [];
  const keys = [...new Set([...Object.keys(baseline), ...Object.keys(after)])];
  if (!keys.length) return "";
  const cell = (v) => v === true
    ? `<span class="pass">pass</span>`
    : `<span class="fail">fail</span>`;
  const rows = keys.map((k) => `<tr${regressed.includes(k) ? ' class="regressed"' : ""}>
    <td class="mono nowrap">${esc(k)}</td>
    <td>${cell(baseline[k])}</td>
    <td>${cell(after[k])}</td>
  </tr>`).join("");
  const foot = regressed.length
    ? `<div class="gates-foot bad">Regressed: ${regressed.map(esc).join(", ")}</div>`
    : `<div class="gates-foot">Every gate that passed before still passes</div>`;
  return `<section class="card" aria-label="Gates">
    <h3>Gates</h3>
    <div class="table-scroll">
      <table class="table" style="white-space:normal">
        <thead><tr><th>Gate</th><th>Baseline</th><th>After</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${foot}
  </section>`;
}

function reviewHtml(r) {
  const rv = r.review;
  if (!rv) return "";
  const verdict = rv.verdict === "changes" ? "warn" : "ok";
  const notes = rv.notes?.length
    ? `<ol class="review-notes">${rv.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ol>` : "";
  return `<section class="card" aria-label="Review">
    <h3>Review</h3>
    <div class="review-head">
      <span class="who">${esc(rv.by)}</span>
      ${pillFrom("approve", verdict)}
      ${rv.rounds !== undefined ? `<span class="round">round ${esc(rv.rounds)}</span>` : ""}
    </div>
    ${notes}
  </section>`;
}

function pillFrom(status, force) {
  const text = status;
  const color = force ?? PILL_COLOR[status] ?? "accent";
  return `<span class="pill ${color}"><span class="pd" aria-hidden="true"></span>${esc(text)}</span>`;
}

function prHtml(r) {
  const pr = r.pr;
  const ap = r.approval;
  if (!pr && !ap) return "";
  const approval = ap
    ? `<div class="pr-approval"><span>Approved by ${esc(ap.by)}</span><span>${absTime(ap.at)}</span></div>` : "";
  const button = pr?.url ? `<a class="pr-button" href="${esc(pr.url)}" target="_blank" rel="noreferrer">Open pull request</a>` : "";
  const url = pr?.url ? `<div class="pr-url">${esc(pr.url)}</div>` : "";
  const meta = pr ? `<div class="pr-meta">
      ${pr.branch ? `<span class="mono">${esc(pr.branch)}</span>` : ""}
      <span>${num(pr.filesChanged)} files changed</span>
      <span class="add">+${num(pr.additions)}</span>
      <span class="del">−${num(pr.deletions)}</span>
    </div>` : "";
  return `<section class="card" aria-label="Pull request"><h3>Pull request</h3>${approval}${button}${url}${meta}</section>`;
}

function timelineHtml(r) {
  const list = [...(r.events ?? [])].sort((a, b) => {
    const ta = Date.parse(a.t), tb = Date.parse(b.t);
    if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
    if (Number.isNaN(ta)) return 1;
    if (Number.isNaN(tb)) return -1;
    return ta - tb;
  });
  if (!list.length) return "";
  const items = list.map((ev, i) => {
    const actor = ev.actor ?? "unknown";
    const agent = isAgent(actor);
    const token = avatarColor(actor);
    return `<li>
      <span class="avatar" style="--av:var(--${token})" aria-hidden="true">${esc(actor.charAt(0).toUpperCase() || "?")}</span>
      <div class="tl-body">
        <div class="tl-head">
          <strong>${esc(actor)}</strong>
          <span class="chip tag ${agent ? "agent" : "muted"}">${agent ? "agent" : "person"}</span>
          <span class="chip">${esc(KIND_LABEL[ev.kind] ?? ev.kind)}</span>
          <span class="time">${esc(absTime(ev.t))}</span>
        </div>
        ${ev.text ? `<div class="tl-text">${esc(ev.text)}</div>` : ""}
      </div>
    </li>`;
  }).join("");
  return `<section class="card" aria-label="Timeline"><h3>Timeline</h3><ol class="timeline">${items}</ol></section>`;
}

function renderRun(r, root) {
  const stopped = r.status === "blocked" || r.status === "failed";
  const banner = stopped
    ? `<div class="banner" role="alert"><strong>${r.status === "blocked" ? "Run blocked" : "Run failed"}</strong>${r.statusReason ? `<div>${esc(r.statusReason)}</div>` : ""}</div>` : "";

  const sev = severityBars(r);
  const findingsSummary = `<section class="card" aria-label="Findings summary">
      <h3>Findings <span class="muted" style="font-weight:400">(${esc(sev.total)})</span></h3>
      ${sev.rows}
      <div class="byfix">${esc(sev.fixLine)}</div>
      ${sev.topBox}
    </section>`;

  const findingsTable = (r.findings?.items?.length ?? 0)
    ? `<section class="card" aria-label="All findings">
        <button class="section-toggle" type="button" aria-expanded="false" data-findings-toggle>
          + All findings <span class="count">(${(r.findings.items ?? []).length})</span>
        </button>
        <div class="findings-table-slot" hidden>${findingsTableHtml(r)}</div>
      </section>` : "";

  const decisions = `<section class="card" aria-label="Human decisions"><h3>Human calls</h3>${decisionsHtml(r)}</section>`;

  const twoCol = `<div class="run-grid">
      <div class="run-detail-left">${findingsSummary}${findingsTable}</div>
      <div class="run-detail-right">${decisions}</div>
    </div>`;

  root.innerHTML = `
    <div class="page">
      <a class="back-link" href="runs.html">← All runs</a>
      <div class="head-row">
        <h1><span class="mono">${esc(r.runId)}</span> · <a href="https://github.com/${esc(r.repo)}" target="_blank" rel="noreferrer">${esc(r.repo)}</a></h1>
        ${pill(r.status, r.events)}
        <span class="meta"><span>requested by ${esc(r.requestedBy)}</span><span>${esc(absTime(r.createdAt))}</span></span>
      </div>
      ${banner}
      <div class="card" aria-label="Stage progress">${stageTrack(r.status, r.events, false)}</div>
      ${twoCol}
      ${fixGridHtml(r)}
      ${gatesHtml(r)}
      ${reviewHtml(r)}
      ${prHtml(r)}
      ${timelineHtml(r)}
    </div>`;

  const tgl = root.querySelector("[data-findings-toggle]");
  const slot = root.querySelector(".findings-table-slot");
  tgl?.addEventListener("click", () => {
    const open = tgl.getAttribute("aria-expanded") === "true";
    tgl.setAttribute("aria-expanded", String(!open));
    tgl.innerHTML = (open ? "+" : "−") + ` All findings <span class="count">(${(r.findings.items ?? []).length})</span>`;
    slot.hidden = open;
  });
}

async function loadRun(file) {
  const res = await fetch(file);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}


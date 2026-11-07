/* Mockup B shared logic — mirrors ui/src/format.ts + 02-UI-SPEC §6.
 * No framework; plain DOM. Every value rendered comes from the fetched
 * r-0001.json — nothing is hard-coded here. */

"use strict";

/* ---- status → stage mapping (02 §6) ------------------------------------ */
const STAGE_LABELS = [
  "Requested", "Scanned", "Human calls", "Shim fixes", "Parallel fixes",
  "Gates", "Review", "Approval", "PR",
];
const STATUS_STAGE = {
  requested: [0, "current"], cloning: [0, "current"], scanned: [1, "current"],
  awaiting_decision: [2, "waiting"], fixing_deterministic: [3, "current"],
  fixing_parallel: [4, "current"], gating: [5, "current"], in_review: [6, "current"],
  awaiting_approval: [7, "waiting"], opening_pr: [8, "current"],
  done: [8, "done"],
};
const PILL_TEXT = {
  requested: "Starting", cloning: "Starting", scanned: "Scanned",
  awaiting_decision: "Needs a human call", fixing_deterministic: "Shim fixing",
  fixing_parallel: "Subagents fixing", gating: "Running gates", in_review: "In review",
  awaiting_approval: "Waiting for approval", opening_pr: "Opening PR",
  done: "PR opened", blocked: "Blocked", failed: "Failed",
};
const PILL_COLOR = {
  requested: "accent", cloning: "accent", scanned: "accent",
  awaiting_decision: "warn", fixing_deterministic: "accent", fixing_parallel: "accent",
  gating: "accent", in_review: "accent", awaiting_approval: "warn", opening_pr: "accent",
  done: "ok", blocked: "warn", failed: "bad",
};
const SEVERITY_LABEL = { break: "Break", silent: "Silent", deprecated: "Deprecated" };
const SEVERITY_COLOR = { break: "bad", silent: "silent", deprecated: "muted" };
const KIND_LABEL = {
  status: "Status", message: "Note", decision: "Decision", fix: "Fix",
  gate: "Gate", review: "Review", approval: "Approval", pr: "PR", error: "Error",
};

const isAgent = (a) => typeof a === "string" && a.startsWith("shim-"); // covers shim-fixer:…
const stageOfStatus = (s) => (STATUS_STAGE[s] ? STATUS_STAGE[s][0] : undefined);

function stageFromEvents(events) {
  let stage = 0;
  for (const ev of events || []) {
    const i = stageOfStatus(ev.status);
    if (i !== undefined && ev.status !== "blocked" && ev.status !== "failed") stage = i;
  }
  return stage;
}
function statusStage(status, events) {
  if (status === "blocked" || status === "failed") return stageFromEvents(events);
  return stageOfStatus(status) ?? 0;
}
function stageStates(status, events) {
  if (status === "done") return STAGE_LABELS.map(() => "done");
  const i = statusStage(status, events);
  const stopped = status === "blocked" || status === "failed";
  return STAGE_LABELS.map((_, k) =>
    k < i ? "done" : k === i ? (stopped ? "stopped" : (STATUS_STAGE[status] ? STATUS_STAGE[status][1] : "current")) : "future");
}
function stageTimestamps(events) {
  const ts = STAGE_LABELS.map(() => null);
  for (const ev of events || []) {
    const i = stageOfStatus(ev.status);
    if (i !== undefined && ev.t) ts[i] = ev.t;
  }
  return ts;
}
const pillText = (s) => PILL_TEXT[s] ?? s;
const pillColor = (s) => PILL_COLOR[s] ?? "accent";

/* ---- time (Intl only, mirrors format.ts) -------------------------------- */
function relTime(iso) {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const diff = then - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (abs < 6e5) return rtf.format(Math.round(diff / 1e3), "second");
  if (abs < 3.6e6) return rtf.format(Math.round(diff / 6e5), "minute");
  if (abs < 864e5) return rtf.format(Math.round(diff / 3.6e6), "hour");
  if (abs < 864e5 * 14) return rtf.format(Math.round(diff / 864e5), "day");
  if (abs < 864e5 * 60) return rtf.format(Math.round(diff / 864e5 * 7), "week");
  if (abs < 864e5 * 365) return rtf.format(Math.round(diff / 864e5 * 30), "month");
  return rtf.format(Math.round(diff / 864e5 * 365), "year");
}
function absTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(d);
}

/* ---- DOM helpers --------------------------------------------------------- */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function pill(status, events) {
  const c = pillColor(status);
  return `<span class="pill ${c}"><span class="dot" aria-hidden="true"></span>${esc(pillText(status))}</span>`;
}

function rail(status, events, compact) {
  const states = stageStates(status, events);
  const stamps = stageTimestamps(events);
  const items = states.map((st, i) => {
    const ts = stamps[i];
    const time = ts ? absTime(ts) : "";
    const label = time ? `${STAGE_LABELS[i]} — ${time}` : STAGE_LABELS[i];
    return `<span class="stage-node" data-state="${st}" tabindex="0" role="img"
      aria-label="${esc(label)}" title="${esc(label)}">
      <span class="stage-node__marker" aria-hidden="true"></span>
      ${compact ? "" : `<span class="stage-node__label">${esc(STAGE_LABELS[i])}</span>`}
    </span>`;
  }).join("");
  return `<div class="stage-rail${compact ? " compact" : ""}" role="group"
    aria-label="${esc(pillText(status))} — stage progress"><span class="stage-rail__line" aria-hidden="true"></span>${items}</div>`;
}

function gateStats(run) {
  const baseline = run.gates?.baseline ?? {};
  const after = run.gates?.after ?? {};
  const keys = [...new Set([...Object.keys(baseline), ...Object.keys(after)])];
  const green = keys.filter((k) => after[k] === true).length;
  return { green, total: keys.length };
}

function runCard(run) {
  const total = run.findings?.total ?? 0;
  const silent = run.findings?.bySeverity?.silent ?? 0;
  const decisions = run.decisions ?? [];
  const gates = gateStats(run);
  const pr = run.pr?.url;
  return `<article class="run-card" aria-label="run ${esc(run.runId)}">
    <a class="run-card__link" href="run.html" aria-label="Open run ${esc(run.runId)}"></a>
    <div class="run-card__inner">
      <div class="run-card__row">
        <span class="mono" style="font-weight:600">${esc(run.runId)}</span>
        <span class="repo">${esc(run.repo)}</span>
        <span class="muted" style="font-size:.85rem">${esc(relTime(run.createdAt))}</span>
        <span style="margin-left:auto">${pill(run.status, run.events)}</span>
      </div>
      ${rail(run.status, run.events, true)}
      <div class="run-card__chips">
        <span class="chip"><span class="n">${total}</span> findings</span>
        <span class="chip silent"><span class="n">${silent}</span> silent</span>
        <span class="chip"><span class="n">${decisions.length}</span> decisions</span>
        <span class="chip">gates <span class="n">${gates.green}/${gates.total}</span></span>
      </div>
      ${pr ? `<a class="run-card__pr" href="${esc(pr)}" target="_blank" rel="noreferrer">PR ${esc(pr)}</a>` : ""}
    </div>
  </article>`;
}

const AVATAR_TOKENS = ["--accent", "--ok", "--warn", "--muted"];
function actorColor(actor) {
  let h = 0;
  for (let i = 0; i < actor.length; i++) h = (h * 31 + actor.charCodeAt(i)) >>> 0;
  return `var(${AVATAR_TOKENS[h % AVATAR_TOKENS.length]})`;
}

function findingsSummary(f) {
  const total = f?.total ?? 0;
  const bySeverity = f?.bySeverity ?? {};
  const byFix = f?.byFix ?? {};
  const sevs = ["break", "silent", "deprecated"];
  const max = Math.max(1, ...sevs.map((s) => bySeverity[s] ?? 0));
  const bars = sevs.map((s) => {
    const count = bySeverity[s] ?? 0;
    const color = `var(--${SEVERITY_COLOR[s]})`;
    return `<div class="sev-row">
      <span class="name sev-${s}">${esc(SEVERITY_LABEL[s] ?? s)}</span>
      <span class="bar"><i style="width:${(count / max) * 100}%;background:${color}"></i></span>
      <span class="count">${count}</span>
    </div>`;
  }).join("");
  const fixLine = `fixed: auto ${byFix.auto ?? 0}, agent ${byFix.agent ?? 0}, manual ${byFix.manual ?? 0}`;
  const top = f?.top;
  const topBox = top
    ? `<div class="top-finding">
        <div class="tag">Most important silent change</div>
        <div class="loc">${esc(top.file)}:${top.line} · ${esc(top.ruleId)}</div>
        <div class="msg">${esc(top.message)}</div>
      </div>`
    : "";
  return `<section class="card section" aria-label="Findings summary">
    <div class="section__head"><h2>Findings ${total ? `<span class="muted mono">(${total})</span>` : ""}</h3>
    <span class="muted" style="font-size:.85rem">${esc(fixLine)}</span></div>
    ${bars}${topBox}
  </section>`;
}

function findingsTable(f) {
  const items = f?.items ?? [];
  if (!items.length) return "";
  const rows = items.map((x, i) =>
    `<tr>
      <td class="mono">${esc(x.file)}</td>
      <td class="mono">${esc(x.line)}</td>
      <td class="sev-${esc(x.severity)}">${esc(SEVERITY_LABEL[x.severity] ?? x.severity)}</td>
      <td>${esc(x.fix)}</td>
      <td class="mono">${esc(x.ruleId)}</td>
      <td title="${esc(x.message)}"><span class="cell-msg">${esc(x.message)}</span></td>
    </tr>`).join("");
  return `<section class="card section" aria-label="All findings">
    <div class="section__head"><h2>All findings (${items.length})</h3></div>
    <div class="table-scroll"><table class="table">
      <thead><tr><th>File</th><th>Line</th><th>Severity</th><th>Fix</th><th>Rule</th><th>Message</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </section>`;
}

function decisionList(ds) {
  const list = ds ?? [];
  const body = list.length
    ? list.map((d) => {
        const chosen = d.options?.[d.choice];
        const opts = (d.options ?? []).map((o, j) =>
          `<div class="opt${j === d.choice ? " chosen" : ""}">${j === d.choice ? "✓ " : ""}${esc(o)}</div>`).join("");
        return `<div class="decision">
          <div class="rid">${esc(d.ruleId)}</div>
          ${d.question ? `<div class="q">${esc(d.question)}</div>` : ""}
          ${opts}
          ${chosen !== undefined ? `<div class="q">Call: <strong>${esc(chosen)}</strong></div>` : ""}
          <div class="who">${esc(d.by)} · ${esc(relTime(d.at))}</div>
        </div>`;
      }).join("")
    : `<p class="muted" style="margin:0">No human calls needed</p>`;
  return `<section class="card section" aria-label="Human calls" style="height:100%">
    <div class="section__head"><h2>Human calls</h3>
    <span class="muted" style="font-size:.85rem">${list.length} decision${list.length === 1 ? "" : "s"}</span></div>
    ${body}
  </section>`;
}

function fixGrid(run) {
  const fixes = run.fixes ?? [];
  const autoFixed = run.autoFixed ?? 0;
  const tiles = fixes.map((x) =>
    `<div class="fix-tile${x.status === "blocked" ? " blocked" : ""}">
      <div class="top"><span class="file">${esc(x.file)}</span><span class="st">${esc(x.status)}</span></div>
      <div class="sum">${esc(x.summary)}</div>
      <div class="model">${esc(x.model ?? "")}${x.agent ? " · " + esc(x.agent) : ""}</div>
    </div>`).join("");
  return `<section class="card section" aria-label="Subagent fixes">
    <div class="section__head"><h2>Subagent fixes</h3>
    <span class="muted" style="font-size:.85rem">Shim fixed ${autoFixed} sites deterministically · ${fixes.length} files fixed in parallel by Sonnet subagents</span></div>
    <div class="fix-grid">${tiles}</div>
  </section>`;
}

function gatesTable(gates) {
  const baseline = gates?.baseline ?? {};
  const after = gates?.after ?? {};
  const regressions = gates?.regressions ?? [];
  const keys = [...new Set([...Object.keys(baseline), ...Object.keys(after)])];
  if (!keys.length) return "";
  const cell = (v) => (v === true ? `<span class="pass">✓ pass</span>` : `<span class="fail">✗ fail</span>`);
  const rows = keys.map((k) =>
    `<tr>
      <td class="gate-cell" style="${regressions.includes(k) ? "border-left:3px solid var(--bad);padding-left:8px" : ""}">${esc(k)}</td>
      <td>${cell(baseline[k])}</td>
      <td>${cell(after[k])}</td>
    </tr>`).join("");
  const footer = regressions.length
    ? `<div class="muted" style="margin-top:8px;color:var(--bad)">Regressed: ${regressions.map(esc).join(", ")}</div>`
    : `<div style="margin-top:8px;font-size:.85rem;color:var(--ok)">Every gate that passed before still passes</div>`;
  return `<section class="card section" aria-label="Gates">
    <div class="section__head"><h2>Gates</h3></div>
    <div class="table-scroll"><table class="table">
      <thead><tr><th>Gate</th><th>Baseline</th><th>After</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>${footer}
  </section>`;
}

function reviewCard(r) {
  if (!r) return "";
  const vc = r.verdict === "changes" ? "warn" : "ok";
  const vDot = r.verdict === "changes" ? "✗" : "✓";
  const notes = (r.notes ?? []).map((n, i) => `<li>${esc(n)}</li>`).join("");
  return `<section class="card section" aria-label="Review">
    <div class="section__head"><h2>Review</h3></div>
    <div class="review-head">
      <strong>${esc(r.by)}</strong>
      <span class="pill ${vc}"><span class="dot" aria-hidden="true"></span>${esc(r.verdict)} ${esc(vDot)}</span>
      <span class="muted" style="font-size:.85rem">round ${esc(r.rounds)}</span>
    </div>
    ${notes ? `<ol class="review-notes">${notes}</ol>` : ""}
  </section>`;
}

function prCard(run) {
  const approval = run.approval;
  const pr = run.pr;
  if (!pr && !approval) return "";
  const appr = approval
    ? `<div class="muted" style="font-size:.85rem;margin-bottom:8px">Approved by ${esc(approval.by ?? "unknown")}${approval.at ? ` · ${esc(absTime(approval.at))}` : ""}</div>` : "";
  const link = pr?.url ? `<a class="pr-link" href="${esc(pr.url)}" target="_blank" rel="noreferrer">Open pull request</a><div class="muted" style="font-size:.85rem;word-break:break-all">${esc(pr.url)}</div>` : "";
  const meta = pr ? `<div class="pr-meta">
      ${pr.branch ? `<span class="mono">${esc(pr.branch)}</span>` : ""}
      <span>${pr.filesChanged ?? 0} files changed</span>
      <span class="mono plus">+${pr.additions ?? 0}</span>
      <span class="mono minus">−${pr.deletions ?? 0}</span>
    </div>` : "";
  return `<section class="card section" aria-label="Pull request">
    <div class="section__head"><h2>Pull request</h3></div>
    ${appr}${link}${meta}
  </section>`;
}

function timeline(events) {
  const list = [...(events ?? [])].sort((a, b) => {
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
    const initials = actor.charAt(0).toUpperCase() || "?";
    const avStyle = `background:${actorColor(actor)};color:var(--on-surface);border-radius:${agent ? "4px" : "50%"}`;
    return `<li>
      <span class="avatar" style="${avStyle}" aria-hidden="true">${esc(initials)}</span>
      <div style="min-width:0">
        <div class="who">
          <strong>${esc(actor)}</strong>
          <span class="chip"><span class="role">${agent ? "agent" : "person"}</span></span>
          <span class="chip"><span class="role">${esc(KIND_LABEL[ev.kind] ?? ev.kind)}</span></span>
          <span class="when">${esc(absTime(ev.t))}</span>
        </div>
        ${ev.text ? `<div class="txt">${esc(ev.text)}</div>` : ""}
      </div>
    </li>`;
  }).join("");
  return `<section class="card section" aria-label="Timeline">
    <div class="section__head"><h2>Timeline</h3>
    <span class="muted" style="font-size:.8rem">square = agent · round = person</span></div>
    <ol class="timeline">${items}</ol>
  </section>`;
}

window.B = {
  isAgent, rail, pill, runCard, gateStats,
  findingsSummary, findingsTable, decisionList, fixGrid, gatesTable, reviewCard, prCard, timeline,
  SEVERITY_LABEL, SEVERITY_COLOR, relTime, absTime, esc,
};

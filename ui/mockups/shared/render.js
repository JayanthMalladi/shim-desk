// Renders runs.html and run.html for one mockup direction. The markup is the
// same section list as ui/src today; each direction's CSS (and a few variant
// switches below) gives it its look. Read-only: no forms, no actions.
import { loadRuns, esc, md, absTime, clock, relTime, duration, summary, gates, stages, pill, decisionTopic, log } from "./data.js";

const v = document.documentElement.dataset.variant; // a | b | c
const root = document.getElementById("app");

const status = (run) => {
  const [text, tone] = pill(run);
  return `<span class="pill pill-${tone}">${text}</span>`;
};
const passCell = (x) =>
  x === true ? `<span class="res ok"><span aria-hidden="true">✓</span> pass</span>`
  : x === false ? `<span class="res bad"><span aria-hidden="true">✗</span> fail</span>`
  : `<span class="res none">not run</span>`;

function header(s) {
  return `<header class="top">
    <a class="brand" href="runs.html">${v === "c" ? `<span class="mark" aria-hidden="true"></span>` : ""}Shim Desk <span class="brand-sub">ledger</span></a>
    <nav><a href="https://github.com/JayanthMalladi/shim-desk#readme">How this works</a></nav>
  </header>`;
}

function stats(s) {
  const tile = (n, label, cls = "") => `<div class="stat ${cls}"><span class="stat-n">${n}</span><span class="stat-l">${label}</span></div>`;
  return `<section class="stats" aria-label="Summary">
    ${tile(s.runs, s.runs === 1 ? "run" : "runs")}
    ${tile(s.prs, s.prs === 1 ? "PR opened" : "PRs opened")}
    ${tile(s.decisions, "human calls", "stat-human")}
    ${tile(s.silent, "silent breaks caught", "stat-silent")}
  </section>`;
}

function track(run, compact = false) {
  const st = stages(run);
  return `<ol class="track${compact ? " track-compact" : ""}" aria-label="Pipeline stages">
    ${st.map((x) => `<li class="st st-${x.state}" tabindex="${compact ? -1 : 0}" title="${esc(x.label)}: ${x.t ? absTime(x.t) : "time not recorded"}">
      <span class="st-mark" aria-hidden="true">${x.state === "done" ? "✓" : ""}</span>
      <span class="st-label">${x.label}<span class="sr"> (${x.state})</span></span>
      ${compact ? "" : `<span class="st-time">${x.t ? clock(x.t) : "&nbsp;"}</span>`}
    </li>`).join("")}
  </ol>`;
}

function storyLine(run) {
  const g = gates(run);
  const f = run.findings;
  return `<p class="story">Shim found <strong>${f.total} changes</strong> in ${f.files} files, <strong class="t-silent">${f.bySeverity.silent} of them silent</strong>.
    People made <strong class="t-human">${run.decisions.length} calls</strong> and approved the PR; agents did the rest.
    <strong class="t-ok">${g.held} of ${g.heldOf}</strong> baseline gates still pass.</p>`;
}

function runCard(run) {
  const g = gates(run);
  const f = run.findings;
  return `<a class="run-card" href="run.html#${esc(run.runId)}">
    <div class="rc-head">
      <span class="mono rc-id">${esc(run.runId)}</span>
      <span class="rc-repo">${esc(run.repo)}</span>
      ${status(run)}
      <span class="rc-time"><time datetime="${run.createdAt}" title="${absTime(run.createdAt)}">${relTime(run.createdAt)}</time></span>
    </div>
    ${track(run, true)}
    <ul class="chips" aria-label="Run numbers">
      <li>${f.total} findings</li>
      <li class="chip-silent">${f.bySeverity.silent} silent</li>
      <li class="chip-human">${run.decisions.length} human calls</li>
      <li class="chip-ok">gates ${g.held}/${g.heldOf} held</li>
      ${run.pr?.url ? `<li class="chip-pr">PR #${run.pr.url.split("/").pop()}</li>` : ""}
    </ul>
  </a>`;
}

function findings(run) {
  const f = run.findings, max = Math.max(...Object.values(f.bySeverity));
  const bar = (k, label) => `<div class="sev sev-${k}"><span class="sev-l">${label}</span><span class="sev-bar"><span style="--w:${(f.bySeverity[k] / max) * 100}%"></span></span><span class="sev-n">${f.bySeverity[k]}</span></div>`;
  const top = f.top;
  return `<section class="card findings" aria-labelledby="h-find">
    <h2 id="h-find">Findings <span class="count">${f.total}</span></h2>
    ${bar("break", "Break")}${bar("silent", "Silent")}${bar("deprecated", "Deprecated")}
    <p class="byfix">Fixed by Shim's rules: ${f.byFix.auto}. By agents: ${f.byFix.agent}. Needed a person: ${f.byFix.manual}.</p>
    ${top ? `<div class="top-silent"><p class="ts-label">Most important silent change</p>
      <p class="mono ts-loc">${esc(top.file)}:${top.line}  ${esc(top.ruleId)}</p>
      <p class="ts-msg">${md(top.message)}</p></div>` : ""}
    <details class="all-findings"><summary>All ${f.total} findings</summary>
      <div class="table-wrap"><table><thead><tr><th>File</th><th>Severity</th><th>Fix</th><th>Rule</th><th>Message</th></tr></thead><tbody>
      ${f.items.map((i) => `<tr><td class="mono">${esc(i.file)}:${i.line}</td><td><span class="sev-tag sev-tag-${i.severity}">${i.severity}</span></td><td>${i.fix}</td><td class="mono">${esc(i.ruleId)}</td><td class="msg" title="${esc(i.message)}">${md(i.message)}</td></tr>`).join("")}
      </tbody></table></div>
    </details>
  </section>`;
}

function decisions(run) {
  return `<section class="card decisions" aria-labelledby="h-dec">
    <h2 id="h-dec">Human calls <span class="count">${run.decisions.length}</span></h2>
    ${run.decisions.length === 0 ? `<p class="muted">No human calls needed</p>` : `<ol class="dec-list">
      ${run.decisions.map((d) => {
        const f = decisionTopic(run, d);
        return `<li class="dec">
          <p class="mono dec-rule">${esc(d.ruleId)}</p>
          <p class="dec-q">${d.question ? esc(d.question) : f ? md(f.message) : ""}</p>
          ${d.options?.length ? `<ul class="dec-opts">${d.options.map((o, j) => `<li class="${j === d.choice ? "chosen" : ""}">${j === d.choice ? "<span aria-hidden='true'>✓ </span>" : ""}${esc(o)}</li>`).join("")}</ul>` : ""}
          <p class="dec-by"><span class="who who-person">${esc(d.by)}</span> <span class="role">person</span> <time datetime="${d.at}">${absTime(d.at)}</time></p>
        </li>`;
      }).join("")}
    </ol>`}
  </section>`;
}

function fixes(run) {
  return `<section class="card fixes" aria-labelledby="h-fix">
    <h2 id="h-fix">Fixes</h2>
    <p class="lede">Shim fixed <strong>${run.autoFixed} sites</strong> with deterministic rules. <strong>${run.fixes.length} files</strong> were fixed in parallel by Sonnet subagents.</p>
    <ol class="fix-grid">
      ${run.fixes.map((x, i) => `<li class="fix fix-${x.status}">
        <p class="fix-head"><span class="mono fix-file">${esc(x.file)}</span><span class="res ${x.status === "done" ? "ok" : "warn"}">${x.status}</span></p>
        <p class="fix-sum">${md(x.summary)}</p>
        <p class="fix-model mono">${esc(x.agent)} ${esc(x.model)}</p>
      </li>`).join("")}
    </ol>
  </section>`;
}

function gatesTable(run) {
  const g = gates(run);
  return `<section class="card gates" aria-labelledby="h-gates">
    <h2 id="h-gates">Gates</h2>
    <div class="table-wrap"><table><thead><tr><th>Gate</th><th>Baseline</th><th>After</th></tr></thead><tbody>
      ${g.rows.map((r) => `<tr class="${r.regressed ? "regressed" : ""}"><td class="mono">${esc(r.name)}</td><td>${passCell(r.baseline)}</td><td>${passCell(r.after)}</td></tr>`).join("")}
    </tbody></table></div>
    <p class="gate-foot ${g.regressions.length ? "t-bad" : "t-ok"}">${g.regressions.length ? `Regressed: ${g.regressions.map(esc).join(", ")}` : `Every gate that passed before still passes (${g.held} of ${g.heldOf}).`}</p>
  </section>`;
}

function review(run) {
  const r = run.review;
  return `<section class="card review" aria-labelledby="h-rev">
    <h2 id="h-rev">Review</h2>
    <p class="rev-head"><span class="who who-agent">${esc(r.by)}</span> <span class="role">agent</span> <span class="pill pill-${r.verdict === "approve" ? "ok" : "warn"}">${r.verdict === "approve" ? "Approved" : "Changes requested"}</span> <span class="muted">round ${r.rounds}</span></p>
    <ol class="rev-notes">${r.notes.map((n) => `<li>${md(n)}</li>`).join("")}</ol>
  </section>`;
}

function prCard(run) {
  const p = run.pr, a = run.approval;
  return `<section class="card pr" aria-labelledby="h-pr">
    <h2 id="h-pr">Pull request</h2>
    <p class="pr-approved">Approved by <span class="who who-person">${esc(a.by)}</span> <span class="role">person</span> <time datetime="${a.at}">${absTime(a.at)}</time></p>
    <a class="pr-link" href="${esc(p.url)}">${esc(p.url.replace("https://github.com/", ""))}</a>
    <dl class="pr-meta"><div><dt>Branch</dt><dd class="mono">${esc(p.branch)}</dd></div><div><dt>Files</dt><dd>${p.filesChanged}</dd></div><div><dt>Lines</dt><dd><span class="t-ok">+${p.additions}</span> <span class="t-bad">−${p.deletions}</span></dd></div></dl>
  </section>`;
}

function timeline(run) {
  const rows = log(run);
  const kindLabel = (k) => ({ requested: "Requested", in_review: "Review", blocked: "Held", done: "Done", decision: "Human call", approval: "Approval" }[k] ?? k);
  return `<section class="card timeline" aria-labelledby="h-log">
    <h2 id="h-log">${v === "c" ? "Signed log" : "Timeline"}</h2>
    <p class="legend"><span class="lg lg-person">person</span><span class="lg lg-agent">agent</span>${v === "c" ? "" : `<span class="muted">${duration(run.createdAt, run.updatedAt)} from request to PR</span>`}</p>
    <ol class="log">
      ${rows.map((e) => `<li class="ev ${e.agent ? "ev-agent" : "ev-person"} ev-${e.kind}">
        <time class="ev-time mono" datetime="${e.t}" title="${absTime(e.t)}">${clock(e.t)}</time>
        <span class="ev-av" aria-hidden="true">${esc(e.actor.charAt(0).toUpperCase())}</span>
        <div class="ev-body">
          <p class="ev-meta"><span class="who ${e.agent ? "who-agent" : "who-person"}">${esc(e.actor)}</span> <span class="role">${e.agent ? "agent" : "person"}</span> <span class="ev-kind">${kindLabel(e.kind)}</span></p>
          <p class="ev-text">${md(e.text)}</p>
          ${e.detail ? `<p class="ev-detail">${md(e.detail)}</p>` : ""}
        </div>
      </li>`).join("")}
    </ol>
  </section>`;
}

function runPage(run) {
  return `<a class="back" href="runs.html"><span aria-hidden="true">←</span> All runs</a>
  <header class="title">
    <div class="title-row">
      <h1><span class="mono">${esc(run.runId)}</span> <a href="https://github.com/${esc(run.repo)}">${esc(run.repo)}</a></h1>
      ${status(run)}
    </div>
    <p class="requested">Requested by <span class="who who-person">${esc(run.requestedBy)}</span> in ~${esc(run.room)}, <time datetime="${run.createdAt}">${absTime(run.createdAt)}</time>. Migration <span class="mono">${esc(run.migration)}</span>.</p>
    ${storyLine(run)}
  </header>
  ${track(run)}
  ${v === "b" ? `<div class="console">
      <div class="console-main">
        <div class="grid2">${findings(run)}${decisions(run)}</div>
        ${fixes(run)}
        <div class="grid2">${gatesTable(run)}${review(run)}</div>
      </div>
      <aside class="console-side">${prCard(run)}${timeline(run)}</aside>
    </div>`
  : v === "c" ? `
    <div class="grid2">${findings(run)}${decisions(run)}</div>
    ${fixes(run)}
    <div class="grid2">${gatesTable(run)}${review(run)}</div>
    ${prCard(run)}
    ${timeline(run)}`
  : `
    <div class="grid2">${findings(run)}${decisions(run)}</div>
    ${fixes(run)}
    ${gatesTable(run)}
    <div class="grid2">${review(run)}${prCard(run)}</div>
    ${timeline(run)}`}`;
}

async function main() {
  try {
    const runs = await loadRuns();
    if (document.body.dataset.page === "run") {
      const id = location.hash.slice(1) || runs[0].runId;
      const run = runs.find((r) => r.runId === id);
      root.innerHTML = header() + (run ? `<main>${runPage(run)}</main>` : `<main><p>No run called ${esc(id)}.</p></main>`);
    } else {
      root.innerHTML = header() + `<main>${stats(summary(runs))}<h2 class="list-h">Runs</h2><div class="run-list">${runs.map(runCard).join("")}</div></main>`;
    }
  } catch (err) {
    root.innerHTML = header() + `<main><p class="error">Can't read the ledger folder. ${esc(err.message)}</p></main>`;
  }
}
main();

/* Shared helpers for the paper-logbook mockup. Pure functions only:
 * stage/pill mapping mirrors ui/src/format.ts, isAgent mirrors its rule.
 * No data is invented — every value is passed in from the ledger JSON. */
(function (global) {
  "use strict";

  // ------------------------------------------------------------------
  // Stage model: 9 stages, 0-8. Requested → Scanned → Human calls →
  // Shim fixes → Parallel fixes → Gates → Review → Approval → PR.
  // ------------------------------------------------------------------
  var STAGE_LABELS = [
    "Requested",
    "Scanned",
    "Human calls",
    "Shim fixes",
    "Parallel fixes",
    "Gates",
    "Review",
    "Approval",
    "PR",
  ];
  var STAGE_COUNT = STAGE_LABELS.length;

  var STATUS_STAGE = {
    requested: { stage: 0, state: "current" },
    cloning: { stage: 0, state: "current" },
    scanned: { stage: 1, state: "current" },
    awaiting_decision: { stage: 2, state: "waiting" },
    fixing_deterministic: { stage: 3, state: "current" },
    fixing_parallel: { stage: 4, state: "current" },
    gating: { stage: 5, state: "current" },
    in_review: { stage: 6, state: "current" },
    awaiting_approval: { stage: 7, state: "waiting" },
    opening_pr: { stage: 8, state: "current" },
    done: { stage: 8, state: "done" },
  };

  function stageOfStatus(status) {
    var row = STATUS_STAGE[status];
    return row ? row.stage : undefined;
  }

  function stageFromEvents(events) {
    var stage = 0;
    var list = Array.isArray(events) ? events : [];
    for (var i = 0; i < list.length; i++) {
      var s = list[i] && list[i].status;
      var idx = stageOfStatus(s);
      if (idx !== undefined && s !== "blocked" && s !== "failed") stage = idx;
    }
    return stage;
  }

  function statusStage(status, events) {
    if (status === "blocked" || status === "failed") return stageFromEvents(events);
    return stageOfStatus(status) !== undefined ? stageOfStatus(status) : 0;
  }

  function stageStates(status, events) {
    if (status === "done") {
      var allDone = [];
      for (var k = 0; k < STAGE_COUNT; k++) allDone.push("done");
      return allDone;
    }
    var i = statusStage(status, events);
    var stopped = status === "blocked" || status === "failed";
    var states = [];
    for (var j = 0; j < STAGE_COUNT; j++) {
      if (j < i) states.push("done");
      else if (j === i)
        states.push(stopped ? "current-hollow" : (STATUS_STAGE[status] ? STATUS_STAGE[status].state : "current"));
      else states.push("future");
    }
    return states;
  }

  function stageTimestamps(events) {
    var ts = [];
    for (var k = 0; k < STAGE_COUNT; k++) ts.push(null);
    var list = Array.isArray(events) ? events : [];
    for (var i = 0; i < list.length; i++) {
      var ev = list[i];
      var idx = stageOfStatus(ev.status);
      if (idx !== undefined && ev.t) ts[idx] = ev.t;
    }
    return ts;
  }

  // ------------------------------------------------------------------
  // Pill text + color (02 §6). Token name only, CSS maps it.
  // ------------------------------------------------------------------
  var PILL_TEXT = {
    requested: "Starting",
    cloning: "Starting",
    scanned: "Scanned",
    awaiting_decision: "Needs a human call",
    fixing_deterministic: "Shim fixing",
    fixing_parallel: "Subagents fixing",
    gating: "Running gates",
    in_review: "In review",
    awaiting_approval: "Waiting for approval",
    opening_pr: "Opening PR",
    done: "PR opened",
    blocked: "Blocked",
    failed: "Failed",
  };

  var PILL_COLOR = {
    requested: "accent",
    cloning: "accent",
    scanned: "accent",
    awaiting_decision: "warn",
    fixing_deterministic: "accent",
    fixing_parallel: "accent",
    gating: "accent",
    in_review: "accent",
    awaiting_approval: "warn",
    opening_pr: "accent",
    done: "ok",
    blocked: "warn",
    failed: "bad",
  };

  function pillText(status) {
    return PILL_TEXT[status] !== undefined ? PILL_TEXT[status] : status;
  }

  function pillColor(status) {
    return PILL_COLOR[status] !== undefined ? PILL_COLOR[status] : "accent";
  }

  // ------------------------------------------------------------------
  // Labels.
  // ------------------------------------------------------------------
  var SEVERITY_LABEL = { break: "Break", silent: "Silent", deprecated: "Deprecated" };
  var SEVERITY_COLOR = { break: "bad", silent: "silent", deprecated: "muted" };
  var KIND_LABEL = {
    status: "Status",
    message: "Note",
    decision: "Decision",
    fix: "Fix",
    gate: "Gate",
    review: "Review",
    approval: "Approval",
    pr: "PR",
    error: "Error",
  };

  // Agent = name starts with "shim-" (covers shim-fixer:<file>). Mirrors
  // ui/src/format.ts isAgent. The person/agent legibility rule.
  function isAgent(actor) {
    return typeof actor === "string" && actor.indexOf("shim-") === 0;
  }

  // Deterministic hash of the actor to one of 4 neutral avatar tokens
  // (02 §5.2 #8: "the color comes from a hash of the actor name … never
  // random at render"). The tokens are the status roles; yellow is a mark,
  // so it stays out of the avatar palette.
  var AVATAR_COLORS = ["ok", "warn", "bad", "muted"];
  function actorColor(actor) {
    var h = 0;
    for (var i = 0; i < actor.length; i++) h = (h * 31 + actor.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  }

  // ------------------------------------------------------------------
  // Time (Intl only, no date library) — mirrors format.ts.
  // ------------------------------------------------------------------
  function absTime(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  }

  function relTime(iso) {
    var then = Date.parse(iso);
    if (isNaN(then)) return "";
    var diff = then - Date.now();
    var abs = Math.abs(diff);
    var rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
    if (abs < 60000) return rtf.format(Math.round(diff / 1000), "second");
    if (abs < 3600000) return rtf.format(Math.round(diff / 60000), "minute");
    if (abs < 86400000) return rtf.format(Math.round(diff / 3600000), "hour");
    if (abs < 86400000 * 14) return rtf.format(Math.round(diff / 86400000), "day");
    if (abs < 86400000 * 60) return rtf.format(Math.round(diff / 86400000 * 7), "week");
    if (abs < 86400000 * 365) return rtf.format(Math.round(diff / 86400000 * 30), "month");
    return rtf.format(Math.round(diff / 86400000 * 365), "year");
  }

  // ------------------------------------------------------------------
  // Small utilities.
  // ------------------------------------------------------------------
  function num(v) {
    return typeof v === "number" ? v : 0;
  }

  function gateStats(run) {
    var baseline = (run.gates && run.gates.baseline) || {};
    var after = (run.gates && run.gates.after) || {};
    var seen = {};
    var keys = [];
    var all = Object.keys(baseline).concat(Object.keys(after));
    for (var i = 0; i < all.length; i++) {
      if (!seen[all[i]]) {
        seen[all[i]] = true;
        keys.push(all[i]);
      }
    }
    var green = keys.filter(function (k) {
      return after[k] === true;
    }).length;
    return { green: green, total: keys.length };
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  global.Board = {
    STAGE_LABELS: STAGE_LABELS,
    STAGE_COUNT: STAGE_COUNT,
    stageStates: stageStates,
    stageTimestamps: stageTimestamps,
    pillText: pillText,
    pillColor: pillColor,
    SEVERITY_LABEL: SEVERITY_LABEL,
    SEVERITY_COLOR: SEVERITY_COLOR,
    KIND_LABEL: KIND_LABEL,
    isAgent: isAgent,
    actorColor: actorColor,
    absTime: absTime,
    relTime: relTime,
    num: num,
    gateStats: gateStats,
    esc: esc,
  };
})(typeof window !== "undefined" ? window : globalThis);

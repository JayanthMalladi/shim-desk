// Shim Desk — status / label / time formatting (02-UI-SPEC §4, §6).
//
// Pure, framework-free helpers used by StatusPill, StageTrack and (wave 3)
// Timeline. Signatures accept plain status strings and structural "run-ish"
// objects so the unit tests do not depend on the generated ../types.ts that
// UI-1 is producing in parallel.

export type PillColor = "accent" | "ok" | "warn" | "bad";

/** Per-stage state. Exactly the five values 02 §6 + 02 §5.2 render:
 *  done (solid --ok) | current (solid --accent) | waiting (solid --warn,
 *  waiting on a human) | current-hollow (stopped: reached but not completed)
 *  | future (hollow). */
export type StageState = "done" | "current" | "waiting" | "current-hollow" | "future";

/** One ledger event (structural; the generated `Run` events use the same shape). */
export interface RunEvent {
  t?: string;
  kind?: string;
  actor?: string;
  text?: string;
  status?: string;
}

/** Minimal structural "run" so format.ts compiles without ../types.ts. */
export interface RunLike {
  status: string;
  events?: RunEvent[];
}

// ---------------------------------------------------------------------------
// Stage model: 9 stages, indices 0–8, in pipeline order.
// Requested → Scanned → Human calls → Shim fixes → Parallel fixes → Gates
// → Review → Approval → PR
// ---------------------------------------------------------------------------
export const STAGE_LABELS = [
  "Requested",
  "Scanned",
  "Human calls",
  "Shim fixes",
  "Parallel fixes",
  "Gates",
  "Review",
  "Approval",
  "PR",
] as const;
export const STAGE_COUNT = STAGE_LABELS.length; // 9

type NormalStatus =
  | "requested"
  | "cloning"
  | "scanned"
  | "awaiting_decision"
  | "fixing_deterministic"
  | "fixing_parallel"
  | "gating"
  | "in_review"
  | "awaiting_approval"
  | "opening_pr"
  | "done";

// The "Stage index" + "Stage state" columns of 02 §6 (rows, excluding the
// terminal blocked/failed, which are resolved from events below).
const STATUS_STAGE: Record<NormalStatus, { stage: number; state: StageState }> = {
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

function stageOfStatus(status: unknown): number | undefined {
  return typeof status === "string" ? STATUS_STAGE[status as NormalStatus]?.stage : undefined;
}

/** True if the actor string is an agent (starts with `shim-`, which also
 *  covers `shim-fixer:<file>`). */
export function isAgent(actor: string): boolean {
  return actor.startsWith("shim-") || actor.startsWith("shim-fixer:");
}

// ---------------------------------------------------------------------------
// Stage resolution
// ---------------------------------------------------------------------------

/** Stage index (0–8) of the LAST non-blocked/non-failed status recorded in
 *  `events`. Used for the terminal `blocked` / `failed` rows of 02 §6.
 *  Falls back to stage 0 (Requested) when no active status was recorded. */
export function stageFromEvents(events?: RunEvent[]): number {
  let stage = 0;
  const list = Array.isArray(events) ? events : [];
  for (const ev of list) {
    const s = ev && typeof ev === "object" ? (ev as RunEvent).status : undefined;
    const idx = stageOfStatus(s);
    if (idx !== undefined && s !== "blocked" && s !== "failed") stage = idx;
  }
  return stage;
}

/** Stage index (0–8) for a status. For `blocked` / `failed` the index is
 *  recovered from `events` (stage of last active status). */
export function statusStage(status: string, events?: RunEvent[]): number {
  if (status === "blocked" || status === "failed") return stageFromEvents(events);
  return stageOfStatus(status) ?? 0;
}

/** The 9 stage states for a status: everything before the current stage is
 *  `done`, everything after is `future`, and the current stage is `waiting`,
 *  `current` or — for a stopped (blocked/failed) run — `current-hollow`.
 *  A `done` run marks all nine stages `done` ("all complete"). */
export function stageStates(status: string, events?: RunEvent[]): StageState[] {
  if (status === "done") return new Array<StageState>(STAGE_COUNT).fill("done");

  const i = statusStage(status, events);
  const stopped = status === "blocked" || status === "failed";
  const states = new Array<StageState>(STAGE_COUNT).fill("future");
  for (let k = 0; k < STAGE_COUNT; k++) {
    if (k < i) states[k] = "done";
    else if (k === i) states[k] = stopped ? "current-hollow" : (STATUS_STAGE[status as NormalStatus]?.state ?? "current");
  }
  return states;
}

/** Per-stage timestamp (ISO string or null) from `events`: the last event
 *  whose status maps to that stage supplies its time. Used to show a stage's
 *  time on hover/focus in StageTrack. */
export function stageTimestamps(events?: RunEvent[]): (string | null)[] {
  const ts = new Array<string | null>(STAGE_COUNT).fill(null);
  const list = Array.isArray(events) ? events : [];
  for (const ev of list) {
    const s = ev && typeof ev === "object" ? (ev as RunEvent).status : undefined;
    const idx = stageOfStatus(s);
    if (idx !== undefined && ev?.t) ts[idx] = ev.t;
  }
  return ts;
}

// ---------------------------------------------------------------------------
// Pill text + color (02 §6 "Pill text" / "Pill color" columns)
// ---------------------------------------------------------------------------
const PILL_TEXT: Record<string, string> = {
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

export function pillText(status: string, _events?: RunEvent[]): string {
  return PILL_TEXT[status] ?? status;
}

const PILL_COLOR: Record<string, PillColor> = {
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

/** Token name (not a hex) so CSS/`styles.css` can map it: 'accent' | 'ok' |
 *  'warn' | 'bad'. */
export function pillColor(status: string, _events?: RunEvent[]): PillColor {
  return PILL_COLOR[status] ?? "accent";
}

// ---------------------------------------------------------------------------
// Label maps
// ---------------------------------------------------------------------------

// Severity (02 §4: break=--bad, silent=--silent, deprecated=--muted).
export const SEVERITY_LABEL: Record<string, string> = {
  break: "Break",
  silent: "Silent",
  deprecated: "Deprecated",
};
export const SEVERITY_COLOR: Record<string, string> = {
  break: "bad",
  silent: "silent",
  deprecated: "muted",
};
export function severityLabel(sev: string): string {
  return SEVERITY_LABEL[sev] ?? sev;
}
export function severityColor(sev: string): string {
  return SEVERITY_COLOR[sev] ?? "muted";
}

// Event kind labels (02 §5.2 Timeline "kind label").
export const KIND_LABEL: Record<string, string> = {
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
export function kindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind;
}

// Raw human status labels (distinct from the pill text, which is short).
export const STATUS_LABEL: Record<string, string> = {
  requested: "Requested",
  cloning: "Cloning",
  scanned: "Scanned",
  awaiting_decision: "Awaiting decision",
  fixing_deterministic: "Fixing (deterministic)",
  fixing_parallel: "Fixing (parallel)",
  gating: "Gating",
  in_review: "In review",
  awaiting_approval: "Awaiting approval",
  opening_pr: "Opening PR",
  done: "Done",
  blocked: "Blocked",
  failed: "Failed",
};
export function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

// ---------------------------------------------------------------------------
// Time formatting (02 §2: Intl only, no date library)
// ---------------------------------------------------------------------------

/** "2 hours ago" / "in 3 minutes" — relative to now, via
 *  Intl.RelativeTimeFormat. */
export function relTime(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const diff = then - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (abs < 60_000) return rtf.format(Math.round(diff / 1_000), "second");
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), "minute");
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), "hour");
  if (abs < 86_400_000 * 14) return rtf.format(Math.round(diff / 86_400_000), "day");
  if (abs < 86_400_000 * 60) return rtf.format(Math.round(diff / 86_400_000 * 7), "week");
  if (abs < 86_400_000 * 365) return rtf.format(Math.round(diff / 86_400_000 * 30), "month");
  return rtf.format(Math.round(diff / 86_400_000 * 365), "year");
}

/** "Nov 6, 2026, 09:31" — absolute, via Intl.DateTimeFormat. */
export function absTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

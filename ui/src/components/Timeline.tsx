import type { ShimDeskRun } from "../types";
import { absTime, isAgent, kindLabel, statusLabel } from "../format";
import { Code } from "./Code";

const AVATAR_COLORS = ["var(--accent, #2F5D50)", "var(--ok, #2E7D4F)", "var(--warn, #B26B00)", "var(--bad, #B3261E)"];

/** Deterministic hash of an actor name to one of 4 tokens (02 §5.2 #8: never
 *  random at render). Kept for callers; the signed log marks person vs agent
 *  with its own row style. */
export function actorColor(actor: string): string {
  let h = 0;
  for (let i = 0; i < actor.length; i++) h = (h * 31 + actor.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

interface Row {
  t: string;
  actor: string;
  kind: string;
  status?: string;
  text: string;
  detail?: string;
}

const TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const clock = (t: string) => {
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? "" : TIME.format(d);
};

/** The log rows: every event, plus the human calls and the approval when the
 *  ledger kept them only in decisions[] / approval (no event of that kind),
 *  so every human step shows up in the log. Oldest first. */
export function logRows(run: Pick<ShimDeskRun, "events" | "decisions" | "approval" | "findings">): Row[] {
  const events = run.events ?? [];
  const rows: Row[] = events.map((e) => ({ t: e.t, actor: e.actor ?? "unknown", kind: e.kind, status: e.status, text: e.text ?? "" }));
  if (!events.some((e) => e.kind === "decision")) {
    for (const d of run.decisions ?? []) {
      const chosen = d.options?.[d.choice];
      rows.push({
        t: d.at,
        actor: d.by,
        kind: "decision",
        text: `Made the call on ${d.ruleId}${chosen ? `: ${chosen}` : ""}`,
        detail: run.findings?.items?.find((f) => f.ruleId === d.ruleId)?.message,
      });
    }
  }
  if (run.approval?.at && !events.some((e) => e.kind === "approval")) {
    rows.push({ t: run.approval.at, actor: run.approval.by ?? "unknown", kind: "approval", text: "Approved the PR" });
  }
  const ms = (t: string) => {
    const v = Date.parse(t);
    return Number.isNaN(v) ? Infinity : v;
  };
  return rows.sort((a, b) => ms(a.t) - ms(b.t));
}

/** Signed log (02 §5.2 #8): ruled rows, time in the margin, the text first and
 *  "signed <actor>" under it with a person/agent label. People's rows are
 *  marked in yellow so the human calls stand out at a glance. */
export function Timeline({ run }: { run: Pick<ShimDeskRun, "events" | "decisions" | "approval" | "findings"> }) {
  const rows = logRows(run);
  if (rows.length === 0) return null;

  return (
    <section className="card timeline" aria-label="Timeline">
      <h2>Signed log</h2>
      <p className="legend">
        <span className="lg lg-person">person</span>
        <span className="lg lg-agent">agent</span>
      </p>
      <ol className="log">
        {rows.map((r, i) => {
          const agent = isAgent(r.actor);
          const label =
            r.status === "blocked" ? "Held" : r.kind === "decision" ? "Human call" : r.kind === "status" && r.status ? statusLabel(r.status) : kindLabel(r.kind);
          return (
            <li key={`${r.t}:${i}`} className={`ev ${agent ? "ev-agent" : "ev-person"}${r.status === "blocked" ? " ev-blocked" : ""}`}>
              <time className="ev-time mono" dateTime={r.t} title={absTime(r.t)}>
                {clock(r.t)}
              </time>
              <div className="ev-body">
                <p className="ev-meta">
                  <span className={`who ${agent ? "who-agent" : "who-person"}`}>{r.actor}</span>{" "}
                  <span className="role">{agent ? "agent" : "person"}</span> <span className="ev-kind">{label}</span>
                </p>
                <p className="ev-text">
                  <Code text={r.text} />
                </p>
                {r.detail ? (
                  <p className="ev-detail">
                    <Code text={r.detail} />
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default Timeline;

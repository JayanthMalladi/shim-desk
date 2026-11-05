import type { ShimDeskRun } from "../types";
import { absTime, isAgent, kindLabel } from "../format";

const AVATAR_COLORS = ["var(--accent, #2F5D50)", "var(--ok, #2E7D4F)", "var(--warn, #B26B00)", "var(--bad, #B3261E)"];

/** Deterministic hash of an actor name to one of the 4 neutral avatar tokens
 *  (02 §5.2 #8: "the color comes from a hash of the actor name … never
 *  random at render"). */
export function actorColor(actor: string): string {
  let h = 0;
  for (let i = 0; i < actor.length; i++) h = (h * 31 + actor.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** Timeline (02 §5.2 #8): every events[] entry, oldest first. Each shows the
 *  time, an actor avatar (initial in a circle, hash-colored), the actor name
 *  labelled "agent"/"person" (via isAgent), the kind label and the text. */
export function Timeline({ events }: { events?: ShimDeskRun["events"] }) {
  const list = [...(events ?? [])].sort((a, b) => {
    const ta = Date.parse(a.t);
    const tb = Date.parse(b.t);
    if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
    if (Number.isNaN(ta)) return 1;
    if (Number.isNaN(tb)) return -1;
    return ta - tb;
  });

  if (list.length === 0) return null;

  return (
    <section className="card" aria-label="Timeline">
      <h3 style={{ marginBottom: 12 }}>Timeline</h3>
      <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
        {list.map((ev, i) => {
          const actor = ev.actor ?? "unknown";
          const agent = isAgent(actor);
          const initial = actor.charAt(0).toUpperCase() || "?";
          return (
            <li key={`${ev.t}:${i}`} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span
                aria-hidden="true"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: actorColor(actor),
                  color: "var(--text, #1C1B19)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  flex: "0 0 auto",
                  marginTop: 2,
                }}
              >
                {initial}
              </span>
              <div style={{ fontSize: "0.9rem", minWidth: 0 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "baseline", flexWrap: "wrap" }}>
                  <strong>{actor}</strong>
                  <span className="chip muted" style={{ fontSize: "0.7rem" }}>{agent ? "agent" : "person"}</span>
                  <span className="chip muted" style={{ fontSize: "0.7rem" }}>{kindLabel(ev.kind)}</span>
                  <span className="muted" style={{ fontSize: "0.8rem" }}>{absTime(ev.t)}</span>
                </div>
                {ev.text ? <div style={{ marginTop: 2, overflowWrap: "break-word" }}>{ev.text}</div> : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default Timeline;

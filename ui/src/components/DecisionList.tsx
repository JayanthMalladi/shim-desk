import type { ShimDeskRun } from "../types";
import { relTime } from "../format";

/** Human decisions (02 §5.2 #3, right column). Each shows the question, the
 *  options with the chosen one marked, and "{by} · {rel time}". When there
 *  are none: "No human calls needed". */
export function DecisionList({ decisions }: { decisions?: ShimDeskRun["decisions"] }) {
  const list = decisions ?? [];

  return (
    <section className="card" aria-label="Human decisions">
      <h3 style={{ marginBottom: 12 }}>Human calls</h3>
      {list.length === 0 ? (
        <p className="muted" style={{ marginTop: 0 }}>No human calls needed</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {list.map((d, i) => {
            const chosen = d.options?.[d.choice];
            return (
              <div key={`${d.ruleId}:${i}`} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 12, marginBottom: 0 }}>
                <div style={{ fontSize: "0.8rem", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: "var(--muted)" }}>
                  {d.ruleId}
                </div>
                <div style={{ margin: "4px 0 8px" }}>{d.question}</div>
                <ol style={{ margin: "0 0 4px", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 2, fontSize: "0.9rem" }}>
                  {(d.options ?? []).map((opt, j) => (
                    <li key={j} style={j === d.choice ? { fontWeight: 700 } : undefined}>
                      {j === d.choice ? "✓ " : ""}{opt}
                    </li>
                  ))}
                </ol>
                {chosen !== undefined ? <div style={{ fontSize: "0.85rem" }}>Call: <strong>{chosen}</strong></div> : null}
                <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{d.by} · {relTime(d.at)}</div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default DecisionList;

import type { ShimDeskRun } from "../types";
import { severityLabel, severityColor } from "../format";

type Findings = ShimDeskRun["findings"];

const num = (v: unknown): number => (typeof v === "number" ? v : 0);

const SEVERITIES = ["break", "silent", "deprecated"] as const;
const FIXES = ["auto", "agent", "manual"] as const;

/** Findings summary (02 §5.2 #3, left column): three horizontal severity
 *  bars with counts, a byFix line, and a highlighted box for the top finding
 *  labelled "Most important silent change". */
export function FindingsSummary({ findings }: { findings?: Findings }) {
  const total = num(findings?.total);
  const bySeverity = findings?.bySeverity ?? {};
  const byFix = findings?.byFix ?? {};
  const top = findings?.top;
  const max = Math.max(1, ...SEVERITIES.map((s) => num(bySeverity[s])));

  return (
    <section className="card" aria-label="Findings summary">
      <h3 style={{ marginBottom: 12 }}>
        Findings {total ? <span className="muted">({total})</span> : null}
      </h3>

      {/* Three horizontal severity bars with counts. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {SEVERITIES.map((sev) => {
          const count = num(bySeverity[sev]);
          const pct = total ? Math.round((count / total) * 100) : 0;
          return (
            <div key={sev} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 84, fontSize: "0.85rem", color: "var(--muted)" }}>
                {severityLabel(sev)}
              </span>
              <div style={{ flex: 1, height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${(count / max) * 100}%`,
                    height: "100%",
                    background: `var(--${severityColor(sev)}, var(--muted))`,
                  }}
                  role="img"
                  aria-label={`${severityLabel(sev)}: ${count} (${pct}%)`}
                />
              </div>
              <span style={{ width: 32, textAlign: "right", fontSize: "0.85rem" }}>{count}</span>
            </div>
          );
        })}
      </div>

      {/* byFix line: auto / agent / manual. */}
      <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: 12 }}>
        Fixed: {FIXES.map((f) => `${f} ${num(byFix[f])}`).join(" · ")}
      </div>

      {/* Highlighted box for the top finding. */}
      {top ? (
        <div
          style={{
            borderLeft: "3px solid var(--silent, #7A4FB5)",
            background: "color-mix(in srgb, var(--silent, #7A4FB5) 8%, var(--surface))",
            padding: "8px 12px",
            borderRadius: 4,
          }}
        >
          <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--silent, #7A4FB5)" }}>
            Most important silent change
          </div>
          <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "0.85rem", margin: "4px 0" }}>
            {top.file}:{top.line} · <span>{top.ruleId}</span>
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--text)" }}>{top.message}</div>
        </div>
      ) : null}
    </section>
  );
}

export default FindingsSummary;

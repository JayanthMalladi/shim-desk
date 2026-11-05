import { useState } from "react";
import type { ShimDeskRun } from "../types";
import { severityLabel, severityColor } from "../format";

const num = (v: unknown): number => (typeof v === "number" ? v : 0);

/** Collapsible full findings list (02 §5.2 #3). Collapsed by default; every
 *  item shows file, line, severity, fix, rule, and the message truncated to
 *  one line (full text in a `title` attribute). The table scrolls inside its
 *  own `.table-scroll` container on narrow screens (02 §4). */
export function FindingsTable({ findings }: { findings?: ShimDeskRun["findings"] }) {
  const [open, setOpen] = useState(false);
  const items = findings?.items ?? [];

  if (items.length === 0) return null;

  return (
    <section className="card" aria-label="All findings">
      <button
        className="section-toggle"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "−" : "+"} All findings ({items.length})
      </button>
      {open ? (
        <div className="table-scroll" style={{ margin: "8px 0" }}>
          <table className="table">
            <thead>
              <tr>
                <th>File</th>
                <th>Line</th>
                <th>Severity</th>
                <th>Fix</th>
                <th>Rule</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {items.map((f, i) => (
                <tr key={`${f.file}:${f.line}:${i}`}>
                  <td className="mono">{f.file}</td>
                  <td>{f.line}</td>
                  <td>
                    <span style={{ color: `var(--${severityColor(f.severity)}, var(--muted))` }}>
                      {severityLabel(f.severity)}
                    </span>
                  </td>
                  <td>{f.fix}</td>
                  <td className="mono">{f.ruleId}</td>
                  <td
                    style={{
                      maxWidth: 280,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={f.message}
                  >
                    {f.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

export default FindingsTable;

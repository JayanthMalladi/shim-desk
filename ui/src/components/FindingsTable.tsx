import { useState } from "react";
import type { ShimDeskRun } from "../types";
import { severityLabel } from "../format";

/** Collapsible full findings list (02 §5.2 #3). Collapsed by default; every
 *  item shows file, line, severity, fix, rule, and the message on one line
 *  (full text in `title`). Scrolls inside its own container when narrow. */
export function FindingsTable({ findings }: { findings?: ShimDeskRun["findings"] }) {
  const [open, setOpen] = useState(false);
  const items = findings?.items ?? [];

  if (items.length === 0) return null;

  return (
    <div className="all-findings" aria-label="All findings">
      <button className="section-toggle" type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span aria-hidden="true">{open ? "−" : "+"}</span> All findings ({items.length})
      </button>
      {open ? (
        <div className="table-wrap">
          <table>
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
                    <span className={`sev-tag-${f.severity}`}>{severityLabel(f.severity)}</span>
                  </td>
                  <td>{f.fix}</td>
                  <td className="mono">{f.ruleId}</td>
                  <td className="msg" title={f.message}>
                    {f.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

export default FindingsTable;

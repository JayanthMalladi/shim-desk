import type { ShimDeskRun } from "../types";
import { severityLabel } from "../format";
import { Code } from "./Code";

type Findings = ShimDeskRun["findings"];

const num = (v: unknown): number => (typeof v === "number" ? v : 0);
const SEVERITIES = ["break", "silent", "deprecated"] as const;

/** Findings summary (02 §5.2 #3, left column): severity bars with counts, the
 *  byFix line, and the top finding as "Most important silent change". */
export function FindingsSummary({ findings }: { findings?: Findings }) {
  const total = num(findings?.total);
  const bySeverity = findings?.bySeverity ?? {};
  const byFix = findings?.byFix ?? {};
  const top = findings?.top;
  const max = Math.max(1, ...SEVERITIES.map((s) => num(bySeverity[s])));

  return (
    <div aria-label="Findings summary">
      <h2>
        Findings {total ? <span className="count">{total}</span> : null}
      </h2>
      {SEVERITIES.map((sev) => {
        const count = num(bySeverity[sev]);
        return (
          <div key={sev} className={`sev sev-${sev}`}>
            <span className="sev-l">{severityLabel(sev)}</span>
            <span className="sev-bar" role="img" aria-label={`${severityLabel(sev)}: ${count}`}>
              <span style={{ ["--w" as string]: `${(count / max) * 100}%` }} />
            </span>
            <span className="sev-n">{count}</span>
          </div>
        );
      })}
      <p className="byfix">
        Fixed by Shim&apos;s rules: {num(byFix.auto)}. By agents: {num(byFix.agent)}. Needed a person:{" "}
        {num(byFix.manual)}.
      </p>
      {top ? (
        <div className="top-silent">
          <p className="ts-label">Most important silent change</p>
          <p className="mono ts-loc">
            {top.file}:{top.line}  {top.ruleId}
          </p>
          <p className="ts-msg">
            <Code text={top.message} />
          </p>
        </div>
      ) : null}
    </div>
  );
}

export default FindingsSummary;

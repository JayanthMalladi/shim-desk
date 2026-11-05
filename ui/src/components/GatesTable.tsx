import type { ShimDeskRun } from "../types";

/** Gates (02 §5.2 #5). Rows = union of gates.baseline & gates.after keys, in
 *  baseline order then new after-only keys; columns Gate · Baseline · After.
 *  Cells show ✅/❌ plus the text "pass"/"fail" (a11y: never symbol alone).
 *  Rows in gates.regressions get a --bad left border. */
export function GatesTable({ gates }: { gates?: ShimDeskRun["gates"] }) {
  const baseline = gates?.baseline ?? {};
  const after = gates?.after ?? {};
  const regressions = gates?.regressions ?? [];

  const keys = [...new Set([...Object.keys(baseline), ...Object.keys(after)])];
  if (keys.length === 0) return null;

  const cell = (v: boolean | undefined) =>
    v === true ? (
      <span style={{ color: "var(--ok, #2E7D4F)" }}>✅ pass</span>
    ) : (
      <span style={{ color: "var(--bad, #B3261E)" }}>❌ fail</span>
    );

  return (
    <section className="card" aria-label="Gates">
      <h3 style={{ marginBottom: 8 }}>Gates</h3>
      <div className="table-scroll">
        <table className="table" style={{ whiteSpace: "normal" }}>
          <thead>
            <tr>
              <th>Gate</th>
              <th>Baseline</th>
              <th>After</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => {
              const regressed = regressions.includes(k);
              return (
                <tr key={k}>
                  <td
                    className="mono"
                    style={regressed ? { borderLeft: "3px solid var(--bad, #B3261E)", paddingLeft: 9 } : undefined}
                  >
                    {k}
                  </td>
                  <td>{cell(baseline[k])}</td>
                  <td>{cell(after[k])}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: "0.85rem",
          color: regressions.length ? "var(--bad, #B3261E)" : "var(--ok, #2E7D4F)",
        }}
      >
        {regressions.length === 0
          ? "Every gate that passed before still passes"
          : `Regressed: ${regressions.join(", ")}`}
      </div>
    </section>
  );
}

export default GatesTable;

import type { ShimDeskRun } from "../types";

/** Gates (02 §5.2 #5). Rows = union of baseline and after keys; columns
 *  Gate, Baseline, After. Each cell says pass, fail or "not run" (a gate with
 *  no value on that side), never a symbol alone. Regressed rows get a --bad edge. */
export function GatesTable({ gates }: { gates?: ShimDeskRun["gates"] }) {
  const baseline = gates?.baseline ?? {};
  const after = gates?.after ?? {};
  const regressions = gates?.regressions ?? [];

  const keys = [...new Set([...Object.keys(baseline), ...Object.keys(after)])];
  if (keys.length === 0) return null;

  const held = keys.filter((k) => baseline[k] === true);
  const stillPass = held.filter((k) => after[k] === true).length;

  const cell = (v: boolean | undefined) =>
    v === true ? (
      <span className="res ok"><span aria-hidden="true">✓</span> pass</span>
    ) : v === false ? (
      <span className="res bad"><span aria-hidden="true">✗</span> fail</span>
    ) : (
      <span className="res none">not run</span>
    );

  return (
    <section className="card gates" aria-label="Gates">
      <h2>Gates</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Gate</th>
              <th>Baseline</th>
              <th>After</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k} className={regressions.includes(k) ? "regressed" : undefined}>
                <td className="mono">{k}</td>
                <td>{cell(baseline[k])}</td>
                <td>{cell(after[k])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={`gate-foot ${regressions.length ? "t-bad" : "t-ok"}`}>
        {regressions.length === 0
          ? `Every gate that passed before still passes (${stillPass} of ${held.length}).`
          : `Regressed: ${regressions.join(", ")}`}
      </p>
    </section>
  );
}

export default GatesTable;

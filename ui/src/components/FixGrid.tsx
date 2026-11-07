import type { ShimDeskRun } from "../types";
import { Code } from "./Code";

const num = (v: unknown): number => (typeof v === "number" ? v : 0);

/** Parallel fixes (02 §5.2 #4). One tile per fixes[] entry, in the order of
 *  their fix events: file, status, summary, and the agent and model, small. */
export function FixGrid({ run }: { run: ShimDeskRun }) {
  const fixes = run.fixes ?? [];

  return (
    <section className="card fixes" aria-label="Parallel fixes">
      <h2>Fixes</h2>
      <p className="lede">
        Shim fixed <strong>{num(run.autoFixed)} sites</strong> with deterministic rules.{" "}
        <strong>{fixes.length} files</strong> were fixed in parallel by Sonnet subagents.
      </p>
      <ol className="fix-grid">
        {fixes.map((f, i) => (
          <li key={`${f.file}:${i}`} className={`fix fix-${f.status}`}>
            <p className="fix-head">
              <span className="mono fix-file">{f.file}</span>
              <span className={`res ${f.status === "blocked" ? "warn" : "ok"}`}>{f.status}</span>
            </p>
            <p className="fix-sum">
              <Code text={f.summary} />
            </p>
            <p className="fix-model mono">
              {f.agent ? `${f.agent} ` : ""}
              {f.model}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default FixGrid;

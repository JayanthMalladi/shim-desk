import type { Run } from "../data";
import { StatusPill } from "./StatusPill";
import { StageTrack } from "./StageTrack";
import { relTime, absTime } from "../format";

const num = (v: unknown): number => (typeof v === "number" ? v : 0);

/** Gates "green/total": gates that pass after, over the union of baseline/after keys. */
export function gateStats(run: Run): { green: number; total: number } {
  const baseline = run.gates?.baseline ?? {};
  const after = run.gates?.after ?? {};
  const keys = [...new Set([...Object.keys(baseline), ...Object.keys(after)])];
  const green = keys.filter((k) => after[k] === true).length;
  return { green, total: keys.length };
}

/** One run on the Runs page (02 §5.1). A stretched link makes the whole card
 *  open #/run/<runId>; the PR link sits above it so it stays clickable. */
export function RunCard({ run }: { run: Run }) {
  const total = num(run.findings?.total);
  const silent = num(run.findings?.bySeverity?.silent);
  const decisions = run.decisions ?? [];
  const gates = gateStats(run);
  const pr = run.pr?.url;

  return (
    <article className="run-card" aria-label={`run ${run.runId}`}>
      <a className="rc-link" href={`#/run/${run.runId}`} aria-label={`Details for ${run.runId}`} />
      <div className="rc-head">
        <span className="mono rc-id">{run.runId}</span>
        <span className="rc-repo">{run.repo}</span>
        <StatusPill status={run.status} events={run.events} />
        <time className="rc-time" dateTime={run.createdAt} title={absTime(run.createdAt)}>
          {relTime(run.createdAt)}
        </time>
      </div>
      <StageTrack status={run.status} events={run.events} variant="compact" />
      <ul className="chips" aria-label="Run numbers">
        <li>{total} findings</li>
        <li className="chip-silent">{silent} silent</li>
        <li className="chip-human">{decisions.length} human calls</li>
        <li className="chip-ok">gates {gates.green}/{gates.total}</li>
        {pr ? (
          <li className="chip-pr">
            <a href={pr} target="_blank" rel="noreferrer">PR #{pr.split("/").pop()}</a>
          </li>
        ) : null}
      </ul>
    </article>
  );
}

export default RunCard;

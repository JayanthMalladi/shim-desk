import type { ShimDeskRun } from "../types";
import { absTime } from "../format";

const num = (v: unknown): number => (typeof v === "number" ? v : 0);

/** PR card (02 §5.2 #7): who approved and when, the PR link, branch, files
 *  changed, +additions / −deletions. */
export function PrCard({ run }: { run: ShimDeskRun }) {
  const approval = run.approval;
  const pr = run.pr;

  if (!pr && !approval) return null;

  return (
    <section className="card pr" aria-label="Pull request">
      <h2>Pull request</h2>
      {approval ? (
        <p className="pr-approved">
          Approved by <span className="who who-person">{approval.by ?? "unknown"}</span>{" "}
          <span className="role">person</span>
          {approval.at ? <time dateTime={approval.at}>{absTime(approval.at)}</time> : null}
        </p>
      ) : null}
      {pr?.url ? (
        <a className="pr-link" href={pr.url} target="_blank" rel="noreferrer">
          {pr.url.replace("https://github.com/", "")}
        </a>
      ) : null}
      {pr ? (
        <dl className="pr-meta">
          {pr.branch ? (
            <div>
              <dt>Branch</dt>
              <dd className="mono">{pr.branch}</dd>
            </div>
          ) : null}
          <div>
            <dt>Files</dt>
            <dd>{num(pr.filesChanged)}</dd>
          </div>
          <div>
            <dt>Lines</dt>
            <dd>
              <span className="t-ok">+{num(pr.additions)}</span> <span className="t-bad">−{num(pr.deletions)}</span>
            </dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}

export default PrCard;

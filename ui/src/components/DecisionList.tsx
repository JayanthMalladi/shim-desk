import type { ShimDeskRun } from "../types";
import { absTime } from "../format";
import { Code } from "./Code";

/** Human calls (02 §5.2 #3, right column): the question, the options with the
 *  chosen one marked, and who made the call and when. A decision recorded
 *  without a question falls back to the scanner's message for the same rule,
 *  so the reader still sees what the call was about. */
export function DecisionList({
  decisions,
  findings,
}: {
  decisions?: ShimDeskRun["decisions"];
  findings?: ShimDeskRun["findings"];
}) {
  const list = decisions ?? [];

  return (
    <section className="card decisions" aria-label="Human decisions">
      <h2>
        Human calls <span className="count">{list.length}</span>
      </h2>
      {list.length === 0 ? (
        <p className="muted">No human calls needed</p>
      ) : (
        <ol className="dec-list">
          {list.map((d, i) => {
            const topic = findings?.items?.find((f) => f.ruleId === d.ruleId)?.message;
            return (
              <li key={`${d.ruleId}:${i}`} className="dec">
                <p className="mono dec-rule">{d.ruleId}</p>
                <p className="dec-q">{d.question ? d.question : <Code text={topic} />}</p>
                {d.options?.length ? (
                  <ul className="dec-opts">
                    {d.options.map((opt, j) => (
                      <li key={j} className={j === d.choice ? "chosen" : undefined}>
                        {j === d.choice ? <span aria-hidden="true">✓ </span> : null}
                        {opt}
                        {j === d.choice ? <span className="sr"> (chosen)</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="dec-by">
                  <span className="who who-person">{d.by}</span> <span className="role">person</span>{" "}
                  <time dateTime={d.at}>{absTime(d.at)}</time>
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export default DecisionList;

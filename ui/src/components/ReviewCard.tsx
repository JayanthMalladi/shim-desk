import type { ShimDeskRun } from "../types";
import { Code } from "./Code";

/** Review card (02 §5.2 #6): reviewer, verdict pill (approve = --ok,
 *  changes = --warn), "round {rounds}", numbered notes. */
export function ReviewCard({ review }: { review?: ShimDeskRun["review"] }) {
  if (!review) return null;
  const approve = review.verdict !== "changes";

  return (
    <section className="card review" aria-label="Review">
      <h2>Review</h2>
      <p className="rev-head">
        <span className="who who-agent">{review.by}</span> <span className="role">agent</span>{" "}
        <span className={`pill pill-${approve ? "ok" : "warn"}`}>{approve ? "Approved" : "Changes requested"}</span>
        {review.rounds !== undefined ? <span className="muted">round {review.rounds}</span> : null}
      </p>
      {review.notes?.length ? (
        <ol className="rev-notes">
          {review.notes.map((n, i) => (
            <li key={i}>
              <Code text={n} />
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

export default ReviewCard;

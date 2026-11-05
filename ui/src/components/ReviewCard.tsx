import type { ShimDeskRun } from "../types";

/** Review card (02 §5.2 #6): reviewer name, verdict pill (approve = --ok,
 *  changes = --warn), numbered notes, and "round {rounds}". */
export function ReviewCard({ review }: { review?: ShimDeskRun["review"] }) {
  if (!review) return null;

  const verdictColor = review.verdict === "changes" ? "var(--warn, #B26B00)" : "var(--ok, #2E7D4F)";

  return (
    <section className="card" aria-label="Review">
      <h3 style={{ marginBottom: 8 }}>Review</h3>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <span style={{ fontWeight: 600 }}>{review.by}</span>
        <span
          className="status-pill"
          style={{
            color: verdictColor,
            borderColor: verdictColor,
            background: `color-mix(in srgb, ${verdictColor} 12%, var(--surface))`,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: verdictColor,
              display: "inline-block",
              marginRight: 6,
            }}
            aria-hidden="true"
          />
          {review.verdict}
        </span>
        {review.rounds !== undefined ? <span className="muted">round {review.rounds}</span> : null}
      </div>
      {review.notes && review.notes.length ? (
        <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4, fontSize: "0.9rem" }}>
          {review.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

export default ReviewCard;

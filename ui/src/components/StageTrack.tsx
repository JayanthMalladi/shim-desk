import { STAGE_LABELS, stageStates, stageTimestamps, pillText, absTime, type RunEvent } from "../format";

interface StageTrackProps {
  /** Ledger `status`. */
  status: string;
  /** Ledger `events` (per-stage timestamps + terminal row recovery). */
  events?: RunEvent[];
  /** Times the ledger stores outside events: the last human call and the approval. */
  decidedAt?: string;
  approvedAt?: string;
  /** "full" = 9 labelled stages with times; "compact" = one line of boxes. */
  variant?: "full" | "compact";
}

const TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

/** The pipeline track (02 §5.2 #2): stamped boxes in order Requested → … → PR.
 *  Done = ticked, current = accent, waiting on a human = warn, stopped =
 *  hollow warn, future = empty. The state is also in text (screen readers
 *  and the hover/focus title). */
export function StageTrack({ status, events, decidedAt, approvedAt, variant = "full" }: StageTrackProps) {
  const states = stageStates(status, events);
  const stamps = stageTimestamps(events);
  stamps[2] = stamps[2] ?? decidedAt ?? null;
  stamps[7] = stamps[7] ?? approvedAt ?? null;
  const compact = variant === "compact";

  return (
    <ol
      className={`track${compact ? " track-compact" : ""}`}
      aria-label={`${pillText(status, events)}: stage progress`}
    >
      {STAGE_LABELS.map((label, i) => {
        const state = states[i];
        const ts = stamps[i];
        return (
          <li
            key={label}
            className={`st st-${state}`}
            tabIndex={compact ? undefined : 0}
            title={`${label}: ${ts ? absTime(ts) : "time not recorded"}`}
          >
            <span className="st-mark" aria-hidden="true">{state === "done" ? "✓" : ""}</span>
            <span className="st-label">
              {label}
              <span className="sr"> ({state})</span>
            </span>
            {compact ? null : <span className="st-time">{ts ? TIME.format(new Date(ts)) : " "}</span>}
          </li>
        );
      })}
    </ol>
  );
}

export default StageTrack;

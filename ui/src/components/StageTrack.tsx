import {
  STAGE_LABELS,
  stageStates,
  stageTimestamps,
  pillText,
  absTime,
  type RunEvent,
} from "../format";

interface StageTrackProps {
  /** Ledger `status`. */
  status: string;
  /** Ledger `events` (for per-stage timestamps + terminal row recovery). */
  events?: RunEvent[];
  /** "full" = 9 labeled stages; "compact" = one line of dots. */
  variant?: "full" | "compact";
}

/** The pipeline progress track (02 §5.2 #2).
 *  - Full: 9 labeled stages in order Requested → … → PR. Completed = --ok,
 *    current = --accent (or --warn when waiting on a human), future hollow,
 *    stopped (blocked/failed) = a hollow current-hollow marker.
 *  - Each stage shows its timestamp from `events` on hover and on focus
 *    (via the `title` attribute and `aria-label`).
 *  - Compact: a single line of dots, no labels.
 *  States are exposed via `data-state` so the CSS colors the markers. */
export function StageTrack({ status, events, variant = "full" }: StageTrackProps) {
  const states = stageStates(status, events);
  const stamps = stageTimestamps(events);
  const compact = variant === "compact";

  const items = STAGE_LABELS.map((label, i) => {
    const state = states[i];
    const ts = stamps[i];
    const timeLabel = ts ? absTime(ts) : "";
    const aria: string[] = [label, state];
    if (timeLabel) aria.push(`(${timeLabel})`);
    // title is the hover/focus timestamp (02 §5.2 "shows its timestamp on
    // hover and focus"); empty stages get the stage name only.
    const title = timeLabel ? `${label} — ${timeLabel}` : label;
    return (
      <span
        key={label}
        className={`stage-track__item`}
        data-state={state}
        aria-label={aria.join(" ")}
        title={title}
        tabIndex={0}
        role="img"
      >
        <span className="stage-track__marker" aria-hidden="true" />
        {!compact ? <span className="stage-track__label">{label}</span> : null}
      </span>
    );
  });

  return (
    <div
      className={`stage-track${compact ? " compact" : ""}`}
      role="group"
      aria-label={`${pillText(status, events)} — stage progress`}
    >
      {items}
    </div>
  );
}

export default StageTrack;

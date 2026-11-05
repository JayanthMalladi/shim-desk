import { pillText, pillColor, type RunEvent } from "../format";

interface StatusPillProps {
  /** Ledger `status` (one of the 13 enum values). */
  status: string;
  /** Events, passed through for the terminal rows (blocked/failed). */
  events?: RunEvent[];
  className?: string;
}

/** Renders a status pill. The text is always shown — never color alone
 *  (02 §4 a11y: "every status shown by text as well as color"). The color
 *  token becomes a modifier class (`.status-pill.accent` etc.) that adds a
 *  subtle tint, so color is a redundant cue on top of the label. */
export function StatusPill({ status, events, className }: StatusPillProps) {
  const text = pillText(status, events);
  const color = pillColor(status, events);
  const cls = ["status-pill", color, className].filter(Boolean).join(" ");
  return (
    <span className={cls} title={text}>
      <span className="dot" aria-hidden="true" />
      {text}
    </span>
  );
}

export default StatusPill;

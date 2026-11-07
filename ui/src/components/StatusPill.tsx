import { pillText, pillColor, type RunEvent } from "../format";

interface StatusPillProps {
  /** Ledger `status` (one of the 13 enum values). */
  status: string;
  /** Events, passed through for the terminal rows (blocked/failed). */
  events?: RunEvent[];
  className?: string;
}

/** A status pill. The text is always shown, never colour alone (02 §4). */
export function StatusPill({ status, events, className }: StatusPillProps) {
  const text = pillText(status, events);
  const cls = ["pill", `pill-${pillColor(status, events)}`, className].filter(Boolean).join(" ");
  return <span className={cls}>{text}</span>;
}

export default StatusPill;

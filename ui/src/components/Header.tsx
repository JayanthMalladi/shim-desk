import { isAgent } from "../format";

interface HeaderProps {
  /** Run page: the run id in mono. */
  runId?: string;
  /** Run page: `owner/name`, linked to GitHub. */
  repo?: string;
  /** Current ledger status; renders the StatusPill on the run page. */
  status?: string;
  events?: import("../format").RunEvent[];
  /** Run page: "requested by {x} · {time}". */
  requestedBy?: string;
  createdAt?: string;
  /** True in dev mode only — shows the "Live" badge (02 §5.1). */
  live?: boolean;
}

import { StatusPill } from "./StatusPill";
import { absTime } from "../format";

/** Top-of-page header.
 *  - Runs page: "Shim Desk Ledger" on the left, "Live" badge (dev only) and
 *    a "How this works" link on the right (02 §5.1).
 *  - Run page: runId · repo · StatusPill · "requested by … · time" (02 §5.2). */
export function Header(props: HeaderProps) {
  const { runId, repo, status, events, requestedBy, createdAt, live } = props;
  const isRunPage = Boolean(runId);

  if (!isRunPage) {
    return (
      <div className="header">
        <h1 className="header__title">Shim Desk Ledger</h1>
        <div className="header__meta">
          {live ? (
            <span className="badge">
              <span className="live-dot" aria-hidden="true" />
              Live
            </span>
          ) : null}
          <a
            className="muted"
            href="https://github.com/JayanthMalladi/shim-desk"
          >
            How this works
          </a>
        </div>
      </div>
    );
  }

  // Run page title row (02 §5.2 #1).
  const meta =
    requestedBy || createdAt
      ? `requested by ${requestedBy ?? "unknown"} · ${absTime(createdAt ?? "")}`
      : undefined;

  return (
    <div className="header">
      <h1 className="header__title">
        {runId ? <span className="mono">{runId}</span> : null}
        {repo ? (
          <>
            {" · "}
            <a href={`https://github.com/${repo}`} target="_blank" rel="noreferrer">
              {repo}
            </a>
          </>
        ) : null}
      </h1>
      <div className="header__meta">
        {status ? <StatusPill status={status} events={events} /> : null}
        {meta ? <span className="muted">{meta}</span> : null}
      </div>
    </div>
  );
}

// Re-exported for convenience in components that also want to label actors.
export { isAgent };

export default Header;

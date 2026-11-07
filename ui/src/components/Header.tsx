import { isAgent } from "../format";

interface HeaderProps {
  /** True in dev mode only: shows the "Live" badge (02 §5.1). */
  live?: boolean;
}

/** Top bar on every page: the wedge mark and wordmark on the left, the "Live"
 *  badge (dev only) and a "How this works" link on the right (02 §5.1).
 *  The run page's title row lives in RunPage. */
export function Header({ live }: HeaderProps) {
  return (
    <header className="top">
      <a className="brand" href="#/">
        <span className="mark" aria-hidden="true" />
        Shim Desk <span className="brand-sub">ledger</span>
      </a>
      <nav className="top-meta">
        {live ? (
          <span className="badge">
            <span className="live-dot" aria-hidden="true" />
            Live
          </span>
        ) : null}
        <a href="https://github.com/JayanthMalladi/shim-desk#readme">How this works</a>
      </nav>
    </header>
  );
}

// Re-exported for convenience in components that also want to label actors.
export { isAgent };

export default Header;

import type { ShimDeskRun } from "../types";
import { absTime } from "../format";

const num = (v: unknown): number => (typeof v === "number" ? v : 0);

/** PR card (02 §5.2 #7): the approval line "Approved by {by} · {time}", then
 *  the PR link, branch (mono), files changed, +additions / −deletions. */
export function PrCard({ run }: { run: ShimDeskRun }) {
  const approval = run.approval;
  const pr = run.pr;

  if (!pr && !approval) return null;

  const approvalLine = approval
    ? `Approved by ${approval.by ?? "unknown"}${approval.at ? ` · ${absTime(approval.at)}` : ""}`
    : undefined;

  return (
    <section className="card" aria-label="Pull request">
      <h3 style={{ marginBottom: 8 }}>Pull request</h3>
      {approvalLine ? <div style={{ marginBottom: 8 }}>{approvalLine}</div> : null}
      {pr?.url ? (
        <a
          href={pr.url}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "inline-block",
            marginBottom: 8,
            background: "var(--accent, #2F5D50)",
            color: "#fff",
            padding: "6px 14px",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Open pull request
        </a>
      ) : null}
      {pr?.url ? <div style={{ fontSize: "0.85rem", wordBreak: "break-all", color: "var(--muted)" }}>{pr.url}</div> : null}
      {pr ? (
        <div style={{ marginTop: 8, display: "flex", gap: 16, flexWrap: "wrap", fontSize: "0.85rem" }}>
          {pr.branch ? (
            <span className="mono" style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
              {pr.branch}
            </span>
          ) : null}
          <span>{num(pr.filesChanged)} files changed</span>
          <span style={{ color: "var(--ok, #2E7D4F)" }}>+{num(pr.additions)}</span>
          <span style={{ color: "var(--bad, #B3261E)" }}>−{num(pr.deletions)}</span>
        </div>
      ) : null}
    </section>
  );
}

export default PrCard;

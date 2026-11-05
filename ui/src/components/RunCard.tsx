import type { Run } from "../data";
import { StatusPill } from "./StatusPill";
import { StageTrack } from "./StageTrack";
import { relTime } from "../format";

const num = (v: unknown): number => (typeof v === "number" ? v : 0);

/** Gates "green/total": gates that pass after, over the union of baseline/after keys. */
export function gateStats(run: Run): { green: number; total: number } {
  const baseline = run.gates?.baseline ?? {};
  const after = run.gates?.after ?? {};
  const keys = [...new Set([...Object.keys(baseline), ...Object.keys(after)])];
  const green = keys.filter((k) => after[k] === true).length;
  return { green, total: keys.length };
}

/** One run on the Runs page (02 §5.1). "Stretched link" pattern: an absolutely
 *  positioned <a> fills the whole card (incl. padding), so the entire card
 *  links to #/run/<runId>. The content wrapper is pointer-events:none so
 *  clicks fall through to that link; the PR link (when present) re-enables
 *  pointer events and paints on top, so it stays clickable. No nested <a>. */
export function RunCard({ run }: { run: Run }) {
  const total = num(run.findings?.total);
  const silent = num(run.findings?.bySeverity?.silent);
  const decisions = run.decisions ?? [];
  const gates = gateStats(run);
  const pr = run.pr?.url;

  return (
    <article
      aria-label={`run ${run.runId}`}
      style={{
        position: "relative",
        background: "var(--surface, #fff)",
        border: "1px solid var(--border, #E6E4DE)",
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <a href={`#/run/${run.runId}`} style={{ position: "absolute", inset: 0 }} />
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: 16,
          paddingBottom: pr ? 0 : 16,
          pointerEvents: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span
            className="mono"
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
              fontSize: "0.9em",
            }}
          >
            {run.runId}
          </span>
          <span>{run.repo}</span>
          <span className="muted">{relTime(run.createdAt)}</span>
          <StatusPill status={run.status} events={run.events} />
        </div>
        <StageTrack status={run.status} events={run.events} variant="compact" />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span className="chip">{total} findings</span>
          <span
            className="chip"
            style={{ color: "var(--silent, #7A4FB5)", borderColor: "var(--silent, #7A4FB5)" }}
          >
            {silent} silent
          </span>
          <span className="chip">{decisions.length} decisions</span>
          <span className="chip">gates {gates.green}/{gates.total}</span>
        </div>
      </div>
      {pr ? (
        <a
          href={pr}
          target="_blank"
          rel="noreferrer"
          style={{
            position: "relative",
            pointerEvents: "auto",
            padding: "0 16px 16px 16px",
            fontSize: "0.9rem",
            display: "block",
          }}
        >
          PR: {pr}
        </a>
      ) : null}
    </article>
  );
}

export default RunCard;

import type { ShimDeskRun } from "../types";

const num = (v: unknown): number => (typeof v === "number" ? v : 0);

/** Parallel fixes (02 §5.2 #4). One tile per fixes[] entry, in the order of
 *  their fix events (the parallel finish order): mono file path, status
 *  (done/blocked), summary, and the model shown small. */
export function FixGrid({ run }: { run: ShimDeskRun }) {
  const fixes = run.fixes ?? [];
  const autoFixed = num(run.autoFixed);

  return (
    <section className="card" aria-label="Parallel fixes">
      <h3 style={{ marginBottom: 4 }}>Subagent fixes</h3>
      <p className="muted" style={{ margin: "0 0 12px" }}>
        Shim fixed {autoFixed} sites deterministically. {fixes.length} files fixed in parallel by
        Sonnet subagents.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 8,
        }}
      >
        {fixes.map((f, i) => (
          <div
            key={`${f.file}:${i}`}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderLeft: `3px solid ${f.status === "blocked" ? "var(--warn, #B26B00)" : "var(--ok, #2E7D4F)"}`,
              borderRadius: 8,
              padding: "8px 12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span className="mono" style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "0.9rem" }}>
                {f.file}
              </span>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: f.status === "blocked" ? "var(--warn, #B26B00)" : "var(--ok, #2E7D4F)" }}>
                {f.status}
              </span>
            </div>
            <div style={{ fontSize: "0.85rem", margin: "4px 0" }}>{f.summary}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{f.model}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default FixGrid;

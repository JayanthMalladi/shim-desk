import { useEffect, useState } from "react";
import { listRuns, type Run } from "../data";
import { Header } from "../components/Header";
import { RunCard } from "../components/RunCard";

// Runs page (02 §5.1). Data only via data.ts — no direct fetch.

const EMPTY_COPY =
  "No runs yet. In the ~shim-desk room, ask `@shim upgrade ai to v7 in <your repo>`.";

const num = (v: unknown): number => (typeof v === "number" ? v : 0);

function sortNewestFirst(runs: Run[]): Run[] {
  return [...runs].sort((a, b) => {
    const ta = Date.parse(a.createdAt);
    const tb = Date.parse(b.createdAt);
    if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
    if (Number.isNaN(ta)) return 1;
    if (Number.isNaN(tb)) return -1;
    return tb - ta;
  });
}

export function RunsPage() {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // import.meta.env.DEV is true in `npm run dev` and under vitest; the
  // static build (PROD) must not poll (02 §1).
  const isDev = import.meta.env.DEV;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const hasDocument = typeof document !== "undefined";
    const visible = () => hasDocument && document.visibilityState === "visible";

    const schedule = () => {
      if (!cancelled && isDev && visible()) {
        timer = setTimeout(load, 2000); // poll every 2 s while visible (02 §1)
      }
    };

    const load = () => {
      listRuns()
        .then((list) => {
          if (cancelled) return;
          setRuns(list);
          setError(null);
          schedule();
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : String(err));
          schedule(); // keep polling even on error (02 §5.1 error state)
        });
    };

    load();

    const onVisibilityChange = () => {
      if (!isDev || cancelled) return;
      if (visible()) {
        if (!timer) load(); // resume polling when the tab becomes visible
      } else if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
    };
    if (hasDocument) document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (hasDocument) document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [isDev]);

  const sorted = runs ? sortNewestFirst(runs) : [];

  // Summary strip (02 §5.1): four stat tiles, always computed from the data.
  const stats = [
    { label: "Runs", value: sorted.length },
    {
      label: "PRs opened",
      value: sorted.filter((r) => r.status === "done" && r.pr?.url).length,
    },
    {
      label: "Human decisions",
      value: sorted.reduce((acc, r) => acc + (r.decisions?.length ?? 0), 0),
    },
    {
      label: "Silent breaks caught",
      value: sorted.reduce((acc, r) => acc + num(r.findings?.bySeverity?.silent), 0),
    },
  ];

  return (
    <div className="page">
      <Header live={isDev} />

      {error ? (
        <div
          className="card"
          role="alert"
          style={{ borderLeft: "3px solid var(--bad, #B3261E)", marginBottom: 16 }}
        >
          Can&apos;t read the ledger folder: <span className="muted">{error}</span>
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 8,
          marginBottom: 16,
        }}
      >
        {stats.map((s) => (
          <div key={s.label} className="card" style={{ margin: 0, padding: 12 }}>
            <div style={{ fontSize: "1.6rem", fontWeight: 700, lineHeight: 1.2 }}>{s.value}</div>
            <div className="muted" style={{ fontSize: "0.85rem" }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {runs && sorted.length === 0 ? (
        <p className="muted" style={{ margin: "24px 0" }}>
          {EMPTY_COPY}
        </p>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column" }}>
        {sorted.map((r) => (
          <RunCard key={r.runId} run={r} />
        ))}
      </div>
    </div>
  );
}

export default RunsPage;

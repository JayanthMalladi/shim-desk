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
    { label: sorted.length === 1 ? "run" : "runs", value: sorted.length, cls: "" },
    {
      label: "PRs opened",
      value: sorted.filter((r) => r.status === "done" && r.pr?.url).length,
      cls: "",
    },
    {
      label: "human calls",
      cls: "stat-human",
      value: sorted.reduce((acc, r) => acc + (r.decisions?.length ?? 0), 0),
    },
    {
      label: "silent breaks caught",
      cls: "stat-silent",
      value: sorted.reduce((acc, r) => acc + num(r.findings?.bySeverity?.silent), 0),
    },
  ];

  return (
    <div className="page">
      <Header live={isDev} />

      {error ? (
        <div
          className="banner"
          role="alert"
        >
          Can&apos;t read the ledger folder: <span className="muted">{error}</span>
        </div>
      ) : null}

      <main>
      <section className="stats" aria-label="Summary">
        {stats.map((s) => (
          <div key={s.label} className={`stat${s.cls ? ` ${s.cls}` : ""}`}>
            <span className="stat-n">{s.value}</span>
            <span className="stat-l">{s.label}</span>
          </div>
        ))}
      </section>
      <h2 className="list-h">Runs</h2>

      {runs && sorted.length === 0 ? (
        <p className="muted empty">
          {EMPTY_COPY}
        </p>
      ) : null}

      <div className="run-list">
        {sorted.map((r) => (
          <RunCard key={r.runId} run={r} />
        ))}
      </div>
      </main>
    </div>
  );
}

export default RunsPage;

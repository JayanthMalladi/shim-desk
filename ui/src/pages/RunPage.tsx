import { useEffect, useState } from "react";
import type { ShimDeskRun } from "../types";
import { getRun } from "../data";
import { Header } from "../components/Header";
import { StageTrack } from "../components/StageTrack";
import { FindingsSummary } from "../components/FindingsSummary";
import { FindingsTable } from "../components/FindingsTable";
import { DecisionList } from "../components/DecisionList";
import { FixGrid } from "../components/FixGrid";
import { GatesTable } from "../components/GatesTable";
import { ReviewCard } from "../components/ReviewCard";
import { PrCard } from "../components/PrCard";
import { Timeline } from "../components/Timeline";

// Run page (02 §5.2). Data only via data.getRun — no direct fetch.
//
// `run` is an optional preloaded run: when present (e.g. the unit test that
// imports the committed fixture) the page renders it immediately and does no
// fetch. When absent, the page fetches by `runId` via data.getRun.

interface RunPageProps {
  /** App path: fetch this run via data.getRun. */
  runId?: string;
  /** Test/static path: render this run directly, no fetch. */
  run?: ShimDeskRun;
}

/** The top-to-bottom section layout (02 §5.2 #2–#8). */
function RunDetail({ run }: { run: ShimDeskRun }) {
  const stopped = run.status === "blocked" || run.status === "failed";

  return (
    <div className="page">
      {/* Sticky "← All runs" link at the top. */}
      <a
        href="#/"
        style={{
          position: "sticky",
          top: 0,
          display: "inline-block",
          background: "var(--bg, #FAFAF7)",
          padding: "4px 0",
          marginBottom: 8,
          zIndex: 1,
        }}
      >
        ← All runs
      </a>

      {/* #1 Title row: runId · repo (linked) · StatusPill · requested-by line. */}
      <Header
        runId={run.runId}
        repo={run.repo}
        status={run.status}
        events={run.events}
        requestedBy={run.requestedBy}
        createdAt={run.createdAt}
      />

      {/* Blocked / failed: a banner with the status reason. */}
      {stopped ? (
        <div
          className="card"
          role="alert"
          style={{
            borderLeft: "3px solid var(--bad, #B3261E)",
            background: "color-mix(in srgb, var(--bad, #B3261E) 8%, var(--surface))",
            marginBottom: 16,
          }}
        >
          <strong>
            {run.status === "blocked" ? "Run blocked" : "Run failed"}
          </strong>
          {run.statusReason ? <div>{run.statusReason}</div> : null}
        </div>
      ) : null}

      {/* #2 Full stage track (9 labeled stages). */}
      <div className="card">
        <StageTrack status={run.status} events={run.events} variant="full" />
      </div>

      {/* #3 Two-column grid: left = findings summary + table, right = decisions.
          Two columns above ~760px, one below (min 340px capped at the
          container width so 375px never overflows). */}
      <div
        className="run-detail-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))",
          gap: 16,
        }}
      >
        <div className="run-detail-left" style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <FindingsSummary findings={run.findings} />
          <FindingsTable findings={run.findings} />
        </div>
        <div className="run-detail-right" style={{ minWidth: 0 }}>
          <DecisionList decisions={run.decisions} />
        </div>
      </div>

      {/* #4 Parallel fixes. */}
      <FixGrid run={run} />

      {/* #5 Gates baseline vs after. */}
      <GatesTable gates={run.gates} />

      {/* #6 Review. */}
      <ReviewCard review={run.review} />

      {/* #7 Pull request. */}
      <PrCard run={run} />

      {/* #8 Timeline (events, oldest first). */}
      <Timeline events={run.events} />
    </div>
  );
}

export function RunPage({ runId, run }: RunPageProps) {
  const [fetched, setFetched] = useState<ShimDeskRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  // When `run` is supplied we render it immediately (no fetch, no loading).
  const [loading, setLoading] = useState(!run);

  useEffect(() => {
    if (run || !runId) return; // nothing to fetch
    let alive = true;
    getRun(runId)
      .then((r) => {
        if (!alive) return;
        setFetched(r);
        setError(null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [run, runId]);

  const data = run ?? fetched;

  if (loading) {
    return (
      <div className="page">
        <a href="#/">← All runs</a>
        <p className="muted">Loading run…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="page">
        <a href="#/">← All runs</a>
        <div className="card" role="alert" style={{ borderLeft: "3px solid var(--bad, #B3261E)" }}>
          Can&apos;t read this run: <span className="muted">{error}</span>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="page">
        <a href="#/">← All runs</a>
        <p className="muted">No such run.</p>
      </div>
    );
  }

  return <RunDetail run={data} />;
}

export default RunPage;

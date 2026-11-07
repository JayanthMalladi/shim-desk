import { useEffect, useState } from "react";
import type { ShimDeskRun } from "../types";
import { getRun } from "../data";
import { Header } from "../components/Header";
import { StageTrack } from "../components/StageTrack";
import { StatusPill } from "../components/StatusPill";
import { absTime } from "../format";
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

const num = (v: unknown): number => (typeof v === "number" ? v : 0);

/** One sentence that says what happened, built only from the ledger. */
function StoryLine({ run }: { run: ShimDeskRun }) {
  const f = run.findings;
  if (!f) return null;
  const baseline = run.gates?.baseline ?? {};
  const after = run.gates?.after ?? {};
  const held = Object.keys(baseline).filter((k) => baseline[k] === true);
  const still = held.filter((k) => after[k] === true).length;
  const calls = run.decisions?.length ?? 0;
  return (
    <p className="story">
      Shim found <strong>{num(f.total)} changes</strong> in {num(f.files)} files,{" "}
      <strong className="t-silent">{num(f.bySeverity?.silent)} of them silent</strong>.{" "}
      {calls ? (
        <>
          People made <strong className="t-human">{calls} {calls === 1 ? "call" : "calls"}</strong>
          {run.approval ? " and approved the PR" : ""}; agents did the rest.{" "}
        </>
      ) : null}
      {held.length && run.gates?.after ? (
        <>
          <strong className="t-ok">
            {still} of {held.length}
          </strong>{" "}
          baseline gates still pass.
        </>
      ) : null}
    </p>
  );
}

/** The top-to-bottom section layout (02 §5.2 #1-#8). */
function RunDetail({ run }: { run: ShimDeskRun }) {
  const stopped = run.status === "blocked" || run.status === "failed";
  const decisions = run.decisions ?? [];

  return (
    <div className="page">
      <Header />
      <main>
        <a className="back" href="#/">
          ← All runs
        </a>

        {/* #1 Title row. */}
        <header className="title">
          <div className="title-row">
            <h1>
              <span className="mono">{run.runId}</span>{" "}
              <a href={`https://github.com/${run.repo}`} target="_blank" rel="noreferrer">
                {run.repo}
              </a>
            </h1>
            <StatusPill status={run.status} events={run.events} />
          </div>
          <p className="requested">
            Requested by <span className="who who-person">{run.requestedBy}</span>
            {run.room ? ` in ~${run.room}` : ""}, <time dateTime={run.createdAt}>{absTime(run.createdAt)}</time>.
          </p>
          <StoryLine run={run} />
        </header>

        {stopped ? (
          <div className="banner" role="alert">
            <strong>{run.status === "blocked" ? "Run blocked" : "Run failed"}</strong>
            {run.statusReason ? <p>{run.statusReason}</p> : null}
          </div>
        ) : null}

        {/* #2 Full stage track. */}
        <StageTrack
          status={run.status}
          events={run.events}
          decidedAt={decisions.length ? decisions[decisions.length - 1].at : undefined}
          approvedAt={run.approval?.at}
          variant="full"
        />

        {/* #3 Findings (left) and human calls (right); one column under ~760px. */}
        <div
          className="run-detail-grid"
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))", gap: "var(--s4)", alignItems: "start" }}
        >
          <section className="card findings" style={{ minWidth: 0 }}>
            <FindingsSummary findings={run.findings} />
            <FindingsTable findings={run.findings} />
          </section>
          <div style={{ minWidth: 0 }}>
            <DecisionList decisions={run.decisions} findings={run.findings} />
          </div>
        </div>

        {/* #4 Parallel fixes. */}
        <FixGrid run={run} />

        {/* #5 Gates and #6 review side by side. */}
        <div className="grid2">
          <GatesTable gates={run.gates} />
          <ReviewCard review={run.review} />
        </div>

        {/* #7 Pull request. */}
        <PrCard run={run} />

        {/* #8 Signed log. */}
        <Timeline run={run} />
      </main>
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
        <Header />
        <a className="back" href="#/">← All runs</a>
        <p className="muted">Loading run…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="page">
        <Header />
        <a className="back" href="#/">← All runs</a>
        <div className="card" role="alert" style={{ borderLeft: "3px solid var(--bad, #B3261E)" }}>
          Can&apos;t read this run: <span className="muted">{error}</span>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="page">
        <Header />
        <a className="back" href="#/">← All runs</a>
        <p className="muted">No such run.</p>
      </div>
    );
  }

  return <RunDetail run={data} />;
}

export default RunPage;

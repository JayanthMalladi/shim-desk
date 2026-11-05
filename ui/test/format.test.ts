import { describe, it, expect } from "vitest";
import {
  statusStage,
  stageStates,
  stageFromEvents,
  stageTimestamps,
  pillText,
  pillColor,
  severityLabel,
  severityColor,
  kindLabel,
  statusLabel,
  relTime,
  absTime,
  isAgent,
  STAGE_LABELS,
  type RunEvent,
} from "../src/format";

// ---------------------------------------------------------------------------
// 02 §6 status → stage table — every one of the 13 statuses.
// [status, stage, currentStageState, pillText, pillColor]
// ---------------------------------------------------------------------------
const ROWS: [
  string,
  number,
  "done" | "current" | "waiting",
  string,
  "accent" | "ok" | "warn" | "bad",
][] = [
  ["requested", 0, "current", "Starting", "accent"],
  ["cloning", 0, "current", "Starting", "accent"],
  ["scanned", 1, "current", "Scanned", "accent"],
  ["awaiting_decision", 2, "waiting", "Needs a human call", "warn"],
  ["fixing_deterministic", 3, "current", "Shim fixing", "accent"],
  ["fixing_parallel", 4, "current", "Subagents fixing", "accent"],
  ["gating", 5, "current", "Running gates", "accent"],
  ["in_review", 6, "current", "In review", "accent"],
  ["awaiting_approval", 7, "waiting", "Waiting for approval", "warn"],
  ["opening_pr", 8, "current", "Opening PR", "accent"],
  ["done", 8, "done", "PR opened", "ok"],
];

function statesFor(i: number, state: string): string[] {
  // 9 stages: before i = done, at i = `state`, after i = future.
  const out = new Array<string>(9).fill("future");
  for (let k = 0; k < i; k++) out[k] = "done";
  out[i] = state;
  return out;
}

describe("02 §6 status → stage mapping (every row)", () => {
  it.each(ROWS)(
    "%# status %s → stage %d / state %s / pill %s (%s)",
    (status, stage, state, text, color) => {
      expect(statusStage(status)).toBe(stage);
      // "done" is the special all-complete case.
      if (state === "done") {
        expect(stageStates(status)).toEqual(
          new Array(9).fill("done"),
        );
      } else {
        expect(stageStates(status)).toEqual(statesFor(stage, state));
      }
      expect(pillText(status)).toBe(text);
      expect(pillColor(status)).toBe(color);
    },
  );

  it("covers all 9 stages in order", () => {
    expect(STAGE_LABELS).toEqual([
      "Requested",
      "Scanned",
      "Human calls",
      "Shim fixes",
      "Parallel fixes",
      "Gates",
      "Review",
      "Approval",
      "PR",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Terminal rows: blocked / failed → stage of last active status in events.
// ---------------------------------------------------------------------------
const blockingEvents: RunEvent[] = [
  { kind: "status", status: "scanned", t: "2026-11-06T09:04:10Z" },
  { kind: "status", status: "fixing_parallel", t: "2026-11-06T09:14:00Z" },
  { kind: "status", status: "gating", t: "2026-11-06T09:26:00Z" },
];

const failingEvents: RunEvent[] = [
  { kind: "status", status: "fixing_deterministic", t: "2026-11-06T09:09:00Z" },
  { kind: "status", status: "in_review", t: "2026-11-06T09:28:00Z" },
  { kind: "error", text: "typecheck failed" },
];

describe("02 §6 terminal rows (blocked / failed)", () => {
  it("stageFromEvents = last non-blocked/non-failed status", () => {
    expect(stageFromEvents(blockingEvents)).toBe(5); // last active = gating
    expect(stageFromEvents(failingEvents)).toBe(6); // last active = in_review
    expect(stageFromEvents(undefined)).toBe(0); // no events → fallback 0
    expect(stageFromEvents([])).toBe(0);
    // a trailing blocked/failed status does not move the pointer
    expect(
      stageFromEvents([{ status: "gating" }, { status: "blocked" }]),
    ).toBe(5);
  });

  it("blocked: stage + current-hollow + pill", () => {
    expect(statusStage("blocked", blockingEvents)).toBe(5);
    expect(stageStates("blocked", blockingEvents)).toEqual(
      statesFor(5, "current-hollow"),
    );
    expect(pillText("blocked", blockingEvents)).toBe("Blocked");
    expect(pillColor("blocked", blockingEvents)).toBe("warn");
  });

  it("failed: stage + current-hollow + pill", () => {
    expect(statusStage("failed", failingEvents)).toBe(6);
    expect(stageStates("failed", failingEvents)).toEqual(
      statesFor(6, "current-hollow"),
    );
    expect(pillText("failed", failingEvents)).toBe("Failed");
    expect(pillColor("failed", failingEvents)).toBe("bad");
  });

  it("blocked/failed with no events → stage 0, current-hollow", () => {
    expect(statusStage("blocked", [])).toBe(0);
    expect(stageStates("failed")).toEqual(
      statesFor(0, "current-hollow"),
    );
  });

  it("stageTimestamps = last event's time per stage", () => {
    const ts = stageTimestamps([
      { status: "requested", t: "2026-11-06T09:02:00Z" },
      { status: "scanned", t: "2026-11-06T09:04:10Z" },
      { status: "gating", t: "2026-11-06T09:26:00Z" },
      // a later event re-records the same stage → keeps the latest
      { status: "scanned", t: "2026-11-06T09:99:00Z" },
    ]);
    expect(ts[0]).toBe("2026-11-06T09:02:00Z");
    expect(ts[1]).toBe("2026-11-06T09:99:00Z"); // latest scanned wins
    expect(ts[5]).toBe("2026-11-06T09:26:00Z");
    expect(ts[2]).toBeNull(); // no human-call event
    expect(ts[8]).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isAgent
// ---------------------------------------------------------------------------
describe("isAgent", () => {
  it("true for shim-* and shim-fixer:<file>", () => {
    expect(isAgent("shim-lead.jayanth")).toBe(true);
    expect(isAgent("shim-reviewer.jayanth")).toBe(true);
    expect(isAgent("shim-fixer:src/billing.ts")).toBe(true);
    expect(isAgent("shim-fixer")).toBe(true); // "shim-" prefix
    expect(isAgent("shim-")).toBe(true);
  });
  it("false for humans and other handles", () => {
    expect(isAgent("Jayanth")).toBe(false);
    expect(isAgent("shim")).toBe(false); // no dash after "shim"
    expect(isAgent("")).toBe(false);
    expect(isAgent("mr-fixer")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Label maps
// ---------------------------------------------------------------------------
describe("label maps", () => {
  it("severityLabel / severityColor", () => {
    expect(severityLabel("break")).toBe("Break");
    expect(severityLabel("silent")).toBe("Silent");
    expect(severityLabel("deprecated")).toBe("Deprecated");
    expect(severityColor("break")).toBe("bad");
    expect(severityColor("silent")).toBe("silent");
    expect(severityColor("deprecated")).toBe("muted");
  });
  it("kindLabel", () => {
    expect(kindLabel("status")).toBe("Status");
    expect(kindLabel("decision")).toBe("Decision");
    expect(kindLabel("fix")).toBe("Fix");
    expect(kindLabel("pr")).toBe("PR");
    expect(kindLabel("unknown-kind")).toBe("unknown-kind"); // fallback
  });
  it("statusLabel (raw, distinct from pill text)", () => {
    expect(statusLabel("done")).toBe("Done");
    expect(statusLabel("gating")).toBe("Gating");
  });
});

// ---------------------------------------------------------------------------
// Time formatting — shape checks (locale-agnostic).
// ---------------------------------------------------------------------------
describe("relTime / absTime (shape)", () => {
  const NOW = Date.now();
  const pastIso = new Date(NOW - 2 * 3_600_000).toISOString(); // 2h ago
  const futureIso = new Date(NOW + 3 * 3_600_000).toISOString(); // 3h ahead

  it("relTime returns a non-empty relative string for valid dates", () => {
    expect(typeof relTime(pastIso)).toBe("string");
    expect(relTime(pastIso).length).toBeGreaterThan(0);
    // past and future resolve differently
    expect(relTime(pastIso)).not.toEqual(relTime(futureIso));
  });
  it("relTime('garbage') → empty string", () => {
    expect(relTime("not-a-date")).toBe("");
  });

  it("absTime returns a non-empty string carrying the year digits", () => {
    const s = absTime("2026-11-06T09:31:00Z");
    expect(typeof s).toBe("string");
    expect(s.length).toBeGreaterThan(0);
    expect(s).toContain("2026"); // year is numeric → locale-stable
    // two different days differ
    expect(absTime("2026-11-06T09:31:00Z")).not.toEqual(
      absTime("2027-01-05T00:00:00Z"),
    );
  });
  it("absTime('garbage') → empty string", () => {
    expect(absTime("garbage")).toBe("");
  });
});

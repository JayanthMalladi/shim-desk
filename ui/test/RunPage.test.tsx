// WP UI-3 — RunPage renders the committed fixture ledger/example-r-0000.json
// and the key numbers match the fixture (02 §7 UI-3, 02 §5.2).
//
// The repo pins vitest but its vite.config.ts (UI-1) sets no test
// environment, so the suite has two layers:
//   1. Server-render assertions (react-dom/server) — run in plain node,
//      no DOM, cover the fixture numbers and the grid markup.
//   2. Interactive jsdom + @testing-library/react assertions — run only when
//      jsdom is installed (dynamic import; the file degrades to layer 1
//      otherwise, so the suite is green either way).

import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

import fixtureJson from "../../ledger/example-r-0000.json";
import type { ShimDeskRun } from "../src/types";
import { RunPage } from "../src/pages/RunPage";
import { RunCard, gateStats } from "../src/components/RunCard";
import { FindingsTable } from "../src/components/FindingsTable";
import { actorColor } from "../src/components/Timeline";
import { isAgent } from "../src/format";

const fixture = fixtureJson as unknown as ShimDeskRun;

// react-dom/server interleaves a `<!-- -->` marker between static text and
// {{expression}} text nodes (a React text-sibling artifact). Strip them so
// assertions match the visible text.
const stripSSV = (s: string): string => s.replace(/<!-- -->/g, "");

/** The key fixture numbers a rendering of RunPage must show (02 §7 UI-3). */
function assertFixtureContent(html: string): void {
  html = stripSSV(html);
  // Findings summary: total "32" and silent count "18".
  expect(html).toContain("32");
  expect(html).toContain("18");
  // Top finding file:line + rule (02 §5.2 #3, "Most important silent change").
  expect(html).toContain("src/billing.ts:15");
  expect(html).toContain("multi-step-result");
  // A decision rendered (02 §5.2 #3, right column): options with the chosen
  // one marked, plus the "by · time" line.
  expect(html).toContain("Convert src/legacy.cjs to ESM");
  // Gates: all-pass footer (02 §5.2 #5) and cell text.
  expect(html).toContain("Every gate that passed before still passes");
  expect(html).toContain("pass");
  // PR url (02 §5.2 #7).
  expect(html).toContain("https://github.com/JayanthMalladi/shim-demo-app/pull/1");
  // At least one timeline entry (02 §5.2 #8).
  expect(html).toContain("Requested: upgrade ai to v7 in JayanthMalladi/shim-demo-app");
  // Sticky "← All runs" link (02 §5.2).
  expect(html).toContain("← All runs");
}

// ---------------------------------------------------------------------------
// jsdom + @testing-library/react environment (optional layer).
// ---------------------------------------------------------------------------
interface JsdomEnv {
  RTL: typeof import("@testing-library/react");
  detach: () => void;
}

async function makeJsdomEnv(): Promise<JsdomEnv | null> {
  let JSDOM: new (html: string, opts?: Record<string, unknown>) => import("jsdom").JSDOM;
  try {
    const jsdomMod = (await import("jsdom")) as unknown as { JSDOM: typeof JSDOM };
    JSDOM = jsdomMod.JSDOM;
  } catch {
    return null; // jsdom not installed — layer 1 (server render) still covers
  }
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
  });
  const win = dom.window as unknown as Record<string, unknown>;
  const prev = {
    document: (globalThis as Record<string, unknown>).document,
    window: (globalThis as Record<string, unknown>).window,
  };
  (globalThis as Record<string, unknown>).document = win.document;
  (globalThis as Record<string, unknown>).window = win;
  let RTL: typeof import("@testing-library/react");
  try {
    RTL = await import("@testing-library/react");
  } catch {
    return null;
  }
  return {
    RTL,
    detach: () => {
      (globalThis as Record<string, unknown>).document = prev.document;
      (globalThis as Record<string, unknown>).window = prev.window;
    },
  };
}

// ---------------------------------------------------------------------------
// Layer 1 — server-rendered fixture assertions (always run).
// ---------------------------------------------------------------------------
describe("RunPage against the committed fixture (02 §5.2)", () => {
  it("renders the fixture without throwing and shows the key numbers", () => {
    const html = renderToString(React.createElement(RunPage, { run: fixture }));
    assertFixtureContent(html);
  });

  it("renders the two-column grid (minmax track; one column under 760px)", () => {
    const html = renderToString(React.createElement(RunPage, { run: fixture }));
    expect(html).toContain('class="run-detail-grid"');
    // auto-fit + min capped at the container width: 375px ⇒ single column,
    // so no horizontal scroll at 375px.
    expect(html).toContain("minmax(min(340px, 100%), 1fr)");
  });

  it("shows the blocked/failed banner only for stopped statuses", () => {
    const html = renderToString(React.createElement(RunPage, { run: fixture }));
    expect(html).not.toContain("Run blocked");
    expect(html).not.toContain("Run failed");

    const blocked = { ...fixture, status: "blocked" as const, statusReason: "gate: test . regressed" };
    const htmlBlocked = renderToString(React.createElement(RunPage, { run: blocked }));
    expect(htmlBlocked).toContain("Run blocked");
    expect(htmlBlocked).toContain("gate: test . regressed");
  });

  it("renders empty findings/decisions/final sections without crashing", () => {
    const bare: ShimDeskRun = {
      runId: "r-9999",
      repo: "o/r",
      requestedBy: "x",
      createdAt: "2026-11-06T09:00:00Z",
      status: "requested",
      events: [],
    } as ShimDeskRun;
    const html = renderToString(React.createElement(RunPage, { run: bare }));
    expect(html).toContain("No human calls needed");
    expect(html).toContain("r-9999");
  });
});

describe("RunCard (02 §5.1)", () => {
  it("renders run numbers, chips, PR link and the card link", () => {
    const html = stripSSV(renderToString(React.createElement(RunCard, { run: fixture })));
    expect(html).toContain("r-0000");
    expect(html).toContain("JayanthMalladi/shim-demo-app");
    expect(html).toContain("32 findings");
    expect(html).toContain("18 silent");
    expect(html).toContain("2 human calls");
    expect(html).toContain("gates 4/4");
    expect(html).toContain("href=\"#/run/r-0000\"");
    expect(html).toContain("https://github.com/JayanthMalladi/shim-demo-app/pull/1");
  });

  it("gateStats: green = gates passing after, total = union of keys", () => {
    expect(gateStats(fixture)).toEqual({ green: 4, total: 4 });
    expect(
      gateStats({ gates: { baseline: { a: true, b: false }, after: { a: true, c: true } } } as unknown as ShimDeskRun),
    ).toEqual({ green: 2, total: 3 });
  });
});

describe("FindingsTable (02 §5.2 #3)", () => {
  it("is collapsed by default (no <table> in the initial render)", () => {
    const html = renderToString(
      React.createElement(FindingsTable, { findings: fixture.findings }),
    );
    expect(html).not.toContain("<table");
    // `+` + marker + ` All findings (` + `10` + `)` → " All findings (10)"
    expect(stripSSV(html)).toContain("All findings (10)");
  });
});

describe("Timeline actors (02 §5.2 #8)", () => {
  it("actorColor is stable: same name → same token, from the 4 neutrals", () => {
    const tokens = [
      "var(--accent, #2F5D50)",
      "var(--ok, #2E7D4F)",
      "var(--warn, #B26B00)",
      "var(--bad, #B3261E)",
    ];
    const a = actorColor("shim-lead.jayanth");
    expect(a).toBe(actorColor("shim-lead.jayanth"));
    expect(tokens).toContain(a);
    // different actors can (and do) land on different tokens
    expect(actorColor("Jayanth")).not.toBe(a);
  });

  it("isAgent classifies agent vs person actors (02 §5.2 #8)", () => {
    expect(isAgent("shim-lead.jayanth")).toBe(true);
    expect(isAgent("shim-fixer:src/billing.ts")).toBe(true);
    expect(isAgent("Jayanth")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Layer 2 — interactive assertions with @testing-library/react + jsdom
// (skipped automatically when jsdom is not installed).
// ---------------------------------------------------------------------------
describe("RunPage interactive (jsdom + @testing-library/react)", () => {
  it("expands the findings table and shows every item", async () => {
    const env = await makeJsdomEnv();
    if (!env) return; // no jsdom — layer 1 already covers rendering
    const { RTL, detach } = env;
    try {
      const { getByRole, container } = RTL.render(
        React.createElement(FindingsTable, { findings: fixture.findings }),
      );
      // collapsed by default
      expect(container.querySelectorAll("table").length).toBe(0);
      const toggle = getByRole("button", { name: /all findings/i });
      RTL.fireEvent.click(toggle);
      const rows = container.querySelectorAll("tbody tr");
      expect(rows.length).toBe(fixture.findings?.items?.length ?? 10);
      // one row carries the truncated message with full text in title
      expect(rows[1].querySelectorAll("td").length).toBe(6);
      RTL.cleanup();
    } finally {
      detach();
    }
  }, 30000);

  it("renders the full RunPage in a real DOM without throwing", async () => {
    const env = await makeJsdomEnv();
    if (!env) return;
    const { RTL, detach } = env;
    try {
      const { container } = RTL.render(React.createElement(RunPage, { run: fixture }));
      const text = container.textContent ?? "";
      assertFixtureContent(text);
      expect(container.querySelectorAll(".run-detail-grid").length).toBe(1);
      RTL.cleanup();
    } finally {
      detach();
    }
  }, 30000);
});

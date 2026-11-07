import path from 'node:path';
import fs from 'node:fs';
import type { Plugin } from 'vite';

// The ledger dir lives next to the ui/ package (../ledger). Vite bundles this
// file when it loads vite.config.ts, so import.meta.url and __dirname do not
// point back at ui/plugins/ — resolve from process.cwd() instead (npm run sets
// cwd to the ui/ package, so `../ledger` is correct). A candidate fallback
// covers a repo-root invocation. Windows-safe via path.join (01 §4.2).
const ledgerDir: string = (() => {
  const candidates = [
    path.join(process.cwd(), 'ledger'),
    path.join(process.cwd(), '..', 'ledger'),
  ];
  return candidates.find((c) => fs.existsSync(c)) ?? candidates[1];
})();

// One object per file that parses. runId is read from the parsed JSON; the
// fileName fallback covers a file that lacks a runId.
type Entry = {
  fileName: string;
  runId: string;
  createdAt: string;
  run: unknown;
};

// Board listing (02 §1): only real runs — files named r-NNNN.json. The
// committed test fixture example-r-0000.json is deliberately NOT listed; it
// exists for ui/test/RunPage.test.tsx, which imports it directly. A fresh
// clone therefore lists exactly r-0001, and runs written later (e.g. the e2e
// live test's r-9999.json) still appear.
function listLedgerFiles(): string[] {
  let names: string[];
  try {
    names = fs.readdirSync(ledgerDir);
  } catch {
    return [];
  }
  return names.filter((n) => /^r-\d{4}\.json$/.test(n));
}

// Read every ledger file on each call — no cache, so dev polling sees live
// changes (02 §1). Files that fail to parse are skipped with a warning.
function readRuns(): Entry[] {
  const out: Entry[] = [];
  for (const fileName of listLedgerFiles()) {
    const file = path.join(ledgerDir, fileName);
    let parsed: Record<string, unknown> | null;
    try {
      parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
    } catch (err) {
      console.warn(
        `[ledger] skipping ${fileName} (parse failed): ${err instanceof Error ? err.message : String(err)}`,
      );
      continue;
    }
    const runId = String(parsed?.runId ?? path.basename(fileName, '.json'));
    const createdAt = String(parsed?.createdAt ?? '');
    out.push({ fileName, runId, createdAt, run: parsed });
  }
  // createdAt descending; newest first. Missing/invalid dates sort to the end.
  out.sort((a, b) => {
    const ta = Date.parse(a.createdAt);
    const tb = Date.parse(b.createdAt);
    if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
    if (Number.isNaN(ta)) return 1;
    if (Number.isNaN(tb)) return -1;
    return tb - ta;
  });
  return out;
}

function sendJson(res: unknown, status: number, body: unknown): void {
  const r = res as { statusCode: number; setHeader: (k: string, v: string) => void; end: (s: string) => void };
  r.statusCode = status;
  r.setHeader('Content-Type', 'application/json');
  r.end(JSON.stringify(body));
}

// Dev-only: GET /api/runs and GET /api/runs/:runId, served from ../ledger.
export function ledgerApi(): Plugin {
  return {
    name: 'shim-desk:ledger-api',
    apply: 'serve',
    // Vite 5.4.10 exposes configureServer (not configureDevServer). Post phase
    // so the API routes win over Vite's own transforms; unmatched URLs pass
    // through via next() to the SPA fallback.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0];
        if (url === '/api/runs') {
          sendJson(res, 200, readRuns().map((e) => e.run));
          return;
        }
        const m = url.match(/^\/api\/runs\/([\w-]+)$/);
        if (m) {
          const runId = decodeURIComponent(m[1]);
          const hit = readRuns().find((e) => e.runId === runId);
          if (!hit) {
            sendJson(res, 404, { error: `run not found: ${runId}` });
            return;
          }
          sendJson(res, 200, hit.run);
          return;
        }
        next();
      });
    },
  };
}

// Build-time: copy every ledger file into dist/data/<runId>.json plus
// dist/data/index.json (run ids sorted by createdAt descending).
export function copyLedger(): Plugin {
  return {
    name: 'shim-desk:copy-ledger',
    apply: 'build',
    closeBundle() {
      const outDir = path.join(process.cwd(), 'dist', 'data');
      const runs = readRuns();
      fs.mkdirSync(outDir, { recursive: true });
      for (const e of runs) {
        fs.copyFileSync(path.join(ledgerDir, e.fileName), path.join(outDir, `${e.runId}.json`));
      }
      fs.writeFileSync(
        path.join(outDir, 'index.json'),
        JSON.stringify(runs.map((e) => e.runId), null, 2) + '\n',
      );
    },
  };
}

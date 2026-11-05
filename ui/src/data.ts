import type { ShimDeskRun } from './types';

// The generated schema type is named after the schema's `title`; alias it to
// `Run` for the data-layer signature. types.ts is generated — do not hand-edit.
export type Run = ShimDeskRun;

// The single data-access module (02 §1). No component fetches directly.
// Dev: the Vite ledgerApi() plugin serves /api/runs from ../ledger.
// Static: the build copies the ledger into data/<runId>.json next to the
// assets, so paths are relative to the document base (works on GitHub Pages).

function base(): string {
  // document.baseURI minus the trailing path of index.html: with base './'
  // Vite rewrites the script tag to './src/main.tsx', so the parent of
  // that URL is the site root.
  const href = document.baseURI;
  return href.replace(/[^/]*$/, '');
}

export async function listRuns(): Promise<Run[]> {
  if (import.meta.env.DEV) {
    const res = await fetch('/api/runs');
    if (!res.ok) throw new Error(`/api/runs failed: ${res.status}`);
    return (await res.json()) as Run[];
  }
  const res = await fetch(`${base()}data/index.json`);
  if (!res.ok) throw new Error(`data/index.json failed: ${res.status}`);
  const ids = (await res.json()) as string[];
  return Promise.all(ids.map((id) => getRun(id)));
}

export async function getRun(id: string): Promise<Run> {
  if (import.meta.env.DEV) {
    const res = await fetch(`/api/runs/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`/api/runs/${id} failed: ${res.status}`);
    return (await res.json()) as Run;
  }
  const res = await fetch(`${base()}data/${id}.json`);
  if (!res.ok) throw new Error(`data/${id}.json failed: ${res.status}`);
  return (await res.json()) as Run;
}

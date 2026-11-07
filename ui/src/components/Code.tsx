/** Renders `backticked` spans in ledger text as <code>. */
export function Code({ text }: { text?: string }) {
  const parts = (text ?? "").split(/`([^`]+)`/);
  return <>{parts.map((p, i) => (i % 2 ? <code key={i}>{p}</code> : p))}</>;
}

export default Code;

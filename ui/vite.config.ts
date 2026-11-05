import { defineConfig } from 'vitest/config';
import { copyLedger, ledgerApi } from './plugins/ledger';

// base './' so the static build works under a GitHub Pages subpath (02 §8).
// JSX/TSX is transformed by Vite's esbuild pipeline (tsconfig jsx: react-jsx);
// 02 §2 pins the stack and lists no react plugin.
export default defineConfig({
  base: './',
  plugins: [ledgerApi(), copyLedger()],
  test: {
    // Test suites are owned by UI-3/UI-4; `npm test` must be runnable now.
    passWithNoTests: true,
  },
});

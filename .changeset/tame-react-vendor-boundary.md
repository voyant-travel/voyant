---
"@voyant-travel/vite-config": patch
---

Anchor the React vendor chunk heuristic to actual `react`, `react-dom`, and `scheduler` package boundaries so third-party package internals such as Better Auth's `dist/client/react/*` subpaths stay out of the eager React chunk.

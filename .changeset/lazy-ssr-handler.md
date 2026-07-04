---
"@voyant-travel/worker-runtime": minor
---

Add `lazySsr` so the TanStack Start SSR handler can be loaded behind the
non-API branch. Statically constructing the start handler in `entry.ts` pulls
React + `react-dom/server` (~2.2 MB) into the Worker's startup graph, which
Cloudflare parses on every cold isolate before routing — so even a no-op
`/api/health` paid the React cold-load and the isolate could not stay warm.
`lazySsr(() => import("./ssr-handler"))` memoizes the loader and keeps the
React SSR graph off the startup path, the same win `lazyApp` already gives the
Hono API. API-only isolates never load `react-dom/server`.

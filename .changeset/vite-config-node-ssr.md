---
"@voyant-travel/vite-config": minor
---

Add a `nodeSsr` option to `voyantStartViteConfig` that folds in the load-bearing
Node SSR build config — `ssr.target: "node"`, `ssr.noExternal` for
`@voyant-travel/*` / `@pxmstudio/*`, and `ssr.resolve.conditions` (source-first)
— which Node-only Voyant apps (voyant#2966) previously hand-merged on top of the
preset.

With `nodeSsr: true` a Voyant TanStack Start app's `vite.config.ts` shrinks to a
single `voyantStartViteConfig(...)` call and copies no build config — the
last piece the source-free managed admin host (voyant#3044) still duplicated.
The operator and managed-operator starters adopt it.

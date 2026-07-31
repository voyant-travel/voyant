---
"@voyant-travel/runtime": patch
---

Let a built operator server start without development tooling present.

The operator Docker image built cleanly but had never booted — it failed at ESM
link time with `Cannot find package 'tsx' imported from dist/server/server.js`,
about a second in and before reading any environment variable.

Two causes, both from the same mismatch: the operator's Vite config inlines
`@voyant-travel/*` from source, while the deployed tree carries only the bundle
plus the operator's own production dependencies.

`project-artifacts.ts` imported `tsx/esm/api` statically. Its loaders read
`*.generated.ts` from `.voyant/`, which is correct for the CLI, but a built
server never reaches them — `voyant build` emits `.voyant/app/project-runtime.ts`,
which pulls the same artifact through an eager `import.meta.glob` and passes it
as `generatedProjectRuntime`. So the bundle linked a transpiler it would never
call, and `pnpm deploy --prod` strips `tsx` because the operator declares it as
a devDependency. The import is now lazy and memoized.

`createBundledDocumentRenderer` hopped `createRequire` through
`@voyant-travel/runtime` to reach `@pdf-lib/fontkit` and the Inter Tight font.
That hop is required under pnpm's isolated layout, where fontkit is only
reachable from the package declaring it, but a built server has no workspace
shell to hop through. It now falls back to the host require, which resolves
both in the deployed layout.

Refs voyant#3994.

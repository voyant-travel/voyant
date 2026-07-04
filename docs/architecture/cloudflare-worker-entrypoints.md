# Cloudflare Worker Entrypoints

Voyant's Cloudflare SSR entrypoints must stay thin enough to pass Worker
startup validation. Cloudflare parses and executes module global scope before
any request routing happens, so entrypoint imports are part of the startup
budget even when the request is only serving SSR HTML.

## Rule

Do not statically import the Hono API app, scheduled job modules, workflow
definition files, or the TanStack Start SSR handler from Cloudflare SSR
entrypoints.

The SSR handler is the subtle one: `@tanstack/react-start/server`
(`createStartHandler` / `defaultStreamHandler`) statically pulls React and
`react-dom/server` — ~2.2 MB — into module global scope. Because that lives in
the same Worker as the API, Cloudflare parses it on every cold isolate before
routing, so even a no-op `/api/health` pays the React cold-load. The route
tree, `recharts`, `@tiptap/*`, and `pdf-lib` are already lazy (dynamic
`import("#tanstack-router-entry")` plus per-route splits); React itself was the
last heavy graph still eager, only because the entrypoint constructed the start
handler at module top level.

Prefer:

- cache a dynamic `import("./api/app")` inside the `/api/*` branch
- keep the start handler in `./ssr-handler` and load it with `lazySsr(() =>
  import("./ssr-handler"))` so `react-dom/server` stays off the startup graph
- cache dynamic workflow/client imports inside the API or scheduled branches
- import only lightweight constants from leaf files
- route scheduled events by cron string, then dynamic-import the matching job

Avoid:

- `import { app as apiApp } from "./api/app"`
- `import { createStartHandler } from "@tanstack/react-start/server"` in `entry.ts`
- `import "./workflows.js"`
- importing a package root only to read a runtime constant

The mechanical check lives in `scripts/check-cloudflare-entrypoints.mjs` and is
part of `pnpm verify:architecture`.

## Why

The operator starter can install enough Voyant modules, schemas, workflows,
and local API routes that eagerly importing the API graph pushes Cloudflare
startup validation over the CPU limit. Lazy-loading keeps the first SSR
entrypoint small while preserving warm-isolate caching for API and workflow
requests.

## Measurement Lane

For the operator starter, use Wrangler's startup profiler before and after
entrypoint changes:

```sh
pnpm -C starters/operator check:startup
pnpm -C starters/operator measure:startup
```

Both scripts rebuild the operator starter first. That keeps startup evidence
tied to the current source instead of a stale `dist/server` artifact.
`check:startup` is the direct Wrangler lane. `measure:startup` stores the Chrome
CPU profile under `.wrangler/startup-profiles/worker-startup.cpuprofile` and
prints a compact self-time summary so reviewers can see which files and
functions dominate startup. Wrangler measures on the local machine, so treat the
numbers as relative evidence, not exact Cloudflare production CPU.

This lane measures Worker startup only. First-hit costs for `/api/*`, scheduled
jobs, and workflow steps should be measured separately by hitting those runtime
branches in `wrangler dev`; those branches are intentionally lazy and should not
move back into module startup just to make first-hit traces quieter.

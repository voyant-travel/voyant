# Deployment Targets

Which runtime each Voyant deployment class runs on, and why. The short version:
**Node is the first-class production target for composed operator/admin
deployments; Cloudflare Workers stays the right answer for storefronts, small
cacheable surfaces, and federated per-domain apps.**

## Node is the first-class target for the operator

A fully composed operator API **cannot stay resident on Cloudflare Workers for
Platforms**. The evaluated composition heap — route trees, drizzle/zod graphs,
module registries — is evicted at zero idle in every container (request
isolates, slim dedicated workers, and Durable Objects all fail; only small heaps
like the lean-auth path are reused). Every request then pays multi-second graph
evaluation.

Measured, in production: warm handler **1–2 ms** on Node (Cloud Run, resident
process) vs **4–6 s/request** on Workers for Platforms. Full evidence chain:
voyant-travel/platform#935 (RFC + probe ladder, voyant#2915/#2925/#2926/#2941/
#2944/#2945) and the pilot on pro-travel (protravel-ro/protravel#391, Node
residency confirmed). Decision: voyant#2966.

The months of workerd-accommodation work (SSR lazy-loading, vendor-chunk
surgery, code-splitting constraints, `pg` stubs, `require` shims, per-isolate
memoization) was rent paid to a runtime that structurally cannot host this
workload class well. On Node none of it is necessary.

### How the operator runs on Node

- **Entry:** `starters/operator/src/server.ts` boots a resident HTTP server via
  `createNodeServer` from
  [`@voyant-travel/runtime`](../../packages/runtime). It runs
  the app's Worker-style `fetch`/`scheduled` handlers (`src/entry.ts`) unchanged,
  adds a real per-request `waitUntil` (background work tracked + drained on
  shutdown), an origin-trust gate, an HTTP `scheduled()` hook, graceful
  SIGTERM/SIGINT drain, and serves the client build (`dist/client`).
- **Managed Cloud entry:** `@voyant-travel/framework/managed-runtime` boots
  managed product profiles from serialized profile snapshots without importing
  starter-local files. Cloud packages this framework-owned entry with
  provisioned env/secrets; storefront/site artifacts remain separate apps that
  consume the managed API for the selected profile. Today that profile is the
  standard managed `operator` profile, but the entry is not named after it.
- **Bindings are real Node providers, not Cloudflare emulation.** In-process KV
  (`createMemoryKvNamespace`) backs `CACHE`/`RATE_LIMIT`; object storage is
  S3-backed in prod (`createR2BucketShim`) or in-process in dev
  (`createMemoryR2Bucket`); there is no `caches.default` shim (the public-cache
  middleware reads `env.CACHE` directly).
- **Build:** `pnpm --filter operator build` (Vite, no `@cloudflare/vite-plugin`)
  emits `dist/client` + `dist/server/server.js`. **Run:** `pnpm --filter operator
  start` (`node dist/server/server.js`).
- **Docker target:** `starters/operator/Dockerfile` is the reference
  self-hosted Node image. Its build stage must call `pnpm --filter operator
  build`, not raw Vite, so graph freshness and graph artifact copying stay on
  the same path as local build. The runtime image boots `dist/server/server.js`,
  which validates the graph artifacts and required graph resource env before
  serving traffic.
- **Graph contract:** `pnpm --filter operator dev`, `pnpm --filter operator
  db:migrate`, and standalone Node boot all load the generated deployment graph
  artifacts and fail before serving traffic or touching the database when
  graph-declared required resource env is missing. Local `.env` loading is only
  a source for satisfying the same graph contract; it is not a parallel
  deployment shape.
- **Database:** the pooled node-postgres lane (`DATABASE_URL_DIRECT`, `adapter:
  "node"`) is the production default — one resident pool per process. neon-http/WS
  remain the fallback adapters. See
  [performance-enterprise-scale-assessment.md](./performance-enterprise-scale-assessment.md)
  §2.6.
- **Crons:** declared runtime-neutrally in `src/scheduled-crons.ts`
  (`OPERATOR_CRON_JOBS`). On Node they can't run on a timer inside the process, so
  `pnpm --filter operator emit:cloud-scheduler` fans them out to Cloud Scheduler
  jobs that POST `/__voyant/scheduled?cron=<expr>` with the origin-trust header.
- **CI:** the `node-smoke` job builds the operator, boots it under Node, and
  asserts `/healthz` + API dispatch — so the first-class target is gated.

## Workers is partially supported

Still supported and still excellent on Workers:

- storefronts, small/public cacheable surfaces, demo deployments, UI shells;
- **federated (per-domain) apps** under the residency cliff — per-domain graphs
  are small enough to stay resident, which is the edge-native long-term
  alternative (see [federated-operating-mode.md](./federated-operating-mode.md)).

**Known limitation for composed operator APIs on Workers:** no isolate residency
→ a per-request composition toll (multi-second graph evaluation). This is a
structural property of the runtime for this workload, not a bug for app authors
to fix. Do not accept further framework complexity whose only purpose is workerd
accommodation for composed apps.

## Keep the app entry lazy

Even on Node the app entry (`src/entry.ts`) keeps SSR behind a lazy import: the
`@tanstack/react-start/server` graph (React + `react-dom/server`, ~2.2 MB) is
imported on first render, not at module top level, which keeps boot fast. Heavy
API and workflow graphs stay lazy for the same reason.

Prefer:

- cache a dynamic `import("./api/app")` inside the `/api/*` branch;
- keep the start handler in `./ssr-handler` and load it with `lazySsr(() =>
  import("./ssr-handler"))`;
- route scheduled events by cron string, then dynamic-import the matching job.

Avoid:

- `import { app as apiApp } from "./api/app"`;
- `import { createStartHandler } from "@tanstack/react-start/server"` in `entry.ts`;
- `import "./workflows.js"`.

The mechanical checks live in `scripts/check-node-entrypoint.mjs` and
`scripts/check-operator-docker-target.mjs` and are part of
`pnpm verify:architecture`: they assert `src/server.ts` wires `createNodeServer`
and graph artifact/resource validation, that `pnpm --filter operator dev` and
`pnpm --filter operator db:migrate` preflight graph resource env, that the Docker
target consumes the graph-checked build artifacts, and that the app entry keeps
those graphs lazy.

## Stop-the-bleed policy

New performance work whose target is workerd residency for **composed** apps is
declined by default — that runtime structurally cannot host the workload well, so
the effort has no ceiling worth paying. Direct that effort at Node-lane boot time
instead (staged composition, compile caching). This does not touch the supported
Workers surfaces above, whose graphs are small by construction.

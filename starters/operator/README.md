# Operator Starter

The Voyant starter for tour operators. A single Cloudflare Worker that serves the `/v1/*` API and SSR dashboard, with Voyant Workflows as the default durable task runtime.

## Stack

- **Runtime**: Cloudflare Workers (Vite + `@cloudflare/vite-plugin`)
- **Framework**: TanStack Start + React 19
- **UI**: Shared `@voyant-travel/ui` components and styles + Tailwind CSS v4
- **DB**: Neon Postgres via the serverless HTTP driver (one secret, `DATABASE_URL`; no Hyperdrive binding required)
- **Auth**: Better Auth
- **Jobs**: Voyant Workflows

## Quick start

```bash
pnpm -F operator dev          # Cloudflare Worker + SSR
pnpm -F operator dev:worker   # Voyant Workflows dev loop
```

Dev server runs on port `3300`.
The local workflows runtime listens on port `3310`.

## Flights Demo API

The operator starter is wired to the standalone flights demo API when
`FLIGHTS_DEMO_API_URL` is set in `.dev.vars`. The service runs on port `3320`
and owns a separate Postgres database for demo flight orders.

From the monorepo root or from an extracted packaged starter:

```bash
cp apps/flights-demo-api/.env.example apps/flights-demo-api/.env
docker compose -f apps/flights-demo-api/docker-compose.yml up -d
pnpm --dir apps/flights-demo-api install
pnpm --dir apps/flights-demo-api db:migrate
pnpm --dir apps/flights-demo-api dev
```

Then keep this in `.dev.vars`:

```bash
FLIGHTS_DEMO_API_URL="http://localhost:3320"
```

## Database

The starter owns its `drizzle.config.ts` and `migrations/`:

```bash
pnpm -F operator db:generate   # generate new migration from schema changes
pnpm -F operator db:migrate    # apply migrations
pnpm -F operator db:push       # push schema directly (dev only)
pnpm -F operator db:studio     # open Drizzle Studio
```

## Deploy

```bash
pnpm -F operator build
pnpm -F operator deploy
```

## Routes

- `/v1/admin/*` — staff-facing API (requires `staff` actor)
- `/v1/public/*` — customer/partner/supplier API
- `/api/auth/*` — Better Auth handler
- `/*` — TanStack Start SSR dashboard

## External cruise adapters

External cruise inventory (any upstream — Voyant Connect is just one option) is
wired in **one place**: `src/api/lib/cruise-adapters-runtime.ts`. Add your
connector's `CruiseAdapter` to `configuredCruiseAdapters`:

```ts
import { createMyCruiseAdapter } from "my-cruise-connector"

export function configuredCruiseAdapters(env: CruiseAdapterEnv): CruiseAdapter[] {
  if (!_configured) {
    const adapters: CruiseAdapter[] = []
    adapters.push(createMyCruiseAdapter({ token: env.MY_CRUISE_ADAPTER_TOKEN }))
    _configured = adapters
  }
  return _configured
}
```

That single registration reaches every path: a cruise adapter is registered into
both the **vertical** registry (admin/public external cruise detail, refresh,
detach, external booking — `cruiseAdminRoutes` / `cruisePublicRoutes`, mounted at
`/v1/{admin,public}/cruises`) and the **catalog** `SourceAdapterRegistry` (content,
discovery/sync, snapshot capture, booking-engine sourced inventory). The same seam
runs in the live API (`booking-engine-runtime.ts`), the external-cruise-refresh
cron, and the `sync:sources` CLI, so all paths stay consistent.

Owned adapters are wrapped with a short-TTL read cache (`memoizeCruiseAdapter`,
60s) automatically — push the **raw** adapter, don't pre-wrap. Repeated
detail/sailing/ship reads within an isolate then skip the upstream call (listings
stay live). Voyant Connect cruise reads are cached upstream in the plugin.

Missing config is a no-op — with no connector and Voyant Connect unconfigured,
external cruise reads return a clean `adapter_not_registered`, never a boot
failure. Voyant Connect cruise sources, when configured, are back-filled into the
vertical registry automatically (no manual entry needed). See
`docs/architecture/cruises-module.md` §10 for the adapter contract.

## Operator Shell

The workspace shell uses the shared `OperatorAdminWorkspaceLayout`. Operators
can collapse or expand the sidebar from the header trigger, or with `Cmd+B` on
macOS and `Ctrl+B` on Windows and Linux.

Use `OperatorAdminPageShell` from `@voyant-travel/admin` for route-level chrome:
breadcrumbs, page actions, and the padded page body. When a route adopts the
page shell, pass `showSidebarTrigger={false}` to `OperatorAdminWorkspaceLayout`
so the shell owns the only visible route header. Pass `padded={false}` to the
page shell for full-bleed operator tools that own their own spacing.

Route-level browser titles are auto-derived from the shared navigation items
and active locale. Override detail pages that need entity-specific metadata
with `useAdminPageHead({ title, description })` from `@voyant-travel/admin`. The
root document also sets `robots: noindex,nofollow`; keep operator deployments
out of search indexes.

## Charts

The dashboard uses `recharts` through `@voyant-travel/ui` and `@voyant-travel/admin`.
If chart cards render headers with blank bodies, run `pnpm -r why recharts`
and confirm the app resolves a single `recharts` version. Add a workspace
override only if a downstream dependency forces a second copy.

## License

Apache-2.0

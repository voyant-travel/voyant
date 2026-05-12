# Operator Template

The Voyant template for tour operators. A single Cloudflare Worker that serves the `/v1/*` API and SSR dashboard, with Voyant Workflows as the default durable task runtime.

## Stack

- **Runtime**: Cloudflare Workers (Vite + `@cloudflare/vite-plugin`)
- **Framework**: TanStack Start + React 19
- **UI**: Local shadcn copy + Tailwind CSS v4
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

## Database

The template owns its `drizzle.config.ts` and `migrations/`:

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

## Operator Shell

The workspace shell uses the shared `OperatorAdminWorkspaceLayout`. Operators
can collapse or expand the sidebar from the header trigger, or with `Cmd+B` on
macOS and `Ctrl+B` on Windows and Linux.

Route-level browser titles are auto-derived from the shared navigation items
and active locale. Override detail pages that need entity-specific metadata
with `useAdminPageHead({ title, description })` from `@voyantjs/admin`. The
root document also sets `robots: noindex,nofollow`; keep operator deployments
out of search indexes.

## Charts

The dashboard uses `recharts` through `@voyantjs/ui` and `@voyantjs/admin`.
If chart cards render headers with blank bodies, run `pnpm -r why recharts`
and confirm the app resolves a single `recharts` version. Add a workspace
override only if a downstream dependency forces a second copy.

## License

Apache-2.0

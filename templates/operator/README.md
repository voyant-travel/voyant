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

## License

Apache-2.0

# Voyant

Voyant is an open-source framework for OTAs, tour operators, and DMCs. It ships starter apps, durable workflow orchestration, and a wide set of headless domain modules - catalog, commerce, inventory, operations, relationships, quotes, bookings, finance, distribution, legal, charters, cruises, accommodation resale, and more - that you can compose into your own travel platform.

#### [CLI](./packages/cli/README.md) | [Operator Starter](./starters/operator/README.md) | [Packages](./packages) | [Examples](./examples) | [Migrations](./docs/migrations/README.md)

## Get started

### 1. Install the CLI

```bash
npm install -g @voyant-travel/cli
```

You can also use `pnpm add -g @voyant-travel/cli`.

### 2. Scaffold a project from a starter

```bash
voyant new my-travel-app --template operator
cd my-travel-app
pnpm install
```

Built-in starters are downloaded from GitHub Release assets for the starter/CLI release version. You can also point `--template` at a custom local starter directory.

### 3. Configure the app

```bash
cp .dev.vars.example .dev.vars
```

Set your secrets in `.dev.vars` and provide `DATABASE_URL` in `.env` for Drizzle and local worker processes.

### 4. Run the app

```bash
pnpm db:migrate
pnpm dev
```

## Starters

Voyant ships one first-party starter:

| Starter | Purpose | Stack |
| --- | --- | --- |
| [`starters/operator`](./starters/operator/README.md) | Tour operator workflows | Cloudflare Workers, TanStack Start, Hono, Better Auth, Drizzle |

## What you get

- Deployable application shells, not just isolated packages
- A normalized travel operations data model on PostgreSQL + Drizzle
- Headless domain modules for catalog, commerce, inventory, operations, relationships, quotes, bookings, finance, distribution, legal, charters, cruises, accommodation resale, and more
- Hono-based API transport with optional Next.js route helpers
- Step-based durable workflow orchestration that runs on Cloudflare Workers + Durable Objects, Node, or Voyant Cloud
- Better Auth wiring in first-party starters, with core packages staying auth-provider agnostic
- Versioned React packages per domain (`relationships-react`, `inventory-react`, `commerce-react`, `bookings-react`, …) consumed as ordinary dependencies
- React hook and reusable UI libraries (`relationships-react`, `inventory-react`, `commerce-react`, `bookings-react`, …) that wrap the HTTP contract of each module
- Optional integrations for payments, e-invoicing, storage, CMS sync, and notifications

Voyant supports accommodation as catalog inventory for resale, packaging, and
trip composition. It is not positioned as a hotel PMS or first-party
hotel-operations system; see
[`docs/architecture/accommodation-resale-boundary.md`](./docs/architecture/accommodation-resale-boundary.md).

## The framework surface

### Core platform

- [`@voyant-travel/core`](./packages/core/README.md), [`@voyant-travel/db`](./packages/db/README.md), [`@voyant-travel/hono`](./packages/hono/README.md), [`@voyant-travel/react`](./packages/react)
- [`@voyant-travel/auth`](./packages/auth/README.md), [`@voyant-travel/auth-react`](./packages/auth-react/README.md), [`@voyant-travel/types`](./packages/types/README.md), [`@voyant-travel/utils`](./packages/utils/README.md), [`@voyant-travel/voyant-test-utils`](./packages/test-utils/README.md)
- [`@voyant-travel/cli`](./packages/cli/README.md), [`@voyant-travel/storage`](./packages/storage/README.md), [`@voyant-travel/i18n`](./packages/i18n)

### Travel domain modules

- [`@voyant-travel/catalog`](./packages/catalog/README.md), [`@voyant-travel/commerce`](./packages/commerce/README.md), [`@voyant-travel/inventory`](./packages/inventory), [`@voyant-travel/operations`](./packages/operations)
- [`@voyant-travel/bookings`](./packages/bookings/README.md), [`@voyant-travel/finance`](./packages/finance/README.md), [`@voyant-travel/legal`](./packages/legal/README.md), [`@voyant-travel/notifications`](./packages/notifications/README.md)
- [`@voyant-travel/distribution`](./packages/distribution/README.md), [`@voyant-travel/relationships`](./packages/relationships/README.md), [`@voyant-travel/quotes`](./packages/quotes/README.md), [`@voyant-travel/trips`](./packages/trips)
- [`@voyant-travel/identity`](./packages/identity/README.md), [`@voyant-travel/storefront`](./packages/storefront), [`@voyant-travel/storefront-verification`](./packages/storefront-verification)
- [`@voyant-travel/accommodations`](./packages/accommodations), [`@voyant-travel/charters`](./packages/charters/README.md), [`@voyant-travel/cruises`](./packages/cruises/README.md), [`@voyant-travel/flights`](./packages/flights), [`@voyant-travel/octo`](./packages/octo)

### Workflows (durable orchestration)

Step-based workflows with durable state, retries, and a shared wire protocol — runnable on Cloudflare Workers + Durable Objects, Node, or Voyant Cloud.

- [`@voyant-travel/workflows`](./packages/workflows) — authoring SDK
- [`@voyant-travel/workflows-orchestrator`](./packages/workflows-orchestrator) — reference orchestrator core
- [`@voyant-travel/workflows-orchestrator-cloudflare`](./packages/workflows-orchestrator-cloudflare) and [`@voyant-travel/workflows-orchestrator-node`](./packages/workflows-orchestrator-node) — runtime adapters
- `@voyant-travel/workflows/bindings`, `@voyant-travel/workflows/config`, and `@voyant-travel/workflows/errors` — SDK subpaths for runtime bindings, config, and typed errors
- [`@voyant-travel/workflows-react`](./packages/workflows-react) — UI hooks for run inspection
- [`@voyant-travel/workflows-react/ui`](./packages/workflows-react) — importable workflow run admin UI

Reference apps under [`apps/`](./apps) compose these into deployable shapes — `workflows-orchestrator-worker`, `workflows-tenant-worker`, `workflows-selfhost-cloudflare-worker`, `workflows-selfhost-node-server`, `workflows-node-step-container`, and `workflows-local-dashboard`.

### UI and React families

Reusable frontend surfaces live in the matching `-react` package for each
domain module. Those packages own hooks, clients, providers, query keys,
view-model helpers, reusable components, and `./ui` owner paths where needed -
for example [`@voyant-travel/relationships-react`](./packages/relationships-react/README.md),
[`@voyant-travel/quotes-react`](./packages/quotes-react/README.md),
[`@voyant-travel/inventory-react`](./packages/inventory-react),
[`@voyant-travel/commerce-react`](./packages/commerce-react), and
[`@voyant-travel/bookings-react`](./packages/bookings-react). Bookings requirements
live under `@voyant-travel/bookings-react/requirements`; checkout UI lives under
`@voyant-travel/finance-react/checkout-ui`. The shared admin shell lives in
[`@voyant-travel/admin`](./packages/admin/README.md); cross-cutting primitives in
[`packages/ui`](./packages/ui/README.md).

### Plugins

- [`@voyant-travel/plugin-netopia`](./packages/plugins/netopia) — Netopia payments
- [`@voyant-travel/plugin-smartbill`](./packages/plugins/smartbill/README.md) — SmartBill e-invoicing (Romanian tax compliance)
- [`@voyant-travel/plugin-payload-cms`](./packages/plugins/payload-cms/README.md) — Payload CMS sync
- [`@voyant-travel/plugin-sanity-cms`](./packages/plugins/sanity-cms/README.md) — Sanity CMS sync

## For contributors

This repository is the workspace that powers the framework, starters, runners, and examples.

| Area | What it contains |
| --- | --- |
| [`packages/*`](./packages) | Reusable business logic, schemas, services, transport adapters, and integrations |
| [`packages/plugins/*`](./packages/plugins) | First-party plugin bundles (payments, invoicing, CMS sync) |
| [`starters/*`](./starters) | First-party starter apps |
| [`apps/workflows-*`](./apps) | Reference orchestrator/tenant/self-host workers and the local workflows dashboard |
| [`apps/scripts`](./apps/scripts/README.md) | Workspace scripts (e.g. seed operator data) |

### Monorepo commands

| Command | Description |
| --- | --- |
| `pnpm install` | Install workspace dependencies |
| `pnpm build` | Build the workspace with Turborepo |
| `pnpm typecheck` | Run workspace typechecks |
| `pnpm test` | Run workspace tests |
| `pnpm test:bookings:integration` | Start or reuse the Docker test Postgres, ensure the bookings test schema, and run the bookings integration files serially |
| `pnpm lint` | Run Biome checks across the repo |
| `pnpm generate:schema-docs` | Regenerate [`SCHEMA.md`](./SCHEMA.md) from the Drizzle table definitions |
| `pnpm -F operator dev` | Start the operator starter on port `3300` |

### Integration test database

The shared Docker test Postgres is defined in [`docker-compose.test.yml`](./docker-compose.test.yml).

- default host port: `5436`
- override with `TEST_DATABASE_PORT`
- override the full connection string with `TEST_DATABASE_URL`

For the bookings package, contributors can use:

```bash
pnpm test:bookings:integration
```

That helper starts or reuses the Docker test DB, applies starter migrations, ensures the current additive bookings-session table exists, and runs the bookings DB-backed integration files serially to avoid deadlocks from concurrent table truncation.

## Architecture

Voyant keeps a strict boundary:

- `packages/*` hold reusable business logic, schemas, services, routes, adapters, and contracts
- `starters/*` and app shells own UI, auth wiring, deployment shape, and runtime-specific configuration
- Core packages stay framework-agnostic even when first-party starters use React, TanStack Start, Hono, Better Auth, and Cloudflare Workers
- Transport adapters stay thin and call shared domain services rather than owning business logic
- Workflow business logic ships as plain SDK packages; orchestrator/runner apps wrap them for a given runtime

Architecture decisions live in [`docs/adr/`](./docs/adr/); domain conventions live in [`docs/architecture/`](./docs/architecture/); per-minor migration notes live in [`docs/migrations/`](./docs/migrations/README.md).

## Security model

**One Postgres database + one runtime per organization.** Tenancy is enforced at the deployment boundary, not by in-process middleware. See [ADR-0001](./docs/adr/0001-tenant-scoping.md) for the full rationale, the alternatives considered, and the conditions under which the decision should be revisited.

## Credits

Voyant is created and maintained by [PixelMakers](https://pixelmakers.com).

## License

Apache License, Version 2.0 (`Apache-2.0`). See [LICENSE](./LICENSE).

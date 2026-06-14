# Voyant

Voyant is an open-source framework for OTAs, tour operators, and DMCs. It ships starter apps, durable workflow orchestration, and a wide set of headless domain modules - catalog, commerce, inventory, operations, relationships, quotes, bookings, finance, distribution, legal, charters, cruises, accommodation resale, and more - that you can compose into your own travel platform.

#### [CLI](./packages/cli/README.md) | [Operator Template](./templates/operator/README.md) | [Packages](./packages) | [Examples](./examples) | [Migrations](./docs/migrations/README.md)

## Get started

### 1. Install the CLI

```bash
npm install -g @voyantjs/cli
```

You can also use `pnpm add -g @voyantjs/cli`.

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

## Starter templates

Voyant ships one first-party starter:

| Starter | Purpose | Stack |
| --- | --- | --- |
| [`templates/operator`](./templates/operator/README.md) | Tour operator workflows | Cloudflare Workers, TanStack Start, Hono, Better Auth, Drizzle |

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

- [`@voyantjs/core`](./packages/core/README.md), [`@voyantjs/db`](./packages/db/README.md), [`@voyantjs/hono`](./packages/hono/README.md), [`@voyantjs/react`](./packages/react)
- [`@voyantjs/auth`](./packages/auth/README.md), [`@voyantjs/auth-react`](./packages/auth-react/README.md), [`@voyantjs/types`](./packages/types/README.md), [`@voyantjs/utils`](./packages/utils/README.md), [`@voyantjs/voyant-test-utils`](./packages/test-utils/README.md)
- [`@voyantjs/cli`](./packages/cli/README.md), [`@voyantjs/storage`](./packages/storage/README.md), [`@voyantjs/i18n`](./packages/i18n)

### Travel domain modules

- [`@voyantjs/catalog`](./packages/catalog/README.md), [`@voyantjs/commerce`](./packages/commerce/README.md), [`@voyantjs/inventory`](./packages/inventory), [`@voyantjs/operations`](./packages/operations)
- [`@voyantjs/bookings`](./packages/bookings/README.md), [`@voyantjs/finance`](./packages/finance/README.md), [`@voyantjs/legal`](./packages/legal/README.md), [`@voyantjs/notifications`](./packages/notifications/README.md)
- [`@voyantjs/distribution`](./packages/distribution/README.md), [`@voyantjs/relationships`](./packages/relationships/README.md), [`@voyantjs/quotes`](./packages/quotes/README.md), [`@voyantjs/trips`](./packages/trips)
- [`@voyantjs/identity`](./packages/identity/README.md), [`@voyantjs/storefront`](./packages/storefront), [`@voyantjs/storefront-verification`](./packages/storefront-verification)
- [`@voyantjs/accommodations`](./packages/accommodations), [`@voyantjs/charters`](./packages/charters/README.md), [`@voyantjs/cruises`](./packages/cruises/README.md), [`@voyantjs/flights`](./packages/flights), [`@voyantjs/octo`](./packages/octo)

### Workflows (durable orchestration)

Step-based workflows with durable state, retries, and a shared wire protocol — runnable on Cloudflare Workers + Durable Objects, Node, or Voyant Cloud.

- [`@voyantjs/workflows`](./packages/workflows) — authoring SDK
- [`@voyantjs/workflows-orchestrator`](./packages/workflows-orchestrator) — reference orchestrator core
- [`@voyantjs/workflows-orchestrator-cloudflare`](./packages/workflows-orchestrator-cloudflare) and [`@voyantjs/workflows-orchestrator-node`](./packages/workflows-orchestrator-node) — runtime adapters
- `@voyantjs/workflows/bindings`, `@voyantjs/workflows/config`, and `@voyantjs/workflows/errors` — SDK subpaths for runtime bindings, config, and typed errors
- [`@voyantjs/workflows-react`](./packages/workflows-react) — UI hooks for run inspection
- [`@voyantjs/workflows-react/ui`](./packages/workflows-react) — importable workflow run admin UI

Reference apps under [`apps/`](./apps) compose these into deployable shapes — `workflows-orchestrator-worker`, `workflows-tenant-worker`, `workflows-selfhost-cloudflare-worker`, `workflows-selfhost-node-server`, `workflows-node-step-container`, and `workflows-local-dashboard`.

### UI and React families

Reusable frontend surfaces live in the matching `-react` package for each
domain module. Those packages own hooks, clients, providers, query keys,
view-model helpers, reusable components, and `./ui` owner paths where needed -
for example [`@voyantjs/relationships-react`](./packages/relationships-react/README.md),
[`@voyantjs/quotes-react`](./packages/quotes-react/README.md),
[`@voyantjs/inventory-react`](./packages/inventory-react),
[`@voyantjs/commerce-react`](./packages/commerce-react), and
[`@voyantjs/bookings-react`](./packages/bookings-react). Bookings requirements
live under `@voyantjs/bookings-react/requirements`; checkout UI lives under
`@voyantjs/finance-react/checkout-ui`. The shared admin shell lives in
[`@voyantjs/admin`](./packages/admin/README.md); cross-cutting primitives in
[`packages/ui`](./packages/ui/README.md).

### Plugins

- [`@voyantjs/plugin-netopia`](./packages/plugins/netopia) — Netopia payments
- [`@voyantjs/plugin-smartbill`](./packages/plugins/smartbill/README.md) — SmartBill e-invoicing (Romanian tax compliance)
- [`@voyantjs/plugin-payload-cms`](./packages/plugins/payload-cms/README.md) — Payload CMS sync
- [`@voyantjs/plugin-sanity-cms`](./packages/plugins/sanity-cms/README.md) — Sanity CMS sync

## For contributors

This repository is the workspace that powers the framework, starters, runners, and examples.

| Area | What it contains |
| --- | --- |
| [`packages/*`](./packages) | Reusable business logic, schemas, services, transport adapters, and integrations |
| [`packages/plugins/*`](./packages/plugins) | First-party plugin bundles (payments, invoicing, CMS sync) |
| [`templates/*`](./templates) | First-party starter apps |
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
| `pnpm -F operator dev` | Start the operator template on port `3300` |

### Integration test database

The shared Docker test Postgres is defined in [`docker-compose.test.yml`](./docker-compose.test.yml).

- default host port: `5436`
- override with `TEST_DATABASE_PORT`
- override the full connection string with `TEST_DATABASE_URL`

For the bookings package, contributors can use:

```bash
pnpm test:bookings:integration
```

That helper starts or reuses the Docker test DB, applies template migrations, ensures the current additive bookings-session table exists, and runs the bookings DB-backed integration files serially to avoid deadlocks from concurrent table truncation.

## Architecture

Voyant keeps a strict boundary:

- `packages/*` hold reusable business logic, schemas, services, routes, adapters, and contracts
- `templates/*` and app shells own UI, auth wiring, deployment shape, and runtime-specific configuration
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

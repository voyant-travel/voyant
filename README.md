# Voyant

Voyant is an open-source framework for OTAs, tour operators, and DMCs. It ships starter apps, durable workflow orchestration, and a wide set of headless domain modules - CRM, products, availability, bookings, finance, distribution, resources, legal, charters, cruises, accommodation resale, and more - that you can compose into your own travel platform.

#### [CLI](./packages/cli/README.md) | [DMC Template](./templates/dmc/README.md) | [Operator Template](./templates/operator/README.md) | [Packages](./packages) | [Examples](./examples) | [Migrations](./docs/migrations/README.md)

## Get started

### 1. Install the CLI

```bash
npm install -g @voyantjs/cli
```

You can also use `pnpm add -g @voyantjs/cli`.

### 2. Scaffold a project from a starter

```bash
voyant new my-travel-app --template dmc
cd my-travel-app
pnpm install
```

Built-in starters are downloaded from the matching GitHub Release for your installed CLI version. You can also point `--template` at a custom local starter directory.

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

Voyant ships two first-party starters:

| Starter | Purpose | Stack |
| --- | --- | --- |
| [`templates/dmc`](./templates/dmc/README.md) | Destination management company workflows | Cloudflare Workers, TanStack Start, Hono, Better Auth, Drizzle |
| [`templates/operator`](./templates/operator/README.md) | Tour operator workflows | Cloudflare Workers, TanStack Start, Hono, Better Auth, Drizzle |

## What you get

- Deployable application shells, not just isolated packages
- A normalized travel operations data model on PostgreSQL + Drizzle
- Headless domain modules for CRM, catalog, availability, bookings, finance, legal, resources, charters, cruises, accommodation resale, and more
- Hono-based API transport with optional Next.js route helpers
- Step-based durable workflow orchestration that runs on Cloudflare Workers + Durable Objects, Node, or Voyant Cloud
- Better Auth wiring in first-party starters, with core packages staying auth-provider agnostic
- A shadcn-style component registry per domain (`crm-ui`, `products-ui`, `bookings-ui`, …) for installable UI blocks
- React hook libraries (`crm-react`, `products-react`, `bookings-react`, …) that wrap the HTTP contract of each module
- Optional integrations for payments, e-invoicing, storage, CMS sync, and notifications

Voyant supports accommodation as catalog inventory for resale, packaging, and
trip composition. It is not positioned as a hotel PMS or first-party
hotel-operations system; see
[`docs/architecture/accommodation-resale-boundary.md`](./docs/architecture/accommodation-resale-boundary.md).

## The framework surface

### Core platform

- [`@voyantjs/core`](./packages/core/README.md), [`@voyantjs/db`](./packages/db/README.md), [`@voyantjs/hono`](./packages/hono/README.md), [`@voyantjs/next`](./packages/next/README.md), [`@voyantjs/react`](./packages/react)
- [`@voyantjs/auth`](./packages/auth/README.md), [`@voyantjs/auth-react`](./packages/auth-react/README.md), [`@voyantjs/types`](./packages/types/README.md), [`@voyantjs/utils`](./packages/utils/README.md), [`@voyantjs/voyant-test-utils`](./packages/test-utils/README.md)
- [`@voyantjs/cli`](./packages/cli/README.md), [`@voyantjs/storage`](./packages/storage/README.md), [`@voyantjs/i18n`](./packages/i18n)

### Travel domain modules

- [`@voyantjs/crm`](./packages/crm/README.md), [`@voyantjs/suppliers`](./packages/suppliers/README.md), [`@voyantjs/products`](./packages/products/README.md), [`@voyantjs/availability`](./packages/availability/README.md)
- [`@voyantjs/booking-requirements`](./packages/booking-requirements/README.md), [`@voyantjs/resources`](./packages/resources/README.md), [`@voyantjs/transactions`](./packages/transactions/README.md), [`@voyantjs/bookings`](./packages/bookings/README.md)
- [`@voyantjs/finance`](./packages/finance/README.md), [`@voyantjs/notifications`](./packages/notifications/README.md), [`@voyantjs/checkout`](./packages/checkout), [`@voyantjs/legal`](./packages/legal/README.md)
- [`@voyantjs/distribution`](./packages/distribution/README.md), [`@voyantjs/markets`](./packages/markets/README.md), [`@voyantjs/pricing`](./packages/pricing/README.md), [`@voyantjs/extras`](./packages/extras/README.md), [`@voyantjs/sellability`](./packages/sellability/README.md)
- [`@voyantjs/facilities`](./packages/facilities/README.md), [`@voyantjs/ground`](./packages/ground/README.md), [`@voyantjs/identity`](./packages/identity/README.md), [`@voyantjs/external-refs`](./packages/external-refs/README.md), [`@voyantjs/octo`](./packages/octo)
- [`@voyantjs/charters`](./packages/charters/README.md), [`@voyantjs/cruises`](./packages/cruises/README.md), [`@voyantjs/storefront`](./packages/storefront), [`@voyantjs/customer-portal`](./packages/customer-portal), [`@voyantjs/storefront-verification`](./packages/storefront-verification)

### Workflows (durable orchestration)

Step-based workflows with durable state, retries, and a shared wire protocol — runnable on Cloudflare Workers + Durable Objects, Node, or Voyant Cloud.

- [`@voyantjs/workflows`](./packages/workflows) — authoring SDK
- [`@voyantjs/workflows-orchestrator`](./packages/workflows-orchestrator) — reference orchestrator core
- [`@voyantjs/workflows-orchestrator-cloudflare`](./packages/workflows-orchestrator-cloudflare) and [`@voyantjs/workflows-orchestrator-node`](./packages/workflows-orchestrator-node) — runtime adapters
- `@voyantjs/workflows/bindings`, `@voyantjs/workflows/config`, and `@voyantjs/workflows/errors` — SDK subpaths for runtime bindings, config, and typed errors
- [`@voyantjs/workflows-react`](./packages/workflows-react) — UI hooks for run inspection
- [`@voyantjs/workflows-ui`](./packages/workflows-ui) — importable workflow run admin UI

Reference apps under [`apps/`](./apps) compose these into deployable shapes — `workflows-orchestrator-worker`, `workflows-tenant-worker`, `workflows-selfhost-cloudflare-worker`, `workflows-selfhost-node-server`, `workflows-node-step-container`, and `workflows-local-dashboard`.

### UI registries and React families

Each domain module has matching `-ui` (shadcn registry source) and `-react` (hooks + provider) packages where a reusable frontend surface is warranted - for example [`@voyantjs/crm-ui`](./packages/crm-ui/README.md) + [`@voyantjs/crm-react`](./packages/crm-react/README.md), [`@voyantjs/bookings-ui`](./packages/bookings-ui) + [`@voyantjs/bookings-react`](./packages/bookings-react), and so on across `products`, `finance`, `availability`, `distribution`, `markets`, `pricing`, `legal`, `resources`, `facilities`, `suppliers`, `identity`, `external-refs`, `charters`, `cruises`, `extras`, `sellability`, `booking-requirements`. The shared admin shell lives in [`@voyantjs/admin`](./packages/admin/README.md); cross-cutting primitives in [`packages/ui`](./packages/ui/README.md).

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
| [`apps/dev`](./apps/dev/README.md) | Internal playground for broader module coverage |
| [`apps/registry`](./apps/registry/README.md) | Hosted shadcn registry for installable Voyant UI components |
| [`apps/workflows-*`](./apps) | Reference orchestrator/tenant/self-host workers and the local workflows dashboard |
| [`apps/scripts`](./apps/scripts/README.md) | Workspace scripts (e.g. seed operator data) |
| [`examples/*`](./examples) | Reference apps that consume Voyant surfaces (e.g. `nextjs-booking-portal`) |

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
| `pnpm registry:build` | Aggregate per-package shadcn registries into `apps/registry/public/r/` |
| `pnpm -F dmc dev` | Start the DMC template on port `3100` |
| `pnpm -F operator dev` | Start the operator template on port `3300` |
| `pnpm -F dev dev` | Start the internal playground on port `3200` |

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

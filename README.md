# Voyant

Voyant is a source-available framework for travel companies. It provides starter apps and domain modules for CRM, products, availability, bookings, finance, distribution, resources, legal, and related travel workflows.

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

Built-in starters are downloaded from the matching GitHub Release for your installed CLI version.

You can also point `--template` at a custom local starter directory.

### 3. Configure the app

```bash
cp .dev.vars.example .dev.vars
```

Then set your secrets in `.dev.vars` and provide `DATABASE_URL` in `.env` for Drizzle and local worker processes.

### 4. Run the app

```bash
pnpm db:migrate
pnpm dev
```

If your starter uses background jobs, run the worker in a second terminal:

```bash
pnpm dev:worker
```

## Starter templates

Voyant currently ships two first-party starters:

| Starter | Purpose | Stack |
| --- | --- | --- |
| [`templates/dmc`](./templates/dmc/README.md) | Destination management company workflows | Cloudflare Workers, TanStack Start, Hono, Better Auth, Drizzle |
| [`templates/operator`](./templates/operator/README.md) | Tour operator workflows | Cloudflare Workers, TanStack Start, Hono, Better Auth, Drizzle |

## What you get

- A deployable application shell, not just isolated packages
- A normalized travel operations data model on PostgreSQL + Drizzle
- Headless domain modules for CRM, catalog, availability, bookings, finance, legal, resources, and more
- Hono-based API transport with optional Next.js route helpers
- Better Auth wiring in first-party starters, while keeping core packages auth-provider agnostic
- Optional integrations for payments, invoicing, storage, CMS sync, and notifications

## The framework surface

### Core platform

- [`@voyantjs/core`](./packages/core/README.md), [`@voyantjs/db`](./packages/db/README.md), [`@voyantjs/hono`](./packages/hono/README.md), [`@voyantjs/next`](./packages/next/README.md)
- [`@voyantjs/auth`](./packages/auth/README.md), [`@voyantjs/types`](./packages/types/README.md), [`@voyantjs/utils`](./packages/utils/README.md), [`@voyantjs/voyant-test-utils`](./packages/test-utils/README.md)
- [`@voyantjs/cli`](./packages/cli/README.md), [`@voyantjs/voyant-storage`](./packages/storage/README.md)

### Travel domain modules

- [`@voyantjs/crm`](./packages/crm/README.md), [`@voyantjs/suppliers`](./packages/suppliers/README.md), [`@voyantjs/products`](./packages/products/README.md), [`@voyantjs/availability`](./packages/availability/README.md)
- [`@voyantjs/booking-requirements`](./packages/booking-requirements/README.md), [`@voyantjs/resources`](./packages/resources/README.md), [`@voyantjs/transactions`](./packages/transactions/README.md), [`@voyantjs/bookings`](./packages/bookings/README.md)
- [`@voyantjs/finance`](./packages/finance/README.md), [`@voyantjs/notifications`](./packages/notifications/README.md), [`@voyantjs/checkout`](./packages/checkout/README.md), [`@voyantjs/legal`](./packages/legal/README.md)
- [`@voyantjs/distribution`](./packages/distribution/README.md), [`@voyantjs/markets`](./packages/markets/README.md), [`@voyantjs/pricing`](./packages/pricing/README.md), [`@voyantjs/extras`](./packages/extras/README.md), [`@voyantjs/sellability`](./packages/sellability/README.md)
- [`@voyantjs/facilities`](./packages/facilities/README.md), [`@voyantjs/hospitality`](./packages/hospitality/README.md), [`@voyantjs/ground`](./packages/ground/README.md), [`@voyantjs/identity`](./packages/identity/README.md), [`@voyantjs/external-refs`](./packages/external-refs/README.md), [`@voyantjs/octo`](./packages/octo)

### UI and integrations

- [`@voyantjs/admin`](./packages/admin/README.md), [`@voyantjs/crm-react`](./packages/crm-react/README.md), and [`@voyantjs/products-react`](./packages/products-react/README.md)
- [`packages/ui`](./packages/ui/README.md) holds the private shadcn registry source for installable UI blocks
- [`@voyantjs/plugin-netopia`](./packages/plugins/netopia/README.md), [`@voyantjs/plugin-smartbill`](./packages/plugins/smartbill/README.md), [`@voyantjs/plugin-payload-cms`](./packages/plugins/payload-cms/README.md), [`@voyantjs/plugin-sanity-cms`](./packages/plugins/sanity-cms/README.md)

## For contributors

This repository is the workspace that powers the framework, starters, and examples.

| Area | What it contains |
| --- | --- |
| [`packages/*`](./packages) | Reusable business logic, schemas, services, transport adapters, and integrations |
| [`templates/*`](./templates) | First-party starter apps |
| [`apps/dev`](./apps/dev/README.md) | Internal playground for broader module coverage |
| [`apps/registry`](./apps/registry) | Hosted shadcn registry for installable Voyant UI components |
| [`examples/*`](./examples) | Reference apps that consume Voyant surfaces |

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

That helper starts or reuses the Docker test DB, applies template migrations,
ensures the current additive bookings-session table exists, and runs the
bookings DB-backed integration files serially to avoid deadlocks from concurrent
table truncation.

## Architecture

Voyant keeps a strict boundary:

- `packages/*` hold reusable business logic, schemas, services, routes, adapters, and contracts
- `templates/*` and app shells own UI, auth wiring, deployment shape, and runtime-specific configuration
- Core packages stay framework-agnostic even when first-party starters use React, TanStack Start, Hono, Better Auth, and Cloudflare Workers
- Transport adapters stay thin and call shared domain services rather than owning business logic

Architecture decisions live in [`docs/adr/`](./docs/adr/); domain
conventions live in [`docs/architecture/`](./docs/architecture/);
per-minor migration notes live in [`docs/migrations/`](./docs/migrations/README.md).

## Security model

**One Postgres database + one runtime per organization.** Tenancy is
enforced at the deployment boundary, not by in-process middleware. See
[ADR-0001](./docs/adr/0001-tenant-scoping.md) for the full rationale,
the alternatives considered, and the conditions under which the decision
should be revisited.

## License

Functional Source License, Version 1.1, Apache 2.0 Future License (`FSL-1.1-Apache-2.0`). See [LICENSE](./LICENSE).

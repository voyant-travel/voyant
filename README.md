<p align="center">
  <a href="https://voyant.travel">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://voyant.travel/images/logo/light.svg" />
      <img alt="Voyant" src="https://voyant.travel/images/logo/dark.svg" width="200" />
    </picture>
  </a>
</p>

<h1 align="center">
  Voyant
</h1>

<p align="center">
  The open-source travel commerce framework for OTAs, tour operators, and DMCs.
</p>

<p align="center">
  <a href="https://github.com/voyant-travel/voyant/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg" alt="Voyant is released under the Apache 2.0 license." />
  </a>
  <a href="https://www.npmjs.com/package/@voyant-travel/cli">
    <img src="https://img.shields.io/npm/v/@voyant-travel/cli.svg" alt="Current npm package version." />
  </a>
  <a href="https://github.com/voyant-travel/voyant/pulls">
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs welcome!" />
  </a>
  <a href="https://x.com/voyant_travel">
    <img src="https://img.shields.io/twitter/follow/voyant_travel.svg?label=Follow%20@voyant_travel" alt="Follow @voyant_travel" />
  </a>
</p>

<h4 align="center">
  <a href="https://voyant.travel/docs">Documentation</a> |
  <a href="https://voyant.travel">Website</a>
</h4>

<p align="center">
  Voyant ships deployable starter apps, durable workflow orchestration, and a
  wide set of headless domain modules — catalog, commerce, inventory, operations,
  relationships, quotes, bookings, finance, distribution, legal, charters,
  cruises, accommodation resale, and more — that you compose into your own
  travel platform.
</p>

## Getting started

Install the CLI, scaffold an app from a first-party starter, and run it locally.

```bash
# 1. Install the CLI
npm install -g @voyant-travel/cli

# 2. Scaffold a project from a starter
voyant new my-travel-app --template operator
cd my-travel-app
pnpm install

# 3. Configure the app
cp .dev.vars.example .dev.vars
# set your secrets in .dev.vars, and DATABASE_URL in .env

# 4. Run the app
pnpm db:migrate
pnpm dev
```

> Built-in starters are downloaded from GitHub Release assets for the matching CLI release. You can also point `--template` at a custom local starter directory.

Visit the [documentation](https://voyant.travel/docs) to learn more.

## What is Voyant?

Voyant is a framework for building travel commerce platforms. Instead of a
monolithic booking system, it gives you composable, headless domain modules
and deployable application shells that you own and extend.

- **Deployable application shells, not just isolated packages.** First-party
  starters ship as real, runnable apps.
- **A normalized travel operations data model** on PostgreSQL + Drizzle.
- **Headless domain modules** for catalog, commerce, inventory, operations,
  relationships, quotes, bookings, finance, distribution, legal, charters,
  cruises, accommodation resale, and more.
- **Hono-based API transport** with optional Next.js route helpers.
- **Durable, step-based workflow orchestration** that runs on self-host
  infrastructure or Voyant Cloud's hosted runtime.
- **Better Auth wiring** in first-party starters, with core packages staying
  auth-provider agnostic.
- **Versioned React packages per domain** (`relationships-react`,
  `inventory-react`, `commerce-react`, `bookings-react`, …) consumed as
  ordinary dependencies — hooks, clients, providers, query keys, and reusable
  UI that wrap each module's HTTP contract.
- **Optional integrations** for payments, e-invoicing, storage, CMS sync, and
  notifications.

Voyant supports accommodation as catalog inventory for resale, packaging, and
trip composition. It is not positioned as a hotel PMS or first-party
hotel-operations system — see
[`docs/architecture/accommodation-resale-boundary.md`](./docs/architecture/accommodation-resale-boundary.md).

## Starters

Voyant ships one first-party starter:

| Starter | Purpose | Stack |
| --- | --- | --- |
| [`starters/operator`](./starters/operator/README.md) | Tour operator workflows | Cloudflare Workers, TanStack Start, Hono, Better Auth, Drizzle |

## The framework surface

### Core platform

- [`@voyant-travel/core`](./packages/core/README.md), [`@voyant-travel/db`](./packages/db/README.md), [`@voyant-travel/hono`](./packages/hono/README.md), [`@voyant-travel/react`](./packages/react)
- [`@voyant-travel/auth`](./packages/auth/README.md), [`@voyant-travel/auth-react`](./packages/auth-react/README.md), [`@voyant-travel/types`](./packages/types/README.md), [`@voyant-travel/utils`](./packages/utils/README.md), [`@voyant-travel/voyant-test-utils`](./packages/test-utils/README.md)
- [`@voyant-travel/cli`](https://www.npmjs.com/package/@voyant-travel/cli), [`@voyant-travel/storage`](./packages/storage/README.md), [`@voyant-travel/i18n`](./packages/i18n)

### Travel domain modules

- [`@voyant-travel/catalog`](./packages/catalog/README.md), [`@voyant-travel/commerce`](./packages/commerce/README.md), [`@voyant-travel/inventory`](./packages/inventory), [`@voyant-travel/operations`](./packages/operations)
- [`@voyant-travel/bookings`](./packages/bookings/README.md), [`@voyant-travel/finance`](./packages/finance/README.md), [`@voyant-travel/legal`](./packages/legal/README.md), [`@voyant-travel/notifications`](./packages/notifications/README.md)
- [`@voyant-travel/distribution`](./packages/distribution/README.md), [`@voyant-travel/relationships`](./packages/relationships/README.md), [`@voyant-travel/quotes`](./packages/quotes/README.md), [`@voyant-travel/trips`](./packages/trips)
- [`@voyant-travel/identity`](./packages/identity/README.md), [`@voyant-travel/storefront`](./packages/storefront)
- [`@voyant-travel/accommodations`](./packages/accommodations), [`@voyant-travel/charters`](./packages/charters/README.md), [`@voyant-travel/cruises`](./packages/cruises/README.md), [`@voyant-travel/flights`](./packages/flights), [`@voyant-travel/octo`](./packages/octo)

### Workflows (durable orchestration)

Step-based workflows with durable state, retries, and a shared wire protocol —
runnable on self-host infrastructure or Voyant Cloud's hosted runtime.

- [`@voyant-travel/workflows`](./packages/workflows) — authoring SDK
- [`@voyant-travel/workflows-orchestrator`](./packages/workflows-orchestrator) — orchestrator engine and Postgres self-host runtime primitives
- `@voyant-travel/workflows/bindings`, `@voyant-travel/workflows/config`, and `@voyant-travel/workflows/errors` — SDK subpaths for runtime bindings, config, and typed errors
- [`@voyant-travel/workflows-react`](./packages/workflows-react) — UI hooks for run inspection, plus an importable workflow run admin UI at `@voyant-travel/workflows-react/ui`

Reference apps under [`apps/`](./apps) compose these into deployable shapes —
`workflows-selfhost-node-server` and `workflows-local-dashboard`.

### UI and React families

Reusable frontend surfaces live in the matching `-react` package for each
domain module. Those packages own hooks, clients, providers, query keys,
view-model helpers, reusable components, and `./ui` owner paths where needed —
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

## Architecture

Voyant keeps a strict boundary between reusable business logic and deployment shells:

- `packages/*` hold reusable business logic, schemas, services, routes, adapters, and contracts
- `starters/*` and app shells own UI, auth wiring, deployment shape, and runtime-specific configuration
- Core packages stay framework-agnostic even when first-party starters use React, TanStack Start, Hono, Better Auth, and Cloudflare Workers
- Transport adapters stay thin and call shared domain services rather than owning business logic
- Workflow business logic ships as plain SDK packages; orchestrator/runner apps wrap them for a given runtime

Architecture decisions live in [`docs/adr/`](./docs/adr/); domain conventions
live in [`docs/architecture/`](./docs/architecture/); per-minor migration notes
live in [`docs/migrations/`](./docs/migrations/README.md).

## Contributing

This repository is the workspace that powers the framework, starters, runners,
and examples.

| Area | What it contains |
| --- | --- |
| [`packages/*`](./packages) | Reusable business logic, schemas, services, transport adapters, and integrations |
| [`packages/plugins/*`](./packages/plugins) | First-party plugin bundles (payments, invoicing, CMS sync) |
| [`starters/*`](./starters) | First-party starter apps |
| [`apps/workflows-*`](./apps) | Reference orchestrator/tenant/self-host workers and the local workflows dashboard |
| [`apps/scripts`](./apps/scripts/README.md) | Workspace scripts (e.g. seed operator data) |

### Monorepo commands

Voyant uses [pnpm](https://pnpm.io) workspaces and [Turborepo](https://turbo.build).

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

The shared Docker test Postgres is defined in
[`docker-compose.test.yml`](./docker-compose.test.yml).

- default host port: `5436`
- override with `TEST_DATABASE_PORT`
- override the full connection string with `TEST_DATABASE_URL`

For the bookings package, contributors can use:

```bash
pnpm test:bookings:integration
```

That helper starts or reuses the Docker test DB, applies starter migrations,
ensures the current additive bookings-session table exists, and runs the
bookings DB-backed integration files serially to avoid deadlocks from
concurrent table truncation.

## Community & support

- [Documentation](https://voyant.travel/docs) — guides, references, and concepts
- [GitHub Issues](https://github.com/voyant-travel/voyant/issues) — bugs and feature requests
- [@voyant_travel](https://x.com/voyant_travel) — news and updates

## Credits

Voyant is created and maintained by [PixelMakers](https://pixelmakers.com).

## License

Licensed under the [Apache License, Version 2.0](./LICENSE) (`Apache-2.0`).

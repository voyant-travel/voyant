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
  The open-source travel commerce platform for OTAs, tour operators, and DMCs.
</p>

<p align="center">
  <a href="https://github.com/voyant-travel/voyant/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg" alt="Voyant is released under the Apache 2.0 license." />
  </a>
  <a href="https://www.npmjs.com/package/@voyant-travel/cli">
    <img src="https://img.shields.io/npm/v/@voyant-travel/cli.svg?label=%40voyant-travel%2Fcli" alt="Current @voyant-travel/cli npm version." />
  </a>
  <a href="https://github.com/voyant-travel/voyant/pkgs/container/operator">
    <img src="https://img.shields.io/badge/ghcr.io-voyant--travel%2Foperator-blue.svg" alt="The Operator container image on GHCR." />
  </a>
  <a href="https://github.com/voyant-travel/voyant/issues">
    <img src="https://img.shields.io/badge/issues-welcome-brightgreen.svg" alt="Issues welcome!" />
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
  Voyant is delivered as the <strong>Operator</strong> — a complete, deployable
  travel commerce back office — composed from a wide set of headless domain
  modules (catalog, commerce, inventory, operations, relationships, proposals,
  bookings, finance, distribution, legal, charters, cruises, accommodation
  resale, and more) that live in this repository.
</p>

## Getting started

The Operator is a resident Node application distributed as a container image.
Run it managed, or self-host it.

### Managed

[Voyant Cloud](https://voyant.travel) provisions and upgrades an Operator
deployment for you: one Postgres database and one runtime per organization. A
running deployment can be exported as a self-host bundle at any time — see
[Exporting From Voyant Cloud](./docs/exporting-from-voyant-cloud.md).

### Self-hosted

The composed Operator image is published to GHCR and is the supported
self-host artifact:

```bash
docker pull ghcr.io/voyant-travel/operator:latest
docker run --rm -p 8080:8080 --env-file ./operator.env \
  ghcr.io/voyant-travel/operator:latest
```

The server listens on `PORT` (default `8080`) and exposes `/healthz` for
container probes. It needs a Postgres URL and a set of auth, session, and
integration secrets — [`apps/operator/.env.example`](./apps/operator/.env.example)
is the authoritative key list.

> Every push to `main` publishes an immutable `sha-<git-sha>` tag; deliberate
> releases publish a bare semver tag, and `latest` is promoted from an
> already-verified release digest. **Pin a semver tag or a digest in
> production** — a `sha-` snapshot records which commit was built, not which
> version was released. See
> [Operator Image Distribution](./docs/architecture/operator-image-distribution.md).

### From source

To generate and own a project instead, use the CLI:

```bash
npm install -g @voyant-travel/cli
voyant new my-travel-app
cd my-travel-app && pnpm install
cp .env.example .env   # set DATABASE_URL, auth secrets, …
pnpm db:migrate && pnpm dev
```

Visit the [documentation](https://voyant.travel/docs) to learn more.

## What is Voyant?

Voyant is a travel commerce platform for OTAs, tour operators, and DMCs.
Instead of a monolithic booking system, the product is assembled from
composable, headless domain modules resolved into a single deployment graph —
so the Operator you run is a real, complete application, and the modules behind
it stay independently versioned and extensible.

- **A deployable product, not a pile of packages.** The Operator is composed,
  built, and shipped as one artifact.
- **A normalized travel operations data model** on PostgreSQL + Drizzle.
- **Headless domain modules** for catalog, commerce, inventory, operations,
  relationships, proposals, bookings, finance, distribution, legal, charters,
  cruises, accommodation resale, and more.
- **Hono-based API transport** with optional Next.js route helpers.
- **Package-owned subscribers and jobs** selected with their domain modules and
  hosted by self-managed infrastructure or Voyant Cloud.
- **Better Auth wiring** in the generated application, with core packages
  staying auth-provider agnostic.
- **Versioned React packages per domain** (`relationships-react`,
  `inventory-react`, `commerce-react`, `bookings-react`, …): hooks, clients,
  providers, query keys, and reusable UI that wrap each module's HTTP contract.
- **Optional integrations** for payments, e-invoicing, storage, CMS sync, and
  notifications.

Voyant supports accommodation as catalog inventory for resale, packaging, and
trip composition. It is not positioned as a hotel PMS or first-party
hotel-operations system. See
[`docs/architecture/accommodation-resale-boundary.md`](./docs/architecture/accommodation-resale-boundary.md).

## The Operator

The Operator is the first-party product: a tour operator and DMC back office
running as a resident Node process (TanStack Start + React 19, Hono, Better
Auth, Drizzle on Postgres). It is composed from the modules below through the
resolved deployment graph and booted by
[`@voyant-travel/runtime`](./packages/runtime).

The unified composed application graph is **Node-only** — a fully composed
operator cannot stay resident on Cloudflare Workers, though Workers still host
separate edge-native storefront and federated surfaces. The measurements and
the decision behind that are in
[Deployment Targets](./docs/architecture/deployment-targets.md) and
[Node Runtime Authority](./docs/architecture/node-runtime-authority.md).

[`apps/operator`](./apps/operator/README.md) is the checked-in integration
application that exercises the whole product in this workspace. It is not the
consumer project — generated projects come from the CLI's
`STANDARD_NODE_STARTER` contract, documented in
[Standard Node Starter Acceptance](./docs/architecture/standard-node-starter-acceptance.md).

## The module surface

Voyant's packages are the composition surface for the product; most are
internal to it rather than separately installable. **Fourteen packages are
published to npm** — chiefly the `*-contracts` tier plus
[`@voyant-travel/cli`](https://www.npmjs.com/package/@voyant-travel/cli),
`@voyant-travel/ui`, `@voyant-travel/payments`, `@voyant-travel/schema-kit`,
`@voyant-travel/app-manifest`, and `@voyant-travel/admin-extension-sdk`. The
rest of the tables below map the repository, not the npm registry; see
[`docs/frontend-package-strategy.md`](./docs/frontend-package-strategy.md) for
what may be published and why.

### Core platform

| Package | Description |
| --- | --- |
| [`@voyant-travel/core`](./packages/core/README.md) | Module system, container, event bus, and adapter registration |
| [`@voyant-travel/db`](./packages/db/README.md) | Drizzle schemas, TypeID, and database adapters |
| [`@voyant-travel/hono`](./packages/hono/README.md) | `createApp`, middleware, auth, and actor guards |
| [`@voyant-travel/react`](./packages/react) | Shared React provider and typed fetch client |
| [`@voyant-travel/auth`](./packages/auth/README.md) | Better Auth wiring for first-party starters |
| [`@voyant-travel/auth-react`](./packages/auth-react/README.md) | Auth React hooks and components |
| [`@voyant-travel/types`](./packages/types/README.md) | Shared workspace types |
| [`@voyant-travel/utils`](./packages/utils/README.md) | Shared utility functions |
| [`@voyant-travel/voyant-test-utils`](./packages/test-utils/README.md) | Test helpers (db, http, seq, cli) |
| [`@voyant-travel/cli`](https://www.npmjs.com/package/@voyant-travel/cli) | The `voyant` CLI: scaffolding, generators, and db tooling |
| [`@voyant-travel/storage`](./packages/storage/README.md) | `StorageProvider` abstraction (local, R2, S3) |
| [`@voyant-travel/i18n`](./packages/i18n) | Internationalization primitives |

### Travel domain modules

| Package | Description |
| --- | --- |
| [`@voyant-travel/catalog`](./packages/catalog/README.md) | Products, tours, packages, and media |
| [`@voyant-travel/commerce`](./packages/commerce/README.md) | Pricing, offers, and sellability |
| [`@voyant-travel/inventory`](./packages/inventory) | Bookable inventory and availability |
| [`@voyant-travel/operations`](./packages/operations) | Suppliers and operational logistics |
| [`@voyant-travel/bookings`](./packages/bookings/README.md) | Booking lifecycle and participants |
| [`@voyant-travel/finance`](./packages/finance/README.md) | Invoicing, payments, tax, and profitability |
| [`@voyant-travel/legal`](./packages/legal/README.md) | Contracts and policies |
| [`@voyant-travel/notifications`](./packages/notifications/README.md) | Email/SMS provider abstraction |
| [`@voyant-travel/distribution`](./packages/distribution/README.md) | Channel distribution |
| [`@voyant-travel/relationships`](./packages/relationships/README.md) | CRM: people, organizations, and pipelines |
| [`@voyant-travel/proposals`](./packages/proposals/README.md) | Proposals and trip revisions |
| [`@voyant-travel/trips`](./packages/trips) | Trip composition and itineraries |
| [`@voyant-travel/identity`](./packages/identity/README.md) | Contact points, addresses, and named contacts |
| [`@voyant-travel/storefront`](./packages/storefront) | Public booking-portal surface |
| [`@voyant-travel/accommodations`](./packages/accommodations) | Accommodation resale inventory |
| [`@voyant-travel/charters`](./packages/charters/README.md) | Charter products |
| [`@voyant-travel/cruises`](./packages/cruises/README.md) | Cruise products |
| [`@voyant-travel/flights`](./packages/flights) | Flight products |

### Background execution

Selected modules contribute the subscribers and jobs required for their
product behavior. Jobs are enabled by the standard managed and self-hosted
runtime and recover from domain-owned durable state. Customer-specific
automation consumes Voyant events and invokes authenticated domain APIs from
an external automation system.

### UI and React families

Reusable frontend surfaces live in the matching `-react` package for each
domain module. Those packages own hooks, clients, providers, query keys,
view-model helpers, reusable components, and `./ui` owner paths where needed.
For example, [`@voyant-travel/relationships-react`](./packages/relationships-react/README.md),
[`@voyant-travel/proposals-react`](./packages/proposals-react/README.md),
[`@voyant-travel/inventory-react`](./packages/inventory-react),
[`@voyant-travel/commerce-react`](./packages/commerce-react), and
[`@voyant-travel/bookings-react`](./packages/bookings-react). Bookings requirements
live under `@voyant-travel/bookings-react/requirements`; checkout UI lives under
`@voyant-travel/finance-react/checkout-ui`. The shared admin shell lives in
[`@voyant-travel/admin`](./packages/admin/README.md); cross-cutting primitives in
[`packages/ui`](./packages/ui/README.md).

### Adapters and integrations

Vendor integrations are **adapters**, not plugins — "plugin" is retired as a
classification. See
[the taxonomy](./docs/architecture/module-provider-plugin-taxonomy.md).

| Package | Description |
| --- | --- |
| [`@voyant-travel/payments`](./packages/payments) | The payment adapter contract: initiate/status/verify, provider catalog, and remote transport |
| [`@voyant-travel/voyant-connect-adapter`](./packages/voyant-connect-adapter) | Voyant Connect supplier connectivity |
| [`plugin-netopia`](https://github.com/voyant-travel/plugin-netopia) | Netopia payments (separate repository) |
| [`plugin-payload`](https://github.com/voyant-travel/plugin-payload) | Payload CMS sync (separate repository) |

## Architecture

Voyant keeps a strict boundary between reusable business logic and deployment shells:

- `packages/*` hold reusable business logic, schemas, services, routes, adapters, and contracts
- `apps/*` own UI, auth wiring, deployment shape, and runtime-specific configuration
- Core packages stay framework-agnostic even when the generated application uses React, TanStack Start, Hono, Better Auth, and Drizzle
- Transport adapters stay thin and call shared domain services rather than owning business logic
- Package manifests contribute required subscribers and jobs; deployment hosts provide their runtime infrastructure
- Modules are components of one deployable, not independently shipped services ([ADR-0016](./docs/adr/0016-modules-as-components-of-one-deployable.md))

Architecture decisions live in [`docs/adr/`](./docs/adr/); domain conventions
live in [`docs/architecture/`](./docs/architecture/); per-minor migration notes
live in [`docs/migrations/`](./docs/migrations/README.md). Start with
[the unified deployment graph](./docs/architecture/unified-deployment-graph.md),
which is what resolves modules into the shipped Operator.

### Security model

**One Postgres database + one runtime per organization.** Tenancy is enforced
at the deployment boundary, not by in-process middleware, so new package work
under `packages/*` should not add in-process tenant scoping. See
[ADR-0001](./docs/adr/0001-tenant-scoping.md) for the full rationale, the
alternatives considered, and the conditions under which the decision should be
revisited.

## Contributing

This repository is the workspace that powers the framework, the Operator
integration application, generated project packaging, runners, and examples.

| Area | What it contains |
| --- | --- |
| [`packages/*`](./packages) | Reusable business logic, schemas, services, transport adapters, and integrations |
| [`packages/*-contracts`](./packages) | Published contract packages consumed outside this repository |
| [`apps/operator`](./apps/operator/README.md) | Checked-in Operator integration and deployable application |
| [`apps/*`](./apps) | Applications, reference/demo APIs, and the shadcn registry host |
| [`examples/operator-demo`](./examples/operator-demo/README.md) | Destructive and generated Operator demo fixtures |

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
| `pnpm -F operator dev` | Start the Operator application on port `3300` |

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

- [Documentation](https://voyant.travel/docs): guides, references, and concepts
- [GitHub Issues](https://github.com/voyant-travel/voyant/issues): bugs and feature requests
- [@voyant_travel](https://x.com/voyant_travel): news and updates

## Credits

Voyant is created and maintained by [PixelMakers](https://pixelmakers.com).

## License

Licensed under the [Apache License, Version 2.0](./LICENSE) (`Apache-2.0`).

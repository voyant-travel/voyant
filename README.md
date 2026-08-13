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
  Voyant is a complete travel commerce platform — catalog, pricing, inventory,
  bookings, finance, CRM, proposals, and distribution in one deployable back
  office called the <strong>Operator</strong>. Self-host it, or let Voyant Cloud
  run it for you.
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

Voyant is the back office an OTA, tour operator, or DMC actually runs on. It is
not a toolkit you assemble into a product — it is the product, and it is open
source. The same platform runs both ways: the whole thing is Apache-2.0 and
published as a container image you can self-host, and Voyant Cloud is the
managed version of it. Nothing is held back from the open edition to make the
managed one worth paying for.

What it covers:

- **Catalog and products** — tours, packages, charters, cruises, flights, and
  accommodation held as resellable inventory.
- **Pricing and sellability** — offers, occupancy pricing, promotions, travel
  credits, and channel-aware rules.
- **Inventory and availability** — allotments, departures, and the operational
  logistics behind them.
- **Bookings** — the full lifecycle, participants, requirements, and
  itinerary composition.
- **Finance** — invoicing, payments, supplier costs, tax, FX, and profitability.
- **CRM and proposals** — people, organizations, pipelines, and versioned
  proposals that carry a trip from sales pursuit to confirmed booking.
- **Distribution and storefronts** — channel distribution plus a public booking
  surface for customers.

Underneath, it runs on Postgres with a normalized travel operations data model,
serves a Hono API, and boots as a resident Node process. Domain modules
contribute their own subscribers, jobs, and React surfaces, so the platform can
be extended without forking it.

Voyant supports accommodation as catalog inventory for resale, packaging, and
trip composition. It is not a hotel PMS or a hotel-operations system. See
[`docs/architecture/accommodation-resale-boundary.md`](./docs/architecture/accommodation-resale-boundary.md).

## The Operator

The Operator is the product — there is one, and this is it. It runs as a
resident Node process (TanStack Start + React 19, Hono, Better Auth, Drizzle on
Postgres), assembled from the modules below through the resolved deployment
graph and booted by [`@voyant-travel/runtime`](./packages/runtime).

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

The platform is built from the modules below. They are internal components of
one deployable rather than a menu of separately installable libraries — see
[ADR-0016](./docs/adr/0016-modules-as-components-of-one-deployable.md).

**Fourteen of them are published to npm**: the `*-contracts` tier plus
`@voyant-travel/ui`, `@voyant-travel/payments`, `@voyant-travel/schema-kit`,
`@voyant-travel/app-manifest`, and `@voyant-travel/admin-extension-sdk`. Those
are the integration points for code outside this repository.
[`@voyant-travel/cli`](https://www.npmjs.com/package/@voyant-travel/cli) is
published from its own repository. Everything else is private, so the tables
below map this repository, not the npm registry; see
[`docs/frontend-package-strategy.md`](./docs/frontend-package-strategy.md) for
what may be published and why.

### Core platform

| Package | Description |
| --- | --- |
| [`@voyant-travel/core`](./packages/core/README.md) | Module system, container, event bus, and adapter registration |
| [`@voyant-travel/db`](./packages/db/README.md) | Drizzle schemas, TypeID, and database adapters |
| [`@voyant-travel/hono`](./packages/hono/README.md) | `createApp`, middleware, auth, and actor guards |
| [`@voyant-travel/react`](./packages/react) | Shared React provider and typed fetch client |
| [`@voyant-travel/auth`](./packages/auth/README.md) | Better Auth wiring for the Operator application |
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

## Extending the platform

"Plugin" is retired as a classification ([RFC #3395](./docs/architecture/module-provider-plugin-taxonomy.md)),
and no package in this repository declares that kind — `verify:deprecated-graph-kinds`
denies it. Modules are components of the one deployable and are not selectable.
Substitution happens at two seams instead.

### Adapters and providers

Adapters and providers swap a vendor or infrastructure implementation *inside*
the deployment. They are ordinary graph units selected through the resolved
deployment graph — object storage, KV, rate limiting, and search all resolve
this way, as does [`@voyant-travel/storage`](./packages/storage/README.md).

| Package | Description |
| --- | --- |
| [`@voyant-travel/payments`](./packages/payments) | The payment adapter contract — initiate/status/verify, provider catalog, and remote transport. Netopia and Voyant Pay are catalog providers |
| [`@voyant-travel/voyant-connect-adapter`](./packages/voyant-connect-adapter) | Voyant Connect supplier connectivity, on top of the external `@voyant-travel/connect-sdk` |

### Apps

An **app** is a separately deployed service activated for a deployment through
OAuth. App code never executes inside the Operator process and never
contributes migrations, routes, providers, or any other executable server code.
Apps integrate through scoped APIs, events, durable webhook subscriptions,
app-owned namespaced custom fields, and sandboxed admin extensions.

The deployment-local runtime for this — registration, immutable declarative
releases, consent, installation, grants, pause/revoke/uninstall — lives in
[`@voyant-travel/apps`](./packages/apps). Accounting and CRM integrations such
as SmartBill are apps. See
[the Remote App Platform RFC](./docs/architecture/remote-app-platform-rfc.md).

## Architecture

Voyant keeps a strict boundary between reusable business logic and deployment shells:

- `packages/*` hold reusable business logic, schemas, services, routes, adapters, and contracts
- `apps/*` own UI, auth wiring, deployment shape, and runtime-specific configuration
- Domain packages stay transport- and UI-agnostic even though the Operator uses React, TanStack Start, Hono, Better Auth, and Drizzle
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

This repository is the whole platform: the domain modules, the Operator
application, generated project packaging, runners, and examples.

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

# @voyant-travel/commerce

## 0.11.1

### Patch Changes

- 733bf33: Stop a bookable departure from rendering "price on request" when an option has a stray empty default rate plan (#1601).

  - **commerce** — `createOptionPriceRule`/`updateOptionPriceRule` now enforce a single active default rate plan per `(option, price catalog)`. Writing or promoting a default plan demotes any sibling default in the same scope inside a transaction, so a save path can no longer fan out several active `is_default` rows where only the newest carries prices.
  - **storefront** — the public departures pricing reader now prefers a rate plan that actually carries a price (positive base amount or a priced active unit rule) before falling back to the `is_default` flag, so a stray empty default can't mask the real priced plan and force a "price on request".

## 0.11.0

### Patch Changes

- Updated dependencies [7779772]
  - @voyant-travel/catalog@0.127.0
  - @voyant-travel/distribution@0.119.0
  - @voyant-travel/quotes@0.122.5
  - @voyant-travel/bookings@0.129.0
  - @voyant-travel/finance@0.129.0
  - @voyant-travel/legal@0.129.0

## 0.10.0

### Patch Changes

- @voyant-travel/bookings@0.128.0
- @voyant-travel/catalog@0.126.0
- @voyant-travel/distribution@0.118.0
- @voyant-travel/finance@0.128.0
- @voyant-travel/legal@0.128.0
- @voyant-travel/quotes@0.122.4

## 0.9.0

### Patch Changes

- Updated dependencies [435a5d1]
  - @voyant-travel/bookings@0.127.0
  - @voyant-travel/distribution@0.117.0
  - @voyant-travel/finance@0.127.0
  - @voyant-travel/legal@0.127.0
  - @voyant-travel/catalog@0.125.0
  - @voyant-travel/quotes@0.122.3

## 0.8.1

### Patch Changes

- 1841ce2: D.2 slice 1 (batch 2) — 14 more packages own + ship their migration history (db, relationships, quotes, identity, distribution, inventory, commerce, catalog, finance, notifications, legal, storefront, charters, cruises). Each baseline reproduces the framework bundle's tables column-for-column, and all package sources now apply together (fresh-D.2 union) without collision.

  Shared enums: the codebase inlines copies of some enums to avoid cross-package schema imports (e.g. `service_type` in distribution + inventory, `entity_type` in relationships + quotes). Per-package generation would emit duplicate `CREATE TYPE`, colliding on a fresh D.2 database. All package migrations now wrap `CREATE TYPE … AS ENUM(…)` in an idempotent `DO`-block guard (subset-safe; whichever source applies first creates the type, the rest no-op). The db package additionally owns the shared Postgres extensions (pg_trgm / unaccent) that downstream trigram indexes need on a fresh D.2 database (the retired bundle injected them; per-package sources did not). The batch-1 packages (operator-settings, action-ledger, workflow-runs, trips) get the same guard for uniformity. No runtime change. See `docs/architecture/migration-collector-d2.md`.

- Updated dependencies [1841ce2]
  - @voyant-travel/db@0.108.4
  - @voyant-travel/quotes@0.122.2
  - @voyant-travel/distribution@0.116.1
  - @voyant-travel/catalog@0.124.1
  - @voyant-travel/finance@0.126.1
  - @voyant-travel/legal@0.126.1
  - @voyant-travel/workflow-runs@0.111.2
  - @voyant-travel/workflows@0.111.2

## 0.8.0

### Patch Changes

- Updated dependencies [84b9d4b]
  - @voyant-travel/legal@0.126.0
  - @voyant-travel/bookings@0.126.0
  - @voyant-travel/catalog@0.124.0
  - @voyant-travel/distribution@0.116.0
  - @voyant-travel/finance@0.126.0
  - @voyant-travel/quotes@0.122.1

## 0.7.0

### Patch Changes

- Updated dependencies [a74471e]
  - @voyant-travel/quotes@0.122.0
  - @voyant-travel/db@0.108.3
  - @voyant-travel/products-contracts@0.105.6
  - @voyant-travel/bookings@0.125.0
  - @voyant-travel/catalog@0.123.0
  - @voyant-travel/distribution@0.115.0
  - @voyant-travel/finance@0.125.0
  - @voyant-travel/legal@0.125.0
  - @voyant-travel/workflow-runs@0.111.0
  - @voyant-travel/workflows@0.111.0
  - @voyant-travel/hono@0.112.2

## 0.6.0

### Patch Changes

- @voyant-travel/hono@0.112.1
- @voyant-travel/workflow-runs@0.110.0
- @voyant-travel/bookings@0.124.0
- @voyant-travel/catalog@0.122.0
- @voyant-travel/distribution@0.114.0
- @voyant-travel/finance@0.124.0
- @voyant-travel/legal@0.124.0
- @voyant-travel/workflows@0.110.0
- @voyant-travel/quotes@0.121.1

## 0.5.0

### Patch Changes

- Updated dependencies [04681f3]
- Updated dependencies [98f4a40]
- Updated dependencies [a3bd51c]
- Updated dependencies [e9d9dbb]
- Updated dependencies [d29dd47]
- Updated dependencies [3b27dcc]
- Updated dependencies [39d48fe]
- Updated dependencies [d222e9f]
  - @voyant-travel/bookings@0.123.0
  - @voyant-travel/core@0.110.0
  - @voyant-travel/hono@0.112.0
  - @voyant-travel/finance@0.123.0
  - @voyant-travel/quotes@0.121.0
  - @voyant-travel/distribution@0.113.0
  - @voyant-travel/legal@0.123.0
  - @voyant-travel/catalog@0.121.0
  - @voyant-travel/db@0.108.2
  - @voyant-travel/workflow-runs@0.109.4
  - @voyant-travel/workflows@0.109.4

## 0.4.0

### Patch Changes

- Updated dependencies [c9de9c4]
- Updated dependencies [14f4234]
- Updated dependencies [89d4ca9]
- Updated dependencies [85caeef]
- Updated dependencies [85a13d3]
- Updated dependencies [51dd276]
  - @voyant-travel/finance@0.122.0
  - @voyant-travel/legal@0.122.0
  - @voyant-travel/quotes@0.120.1
  - @voyant-travel/bookings@0.122.0
  - @voyant-travel/catalog@0.120.0
  - @voyant-travel/distribution@0.112.0

## 0.3.0

### Minor Changes

- 13fe70b: The commerce module now owns the catalog-checkout materialization/finalize logic: new `@voyant-travel/commerce/checkout` surface (`createCatalogCheckoutRoutes`, `startCatalogCheckout`, `materializeBookingFromSnapshot`, `dispatchCheckoutFinalize`, `rebuildBookingItemTaxLines`, etc.). Deployment specifics — tax settings, owned-product lookup, bank-transfer instructions, contract-pdf generator, and the card-payment provider start (`startCardPayment`) — are injected as options. `quotes` and `legal` are now optional peer dependencies (used only on the quote-version / contract checkout paths).

### Patch Changes

- Updated dependencies [11095db]
- Updated dependencies [13fe70b]
- Updated dependencies [13fe70b]
- Updated dependencies [9ea7220]
- Updated dependencies [503a634]
- Updated dependencies [a860e15]
  - @voyant-travel/catalog@0.119.0
  - @voyant-travel/finance@0.121.0
  - @voyant-travel/hono@0.111.0
  - @voyant-travel/legal@0.121.0
  - @voyant-travel/quotes@0.120.0
  - @voyant-travel/bookings@0.121.0
  - @voyant-travel/distribution@0.111.0
  - @voyant-travel/workflow-runs@0.109.2
  - @voyant-travel/workflows@0.109.2

## 0.2.3

### Patch Changes

- 756213e: Add public cache policy headers for cacheable public read routes and expose public response cache configuration typing.
- Updated dependencies [756213e]
  - @voyant-travel/hono@0.110.3

## 0.2.2

### Patch Changes

- @voyant-travel/hono@0.110.2
- @voyant-travel/workflows@0.109.0
- @voyant-travel/distribution@0.110.2

## 0.2.1

### Patch Changes

- 0c003f3: Make workflows node-only and remove the stale Cloudflare edge/Node step split.

  Workflow runtime annotations now accept only `runtime: "node"`, legacy
  `runtime: "edge"` is rejected, and the old split-runner wiring has been removed.
  The legacy Cloudflare workflow adapter packages, Worker reference apps, and
  standalone external step-server artifact have been removed. Managed Cloud apps
  should forward workflow calls to the hosted Node runtime, and self-hosted
  deployments should use the Node/Postgres runtime package.

- Updated dependencies [0c003f3]
  - @voyant-travel/workflows@0.108.0
  - @voyant-travel/db@0.108.1
  - @voyant-travel/hono@0.110.1
  - @voyant-travel/distribution@0.110.1

## 0.2.0

### Minor Changes

- e388bc9: Introduce the Commerce commercial decision Interface with adapter-registered
  price-availability evaluation and explicit snapshot recording.
- 6bff46f: Add Commerce runtime wiring for the pricing, markets, sellability, and
  promotions cluster. Templates can now declare one Commerce runtime entry while
  preserving the existing package route prefixes during the v1 migration.

  Allow manifest module factories in `@voyant-travel/hono/composition` to expand to
  multiple Hono modules. Remove the Promotions package's direct Storefront
  dependency by keeping the storefront offer resolver structurally typed.

- a4e0909: Move Markets, Pricing, Promotions, and Sellability runtime source behind the
  Commerce owner path. The old package names are removed from the v1 workspace
  surface, and schema/template manifests now point at Commerce directly.

### Patch Changes

- eb17d3d: Add owner-path schema manifest metadata for Commerce and Operations, expose the
  Distribution counterparty interface, and refresh operator schema/link generated
  artifacts for the v1 package restructure.
- 063f2b5: Remove Sellability's legacy construct-offer route, service method, validation
  schemas, and public `service-construct-offer` export. Commerce now keeps
  sellability focused on commercial resolution and persisted decision snapshots;
  Quote, Trips, and Booking flows own downstream materialization.
- Updated dependencies [c9ec9f8]
- Updated dependencies [6bff46f]
- Updated dependencies [081e310]
- Updated dependencies [eb17d3d]
- Updated dependencies [3e160d3]
- Updated dependencies [47fef18]
  - @voyant-travel/catalog@0.118.0
  - @voyant-travel/hono@0.110.0
  - @voyant-travel/distribution@0.110.0
  - @voyant-travel/workflows@0.107.11

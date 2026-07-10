# @voyant-travel/inventory

## 0.8.0

### Minor Changes

- a370024: Publish package-owned deployment manifests for catalog, commerce, and inventory
  runtime, persistence, orchestration, and extension surfaces.
- a370024: Publish package-owned deployment declarations and configurable runtime factories for vertical
  content, brochure, booking-extension, base API, and scheduled workflow surfaces.
- e3dc5a9: Declare package-owned admin route and copy facets for vertical modules with existing public admin extensions.
- e3dc5a9: Declare package-owned Node deployment facets for product events, subscribers, workflows, access resources, tools, actions, and retain-data lifecycle behavior.

### Patch Changes

- Updated dependencies [a370024]
- Updated dependencies [a370024]
- Updated dependencies [e3dc5a9]
- Updated dependencies [e3dc5a9]
- Updated dependencies [e3dc5a9]
- Updated dependencies [e3dc5a9]
- Updated dependencies [a370024]
- Updated dependencies [e3dc5a9]
- Updated dependencies [e3dc5a9]
- Updated dependencies [e3dc5a9]
- Updated dependencies [a370024]
- Updated dependencies [a370024]
- Updated dependencies [a370024]
- Updated dependencies [e3dc5a9]
- Updated dependencies [a370024]
- Updated dependencies [a370024]
- Updated dependencies [e3dc5a9]
- Updated dependencies [e3dc5a9]
- Updated dependencies [e3dc5a9]
- Updated dependencies [e3dc5a9]
- Updated dependencies [e3dc5a9]
  - @voyant-travel/core@0.114.0
  - @voyant-travel/catalog@0.149.0
  - @voyant-travel/commerce@0.33.0
  - @voyant-travel/action-ledger@0.106.0
  - @voyant-travel/db@0.111.0
  - @voyant-travel/operations@0.6.0
  - @voyant-travel/storage@0.107.0
  - @voyant-travel/hono@0.122.4
  - @voyant-travel/types@0.107.2
  - @voyant-travel/workflows@0.112.0

## 0.7.11

### Patch Changes

- Updated dependencies [496f2ef]
  - @voyant-travel/core@0.113.0
  - @voyant-travel/commerce@0.32.0
  - @voyant-travel/action-ledger@0.105.15
  - @voyant-travel/catalog@0.148.0
  - @voyant-travel/db@0.110.2
  - @voyant-travel/hono@0.122.3
  - @voyant-travel/operations@0.5.23

## 0.7.10

### Patch Changes

- 5e1d221: Publish `voyant.package.v1` compatibility metadata from first-party
  schema-owning packages so deployment graph package admission can validate their
  framework, target, and deployment-mode compatibility before runtime imports.
- Updated dependencies [5e1d221]
- Updated dependencies [682d7d0]
  - @voyant-travel/action-ledger@0.105.14
  - @voyant-travel/catalog@0.147.1
  - @voyant-travel/commerce@0.31.1
  - @voyant-travel/db@0.110.1
  - @voyant-travel/operations@0.5.22
  - @voyant-travel/hono@0.122.2

## 0.7.9

### Patch Changes

- @voyant-travel/catalog@0.147.0
- @voyant-travel/commerce@0.31.0
- @voyant-travel/operations@0.5.21

## 0.7.8

### Patch Changes

- @voyant-travel/catalog@0.146.0
- @voyant-travel/commerce@0.30.0
- @voyant-travel/operations@0.5.20

## 0.7.7

### Patch Changes

- @voyant-travel/catalog@0.145.0
- @voyant-travel/commerce@0.29.0
- @voyant-travel/operations@0.5.19

## 0.7.6

### Patch Changes

- @voyant-travel/catalog@0.144.0
- @voyant-travel/commerce@0.28.0
- @voyant-travel/operations@0.5.18

## 0.7.5

### Patch Changes

- Updated dependencies [4829ef3]
  - @voyant-travel/catalog@0.143.0
  - @voyant-travel/commerce@0.27.0
  - @voyant-travel/operations@0.5.17
  - @voyant-travel/products-contracts@0.106.1

## 0.7.4

### Patch Changes

- @voyant-travel/commerce@0.26.0
- @voyant-travel/catalog@0.142.0
- @voyant-travel/operations@0.5.16

## 0.7.3

### Patch Changes

- 425f92e: Add Node-native cache and shared-state providers behind the existing KVStore
  surface, including in-process LRU, tiered Redis/Postgres providers, Postgres
  fixed-window rate limiting, Redis rate limiting, and managed-runtime provider
  selection without KV-shaped binding requirements.
- Updated dependencies [425f92e]
  - @voyant-travel/utils@0.106.0
  - @voyant-travel/db@0.110.0
  - @voyant-travel/hono@0.122.0
  - @voyant-travel/core@0.112.3
  - @voyant-travel/action-ledger@0.105.13
  - @voyant-travel/catalog@0.141.0
  - @voyant-travel/commerce@0.25.0
  - @voyant-travel/operations@0.5.15
  - @voyant-travel/types@0.107.1

## 0.7.2

### Patch Changes

- Updated dependencies [05c10f2]
  - @voyant-travel/commerce@0.24.0
  - @voyant-travel/catalog@0.140.0
  - @voyant-travel/operations@0.5.14

## 0.7.1

### Patch Changes

- Updated dependencies [6711f4c]
  - @voyant-travel/catalog@0.139.0
  - @voyant-travel/commerce@0.23.0
  - @voyant-travel/operations@0.5.13

## 0.7.0

### Minor Changes

- 8405bee: Fold the product's default itinerary into the catalog product read-model document.

  `getCatalogProductById` (and the `/v1/public/products/:id` + `/slug/:slug`
  read-through documents) can now include the product's default day-by-day
  itinerary — days and day-services with `product_day_translations` /
  `product_day_service_translations` resolved by the document's locale, plus a
  per-day thumbnail. It is opt-in via `?include=itinerary`, encoded in the
  read-model variant so itinerary and non-itinerary documents cache — and warm on
  mutation — independently. Only the product default itinerary is folded;
  departure-specific overrides stay on the departure itinerary endpoint.

  The itinerary update/delete/duplicate admin routes (keyed on the itinerary id,
  not the product id) now trigger read-model recompute so the folded itinerary
  stays fresh.

### Patch Changes

- Updated dependencies [8405bee]
  - @voyant-travel/products-contracts@0.106.0
  - @voyant-travel/commerce@0.22.0
  - @voyant-travel/catalog@0.138.0
  - @voyant-travel/operations@0.5.12

## 0.6.1

### Patch Changes

- 4504abb: Export product read-model helpers and the public product read service, and add a write-time warm path for product read-model recomputation after inventory mutations.

## 0.6.0

### Minor Changes

- 77f139b: Add read-only agent tools for the products domain at
  `@voyant-travel/inventory/tools`: `list_products` and `get_product`, exposed as
  headless `defineTool`s over the existing products service (`products:read` scope,
  read tier). The operator registers them on the in-deployment MCP server alongside
  the trips tools — establishing the module-owned-tools pattern for the remaining
  domains.

### Patch Changes

- Updated dependencies [c9a356f]
- Updated dependencies [689a289]
- Updated dependencies [6474f42]
- Updated dependencies [5786f63]
- Updated dependencies [0c75844]
- Updated dependencies [1655995]
- Updated dependencies [22f0457]
  - @voyant-travel/types@0.107.0
  - @voyant-travel/core@0.112.0
  - @voyant-travel/hono@0.121.0
  - @voyant-travel/catalog@0.137.0
  - @voyant-travel/commerce@0.21.0
  - @voyant-travel/tools@0.1.0
  - @voyant-travel/operations@0.5.10
  - @voyant-travel/utils@0.105.6
  - @voyant-travel/action-ledger@0.105.12
  - @voyant-travel/db@0.109.5

## 0.5.18

### Patch Changes

- ae115de: Use owned product option-unit pax pricing tiers when booking journey quotes include explicit unit selections.

## 0.5.17

### Patch Changes

- Updated dependencies [1cb9cba]
- Updated dependencies [131ff9b]
- Updated dependencies [f1090b7]
- Updated dependencies [42f662c]
- Updated dependencies [fead555]
  - @voyant-travel/hono@0.120.0
  - @voyant-travel/operations@0.5.9
  - @voyant-travel/action-ledger@0.105.11
  - @voyant-travel/catalog@0.136.3
  - @voyant-travel/commerce@0.20.5

## 0.5.16

### Patch Changes

- Updated dependencies [86fbb05]
  - @voyant-travel/hono@0.119.0
  - @voyant-travel/action-ledger@0.105.10
  - @voyant-travel/catalog@0.136.2
  - @voyant-travel/commerce@0.20.4
  - @voyant-travel/operations@0.5.8

## 0.5.15

### Patch Changes

- 2d3b039: Offer bank transfer and inquiry on owned-product storefront checkout.

  The owned-product booking draft shape hardcoded `paymentIntents: ["hold",
"card"]`, so the storefront Payment step collapsed to card-only for owned
  products even though the deployment advertised bank transfer and inquiry
  (sourced products already offered all three). Both product draft shapes now
  declare the full engine allow list via a shared `DEFAULT_PAYMENT_INTENTS`
  constant, and deployment/surface `PaymentProviderCapabilities` narrow it at
  render time — so owned and sourced products offer the same payment paths. The
  `/checkout/start` flow already handled bank transfer and inquiry generically on
  the booking row, so no server change was needed.

- Updated dependencies [dd03968]
- Updated dependencies [2d3b039]
- Updated dependencies [bcd76ae]
  - @voyant-travel/operations@0.5.7
  - @voyant-travel/catalog@0.136.1
  - @voyant-travel/commerce@0.20.3

## 0.5.14

### Patch Changes

- 9ebd8e8: Owned product booking commit now resolves (or creates) a CRM person from the
  billing contact when the commit carries no `personId`/`organizationId` — the
  anonymous storefront checkout case. `createProductsBookingHandler` accepts a new
  optional `resolveBillingPerson` bridge (wired by the template to
  `relationshipsService.upsertPersonFromContact`), mirroring the sourced/session
  arm's `resolveBillingPerson` hook. This fixes anonymous storefront checkout for
  owned public products, which previously failed with a 400 "Select a billing
  person or organization".

## 0.5.13

### Patch Changes

- @voyant-travel/commerce@0.20.0
- @voyant-travel/catalog@0.136.0
- @voyant-travel/operations@0.5.6

## 0.5.12

### Patch Changes

- c5cd9cd: Return structured 409 conflicts for duplicate inventory taxonomy and product translation creates.
- Updated dependencies [fd17317]
  - @voyant-travel/hono@0.118.3

## 0.5.11

### Patch Changes

- 5c1294f: Reject inverted inventory product dates, option availability dates, option-unit quantity bounds, and duplicate itinerary day numbers.
- Updated dependencies [5c1294f]
  - @voyant-travel/products-contracts@0.105.17

## 0.5.10

### Patch Changes

- a10b9ba: Return deterministic 503 responses when product brochure generation cannot upload to configured storage or resolve a brochure URL.
- e005c4d: Reject inverted product option-unit age ranges and commerce pricing ranges across schemas and service mutations.
- ad02eae: Reject non-image product media as cover media and surface brochure generation failures in the product detail UI.
- Updated dependencies [ed5463f]
- Updated dependencies [e005c4d]
  - @voyant-travel/operations@0.5.5
  - @voyant-travel/products-contracts@0.105.16
  - @voyant-travel/commerce@0.19.4

## 0.5.9

### Patch Changes

- 61410dd: Preserve catalog sourced-entry provenance when packaged detail pages start the booking journey.
- Updated dependencies [61410dd]
  - @voyant-travel/catalog@0.135.3

## 0.5.8

### Patch Changes

- 98e270c: Add a public-audience listability predicate to the product document builder so deployments can tombstone non-listable customer catalog documents.
- Updated dependencies [d2351e0]
  - @voyant-travel/catalog@0.135.2

## 0.5.7

### Patch Changes

- fcb8b88: Add catalog-authoring validation for transfer pickup/dropoff rules, block static availability for dynamic products, and require scheduled products to have a future open departure before publishing.
- Updated dependencies [fcb8b88]
  - @voyant-travel/operations@0.5.4

## 0.5.6

### Patch Changes

- Updated dependencies [9a1197b]
  - @voyant-travel/storage@0.106.0
  - @voyant-travel/hono@0.118.0
  - @voyant-travel/action-ledger@0.105.9
  - @voyant-travel/catalog@0.135.1
  - @voyant-travel/commerce@0.19.1
  - @voyant-travel/operations@0.5.3

## 0.5.5

### Patch Changes

- Updated dependencies [7c5ee80]
  - @voyant-travel/hono@0.117.0
  - @voyant-travel/commerce@0.19.0
  - @voyant-travel/action-ledger@0.105.8
  - @voyant-travel/catalog@0.135.0
  - @voyant-travel/operations@0.5.2

## 0.5.4

### Patch Changes

- 12a1eb2: Expose client-safe subpaths for validation schemas, linkable metadata, template authoring metadata, finance payment-policy primitives, and Hono reporter utilities. Move browser-facing React/operator imports off mixed runtime barrels so client bundles do not pull Hono request context or other server-only runtime code.
- Updated dependencies [12a1eb2]
  - @voyant-travel/commerce@0.18.1
  - @voyant-travel/hono@0.116.2
  - @voyant-travel/operations@0.5.1

## 0.5.3

### Patch Changes

- Updated dependencies [787c852]
- Updated dependencies [293e5e4]
  - @voyant-travel/operations@0.5.0
  - @voyant-travel/hono@0.116.1
  - @voyant-travel/db@0.109.2
  - @voyant-travel/products-contracts@0.105.12
  - @voyant-travel/catalog@0.134.0
  - @voyant-travel/commerce@0.18.0

## 0.5.2

### Patch Changes

- Updated dependencies [924d201]
- Updated dependencies [f311826]
  - @voyant-travel/operations@0.4.0
  - @voyant-travel/db@0.109.1
  - @voyant-travel/products-contracts@0.105.11
  - @voyant-travel/catalog@0.133.0
  - @voyant-travel/commerce@0.17.0

## 0.5.1

### Patch Changes

- Updated dependencies [684b321]
- Updated dependencies [2542715]
  - @voyant-travel/hono@0.116.0
  - @voyant-travel/action-ledger@0.105.7
  - @voyant-travel/catalog@0.132.1
  - @voyant-travel/commerce@0.16.1
  - @voyant-travel/operations@0.3.1

## 0.5.0

### Minor Changes

- 51f7dea: Share one list-response contract instead of per-module copies (voyant#2109).

  `@voyant-travel/types` now owns the canonical offset-paginated list envelope: the `ListResponse<T>` type + `listResponse(data, { total, limit, offset })` builder, plus the zod `paginationSchema` (coerced `limit` 1–200 default 50, `offset` ≥0 default 0) and the `listResponseSchema(item)` factory. Both server services and `*-react` clients import from this single source.

  Server side: every module's local `paginate()` / inline `{ data, total, limit, offset }` construction now routes through the shared `listResponse` builder, and the count read is standardized on `count` internally — fixing the drift where finance, notifications and the legal contracts/policies services read `countResult[0]?.total` while every other module read `countResult[0]?.count` (their `count(*)` selects were aliased `total`; they are now aliased `count`). The returned shape is byte-for-byte identical.

  Client side: the ~23 copied `paginatedEnvelope` zod schemas across the `*-react` packages are replaced by re-exporting the shared `listResponseSchema` factory under the same `paginatedEnvelope` name, so consumers are unchanged.

  Input alignment: `finance-contracts` and `legal-contracts` pagination `limit` caps were raised from `.max(100)` to `.max(200)` to match the framework-wide max.

  Additive and non-breaking.

### Patch Changes

- Updated dependencies [04b257c]
- Updated dependencies [78c15fa]
- Updated dependencies [51f7dea]
  - @voyant-travel/hono@0.115.0
  - @voyant-travel/types@0.106.0
  - @voyant-travel/commerce@0.16.0
  - @voyant-travel/operations@0.3.0
  - @voyant-travel/action-ledger@0.105.6
  - @voyant-travel/catalog@0.132.0
  - @voyant-travel/utils@0.105.4

## 0.4.7

### Patch Changes

- Updated dependencies [4abf9a2]
  - @voyant-travel/hono@0.114.0
  - @voyant-travel/db@0.109.0
  - @voyant-travel/utils@0.105.3
  - @voyant-travel/action-ledger@0.105.5
  - @voyant-travel/catalog@0.131.0
  - @voyant-travel/commerce@0.15.0
  - @voyant-travel/operations@0.2.8
  - @voyant-travel/products-contracts@0.105.10

## 0.4.6

### Patch Changes

- Updated dependencies [6a0edd2]
  - @voyant-travel/catalog@0.130.0
  - @voyant-travel/products-contracts@0.105.9
  - @voyant-travel/commerce@0.14.0
  - @voyant-travel/operations@0.2.7

## 0.4.5

### Patch Changes

- Updated dependencies [021ec00]
  - @voyant-travel/hono@0.113.0
  - @voyant-travel/core@0.111.0
  - @voyant-travel/action-ledger@0.105.4
  - @voyant-travel/catalog@0.129.1
  - @voyant-travel/commerce@0.13.1
  - @voyant-travel/operations@0.2.6
  - @voyant-travel/db@0.108.5

## 0.4.4

### Patch Changes

- fcd2e0b: Add itinerary and day-service translation authoring surfaces, and localize owned itinerary content projection for translated days and service labels.
- Updated dependencies [fcd2e0b]
  - @voyant-travel/products-contracts@0.105.8

## 0.4.3

### Patch Changes

- @voyant-travel/catalog@0.129.0
- @voyant-travel/commerce@0.13.0
- @voyant-travel/operations@0.2.4

## 0.4.2

### Patch Changes

- @voyant-travel/catalog@0.128.0
- @voyant-travel/commerce@0.12.0
- @voyant-travel/operations@0.2.3

## 0.4.1

### Patch Changes

- Updated dependencies [7779772]
  - @voyant-travel/catalog@0.127.0
  - @voyant-travel/commerce@0.11.0
  - @voyant-travel/operations@0.2.2

## 0.4.0

### Minor Changes

- 9c47b00: Add a themed product brochure HTML renderer and printer decorator. Brochure
  template context now includes product media and pax pricing tiers so custom
  brochure layouts can render covers, galleries, and pricing tables without
  extra app-local queries, while still replacing the section set for fully custom
  brochure designs. The themed printer requires an HTML-capable browser printer
  and guards against accidental composition with the built-in basic PDF printer.

### Patch Changes

- @voyant-travel/catalog@0.126.0
- @voyant-travel/commerce@0.10.0
- @voyant-travel/operations@0.2.1

## 0.3.9

### Patch Changes

- Updated dependencies [435a5d1]
  - @voyant-travel/operations@0.2.0
  - @voyant-travel/commerce@0.9.0
  - @voyant-travel/catalog@0.125.0

## 0.3.8

### Patch Changes

- fc678e9: Align public product slug lookups with catalog search locale fallback so exact fallback slugs resolve product details.

## 0.3.7

### Patch Changes

- 1841ce2: D.2 slice 1 (batch 2) — 14 more packages own + ship their migration history (db, relationships, quotes, identity, distribution, inventory, commerce, catalog, finance, notifications, legal, storefront, charters, cruises). Each baseline reproduces the framework bundle's tables column-for-column, and all package sources now apply together (fresh-D.2 union) without collision.

  Shared enums: the codebase inlines copies of some enums to avoid cross-package schema imports (e.g. `service_type` in distribution + inventory, `entity_type` in relationships + quotes). Per-package generation would emit duplicate `CREATE TYPE`, colliding on a fresh D.2 database. All package migrations now wrap `CREATE TYPE … AS ENUM(…)` in an idempotent `DO`-block guard (subset-safe; whichever source applies first creates the type, the rest no-op). The db package additionally owns the shared Postgres extensions (pg_trgm / unaccent) that downstream trigram indexes need on a fresh D.2 database (the retired bundle injected them; per-package sources did not). The batch-1 packages (operator-settings, action-ledger, workflow-runs, trips) get the same guard for uniformity. No runtime change. See `docs/architecture/migration-collector-d2.md`.

- Updated dependencies [1841ce2]
- Updated dependencies [4893352]
  - @voyant-travel/db@0.108.4
  - @voyant-travel/commerce@0.8.1
  - @voyant-travel/catalog@0.124.1
  - @voyant-travel/action-ledger@0.105.3
  - @voyant-travel/operations@0.1.7

## 0.3.6

### Patch Changes

- @voyant-travel/commerce@0.8.0
- @voyant-travel/catalog@0.124.0
- @voyant-travel/operations@0.1.6

## 0.3.5

### Patch Changes

- @voyant-travel/db@0.108.3
- @voyant-travel/products-contracts@0.105.6
- @voyant-travel/commerce@0.7.0
- @voyant-travel/catalog@0.123.0
- @voyant-travel/operations@0.1.5
- @voyant-travel/hono@0.112.2

## 0.3.4

### Patch Changes

- @voyant-travel/hono@0.112.1
- @voyant-travel/catalog@0.122.0
- @voyant-travel/commerce@0.6.0
- @voyant-travel/operations@0.1.4

## 0.3.3

### Patch Changes

- Updated dependencies [98f4a40]
- Updated dependencies [a3bd51c]
- Updated dependencies [3b27dcc]
- Updated dependencies [39d48fe]
- Updated dependencies [d222e9f]
  - @voyant-travel/core@0.110.0
  - @voyant-travel/hono@0.112.0
  - @voyant-travel/commerce@0.5.0
  - @voyant-travel/action-ledger@0.105.1
  - @voyant-travel/catalog@0.121.0
  - @voyant-travel/db@0.108.2
  - @voyant-travel/operations@0.1.3

## 0.3.2

### Patch Changes

- a9dcf89: Fix catalog browse defaults so product projections expose supply models for scheduled/dynamic locks and embedded catalog admins resolve locale from the loaded operator market.
  - @voyant-travel/catalog@0.120.1

## 0.3.1

### Patch Changes

- @voyant-travel/commerce@0.4.0
- @voyant-travel/catalog@0.120.0
- @voyant-travel/operations@0.1.2

## 0.3.0

### Minor Changes

- 13fe70b: The inventory module now owns the product brochure route: new `@voyant-travel/inventory/routes-brochure` export (`createProductBrochureRoutes(options)`) with the object storage provider injected as an option.

### Patch Changes

- Updated dependencies [13fe70b]
- Updated dependencies [11095db]
- Updated dependencies [13fe70b]
- Updated dependencies [13fe70b]
- Updated dependencies [9ea7220]
- Updated dependencies [13fe70b]
  - @voyant-travel/action-ledger@0.105.0
  - @voyant-travel/catalog@0.119.0
  - @voyant-travel/commerce@0.3.0
  - @voyant-travel/hono@0.111.0
  - @voyant-travel/storage@0.105.0
  - @voyant-travel/operations@0.1.1

## 0.2.0

### Minor Changes

- 3cc83b6: Move extras runtime and React source behind Inventory and Bookings owner
  subpaths. The old runtime and React extras package names are removed from v1;
  first-party imports use the Inventory and Bookings owner paths.
- 7ea516a: Move product graph compose/duplicate authoring behind
  `@voyant-travel/inventory/authoring`. `@voyant-travel/catalog-authoring` now delegates to
  the Inventory owner path during the v1 restructure.
- 65b3782: Add optional Inventory package entrypoints for operated product authoring and
  Inventory React authoring UI surfaces.
- a101971: Move the main operated Product route/service/schema/runtime and React
  authoring source under Inventory owner paths. The old Products runtime package
  names are removed from the v1 workspace surface, while the operator keeps
  stable `/products` API URLs backed by Inventory.

### Patch Changes

- 3408b2a: Move availability, allocation UI, resources, ground logistics, and places source
  under Operations owner paths. The old operated-execution package names are
  removed from the v1 workspace surface while first-party runtime, React, and
  operator imports use `@voyant-travel/operations` and `@voyant-travel/operations-react`
  surfaces.
- 47fef18: Retarget first-party imports from the removed beta package names to their owner
  packages. Operated product UI now imports Inventory React, commercial UI imports
  Commerce React, supplier UI imports Distribution React, checkout UI imports
  Finance React, and operated place/availability schema references import
  Operations owner paths.
- Updated dependencies [c9ec9f8]
- Updated dependencies [e388bc9]
- Updated dependencies [6bff46f]
- Updated dependencies [a4e0909]
- Updated dependencies [eb17d3d]
- Updated dependencies [3cc83b6]
- Updated dependencies [3408b2a]
- Updated dependencies [47fef18]
- Updated dependencies [063f2b5]
  - @voyant-travel/catalog@0.118.0
  - @voyant-travel/commerce@0.2.0
  - @voyant-travel/hono@0.110.0
  - @voyant-travel/operations@0.1.0
  - @voyant-travel/extras-contracts@0.104.2
  - @voyant-travel/action-ledger@0.104.11

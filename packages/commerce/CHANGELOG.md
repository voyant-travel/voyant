# @voyant-travel/commerce

## 0.31.1

### Patch Changes

- 5e1d221: Publish `voyant.package.v1` compatibility metadata from first-party
  schema-owning packages so deployment graph package admission can validate their
  framework, target, and deployment-mode compatibility before runtime imports.
- Updated dependencies [5e1d221]
- Updated dependencies [682d7d0]
  - @voyant-travel/bookings@0.149.1
  - @voyant-travel/catalog@0.147.1
  - @voyant-travel/db@0.110.1
  - @voyant-travel/distribution@0.139.1
  - @voyant-travel/finance@0.149.1
  - @voyant-travel/legal@0.149.1
  - @voyant-travel/quotes@0.125.8
  - @voyant-travel/workflow-runs@0.111.19
  - @voyant-travel/hono@0.122.2
  - @voyant-travel/workflows@0.111.19

## 0.31.0

### Patch Changes

- @voyant-travel/bookings@0.149.0
- @voyant-travel/catalog@0.147.0
- @voyant-travel/distribution@0.139.0
- @voyant-travel/finance@0.149.0
- @voyant-travel/legal@0.149.0
- @voyant-travel/quotes@0.125.7

## 0.30.0

### Patch Changes

- @voyant-travel/bookings@0.148.0
- @voyant-travel/catalog@0.146.0
- @voyant-travel/distribution@0.138.0
- @voyant-travel/finance@0.148.0
- @voyant-travel/legal@0.148.0
- @voyant-travel/quotes@0.125.6

## 0.29.0

### Patch Changes

- @voyant-travel/bookings@0.147.0
- @voyant-travel/catalog@0.145.0
- @voyant-travel/distribution@0.137.0
- @voyant-travel/finance@0.147.0
- @voyant-travel/legal@0.147.0
- @voyant-travel/quotes@0.125.5

## 0.28.0

### Patch Changes

- @voyant-travel/bookings@0.146.0
- @voyant-travel/catalog@0.144.0
- @voyant-travel/distribution@0.136.0
- @voyant-travel/finance@0.146.0
- @voyant-travel/legal@0.146.0
- @voyant-travel/quotes@0.125.4

## 0.27.0

### Patch Changes

- Updated dependencies [4829ef3]
  - @voyant-travel/catalog@0.143.0
  - @voyant-travel/distribution@0.135.0
  - @voyant-travel/products-contracts@0.106.1
  - @voyant-travel/bookings@0.145.0
  - @voyant-travel/quotes@0.125.3
  - @voyant-travel/finance@0.145.0
  - @voyant-travel/legal@0.145.0

## 0.26.0

### Patch Changes

- Updated dependencies [ba6c30a]
  - @voyant-travel/bookings@0.144.0
  - @voyant-travel/distribution@0.134.0
  - @voyant-travel/finance@0.144.0
  - @voyant-travel/legal@0.144.0
  - @voyant-travel/catalog@0.142.0
  - @voyant-travel/quotes@0.125.2

## 0.25.0

### Patch Changes

- Updated dependencies [425f92e]
  - @voyant-travel/db@0.110.0
  - @voyant-travel/hono@0.122.0
  - @voyant-travel/core@0.112.3
  - @voyant-travel/bookings@0.143.0
  - @voyant-travel/finance@0.143.0
  - @voyant-travel/legal@0.143.0
  - @voyant-travel/catalog@0.141.0
  - @voyant-travel/distribution@0.133.0
  - @voyant-travel/quotes@0.125.1
  - @voyant-travel/types@0.107.1
  - @voyant-travel/workflow-runs@0.111.18
  - @voyant-travel/workflows@0.111.18

## 0.24.0

### Minor Changes

- 05c10f2: Promote booking-maintenance tax-line rebuild routes into package-owned source-free managed runtime wiring.

### Patch Changes

- Updated dependencies [ee09a7f]
- Updated dependencies [97d1c14]
  - @voyant-travel/distribution@0.132.0
  - @voyant-travel/quotes@0.125.0
  - @voyant-travel/bookings@0.142.0
  - @voyant-travel/catalog@0.140.0
  - @voyant-travel/finance@0.142.0
  - @voyant-travel/legal@0.142.0

## 0.23.0

### Patch Changes

- Updated dependencies [6711f4c]
  - @voyant-travel/catalog@0.139.0
  - @voyant-travel/distribution@0.131.0
  - @voyant-travel/bookings@0.141.0
  - @voyant-travel/finance@0.141.0
  - @voyant-travel/legal@0.141.0
  - @voyant-travel/quotes@0.124.2

## 0.22.1

### Patch Changes

- 621f989: Allow modules to register workflow and event-filter manifest metadata without importing run-bearing workflow definitions into request-serving apps.
- Updated dependencies [621f989]
  - @voyant-travel/core@0.112.2
  - @voyant-travel/hono@0.121.2
  - @voyant-travel/workflows@0.111.17
  - @voyant-travel/workflow-runs@0.111.17

## 0.22.0

### Patch Changes

- Updated dependencies [8405bee]
  - @voyant-travel/products-contracts@0.106.0
  - @voyant-travel/bookings@0.140.0
  - @voyant-travel/catalog@0.138.0
  - @voyant-travel/distribution@0.130.0
  - @voyant-travel/finance@0.140.0
  - @voyant-travel/legal@0.140.0
  - @voyant-travel/workflow-runs@0.111.16
  - @voyant-travel/workflows@0.111.16
  - @voyant-travel/quotes@0.124.1

## 0.21.2

### Patch Changes

- 32d0e1c: Split the framework standard runtime composition into lightweight per-module
  lazy route loaders, and allow overlapping lazy route mounts to fall through on
  wrapper route misses so lazy modules/extensions preserve eager route composition
  semantics without swallowing handler-authored 404 responses.
- Updated dependencies [32d0e1c]
  - @voyant-travel/hono@0.121.1
  - @voyant-travel/finance@0.139.3

## 0.21.1

### Patch Changes

- a69f820: Snapshot accepted bank-transfer checkout payment terms into booking activity and show pre-payment checkout lifecycle rows in the admin activity timeline.
  - @voyant-travel/bookings@0.139.1

## 0.21.0

### Patch Changes

- 0c75844: Validate promotion product scopes against real products before creating or updating offers, preventing dangling `promotional_offer_products` rows for unknown product ids.
- Updated dependencies [c9a356f]
- Updated dependencies [689a289]
- Updated dependencies [fc71db1]
- Updated dependencies [fc71db1]
- Updated dependencies [6474f42]
- Updated dependencies [5786f63]
- Updated dependencies [22f0457]
- Updated dependencies [92e170a]
- Updated dependencies [f3b8bef]
- Updated dependencies [13f21a1]
- Updated dependencies [9f29b74]
- Updated dependencies [fcad28b]
  - @voyant-travel/types@0.107.0
  - @voyant-travel/core@0.112.0
  - @voyant-travel/hono@0.121.0
  - @voyant-travel/catalog@0.137.0
  - @voyant-travel/bookings@0.139.0
  - @voyant-travel/finance@0.139.0
  - @voyant-travel/quotes@0.124.0
  - @voyant-travel/distribution@0.129.0
  - @voyant-travel/legal@0.139.0
  - @voyant-travel/workflow-runs@0.111.15
  - @voyant-travel/db@0.109.5
  - @voyant-travel/workflows@0.111.15

## 0.20.5

### Patch Changes

- Updated dependencies [1cb9cba]
- Updated dependencies [131ff9b]
  - @voyant-travel/hono@0.120.0
  - @voyant-travel/bookings@0.138.6
  - @voyant-travel/catalog@0.136.3
  - @voyant-travel/distribution@0.128.4
  - @voyant-travel/finance@0.138.8
  - @voyant-travel/legal@0.138.2
  - @voyant-travel/quotes@0.123.14
  - @voyant-travel/workflow-runs@0.111.14
  - @voyant-travel/workflows@0.111.14

## 0.20.4

### Patch Changes

- Updated dependencies [b254511]
- Updated dependencies [141bd2b]
- Updated dependencies [86fbb05]
  - @voyant-travel/bookings@0.138.5
  - @voyant-travel/finance@0.138.7
  - @voyant-travel/hono@0.119.0
  - @voyant-travel/catalog@0.136.2
  - @voyant-travel/distribution@0.128.3
  - @voyant-travel/legal@0.138.1
  - @voyant-travel/quotes@0.123.13
  - @voyant-travel/workflow-runs@0.111.13
  - @voyant-travel/workflows@0.111.13

## 0.20.3

### Patch Changes

- bcd76ae: Reject invalid or dangling pricing and tax reference-data before writing.
  `POST /v1/admin/pricing/price-schedules` now rejects a nonexistent
  `priceCatalogId` with a deterministic `invalid_reference` 400 instead of a 500.
  Tax regime rates are bounded to the 0..100 percent domain (matching the
  booking-tax calculator that divides by 100), and `POST
/v1/admin/finance/tax-policy-rules` rejects dangling `profileId`/`taxRegimeId`
  references with an `invalid_reference` 400 (mirroring the existing tax-class
  regime guard).
- Updated dependencies [1544a59]
- Updated dependencies [2d3b039]
- Updated dependencies [bcd76ae]
- Updated dependencies [37e7758]
  - @voyant-travel/bookings@0.138.4
  - @voyant-travel/catalog@0.136.1
  - @voyant-travel/finance@0.138.6

## 0.20.2

### Patch Changes

- 569e2a0: Settings reference-data creates now return a deterministic 409 conflict on
  duplicate unique keys instead of a generic 500, so the admin UI can render an
  inline field error. `POST /v1/admin/pricing/price-catalogs` maps a duplicate
  `code` to `duplicate_price_catalog_code`, and
  `POST /v1/admin/relationships/custom-fields` maps a duplicate `(entityType,
key)` to `duplicate_custom_field_key`. Both use `onConflictDoNothing` and throw
  a 409 `ApiHttpError` carrying `details.fields` / `details.issues`, matching the
  existing product-type / product-tag duplicate-error shape.

## 0.20.1

### Patch Changes

- d1b4da2: Preserve proforma conversion linkage while checkout finalization issues final invoices so invoice-issued subscribers can convert existing provider estimates instead of creating standalone invoices.
- Updated dependencies [d388565]
- Updated dependencies [d1b4da2]
  - @voyant-travel/bookings@0.138.2
  - @voyant-travel/finance@0.138.2

## 0.20.0

### Patch Changes

- Updated dependencies [2325c93]
  - @voyant-travel/distribution@0.128.0
  - @voyant-travel/legal@0.138.0
  - @voyant-travel/bookings@0.138.0
  - @voyant-travel/catalog@0.136.0
  - @voyant-travel/finance@0.138.0
  - @voyant-travel/quotes@0.123.12

## 0.19.6

### Patch Changes

- 2156dcb: Map duplicate active promotion slug and code constraints to 409 API errors with field-level details.
  - @voyant-travel/bookings@0.137.7

## 0.19.5

### Patch Changes

- bb3b29c: Add a read-only public market discovery endpoint. `GET /v1/public/markets` is now reachable anonymously (no admin auth) and returns the supported markets, each with its active locales and currencies, using a narrow customer projection — `id`, `code`, `name`, `regionCode`, `countryCode`, `defaultLocale`, `defaultCurrency`, plus `locales` and `currencies`. No admin/tenant-internal fields (`status`, `timezone`, `taxContext`, `metadata`, FX rate sets, exchange rates, price catalogs, product/channel rules, or the per-currency `isSettlement`/`isReporting` flags) are exposed. Only `active` markets are listed. The market `id` is the catalog-search scope key storefronts thread into search as the `market` parameter (the catalog runtime indexes/searches slices keyed by `market.id`); `code`/`name` are for display.

## 0.19.4

### Patch Changes

- e005c4d: Reject inverted product option-unit age ranges and commerce pricing ranges across schemas and service mutations.
- Updated dependencies [e005c4d]
  - @voyant-travel/products-contracts@0.105.16

## 0.19.3

### Patch Changes

- dda92bd: Validate bank-transfer proforma number-series setup before materializing catalog snapshot bookings.
- Updated dependencies [24413e3]
- Updated dependencies [951409a]
- Updated dependencies [24413e3]
  - @voyant-travel/catalog@0.135.5
  - @voyant-travel/finance@0.137.4
  - @voyant-travel/hono@0.118.2

## 0.19.2

### Patch Changes

- eb9285a: Prevent partial pricing update schemas from reapplying insert defaults to omitted fields.
- Updated dependencies [db1acc4]
  - @voyant-travel/products-contracts@0.105.15

## 0.19.1

### Patch Changes

- Updated dependencies [9a1197b]
  - @voyant-travel/hono@0.118.0
  - @voyant-travel/finance@0.137.1
  - @voyant-travel/legal@0.137.1
  - @voyant-travel/bookings@0.137.1
  - @voyant-travel/catalog@0.135.1
  - @voyant-travel/distribution@0.127.1
  - @voyant-travel/quotes@0.123.6
  - @voyant-travel/workflow-runs@0.111.10
  - @voyant-travel/workflows@0.111.10

## 0.19.0

### Minor Changes

- 7c5ee80: Modules can own their OpenAPI contract (voyant#2114).

  The composed app root is now an `OpenAPIHono`, so routes authored with
  `@hono/zod-openapi`'s `createRoute(...).openapi(...)` contribute to a generated
  OpenAPI document at their real composed path. A new
  `@voyant-travel/hono/openapi` entrypoint exposes `generateOpenApiDocument` +
  `selectSurface` for build-time generation (kept off the package barrel so the
  doc generator stays out of the Worker runtime bundle). Existing plain routes are
  unaffected.

  The `commerce` markets list route is the first to declare its contract this way,
  using `listResponseSchema(...)` from `@voyant-travel/types` for its response
  envelope.

### Patch Changes

- Updated dependencies [7c5ee80]
  - @voyant-travel/hono@0.117.0
  - @voyant-travel/bookings@0.137.0
  - @voyant-travel/catalog@0.135.0
  - @voyant-travel/distribution@0.127.0
  - @voyant-travel/finance@0.137.0
  - @voyant-travel/legal@0.137.0
  - @voyant-travel/quotes@0.123.5
  - @voyant-travel/workflow-runs@0.111.9
  - @voyant-travel/workflows@0.111.9

## 0.18.1

### Patch Changes

- 12a1eb2: Expose client-safe subpaths for validation schemas, linkable metadata, template authoring metadata, finance payment-policy primitives, and Hono reporter utilities. Move browser-facing React/operator imports off mixed runtime barrels so client bundles do not pull Hono request context or other server-only runtime code.
- Updated dependencies [12a1eb2]
  - @voyant-travel/bookings@0.136.2
  - @voyant-travel/distribution@0.126.2
  - @voyant-travel/finance@0.136.2
  - @voyant-travel/hono@0.116.2
  - @voyant-travel/legal@0.136.2
  - @voyant-travel/quotes@0.123.4

## 0.18.0

### Patch Changes

- Updated dependencies [293e5e4]
  - @voyant-travel/hono@0.116.1
  - @voyant-travel/db@0.109.2
  - @voyant-travel/products-contracts@0.105.12
  - @voyant-travel/bookings@0.136.0
  - @voyant-travel/catalog@0.134.0
  - @voyant-travel/distribution@0.126.0
  - @voyant-travel/finance@0.136.0
  - @voyant-travel/legal@0.136.0
  - @voyant-travel/quotes@0.123.3

## 0.17.0

### Patch Changes

- @voyant-travel/db@0.109.1
- @voyant-travel/products-contracts@0.105.11
- @voyant-travel/bookings@0.135.0
- @voyant-travel/catalog@0.133.0
- @voyant-travel/distribution@0.125.0
- @voyant-travel/finance@0.135.0
- @voyant-travel/legal@0.135.0
- @voyant-travel/quotes@0.123.2

## 0.16.1

### Patch Changes

- Updated dependencies [684b321]
- Updated dependencies [2542715]
  - @voyant-travel/hono@0.116.0
  - @voyant-travel/bookings@0.134.1
  - @voyant-travel/catalog@0.132.1
  - @voyant-travel/distribution@0.124.1
  - @voyant-travel/finance@0.134.1
  - @voyant-travel/legal@0.134.1
  - @voyant-travel/quotes@0.123.1
  - @voyant-travel/workflow-runs@0.111.6
  - @voyant-travel/workflows@0.111.6

## 0.16.0

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
  - @voyant-travel/bookings@0.134.0
  - @voyant-travel/distribution@0.124.0
  - @voyant-travel/finance@0.134.0
  - @voyant-travel/legal@0.134.0
  - @voyant-travel/quotes@0.123.0
  - @voyant-travel/catalog@0.132.0
  - @voyant-travel/workflow-runs@0.111.5
  - @voyant-travel/workflows@0.111.5

## 0.15.0

### Patch Changes

- Updated dependencies [4abf9a2]
  - @voyant-travel/hono@0.114.0
  - @voyant-travel/bookings@0.133.0
  - @voyant-travel/legal@0.133.0
  - @voyant-travel/db@0.109.0
  - @voyant-travel/catalog@0.131.0
  - @voyant-travel/distribution@0.123.0
  - @voyant-travel/finance@0.133.0
  - @voyant-travel/quotes@0.122.11
  - @voyant-travel/workflow-runs@0.111.4
  - @voyant-travel/products-contracts@0.105.10
  - @voyant-travel/workflows@0.111.4

## 0.14.0

### Patch Changes

- Updated dependencies [6a0edd2]
  - @voyant-travel/catalog@0.130.0
  - @voyant-travel/products-contracts@0.105.9
  - @voyant-travel/distribution@0.122.0
  - @voyant-travel/bookings@0.132.0
  - @voyant-travel/quotes@0.122.10
  - @voyant-travel/finance@0.132.0
  - @voyant-travel/legal@0.132.0

## 0.13.1

### Patch Changes

- Updated dependencies [021ec00]
  - @voyant-travel/hono@0.113.0
  - @voyant-travel/core@0.111.0
  - @voyant-travel/bookings@0.131.1
  - @voyant-travel/catalog@0.129.1
  - @voyant-travel/distribution@0.121.1
  - @voyant-travel/finance@0.131.2
  - @voyant-travel/legal@0.131.1
  - @voyant-travel/quotes@0.122.9
  - @voyant-travel/workflow-runs@0.111.3
  - @voyant-travel/db@0.108.5
  - @voyant-travel/workflows@0.111.3

## 0.13.0

### Patch Changes

- @voyant-travel/bookings@0.131.0
- @voyant-travel/catalog@0.129.0
- @voyant-travel/distribution@0.121.0
- @voyant-travel/finance@0.131.0
- @voyant-travel/legal@0.131.0
- @voyant-travel/quotes@0.122.8

## 0.12.0

### Patch Changes

- @voyant-travel/bookings@0.130.0
- @voyant-travel/catalog@0.128.0
- @voyant-travel/distribution@0.120.0
- @voyant-travel/finance@0.130.0
- @voyant-travel/legal@0.130.0
- @voyant-travel/quotes@0.122.7

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

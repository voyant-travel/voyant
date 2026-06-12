# @voyantjs/schema-kit

## 0.105.1

### Patch Changes

- b7056f1: New `@voyantjs/db/outbox` module + `event_outbox` table (`schema/infra`, TypeID prefix `evob`) — the Postgres half of the transactional outbox (RFC #1687 Phase 2.1). **Requires the `event_outbox` migration.**

  - `createOutboxEventStore(getDb)` — plugs into `createEventBus`'s durable emit.
  - `insertOutboxEvents(dbOrTx, envelopes)` — atomic capture inside a domain transaction ("transactional outbox" proper); dedups on `metadata.eventId`.
  - `claimDueOutboxEvents` — visibility-timeout claiming (single statement, `FOR UPDATE SKIP LOCKED` subquery — safe on neon-http and under concurrent drains; a crashed claimer's rows simply become due again).
  - `drainOutbox(db, bus, opts)` — claim → redeliver via `bus.deliver` → complete / reschedule with exponential backoff (5s·2^attempts, 15min cap, jitter) / dead-letter after `max_attempts`.
  - `pruneDeliveredOutboxEvents`, `getOutboxStats`.

  Delivery is **at-least-once**: subscribers must be idempotent (the workflow forwarder already dedups on eventId; plugin subscribers key on external refs).

  Also: `createTestDb()` disables the Phase-1 default statement/query timeouts for test clients — `cleanupTestDb`'s full-schema TRUNCATE could exceed the 10s production default and kill integration-suite setup.

## 0.105.0

### Minor Changes

- d1ad572: Rename CRM sales artifacts from Opportunities to Quotes, split Quote Versions into their own schema/API surface, and update the corresponding TypeID prefixes.
- d1ad572: Add composer-owned Trip snapshot freezing and read APIs for Quote Version proposal snapshots.

## 0.104.2

### Patch Changes

- cfa6af8: feat(finance): accounts-payable supplier invoices, profitability & end-to-end FX

  Adds the full accounts-payable vertical for #1506:

  - **Supplier invoices (AP)**: `supplier_invoices` / `supplier_invoice_lines` /
    `supplier_cost_allocations`, the `supplierInvoicesService` (create/update/
    setLines/setAllocations/payments), attachments, and admin API routes.
  - **Cost allocation**: two-step product → departure picker, configurable cost
    categories (managed under Settings), searchable comboboxes.
  - **Profitability**: per-departure / per-product / per-traveller P&L read model
    - dashboards, cost-by-category breakdown, charts, CSV export.
  - **Accountant share portal**: scoped, revocable token links (no login) exposing
    financials + client/supplier invoices with downloadable attachments, ZIP
    download, and an en/ro language switcher.
  - **End-to-end FX**: supplier invoices and cost allocations snapshot their
    accounting-base value at the FX rate effective on the issue date; the
    profitability rollup sums those recorded snapshots (per-transaction-date
    rates) instead of re-valuing aggregates at the latest rate.

  Supporting additive exports: `availability`/`bookings`/`suppliers` schema and
  linkable exports consumed by the finance read model, and new TypeID prefixes in
  `schema-kit`.

## 0.104.1

## 0.104.0

## 0.103.0

## 0.102.0

## 0.101.2

### Patch Changes

- 577eaf5: Add in-context translations for products and itinerary days.

  - `@voyantjs/products`: add a `products.default_language_tag` column (the language the base name/description columns are written in) and a new `product_day_translations` table (per-language title/description/location) with CRUD service methods and routes under `/v1/products/:id/days/:dayId/translations`.
  - `@voyantjs/products-contracts`: validation schemas for the product default language and itinerary-day translations.
  - `@voyantjs/products-react`: `useProductDayTranslations` / `useProductDayTranslationMutation` hooks, record/response schemas, and query keys; the product record now exposes `defaultLanguageTag`.
  - `@voyantjs/schema-kit`: `product_day_translations` TypeID prefix (`pdtr`).
  - `@voyantjs/i18n`: operator labels for the content-language switcher, default language, itinerary-day sheet, and market-rule columns.

## 0.101.1

## 0.101.0

## 0.100.0

## 0.99.0

## 0.98.0

## 0.97.0

### Minor Changes

- 7094c8e: Add `@voyantjs/schema-kit` and extend the `*-contracts` pattern to the
  operational modules.

  `@voyantjs/schema-kit` (pure: zod + typeid-js) is the new foundational home for
  schema primitives shared by the runtime and the contract packages — the TypeID
  system (prefix registry, id generation, zod validators), `booleanQueryParam`,
  and `kmsEnvelopeSchema`. These moved out of `@voyantjs/db` (which now re-exports
  them from their original paths, so every call-site is unchanged) so they sit
  below the data layer and the contract packages can depend on them without
  pulling Drizzle.

  New zod-only contract packages own each module's validation surface (schemas +
  enums): `@voyantjs/bookings-contracts`, `@voyantjs/finance-contracts`,
  `@voyantjs/crm-contracts`, `@voyantjs/transactions-contracts`,
  `@voyantjs/suppliers-contracts`, `@voyantjs/identity-contracts`, and
  `@voyantjs/legal-contracts`. Each runtime module re-exports from its contracts
  package, so existing `@voyantjs/<module>/validation` import paths are unchanged.
  Shared primitives come from `@voyantjs/schema-kit`, keeping the contract
  packages free of the data layer.

  (`legal-contracts` still transitively depends on `@voyantjs/utils` for the
  template-syntax validator used by contract validation — a tracked follow-up
  would purify it.)

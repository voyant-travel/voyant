# @voyantjs/charters-react

## 0.26.4

### Patch Changes

- @voyantjs/charters@0.26.4
- @voyantjs/react@0.26.4

## 0.26.3

### Patch Changes

- @voyantjs/charters@0.26.3
- @voyantjs/react@0.26.3

## 0.26.2

### Patch Changes

- @voyantjs/charters@0.26.2
- @voyantjs/react@0.26.2

## 0.26.1

### Patch Changes

- @voyantjs/charters@0.26.1
- @voyantjs/react@0.26.1

## 0.26.0

### Patch Changes

- @voyantjs/charters@0.26.0
- @voyantjs/react@0.26.0

## 0.25.0

### Patch Changes

- @voyantjs/charters@0.25.0
- @voyantjs/react@0.25.0

## 0.24.3

### Patch Changes

- @voyantjs/charters@0.24.3
- @voyantjs/react@0.24.3

## 0.24.2

### Patch Changes

- @voyantjs/charters@0.24.2
- @voyantjs/react@0.24.2

## 0.24.1

### Patch Changes

- @voyantjs/charters@0.24.1
- @voyantjs/react@0.24.1

## 0.24.0

### Patch Changes

- @voyantjs/charters@0.24.0
- @voyantjs/react@0.24.0

## 0.23.0

### Patch Changes

- @voyantjs/charters@0.23.0
- @voyantjs/react@0.23.0

## 0.22.0

### Patch Changes

- @voyantjs/charters@0.22.0
- @voyantjs/react@0.22.0

## 0.21.1

### Patch Changes

- @voyantjs/charters@0.21.1
- @voyantjs/react@0.21.1

## 0.21.0

### Patch Changes

- @voyantjs/charters@0.21.0
- @voyantjs/react@0.21.0

## 0.20.0

### Patch Changes

- @voyantjs/charters@0.20.0
- @voyantjs/react@0.20.0

## 0.19.0

### Patch Changes

- @voyantjs/charters@0.19.0
- @voyantjs/react@0.19.0

## 0.18.0

### Patch Changes

- Updated dependencies [8932f60]
  - @voyantjs/charters@0.18.0
  - @voyantjs/react@0.18.0

## 0.17.0

### Minor Changes

- 66d722d: Charters pricing was built around four hardcoded "first-class" currencies (USD/EUR/GBP/AUD). Adding a new currency required schema, validation, service, adapter, React, and UI changes — a domain constraint, not an i18n concern. This release replaces the column-per-currency shape with `pricesByCurrency: Record<currency, amount>` jsonb maps so adding a new currency is a content change, not a migration.

  **Schema:**

  - `charter_suites.{price,port_fee}_{usd,eur,gbp,aud}` (8 cols) → `prices_by_currency` + `port_fees_by_currency` (2 jsonb cols).
  - `charter_voyages.whole_yacht_price_{usd,eur,gbp,aud}` (4 cols) → `whole_yacht_prices_by_currency` (1 jsonb col).
  - `charter_products.lowest_price_cached_usd` → `lowest_price_cached_amount` + `lowest_price_cached_currency` (deployment-chosen browse currency).

  **API surface:** Removed `FIRST_CLASS_CURRENCIES`, `firstClassCurrencySchema`, `FirstClassCurrency`. Hook request types `currency: "USD"|"EUR"|"GBP"|"AUD"` → `currency: string`. `ExternalCharterProductSummary.lowestPriceUSD` → `lowestPriceAmount` + `lowestPriceCurrency`. `pricingService.lowestSuitePriceUSD` → `lowestSuitePriceForCurrency(db, voyageId, currency)`. `recomputeProductAggregates(db, productId, { browseCurrency? })` accepts an explicit browse currency; defaults to `"USD"` for backward compatibility.

  **Migration:** Existing deployments need a one-shot SQL backfill of the new jsonb columns from the old per-currency columns before the column drop lands. See PR #355 description for a sketch.

### Patch Changes

- Updated dependencies [66d722d]
  - @voyantjs/charters@0.17.0
  - @voyantjs/react@0.17.0

## 0.16.0

### Patch Changes

- @voyantjs/charters@0.16.0
- @voyantjs/react@0.16.0

## 0.15.0

### Patch Changes

- @voyantjs/charters@0.15.0
- @voyantjs/react@0.15.0

## 0.14.0

### Patch Changes

- @voyantjs/charters@0.14.0
- @voyantjs/react@0.14.0

## 0.13.0

### Patch Changes

- @voyantjs/charters@0.13.0
- @voyantjs/react@0.13.0

## 0.12.0

### Minor Changes

- 944d244: Adds the charters module — a new opt-in vertical for yacht-charter brands carved out of cruises (operators selling Aman, Four Seasons, Ritz-Carlton, SeaDream, A&K, Orient Express style products), designed natively against Voyant's existing module/extension/link conventions and the broker-mediated yacht-charter data shape (whole-yacht vs per-suite, MYBA contracts, APA, multi-currency native pricing).

  **`@voyantjs/charters`** — full server module:

  - 5 tables: charter_products (one per brand × yacht configuration), charter_voyages (a specific dated trip), charter_yachts (vessel specs + crew), charter_suites (per-voyage suite pricing, all four first-class currencies as explicit columns), charter_schedule_days (flat per-voyage itinerary; no template/override two-tier — charter schedules are negotiable).
  - Two booking modes per voyage: `per_suite` and `whole_yacht`. Voyages opt into either or both; whole-yacht requires a resolvable APA percent and an MYBA contract template ref.
  - Multi-currency native (USD/EUR/GBP/AUD as explicit price columns, not derived). `pricingService.quotePerSuite` and `quoteWholeYacht` use pure BigInt-cent math; no float drift. APA computed as integer basis points.
  - `booking_charter_details` 1:1 extension on bookings: `bookingMode` discriminator, source/sourceProvider/sourceRef provenance, multi-currency snapshot fields, MYBA contract id (soft FK to legal.contracts), and APA reconciliation state (paid / spent / refund / settledAt).
  - `chartersBookingService` with four entry points — local + external × per-suite + whole-yacht. Each commits in a single transaction (atomic booking + travelers + extension snapshot). External flows commit upstream BEFORE local writes so the upstream rejection path is loud.
  - `mybaService.generateContract` is DI-shaped — accepts a `CharterContractsService` so charters takes no hard dep on `@voyantjs/legal`. Idempotent; respects voyage override → product default → injected service default precedence.
  - APA reconciliation: `recordApaPayment` (collected from charterer pre-charter) and `reconcileApa` (records on-board spend + refund balance + optional settle stamp). Routes mounted as a `bookings` extension at `POST /v1/admin/bookings/:bookingId/charter-details/apa/{payment,reconcile}`.
  - **Provenance — local + external in one experience.** Charters can be self-managed (operator owns the rows) or external (sourced through a registered `CharterAdapter`). Admin + public routes use a unified-key parser that accepts both `chrt_*` / `chrv_*` / `chry_*` TypeIDs and `<provider>:<ref>` external keys; list endpoints fan out to all registered adapters via parallel `Promise.allSettled`. External writes return 409.
  - Adapter contract (`@voyantjs/charters/adapters`): `CharterAdapter` interface with `listEntries` / `fetchProduct` / `fetchVoyage` / `fetchVoyageSuites` / `fetchVoyageSchedule` / `fetchYacht` / `listVoyagesForProduct` / `createPerSuiteBooking` / `createWholeYachtBooking`. Process-local registry, TTL+LRU memoize decorator, and `MockCharterAdapter` for tests with seeders + `failEveryNthCall` for error-path coverage.
  - Unlike cruises, charters has NO search index — the operator universe is small (six brands in v1) so adapter fan-out per request is plenty.
  - 77 unit tests covering pricing math (USD/EUR/GBP/AUD currency resolution, fractional APA percentages, BigInt cent precision), MYBA service (idempotency, template precedence, variable propagation), booking-extension validation (mode-specific refinements, external provenance rules), routes (invalid keys, write rejections, external dispatch with adapter, MYBA endpoint without contracts service), adapter registry / mock / memoize.

  **`@voyantjs/charters-react`** — React Query hooks + Zod fetch client:

  - ~15 hooks: `useCharterProducts` / `useCharterProduct` / `useCharterProductMutation`, `useCharterVoyages` / `useCharterVoyage`, `useCharterYachts` / `useCharterYacht`, `usePerSuiteQuote` / `useWholeYachtQuote`, `useCharterBookingMutation` (per-suite + whole-yacht — server dispatches local vs external), `useGenerateMybaContract`, `useCharterDetails` / `useRecordApaPayment` / `useReconcileApa`, plus public-surface variants.
  - Mirrors `@voyantjs/cruises-react` exactly: hierarchical query keys rooted at `["voyant", "charters"]`, `queryOptions()` factories for SSR/router prefetch, envelope helpers, `VoyantChartersProvider`, mutations that invalidate the parent resource and `setQueryData` on the detail. Detail responses union local + external dispatch shapes so callers handle provenance with a discriminated check.
  - 15 unit tests across query keys, the validating fetcher (URL join, error extraction, schema mismatch handling, Content-Type defaulting), and query-option factories (URL serialisation, unified-key encoding, public-vs-admin surface routing).

  **`@voyantjs/bookings`**: no schema changes; charters integrates as a 1:1 extension table. Patch bump captures the dependency edge.

  **`@voyantjs/db`**: registers TypeID prefixes for the charter namespace (`chrt`, `chrv`, `chry`, `chst`, `chrd`).

  **`@voyantjs/ui`** (registry only — versionless): adds the `voyant-charters-*` shadcn registry components — `external-badge`, `charter-product-card` (works for both local records and external summaries), `voyage-suite-grid` (per-suite pricing matrix with category, availability badge, multi-currency price, quote/book CTA), `whole-yacht-quote-card` (charter fee + APA + total + explanatory copy; ships with a per-suite sibling), `apa-tracker` (pre-/post-charter APA reconciliation panel with collected / spent / refund / settled state). Install via `shadcn add voyant-charters-charter-product-card` etc.

  **Design doc**: full rationale, schema, and architecture in `docs/architecture/charters-module.md`.

### Patch Changes

- Updated dependencies [944d244]
  - @voyantjs/charters@0.12.0
  - @voyantjs/react@0.12.0

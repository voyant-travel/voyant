# @voyantjs/catalog

## 0.30.3

### Patch Changes

- Updated dependencies [05a1b19]
  - @voyantjs/core@0.30.3
  - @voyantjs/db@0.30.3
  - @voyantjs/hono@0.30.3

## 0.30.2

### Patch Changes

- @voyantjs/core@0.30.2
- @voyantjs/db@0.30.2
- @voyantjs/hono@0.30.2

## 0.30.1

### Patch Changes

- @voyantjs/core@0.30.1
- @voyantjs/db@0.30.1
- @voyantjs/hono@0.30.1

## 0.30.0

### Patch Changes

- @voyantjs/core@0.30.0
- @voyantjs/db@0.30.0
- @voyantjs/hono@0.30.0

## 0.29.0

### Minor Changes

- 583326e: PR4 of #497: booking-engine + storefront integration.

  Customers can now enter a promotion code at checkout, see the discount applied to the pre-tax base on the quote, complete the booking, and end up with a redemption row recorded by the post-commit subscriber. Storefront's `/v1/public/products/:productId/offers` and `/v1/public/offers/:slug` endpoints (previously empty) now return real data.

  **`@voyantjs/catalog`** —

  - **Field rename**: `BookingDraft.voucher: { code }` → `BookingDraft.promotionCode: string`. Avoids permanent collision with the finance `vouchers` domain. Single live consumer (`@voyantjs/catalog-react`'s `useBookingQuote` hook) updated.
  - **New `./booking-engine` exports**: `AppliedOffer`, `CodeStatus`, `PromotionEvaluationInput`, `PromotionEvaluationOutput` — the contract types templates implement to wire promotions. Catalog stays decoupled from `@voyantjs/promotions`.
  - **`QuoteEntityDeps.evaluatePromotions`** — optional async hook called inside `quoteEntity` after the adapter returns pricing (only for `entity_module === "products"` in v1). Discounts apply to `pricing.base_amount` pre-tax so the operator template's `applyOperatorTaxToQuoteResult` step downstream recomputes taxes against the new base. Bad-code outcomes surface as `code_*` `invalidReason` on the quote (`code_not_found`, `code_expired`, `code_not_yet_valid`, `code_not_applicable`).
  - **`CatalogBookingRoutesOptions.resolveEvaluatePromotions`** — per-request callback templates wire so the hook closes over the request's `db`.
  - **Schema additions**:
    - `catalog_quotes.pricing_applied_offers` (JSONB, typed `AppliedOffer[]`).
    - `booking_catalog_snapshot.pricing_applied_offers` (JSONB) — frozen for audit; survives source-offer mutation.
    - Index `idx_catalog_quotes_consumed_booking` on `consumed_booking_id` for the post-commit subscriber's lookup.
  - **`PricingBasis.appliedOffers?: AppliedOffer[]`** added in-memory; `readPricingBasis`, `readPricingFromQuote`, `snapshotToPricing`, `captureSnapshot`, and `captureSnapshotGraph` all updated to round-trip the field.

  **`@voyantjs/promotions`** —

  - **`./service-catalog-evaluator`** — `createCatalogPromotionEvaluator(db)` adapter factory. Bridges catalog's `PromotionEvaluationInput` / `PromotionEvaluationOutput` to the package's internal evaluator (PR2). Operator template wires it via `resolveEvaluatePromotions`.
  - **`./service-booking-confirmed`** — `recordPromotionRedemptionsForBooking(db, bookingId)`. Reads `pricing_applied_offers` from `catalog_quotes` joined to the booking via `consumed_booking_id` (NOT from the snapshot, to avoid an ordering race with `captureSnapshotGraph`). Aggregates per-offer (sums `discount_applied_cents` across multiple line-item snapshots; first non-null `appliedCode` wins). Idempotent upsert into `promotional_offer_redemptions` via `(offer_id, booking_id)` unique index — replay-safe.
  - **`./service-storefront`** — `createPromotionsStorefrontResolvers()` returning `StorefrontOfferResolvers`. Maps offer rows to the `StorefrontPromotionalOffer` DTO (single `discountValue` string for both `percentage` and `fixed_amount` flavors; `applicableDepartureIds: []` per v1 limitation).
  - New deps: `@voyantjs/catalog`, `@voyantjs/storefront` (workspace).

  **Operator template** —

  - `catalog-booking.ts` wires `resolveEvaluatePromotions: ({ db }) => createCatalogPromotionEvaluator(db)` so the hook fires for every quote.
  - `app.ts` wires `createPromotionsStorefrontResolvers()` into `createStorefrontHonoModule({ offers })`.
  - `catalog-bridge.ts` registers a second `booking.confirmed` subscriber alongside the existing snapshot capture; the new subscriber calls `recordPromotionRedemptionsForBooking`. Failure logs but doesn't rethrow (sibling subscribers shouldn't be blocked); ops can backfill from snapshot's `pricing_applied_offers`.
  - Drizzle migration `0008_white_bucky.sql` generated for the column + index additions.

  **Validation**:

  - `pnpm -F (@voyantjs/catalog, @voyantjs/promotions, @voyantjs/storefront, operator) typecheck` — clean (operator runs with `NODE_OPTIONS=--max-old-space-size=8192` due to large workspace heap requirements).
  - `pnpm -F @voyantjs/promotions test` — 84 unit tests pass; 32 integration tests skip without `TEST_DATABASE_URL` (added 6 new for the redemption recorder, 8 new for storefront resolver).
  - Biome lint clean across all touched files.

  **Honest about what the post-commit pattern guarantees**: `bookEntity` doesn't have a single enclosing transaction, so the redemption subscriber accepts a small audit gap on permanent failure (mitigated by `pricing_applied_offers` on the snapshot enabling backfill, and idempotent upsert handling subscriber retries). This was the explicit decision in §15.2 of the architecture doc.

### Patch Changes

- Updated dependencies [583326e]
- Updated dependencies [583326e]
- Updated dependencies [4a6523e]
- Updated dependencies [db51715]
  - @voyantjs/core@0.29.0
  - @voyantjs/db@0.29.0
  - @voyantjs/hono@0.29.0

## 0.28.3

### Patch Changes

- @voyantjs/core@0.28.3
- @voyantjs/db@0.28.3
- @voyantjs/hono@0.28.3

## 0.28.2

### Patch Changes

- @voyantjs/core@0.28.2
- @voyantjs/db@0.28.2
- @voyantjs/hono@0.28.2

## 0.28.1

### Patch Changes

- @voyantjs/core@0.28.1
- @voyantjs/db@0.28.1
- @voyantjs/hono@0.28.1

## 0.28.0

### Patch Changes

- @voyantjs/core@0.28.0
- @voyantjs/db@0.28.0
- @voyantjs/hono@0.28.0

## 0.27.0

### Patch Changes

- @voyantjs/core@0.27.0
- @voyantjs/db@0.27.0
- @voyantjs/hono@0.27.0

## 0.26.9

### Patch Changes

- @voyantjs/core@0.26.9
- @voyantjs/db@0.26.9
- @voyantjs/hono@0.26.9

## 0.26.8

### Patch Changes

- @voyantjs/core@0.26.8
- @voyantjs/db@0.26.8
- @voyantjs/hono@0.26.8

## 0.26.7

### Patch Changes

- @voyantjs/core@0.26.7
- @voyantjs/db@0.26.7
- @voyantjs/hono@0.26.7

## 0.26.6

### Patch Changes

- @voyantjs/core@0.26.6
- @voyantjs/db@0.26.6
- @voyantjs/hono@0.26.6

## 0.26.5

### Patch Changes

- Updated dependencies [7a92aba]
  - @voyantjs/core@0.26.5
  - @voyantjs/db@0.26.5
  - @voyantjs/hono@0.26.5

## 0.26.4

### Patch Changes

- Updated dependencies [6493f62]
  - @voyantjs/core@0.26.4
  - @voyantjs/db@0.26.4
  - @voyantjs/hono@0.26.4

## 0.26.3

### Patch Changes

- Updated dependencies [372cad5]
  - @voyantjs/core@0.26.3
  - @voyantjs/db@0.26.3
  - @voyantjs/hono@0.26.3

## 0.26.2

### Patch Changes

- Updated dependencies [ffdb485]
  - @voyantjs/core@0.26.2
  - @voyantjs/db@0.26.2
  - @voyantjs/hono@0.26.2

## 0.26.1

### Patch Changes

- Updated dependencies [c0507a6]
  - @voyantjs/core@0.26.1
  - @voyantjs/db@0.26.1
  - @voyantjs/hono@0.26.1

## 0.26.0

### Patch Changes

- @voyantjs/core@0.26.0
- @voyantjs/db@0.26.0
- @voyantjs/hono@0.26.0

## 0.25.0

### Patch Changes

- @voyantjs/core@0.25.0
- @voyantjs/db@0.25.0
- @voyantjs/hono@0.25.0

## 0.24.3

### Patch Changes

- @voyantjs/core@0.24.3
- @voyantjs/db@0.24.3
- @voyantjs/hono@0.24.3

## 0.24.2

### Patch Changes

- bec0471: Export the BookingJourney Hono route factory and module from the catalog package root, matching the route-module import pattern used by the vertical packages.
  - @voyantjs/core@0.24.2
  - @voyantjs/db@0.24.2
  - @voyantjs/hono@0.24.2

## 0.24.1

### Patch Changes

- 2d6297d: Expose a reusable BookingJourney Hono route module for the catalog booking engine.
  - @voyantjs/core@0.24.1
  - @voyantjs/db@0.24.1
  - @voyantjs/hono@0.24.1

## 0.24.0

### Patch Changes

- @voyantjs/core@0.24.0
- @voyantjs/db@0.24.0

## 0.23.0

### Patch Changes

- @voyantjs/core@0.23.0
- @voyantjs/db@0.23.0

## 0.22.0

### Patch Changes

- @voyantjs/core@0.22.0
- @voyantjs/db@0.22.0

## 0.21.1

### Patch Changes

- @voyantjs/core@0.21.1
- @voyantjs/db@0.21.1

## 0.21.0

### Minor Changes

- 6427bad: Release the booking journey architecture train.

  This adds booking hold policy support, richer traveler and booking journey flows, operator tax policy configuration, finance billing and tax policy APIs, notification reminder target and delivery tooling, and the template/runtime wiring needed for the operator storefront checkout flow.

### Patch Changes

- Updated dependencies [6427bad]
  - @voyantjs/core@0.21.0
  - @voyantjs/db@0.21.0

## 0.20.0

### Patch Changes

- @voyantjs/core@0.20.0
- @voyantjs/db@0.20.0

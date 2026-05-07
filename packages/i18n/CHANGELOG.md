# @voyantjs/i18n

## 0.27.0

### Patch Changes

- dc46e37: First-class per-departure price overrides (#467).

  Operators can now opt a single departure out of the seasonal `priceSchedule` layer by setting an explicit per-unit price. Resolved at snapshot time before option price rules: a unit with an active override on a given departure gets that override's amount; units without an override fall through to the schedule-matched rule.

  **`@voyantjs/pricing`**

  - New `departure_price_overrides` table (TypeID prefix `dpov`). One row per `(departureId × optionUnitId × priceCatalogId)` with `sellAmountCents`, optional `costAmountCents`, `active` flag, `notes`, `metadata`.
  - Service + admin REST CRUD at `/v1/admin/pricing/departure-overrides`.
  - New `loadDeparturePriceOverrides` helper in `service-rule-resolver`.
  - Public pricing snapshot consumes overrides when `departureId` is passed: per-unit `sellAmountCents` is replaced for matching units. Backward-compatible — without `departureId`, the snapshot is unchanged.
  - Migrations shipped for the `operator` and `dmc` templates.
  - 5 integration tests covering: override beats unit price for the targeted unit, falls through when absent, respects `active=false`, multi-unit overrides coexist, no overrides applied when `departureId` is omitted.

  **`@voyantjs/pricing-react`**

  - New hooks: `useDeparturePriceOverrides`, `useDeparturePriceOverride`, `useDeparturePriceOverrideMutation`.
  - New query options: `getDeparturePriceOverridesQueryOptions`, `getDeparturePriceOverrideQueryOptions`.
  - New record schema + paginated/single response envelopes.

  **`@voyantjs/i18n`**

  - Admin strings for the operator template's "Override pricing" affordance and "Custom price" badge (EN + RO).

## 0.26.9

### Patch Changes

- 24a121e: Add admin strings for the simplified per-unit pricing table (#466).

  The operator UI now hides the unit×category pricing matrix when a price rule uses `pricingMode = "per_person"` and `allPricingCategories = true` — the pax-bucket unit (Adult / Child / Infant) already encodes the differentiation, so the 12-column room/group/category matrix is just noise on day-trip products. Three new strings power the simplified table:

  - `products.operations.priceRules.unitPricingTitle` — section title when the simple table renders
  - `products.operations.priceRules.tableSell` — Sell column header
  - `products.operations.priceRules.tableCost` — Cost column header (reserved for future per-unit cost editing)

  Existing `unitCategoryTitle` and `tableUnit` strings still drive the full matrix when `allPricingCategories` is off.

## 0.26.8

## 0.26.7

## 0.26.6

## 0.26.5

## 0.26.4

## 0.26.3

## 0.26.2

## 0.26.1

## 0.26.0

## 0.25.0

## 0.24.3

## 0.24.2

## 0.24.1

## 0.24.0

## 0.23.0

## 0.22.0

## 0.21.1

## 0.21.0

### Minor Changes

- 6427bad: Release the booking journey architecture train.

  This adds booking hold policy support, richer traveler and booking journey flows, operator tax policy configuration, finance billing and tax policy APIs, notification reminder target and delivery tooling, and the template/runtime wiring needed for the operator storefront checkout flow.

## 0.20.0

## 0.19.0

## 0.18.0

## 0.17.0

### Minor Changes

- 66d722d: Complete the UI i18n rollout: every `*-ui` package now ships locale-aware messages with English + Romanian definitions, a `MessagesProvider`, and a parity test harness. New packages adding UI components should mirror the same shape (see `packages/suppliers-ui` as the reference).

# @voyantjs/pricing-react

## 0.28.1

### Patch Changes

- 9d88eae: Fix #479: `priceCatalogRecordSchema.currencyCode` is now `z.string().nullable()`, matching the DB column, the server-side core schema, and the `#462` "NULL means follow `product.sellCurrency`" semantics. Operators using a single default public catalog with `currency_code = NULL` no longer hit `Voyant API response failed validation` on the catalog-settings page or the departure-pricing-override dialog.

  `PriceCatalogRecord["currencyCode"]` is now `string | null`. Registry components in `@voyantjs/ui` (`price-catalogs-page`, `price-catalog-dialog`) render the NULL case as `—` and load it as `""` into the form. Direct consumers of `record.currencyCode` should add a similar fallback.

  - @voyantjs/pricing@0.28.1
  - @voyantjs/react@0.28.1

## 0.28.0

### Patch Changes

- Updated dependencies [b72948d]
  - @voyantjs/pricing@0.28.0
  - @voyantjs/react@0.28.0

## 0.27.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [dc46e37]
  - @voyantjs/pricing@0.27.0
  - @voyantjs/react@0.27.0

## 0.26.9

### Patch Changes

- Updated dependencies [24a121e]
  - @voyantjs/pricing@0.26.9
  - @voyantjs/react@0.26.9

## 0.26.8

### Patch Changes

- Updated dependencies [abc9aa0]
  - @voyantjs/pricing@0.26.8
  - @voyantjs/react@0.26.8

## 0.26.7

### Patch Changes

- @voyantjs/pricing@0.26.7
- @voyantjs/react@0.26.7

## 0.26.6

### Patch Changes

- @voyantjs/pricing@0.26.6
- @voyantjs/react@0.26.6

## 0.26.5

### Patch Changes

- @voyantjs/pricing@0.26.5
- @voyantjs/react@0.26.5

## 0.26.4

### Patch Changes

- @voyantjs/pricing@0.26.4
- @voyantjs/react@0.26.4

## 0.26.3

### Patch Changes

- @voyantjs/pricing@0.26.3
- @voyantjs/react@0.26.3

## 0.26.2

### Patch Changes

- @voyantjs/pricing@0.26.2
- @voyantjs/react@0.26.2

## 0.26.1

### Patch Changes

- @voyantjs/pricing@0.26.1
- @voyantjs/react@0.26.1

## 0.26.0

### Patch Changes

- @voyantjs/pricing@0.26.0
- @voyantjs/react@0.26.0

## 0.25.0

### Patch Changes

- @voyantjs/pricing@0.25.0
- @voyantjs/react@0.25.0

## 0.24.3

### Patch Changes

- @voyantjs/pricing@0.24.3
- @voyantjs/react@0.24.3

## 0.24.2

### Patch Changes

- @voyantjs/pricing@0.24.2
- @voyantjs/react@0.24.2

## 0.24.1

### Patch Changes

- @voyantjs/pricing@0.24.1
- @voyantjs/react@0.24.1

## 0.24.0

### Patch Changes

- @voyantjs/pricing@0.24.0
- @voyantjs/react@0.24.0

## 0.23.0

### Patch Changes

- @voyantjs/pricing@0.23.0
- @voyantjs/react@0.23.0

## 0.22.0

### Patch Changes

- @voyantjs/pricing@0.22.0
- @voyantjs/react@0.22.0

## 0.21.1

### Patch Changes

- @voyantjs/pricing@0.21.1
- @voyantjs/react@0.21.1

## 0.21.0

### Patch Changes

- @voyantjs/pricing@0.21.0
- @voyantjs/react@0.21.0

## 0.20.0

### Patch Changes

- @voyantjs/pricing@0.20.0
- @voyantjs/react@0.20.0

## 0.19.0

### Patch Changes

- @voyantjs/pricing@0.19.0
- @voyantjs/react@0.19.0

## 0.18.0

### Patch Changes

- @voyantjs/pricing@0.18.0
- @voyantjs/react@0.18.0

## 0.17.0

### Patch Changes

- @voyantjs/pricing@0.17.0
- @voyantjs/react@0.17.0

## 0.16.0

### Patch Changes

- @voyantjs/pricing@0.16.0
- @voyantjs/react@0.16.0

## 0.15.0

### Patch Changes

- @voyantjs/pricing@0.15.0
- @voyantjs/react@0.15.0

## 0.14.0

### Patch Changes

- @voyantjs/pricing@0.14.0
- @voyantjs/react@0.14.0

## 0.13.0

### Patch Changes

- @voyantjs/pricing@0.13.0
- @voyantjs/react@0.13.0

## 0.12.0

### Patch Changes

- @voyantjs/pricing@0.12.0
- @voyantjs/react@0.12.0

## 0.11.0

### Patch Changes

- @voyantjs/pricing@0.11.0
- @voyantjs/react@0.11.0

## 0.10.0

### Patch Changes

- @voyantjs/pricing@0.10.0
- @voyantjs/react@0.10.0

## 0.9.0

### Patch Changes

- @voyantjs/pricing@0.9.0
- @voyantjs/react@0.9.0

## 0.8.0

### Patch Changes

- @voyantjs/pricing@0.8.0
- @voyantjs/react@0.8.0

## 0.7.0

### Patch Changes

- @voyantjs/pricing@0.7.0
- @voyantjs/react@0.7.0

## 0.6.9

### Patch Changes

- @voyantjs/pricing@0.6.9
- @voyantjs/react@0.6.9

## 0.6.8

### Patch Changes

- Updated dependencies [b218885]
- Updated dependencies [b218885]
  - @voyantjs/pricing@0.6.8
  - @voyantjs/react@0.6.8

## 0.6.7

### Patch Changes

- @voyantjs/pricing@0.6.7
- @voyantjs/react@0.6.7

## 0.6.6

### Patch Changes

- @voyantjs/pricing@0.6.6
- @voyantjs/react@0.6.6

## 0.6.5

### Patch Changes

- @voyantjs/pricing@0.6.5
- @voyantjs/react@0.6.5

## 0.6.4

### Patch Changes

- @voyantjs/pricing@0.6.4
- @voyantjs/react@0.6.4

## 0.6.3

### Patch Changes

- @voyantjs/pricing@0.6.3
- @voyantjs/react@0.6.3

## 0.6.2

### Patch Changes

- @voyantjs/pricing@0.6.2
- @voyantjs/react@0.6.2

## 0.6.1

### Patch Changes

- @voyantjs/pricing@0.6.1
- @voyantjs/react@0.6.1

## 0.6.0

### Patch Changes

- @voyantjs/pricing@0.6.0
- @voyantjs/react@0.6.0

## 0.5.0

### Patch Changes

- @voyantjs/pricing@0.5.0
- @voyantjs/react@0.5.0

## 0.4.5

### Patch Changes

- @voyantjs/pricing@0.4.5
- @voyantjs/react@0.4.5

## 0.4.4

### Patch Changes

- @voyantjs/pricing@0.4.4
- @voyantjs/react@0.4.4

## 0.4.3

### Patch Changes

- @voyantjs/pricing@0.4.3
- @voyantjs/react@0.4.3

## 0.4.2

### Patch Changes

- @voyantjs/pricing@0.4.2
- @voyantjs/react@0.4.2

## 0.4.1

### Patch Changes

- @voyantjs/pricing@0.4.1
- @voyantjs/react@0.4.1

## 0.4.0

### Patch Changes

- @voyantjs/pricing@0.4.0
- @voyantjs/react@0.4.0

## 0.3.1

### Patch Changes

- @voyantjs/pricing@0.3.1
- @voyantjs/react@0.3.1

## 0.3.0

### Minor Changes

- da84f07: Add reusable React Query option builders for pricing categories and category dependencies so consumers can preload those lists from route loaders.

### Patch Changes

- e57725d: Flatten frontend provider wiring around a shared `@voyantjs/react` config provider so module react packages can share one app-level Voyant context.
- Updated dependencies [e57725d]
  - @voyantjs/pricing@0.3.0
  - @voyantjs/react@0.3.0

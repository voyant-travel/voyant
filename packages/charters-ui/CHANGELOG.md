# @voyantjs/charters-ui

## 0.21.0

### Patch Changes

- Updated dependencies [6427bad]
  - @voyantjs/catalog-react@0.21.0
  - @voyantjs/charters-react@0.21.0
  - @voyantjs/i18n@0.21.0
  - @voyantjs/ui@0.21.0

## 0.20.0

### Patch Changes

- @voyantjs/catalog-react@0.20.0
- @voyantjs/charters-react@0.20.0
- @voyantjs/i18n@0.20.0
- @voyantjs/ui@0.20.0

## 0.19.0

### Patch Changes

- @voyantjs/charters-react@0.19.0
- @voyantjs/i18n@0.19.0
- @voyantjs/ui@0.19.0

## 0.18.0

### Patch Changes

- @voyantjs/charters-react@0.18.0
- @voyantjs/i18n@0.18.0
- @voyantjs/ui@0.18.0

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
- Updated dependencies [66d722d]
  - @voyantjs/charters-react@0.17.0
  - @voyantjs/i18n@0.17.0
  - @voyantjs/ui@0.17.0

## 0.16.0

### Patch Changes

- @voyantjs/charters-react@0.16.0
- @voyantjs/ui@0.16.0

## 0.15.0

### Minor Changes

- cccc905: Bulk-extract per-domain importable UI packages, mirroring the `*-react` split. 17 new `*-ui` packages shipping a combined 137 components; primitives package `voyant-ui` gains 3 promoted shared primitives (`currency-combobox`, `date-time-picker`, `country-combobox`).

  **New `*-ui` packages**: `booking-requirements`, `bookings`, `charters`, `cruises`, `distribution`, `external-refs`, `extras`, `finance`, `hospitality`, `identity`, `legal`, `markets`, `pricing`, `products`, `resources`, `sellability`, `suppliers`. (Already shipped in prior commit: `crm-ui`.)

  **`voyant-ui` additions**: `CurrencyCombobox`, `DateTimePicker`, `CountryCombobox` — promoted from registry/template-local sources because they're shared primitives that 21 domain components depend on. Adds `@voyantjs/utils` to dependencies.

  **Two distribution modes for every domain**:

  - Importable: `pnpm add @voyantjs/<domain>-ui` — version-tracked, updates flow with bumps
  - Registry: `npx shadcn add @voyant/<component>` — copy + own, fork-friendly

  **Components NOT in importable packages** (registry-only):

  - Router-coupled components (TanStack Router): legal `quotes-page`, `create-quote-dialog`, etc.
  - Template-local-helper-coupled: `@/components/voyant/crm/*` deps, `@/lib/api-client` deps
  - Components with pre-existing latent bugs surfaced by per-package compilation: API drift against `*-react` hooks (e.g., `useBookingItemParticipants` no longer exists), loose typing that worked under permissive consumer tsconfigs but not under strict library compilation, broken imports to skipped sibling components

  The full coupling-and-bug list is preserved in each package's README. These components remain consumable via the shadcn registry path; they can be promoted into the importable packages when their underlying issues are fixed.

  **Domains with no importable surface** (all components either failed to compile or were registry-only by design): `auth`, `ground`, `notifications`, `transactions`. Their components remain available via the registry.

  **Tree-shaking**: `sideEffects: false` is set across all packages. With ESM + Bundler-resolution, modern bundlers (Vite, webpack, Next.js) drop unused named exports through barrels.

### Patch Changes

- Updated dependencies [cccc905]
- Updated dependencies [361c8c5]
- Updated dependencies [e84fe0f]
- Updated dependencies [24869f4]
- Updated dependencies [cccc905]
  - @voyantjs/charters-react@0.15.0
  - @voyantjs/ui@0.15.0

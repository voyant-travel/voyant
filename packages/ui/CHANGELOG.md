# @voyantjs/ui

## 0.26.7

### Patch Changes

- @voyantjs/i18n@0.26.7
- @voyantjs/notifications@0.26.7
- @voyantjs/notifications-react@0.26.7
- @voyantjs/utils@0.26.7

## 0.26.6

### Patch Changes

- @voyantjs/i18n@0.26.6
- @voyantjs/notifications@0.26.6
- @voyantjs/notifications-react@0.26.6
- @voyantjs/utils@0.26.6

## 0.26.5

### Patch Changes

- @voyantjs/i18n@0.26.5
- @voyantjs/notifications@0.26.5
- @voyantjs/notifications-react@0.26.5
- @voyantjs/utils@0.26.5

## 0.26.4

### Patch Changes

- @voyantjs/i18n@0.26.4
- @voyantjs/notifications@0.26.4
- @voyantjs/notifications-react@0.26.4
- @voyantjs/utils@0.26.4

## 0.26.3

### Patch Changes

- @voyantjs/i18n@0.26.3
- @voyantjs/notifications@0.26.3
- @voyantjs/notifications-react@0.26.3
- @voyantjs/utils@0.26.3

## 0.26.2

### Patch Changes

- @voyantjs/i18n@0.26.2
- @voyantjs/notifications@0.26.2
- @voyantjs/notifications-react@0.26.2
- @voyantjs/utils@0.26.2

## 0.26.1

### Patch Changes

- @voyantjs/i18n@0.26.1
- @voyantjs/notifications@0.26.1
- @voyantjs/notifications-react@0.26.1
- @voyantjs/utils@0.26.1

## 0.26.0

### Patch Changes

- @voyantjs/i18n@0.26.0
- @voyantjs/notifications@0.26.0
- @voyantjs/notifications-react@0.26.0
- @voyantjs/utils@0.26.0

## 0.25.0

### Patch Changes

- @voyantjs/i18n@0.25.0
- @voyantjs/notifications@0.25.0
- @voyantjs/notifications-react@0.25.0
- @voyantjs/utils@0.25.0

## 0.24.3

### Patch Changes

- @voyantjs/i18n@0.24.3
- @voyantjs/notifications@0.24.3
- @voyantjs/notifications-react@0.24.3
- @voyantjs/utils@0.24.3

## 0.24.2

### Patch Changes

- @voyantjs/i18n@0.24.2
- @voyantjs/notifications@0.24.2
- @voyantjs/notifications-react@0.24.2
- @voyantjs/utils@0.24.2

## 0.24.1

### Patch Changes

- ed635c7: Expose consistent Tailwind v4 style helper imports across admin and UI packages,
  and document single-tenant auth shell bootstrap without mandatory workspace
  organization routes.
  - @voyantjs/i18n@0.24.1
  - @voyantjs/notifications@0.24.1
  - @voyantjs/notifications-react@0.24.1
  - @voyantjs/utils@0.24.1

## 0.24.0

### Patch Changes

- @voyantjs/i18n@0.24.0
- @voyantjs/notifications@0.24.0
- @voyantjs/notifications-react@0.24.0
- @voyantjs/utils@0.24.0

## 0.23.0

### Patch Changes

- @voyantjs/i18n@0.23.0
- @voyantjs/notifications@0.23.0
- @voyantjs/notifications-react@0.23.0
- @voyantjs/utils@0.23.0

## 0.22.0

### Patch Changes

- @voyantjs/i18n@0.22.0
- @voyantjs/notifications@0.22.0
- @voyantjs/notifications-react@0.22.0
- @voyantjs/utils@0.22.0

## 0.21.1

### Patch Changes

- @voyantjs/i18n@0.21.1
- @voyantjs/notifications@0.21.1
- @voyantjs/notifications-react@0.21.1
- @voyantjs/utils@0.21.1

## 0.21.0

### Minor Changes

- 6427bad: Release the booking journey architecture train.

  This adds booking hold policy support, richer traveler and booking journey flows, operator tax policy configuration, finance billing and tax policy APIs, notification reminder target and delivery tooling, and the template/runtime wiring needed for the operator storefront checkout flow.

### Patch Changes

- Updated dependencies [6427bad]
  - @voyantjs/i18n@0.21.0
  - @voyantjs/notifications@0.21.0
  - @voyantjs/notifications-react@0.21.0
  - @voyantjs/utils@0.21.0

## 0.20.0

### Patch Changes

- @voyantjs/i18n@0.20.0
- @voyantjs/notifications@0.20.0
- @voyantjs/notifications-react@0.20.0
- @voyantjs/utils@0.20.0

## 0.19.0

### Patch Changes

- @voyantjs/i18n@0.19.0
- @voyantjs/notifications@0.19.0
- @voyantjs/notifications-react@0.19.0
- @voyantjs/utils@0.19.0

## 0.18.0

### Patch Changes

- @voyantjs/i18n@0.18.0
- @voyantjs/notifications@0.18.0
- @voyantjs/notifications-react@0.18.0
- @voyantjs/utils@0.18.0

## 0.17.0

### Minor Changes

- 66d722d: Charters pricing was built around four hardcoded "first-class" currencies (USD/EUR/GBP/AUD). Adding a new currency required schema, validation, service, adapter, React, and UI changes — a domain constraint, not an i18n concern. This release replaces the column-per-currency shape with `pricesByCurrency: Record<currency, amount>` jsonb maps so adding a new currency is a content change, not a migration.

  **Schema:**

  - `charter_suites.{price,port_fee}_{usd,eur,gbp,aud}` (8 cols) → `prices_by_currency` + `port_fees_by_currency` (2 jsonb cols).
  - `charter_voyages.whole_yacht_price_{usd,eur,gbp,aud}` (4 cols) → `whole_yacht_prices_by_currency` (1 jsonb col).
  - `charter_products.lowest_price_cached_usd` → `lowest_price_cached_amount` + `lowest_price_cached_currency` (deployment-chosen browse currency).

  **API surface:** Removed `FIRST_CLASS_CURRENCIES`, `firstClassCurrencySchema`, `FirstClassCurrency`. Hook request types `currency: "USD"|"EUR"|"GBP"|"AUD"` → `currency: string`. `ExternalCharterProductSummary.lowestPriceUSD` → `lowestPriceAmount` + `lowestPriceCurrency`. `pricingService.lowestSuitePriceUSD` → `lowestSuitePriceForCurrency(db, voyageId, currency)`. `recomputeProductAggregates(db, productId, { browseCurrency? })` accepts an explicit browse currency; defaults to `"USD"` for backward compatibility.

  **Migration:** Existing deployments need a one-shot SQL backfill of the new jsonb columns from the old per-currency columns before the column drop lands. See PR #355 description for a sketch.

- 66d722d: Complete the UI i18n rollout: every `*-ui` package now ships locale-aware messages with English + Romanian definitions, a `MessagesProvider`, and a parity test harness. New packages adding UI components should mirror the same shape (see `packages/suppliers-ui` as the reference).

### Patch Changes

- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
  - @voyantjs/i18n@0.17.0
  - @voyantjs/notifications@0.17.0
  - @voyantjs/notifications-react@0.17.0
  - @voyantjs/utils@0.17.0

## 0.16.0

### Patch Changes

- @voyantjs/notifications@0.16.0
- @voyantjs/notifications-react@0.16.0
- @voyantjs/utils@0.16.0

## 0.15.0

### Minor Changes

- 361c8c5: Add `DateTimePicker` primitive (`@/components/ui/date-time-picker`) and migrate every remaining `<Input type="datetime-local">` in the registry.

  - Registered as `voyant-date-time-picker` in `packages/ui/registry.json` (`type: "registry:ui"`) so external consumers can install via `shadcn add voyant-date-time-picker`.
  - Composes Calendar + an `HH:mm` time input inside a Popover, with the value serialized as `"YYYY-MM-DDTHH:mm"` — drop-in compatible with the native `<input type="datetime-local">` contract.
  - Picking a new day preserves the existing time-of-day; clearing the time falls back to `00:00`.
  - Supports the same `disabled` / `dateDisabled` / `clearable` props as the enhanced DatePicker.
  - Migrated 6 sites across 4 registry files (booking guarantee, distribution sync + webhook dialogs, legal contract dialog), plus template copies in `templates/dmc`, `templates/operator`, `apps/dev`.

- 24869f4: UI consistency sweep across every registry dialog and form:

  - **New primitive**: `CurrencyCombobox` (`@/components/ui/currency-combobox`) — searchable currency picker backed by the canonical `currencies` list from `@voyantjs/utils`. Trigger renders `CODE (symbol)`; items render `CODE — Name (symbol)`. Registered in `packages/ui/registry.json` as `voyant-currency-combobox` with `type: "registry:ui"` so external consumers can install via `shadcn add voyant-currency-combobox`.
  - **DatePicker enhancement**: added first-class `disabled?: boolean` (disables the entire picker) and `dateDisabled` (day-level matcher, forwards to underlying Calendar) props. Replaces prior ambiguity where `disabled` collided with react-day-picker's Matcher type.
  - **Swept every registry dialog + form**:
    - Native `<Input type="date">` → `<DatePicker>` (56 sites across bookings, finance, transactions, hospitality, legal, distribution, products).
    - Currency `<Input maxLength={3}>` → `<CurrencyCombobox>` (18 sites across the same domains).
    - Bare `<SelectTrigger>` → `<SelectTrigger className="w-full">` so the trigger fills its form column (~118 sites across every domain).
  - Template copies in `templates/dmc`, `templates/operator`, and `apps/dev` synced with the registry source.

- cccc905: `@voyantjs/ui` is now publishable. Consumers can `pnpm add @voyantjs/ui` and import primitives directly instead of copying them via the shadcn registry — updates flow with version bumps. The registry path remains for components you intend to fork.

  **What changed:**

  - `private: true` flipped to publishable; package removed from changesets `ignore` and added to the linked release group.
  - New `tsconfig.build.json` emits `dist/` (JS + `.d.ts` + declaration maps) under `module: ESNext` / `moduleResolution: Bundler`. The package is bundler-consumed by design.
  - New `build`, `clean`, `prepack`, `typecheck` scripts. `prepack` runs the build so `pnpm pack` produces a complete tarball.
  - `publishConfig.exports` mirrors the dev `exports` map but points at `./dist/*.js` + `./dist/*.d.ts`. Workspace consumers continue to resolve `./src/*` directly; only published consumers see the dist paths.
  - `files: ["dist", "src/styles", "postcss.config.mjs"]` — `globals.css` ships as-is for consumers to import.
  - Editor `tsconfig.json` aligned to `Bundler` resolution to match the build (avoids extensionless-import false positives in `tsc --noEmit`).
  - One latent type bug in `input-group.tsx` fixed (`querySelector` lacked an explicit element-type narrowing).

  **Tree-shaking:** `sideEffects: false` is set across all UI/react packages in this repo, so unused named exports drop through barrels in modern bundlers.

### Patch Changes

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

- e84fe0f: Add shared upload-aware media workflows to the product registry components.

  `product-media-section` now supports optional file upload handlers and compact
  embedded rendering for day-level media management. `product-itinerary-section`
  now renders the shared day-media section directly inside expanded itinerary day
  rows, so apps no longer need a local wrapper just to manage day media uploads.

  - @voyantjs/notifications@0.15.0
  - @voyantjs/notifications-react@0.15.0
  - @voyantjs/utils@0.15.0

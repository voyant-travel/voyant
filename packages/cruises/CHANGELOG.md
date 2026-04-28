# @voyantjs/cruises

## 0.14.0

### Patch Changes

- @voyantjs/bookings@0.14.0
- @voyantjs/core@0.14.0
- @voyantjs/db@0.14.0
- @voyantjs/hono@0.14.0

## 0.13.0

### Patch Changes

- Updated dependencies [7dfbc05]
- Updated dependencies [15dda79]
  - @voyantjs/bookings@0.13.0
  - @voyantjs/core@0.13.0
  - @voyantjs/db@0.13.0
  - @voyantjs/hono@0.13.0

## 0.12.0

### Minor Changes

- cc561ce: Adds the cruises module — a new opt-in vertical for cruise-selling travel agencies, designed natively against Voyant's existing module/extension/link conventions and reverse-engineered from the cross-line cruise-industry data shape (sailings, ships, decks, cabin categories, fare codes, occupancy grids, dated promo overlays, expedition enrichment programs).

  **`@voyantjs/cruises`** — full server module:

  - 13 tables: cruises, sailings, ships, decks, cabin categories, cabins, prices, price components, days, sailing-day overrides, media, inclusions, search index, enrichment programs.
  - Pricing: a (sailing × cabin category × occupancy × fare code) grid with per-row price components (gratuities, OBC, port charges, taxes, NCF, airfare). Soft-FKs to `@voyantjs/pricing` `priceCatalogs`/`priceSchedules` for promo overlays — no cruise-local promotions table.
  - Itinerary at two levels: `cruise_days` template + `cruise_sailing_days` per-sailing overrides (skipped ports, alternate times, ship swaps). `getEffectiveItinerary()` merges them.
  - River direction enum (`upstream | downstream | round_trip | one_way`) on sailings.
  - Expedition enrichment programs (naturalist / historian / photographer / lecturer / expert).
  - Money math (`composeQuote`) is a pure function performed in BigInt cents — supports occupancy variants, single-supplement %, second-guest pricing, and the addition/credit/inclusion price-component directions. 20 unit tests cover the math.
  - Booking integration: `booking_cruise_details` + `booking_group_cruise_details` extension tables, `cruisesBookingService.createCruiseBooking` (single cabin) and `createCruisePartyBooking` (multi-cabin via `bookingGroups` of new kind `cruise_party`). External-sailing bookings go through `createExternalCruiseBooking` which commits upstream first, then snapshots the connector booking ref.
  - **Provenance — local + external in one experience.** Cruises can be self-managed (operator owns the rows) or external (sourced through a registered `CruiseAdapter`). Admin routes use a unified-key parser that accepts both `cru_*` TypeIDs and `<provider>:<ref>` external keys; list endpoints interleave both sources via parallel `Promise.allSettled` adapter fan-out. External writes return 409. `POST /:key/refresh` re-fetches; `POST /:key/detach` does a one-way snapshot to local.
  - Adapter contract (`@voyantjs/cruises/adapters`): `CruiseAdapter` interface with `listEntries` / `searchProjection` / `fetchCruise` / `fetchSailing` / `fetchSailingPricing` / `fetchSailingItinerary` / `fetchShip` / `listSailingsForCruise` / `createBooking`. Process-local registry (`registerCruiseAdapter`/`resolveCruiseAdapter`/`listCruiseAdapters`), TTL+LRU memoize decorator, and `MockCruiseAdapter` for tests. The Voyant Connect adapter is intentionally not built in this release — the contract is ready for it.
  - Search index (`cruise_search_index`): opt-in storefront projection. Local cruises are projected automatically by mutation hooks in `cruisesService`; adapters call `PUT /v1/admin/cruises/search-index/bulk` to push externals. Storefront `GET /v1/public/cruises` reads exclusively from this index for paginated/filterable browse with provenance-aware detail dispatch.
  - ~88 unit tests covering pricing math, key parsing, route validation, adapter registry, mock adapter, memoize decorator, and direction/enrichment validation.

  **`@voyantjs/cruises-react`** — React Query hooks + Zod fetch client:

  - ~25 hooks: `useCruises` / `useCruise` / `useCruiseMutation`, `useSailings` / `useSailing` / `useSailingMutation`, `useShips` + ship-detail family, `usePrices` / `useQuote`, `useCruiseBookingMutation` (single + party), `useEnrichmentPrograms` / `useEnrichmentMutation`, `useExternalCruiseActions` (refresh / detach), `useSearchIndexMutation`, `useStorefrontCruises` / `useStorefrontCruise` / `useStorefrontSailing`.
  - Mirrors `@voyantjs/crm-react` and `@voyantjs/products-react` exactly: hierarchical query keys rooted at `["voyant", "cruises"]`, `queryOptions()` factories for SSR/router prefetch, envelope helpers, `VoyantCruisesProvider`, mutations that invalidate the parent resource and `setQueryData` on the detail.

  **`@voyantjs/bookings`**: extends `bookingGroupKindEnum` with `cruise_party` so multi-cabin party bookings have a first-class group kind alongside `shared_room` and `other`. Pure additive; existing groups unaffected.

  **`@voyantjs/db`**: registers TypeID prefixes for the cruise namespace (`cru`, `crsl`, `crsh`, `crdk`, `crcc`, `crcb`, `crpx`, `crpc`, `crdy`, `crsd`, `crme`, `crin`, `crsi`, `crep`).

  **`@voyantjs/voyant-ui`** (registry only — versionless): adds the `voyant-cruises-*` shadcn registry components — `external-badge`, `cruise-card`, `cruise-list`, `pricing-grid` (the load-bearing cabin × occupancy matrix), `quote-display`, `enrichment-program-list`. Install via `shadcn add voyant-cruises-cruise-card` etc.

  **Example app** (`examples/nextjs-booking-portal`): adds `/cruises` listing + `/cruises/[slug]` detail pages backed by `/v1/public/cruises`, with mock data showing the local-vs-external dual-source UI.

  **Design doc**: full rationale, schema, and architecture in `docs/architecture/cruises-module.md` (745 lines).

### Patch Changes

- Updated dependencies [944d244]
- Updated dependencies [cc561ce]
  - @voyantjs/bookings@0.12.0
  - @voyantjs/core@0.12.0
  - @voyantjs/db@0.12.0
  - @voyantjs/hono@0.12.0

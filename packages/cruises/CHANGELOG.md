# @voyantjs/cruises

## 0.35.0

### Patch Changes

- @voyantjs/bookings@0.35.0
- @voyantjs/catalog@0.35.0
- @voyantjs/core@0.35.0
- @voyantjs/db@0.35.0
- @voyantjs/hono@0.35.0

## 0.34.0

### Patch Changes

- f8312f5: Project a normalized `thumbnailUrl` field into catalog search documents so
  operator catalog cards can render real cover images across verticals.
  - @voyantjs/bookings@0.34.0
  - @voyantjs/catalog@0.34.0
  - @voyantjs/core@0.34.0
  - @voyantjs/db@0.34.0
  - @voyantjs/hono@0.34.0

## 0.33.1

### Patch Changes

- Updated dependencies [9bee9aa]
  - @voyantjs/bookings@0.33.1
  - @voyantjs/catalog@0.33.1
  - @voyantjs/core@0.33.1
  - @voyantjs/db@0.33.1
  - @voyantjs/hono@0.33.1

## 0.33.0

### Patch Changes

- @voyantjs/bookings@0.33.0
- @voyantjs/catalog@0.33.0
- @voyantjs/core@0.33.0
- @voyantjs/db@0.33.0
- @voyantjs/hono@0.33.0

## 0.32.3

### Patch Changes

- @voyantjs/bookings@0.32.3
- @voyantjs/catalog@0.32.3
- @voyantjs/core@0.32.3
- @voyantjs/db@0.32.3
- @voyantjs/hono@0.32.3

## 0.32.2

### Patch Changes

- @voyantjs/bookings@0.32.2
- @voyantjs/catalog@0.32.2
- @voyantjs/core@0.32.2
- @voyantjs/db@0.32.2
- @voyantjs/hono@0.32.2

## 0.32.1

### Patch Changes

- @voyantjs/bookings@0.32.1
- @voyantjs/catalog@0.32.1
- @voyantjs/core@0.32.1
- @voyantjs/db@0.32.1
- @voyantjs/hono@0.32.1

## 0.32.0

### Patch Changes

- Updated dependencies [6ea6ded]
  - @voyantjs/bookings@0.32.0
  - @voyantjs/catalog@0.32.0
  - @voyantjs/core@0.32.0
  - @voyantjs/db@0.32.0
  - @voyantjs/hono@0.32.0

## 0.31.4

### Patch Changes

- @voyantjs/bookings@0.31.4
- @voyantjs/catalog@0.31.4
- @voyantjs/core@0.31.4
- @voyantjs/db@0.31.4
- @voyantjs/hono@0.31.4

## 0.31.3

### Patch Changes

- Updated dependencies [5f974dd]
  - @voyantjs/bookings@0.31.3
  - @voyantjs/catalog@0.31.3
  - @voyantjs/core@0.31.3
  - @voyantjs/db@0.31.3
  - @voyantjs/hono@0.31.3

## 0.31.2

### Patch Changes

- Updated dependencies [54ddc93]
  - @voyantjs/bookings@0.31.2
  - @voyantjs/catalog@0.31.2
  - @voyantjs/core@0.31.2
  - @voyantjs/db@0.31.2
  - @voyantjs/hono@0.31.2

## 0.31.1

### Patch Changes

- @voyantjs/bookings@0.31.1
- @voyantjs/catalog@0.31.1
- @voyantjs/core@0.31.1
- @voyantjs/db@0.31.1
- @voyantjs/hono@0.31.1

## 0.31.0

### Patch Changes

- @voyantjs/bookings@0.31.0
- @voyantjs/catalog@0.31.0
- @voyantjs/core@0.31.0
- @voyantjs/db@0.31.0
- @voyantjs/hono@0.31.0

## 0.30.7

### Patch Changes

- @voyantjs/bookings@0.30.7
- @voyantjs/catalog@0.30.7
- @voyantjs/core@0.30.7
- @voyantjs/db@0.30.7
- @voyantjs/hono@0.30.7

## 0.30.6

### Patch Changes

- Updated dependencies [5a4c592]
  - @voyantjs/bookings@0.30.6
  - @voyantjs/catalog@0.30.6
  - @voyantjs/core@0.30.6
  - @voyantjs/db@0.30.6
  - @voyantjs/hono@0.30.6

## 0.30.5

### Patch Changes

- Updated dependencies [3f323e9]
  - @voyantjs/bookings@0.30.5
  - @voyantjs/catalog@0.30.5
  - @voyantjs/core@0.30.5
  - @voyantjs/db@0.30.5
  - @voyantjs/hono@0.30.5

## 0.30.4

### Patch Changes

- @voyantjs/bookings@0.30.4
- @voyantjs/catalog@0.30.4
- @voyantjs/core@0.30.4
- @voyantjs/db@0.30.4
- @voyantjs/hono@0.30.4

## 0.30.3

### Patch Changes

- Updated dependencies [05a1b19]
  - @voyantjs/bookings@0.30.3
  - @voyantjs/catalog@0.30.3
  - @voyantjs/core@0.30.3
  - @voyantjs/db@0.30.3
  - @voyantjs/hono@0.30.3

## 0.30.2

### Patch Changes

- @voyantjs/bookings@0.30.2
- @voyantjs/catalog@0.30.2
- @voyantjs/core@0.30.2
- @voyantjs/db@0.30.2
- @voyantjs/hono@0.30.2

## 0.30.1

### Patch Changes

- @voyantjs/bookings@0.30.1
- @voyantjs/catalog@0.30.1
- @voyantjs/core@0.30.1
- @voyantjs/db@0.30.1
- @voyantjs/hono@0.30.1

## 0.30.0

### Patch Changes

- @voyantjs/bookings@0.30.0
- @voyantjs/catalog@0.30.0
- @voyantjs/core@0.30.0
- @voyantjs/db@0.30.0
- @voyantjs/hono@0.30.0

## 0.29.0

### Patch Changes

- 2baf762: Fix #492: expose all workspace sub-paths in `publishConfig.exports` for vertical packages.

  `publishConfig.exports` (used at publish time) had drifted from the workspace `exports` map: catalog plane and content plane sub-paths shipped in `dist/` but were unreachable from the published package. Consumers installing from npm hit `ERR_PACKAGE_PATH_NOT_EXPORTED` / `TS2307` when importing them.

  Newly exposed sub-paths:

  - `@voyantjs/products`: `./catalog-policy`, `./service-catalog-plane`, `./content-shape`, `./service-content`, `./service-content-synthesizer`, `./routes-content`, `./draft-shape`
  - `@voyantjs/extras`: `./catalog-policy`, `./service-catalog-plane`, `./content-shape`, `./service-content`, `./service-content-synthesizer`, `./draft-shape`
  - `@voyantjs/cruises`: `./catalog-policy`, `./service-catalog-plane`, `./content-shape`, `./service-content-synthesizer`, `./routes-content`, `./draft-shape`
  - `@voyantjs/charters`: `./catalog-policy`, `./service-catalog-plane`, `./content-shape`, `./service-content`, `./service-content-synthesizer`, `./draft-shape`
  - `@voyantjs/hospitality`: `./catalog-policy`, `./service-catalog-plane`, `./content-shape`, `./service-content-synthesizer`, `./draft-shape`

- Updated dependencies [3420711]
- Updated dependencies [583326e]
- Updated dependencies [583326e]
- Updated dependencies [583326e]
- Updated dependencies [4a6523e]
- Updated dependencies [db51715]
  - @voyantjs/bookings@0.29.0
  - @voyantjs/catalog@0.29.0
  - @voyantjs/core@0.29.0
  - @voyantjs/db@0.29.0
  - @voyantjs/hono@0.29.0

## 0.28.3

### Patch Changes

- @voyantjs/bookings@0.28.3
- @voyantjs/catalog@0.28.3
- @voyantjs/core@0.28.3
- @voyantjs/db@0.28.3
- @voyantjs/hono@0.28.3

## 0.28.2

### Patch Changes

- @voyantjs/bookings@0.28.2
- @voyantjs/catalog@0.28.2
- @voyantjs/core@0.28.2
- @voyantjs/db@0.28.2
- @voyantjs/hono@0.28.2

## 0.28.1

### Patch Changes

- @voyantjs/bookings@0.28.1
- @voyantjs/catalog@0.28.1
- @voyantjs/core@0.28.1
- @voyantjs/db@0.28.1
- @voyantjs/hono@0.28.1

## 0.28.0

### Patch Changes

- @voyantjs/bookings@0.28.0
- @voyantjs/catalog@0.28.0
- @voyantjs/core@0.28.0
- @voyantjs/db@0.28.0
- @voyantjs/hono@0.28.0

## 0.27.0

### Patch Changes

- @voyantjs/bookings@0.27.0
- @voyantjs/catalog@0.27.0
- @voyantjs/core@0.27.0
- @voyantjs/db@0.27.0
- @voyantjs/hono@0.27.0

## 0.26.9

### Patch Changes

- @voyantjs/bookings@0.26.9
- @voyantjs/catalog@0.26.9
- @voyantjs/core@0.26.9
- @voyantjs/db@0.26.9
- @voyantjs/hono@0.26.9

## 0.26.8

### Patch Changes

- @voyantjs/bookings@0.26.8
- @voyantjs/catalog@0.26.8
- @voyantjs/core@0.26.8
- @voyantjs/db@0.26.8
- @voyantjs/hono@0.26.8

## 0.26.7

### Patch Changes

- @voyantjs/bookings@0.26.7
- @voyantjs/catalog@0.26.7
- @voyantjs/core@0.26.7
- @voyantjs/db@0.26.7
- @voyantjs/hono@0.26.7

## 0.26.6

### Patch Changes

- Updated dependencies [571e340]
  - @voyantjs/bookings@0.26.6
  - @voyantjs/catalog@0.26.6
  - @voyantjs/core@0.26.6
  - @voyantjs/db@0.26.6
  - @voyantjs/hono@0.26.6

## 0.26.5

### Patch Changes

- Updated dependencies [7a92aba]
  - @voyantjs/bookings@0.26.5
  - @voyantjs/catalog@0.26.5
  - @voyantjs/core@0.26.5
  - @voyantjs/db@0.26.5
  - @voyantjs/hono@0.26.5

## 0.26.4

### Patch Changes

- Updated dependencies [6493f62]
  - @voyantjs/bookings@0.26.4
  - @voyantjs/catalog@0.26.4
  - @voyantjs/core@0.26.4
  - @voyantjs/db@0.26.4
  - @voyantjs/hono@0.26.4

## 0.26.3

### Patch Changes

- Updated dependencies [372cad5]
  - @voyantjs/bookings@0.26.3
  - @voyantjs/catalog@0.26.3
  - @voyantjs/core@0.26.3
  - @voyantjs/db@0.26.3
  - @voyantjs/hono@0.26.3

## 0.26.2

### Patch Changes

- Updated dependencies [ffdb485]
  - @voyantjs/bookings@0.26.2
  - @voyantjs/catalog@0.26.2
  - @voyantjs/core@0.26.2
  - @voyantjs/db@0.26.2
  - @voyantjs/hono@0.26.2

## 0.26.1

### Patch Changes

- Updated dependencies [c0507a6]
  - @voyantjs/bookings@0.26.1
  - @voyantjs/catalog@0.26.1
  - @voyantjs/core@0.26.1
  - @voyantjs/db@0.26.1
  - @voyantjs/hono@0.26.1

## 0.26.0

### Patch Changes

- @voyantjs/bookings@0.26.0
- @voyantjs/catalog@0.26.0
- @voyantjs/core@0.26.0
- @voyantjs/db@0.26.0
- @voyantjs/hono@0.26.0

## 0.25.0

### Patch Changes

- @voyantjs/bookings@0.25.0
- @voyantjs/catalog@0.25.0
- @voyantjs/core@0.25.0
- @voyantjs/db@0.25.0
- @voyantjs/hono@0.25.0

## 0.24.3

### Patch Changes

- @voyantjs/bookings@0.24.3
- @voyantjs/catalog@0.24.3
- @voyantjs/core@0.24.3
- @voyantjs/db@0.24.3
- @voyantjs/hono@0.24.3

## 0.24.2

### Patch Changes

- Updated dependencies [bec0471]
  - @voyantjs/bookings@0.24.2
  - @voyantjs/catalog@0.24.2
  - @voyantjs/core@0.24.2
  - @voyantjs/db@0.24.2
  - @voyantjs/hono@0.24.2

## 0.24.1

### Patch Changes

- Updated dependencies [2d6297d]
  - @voyantjs/bookings@0.24.1
  - @voyantjs/catalog@0.24.1
  - @voyantjs/core@0.24.1
  - @voyantjs/db@0.24.1
  - @voyantjs/hono@0.24.1

## 0.24.0

### Patch Changes

- @voyantjs/bookings@0.24.0
- @voyantjs/catalog@0.24.0
- @voyantjs/core@0.24.0
- @voyantjs/db@0.24.0
- @voyantjs/hono@0.24.0

## 0.23.0

### Patch Changes

- @voyantjs/bookings@0.23.0
- @voyantjs/catalog@0.23.0
- @voyantjs/core@0.23.0
- @voyantjs/db@0.23.0
- @voyantjs/hono@0.23.0

## 0.22.0

### Patch Changes

- @voyantjs/bookings@0.22.0
- @voyantjs/catalog@0.22.0
- @voyantjs/core@0.22.0
- @voyantjs/db@0.22.0
- @voyantjs/hono@0.22.0

## 0.21.1

### Patch Changes

- @voyantjs/bookings@0.21.1
- @voyantjs/catalog@0.21.1
- @voyantjs/core@0.21.1
- @voyantjs/db@0.21.1
- @voyantjs/hono@0.21.1

## 0.21.0

### Patch Changes

- Updated dependencies [6427bad]
  - @voyantjs/bookings@0.21.0
  - @voyantjs/catalog@0.21.0
  - @voyantjs/core@0.21.0
  - @voyantjs/db@0.21.0
  - @voyantjs/hono@0.21.0

## 0.20.0

### Patch Changes

- @voyantjs/bookings@0.20.0
- @voyantjs/catalog@0.20.0
- @voyantjs/core@0.20.0
- @voyantjs/db@0.20.0
- @voyantjs/hono@0.20.0

## 0.19.0

### Patch Changes

- Updated dependencies [714c544]
  - @voyantjs/bookings@0.19.0
  - @voyantjs/core@0.19.0
  - @voyantjs/db@0.19.0
  - @voyantjs/hono@0.19.0

## 0.18.0

### Minor Changes

- 8932f60: Make schema discovery declarative and unblock downstream `drizzle-kit generate` against published packages.

  **Exports — `default` condition added everywhere (fixes #380)**

  Every `@voyantjs/*` package's `publishConfig.exports` previously declared only `types` and `import`. drizzle-kit (and any CJS-based resolver) walked the `require` branch, hit nothing, and threw `ERR_PACKAGE_PATH_NOT_EXPORTED` on subpaths like `@voyantjs/db/schema`. Each subpath now also declares a `default` condition pointing at the same `.js` file, so downstream consumers can resolve subpaths and run their own `drizzle-kit generate` against the canonical runtime schema.

  **Operator template baseline regenerated (fixes #378, #379)**

  `templates/operator/migrations/0000_striped_jubilee.sql` was missing `bookings.fx_rate_set_id` (causing `GET /v1/admin/bookings` to 500), and `@voyantjs/cruises`'s 14 tables had never made it into any baseline. Added `@voyantjs/cruises` to `templates/operator/drizzle.config.ts` and emitted `0004_steady_molten_man.sql` covering all drift (cruise tables/enums, the missing `fx_rate_set_id`, idempotency keys, vouchers, voucher redemptions, the `accessibility_needs` → encrypted-jsonb move, several check constraints, new enum values). Pruned 7 stale orphan migrations that were on disk but not in `_journal.json`. Schema baseline + runtime now match — `drizzle-kit generate` against a freshly migrated DB returns "No schema changes".

  **One `./schema` per module — sub-paths removed (BREAKING)**

  Each module now exposes exactly one schema entrypoint, `./schema`, that re-exports everything DB-related the module owns. Granular sub-paths are deleted from `exports` and `publishConfig.exports`:

  - `@voyantjs/bookings/schema/travel-details` → fold into `@voyantjs/bookings/schema`
  - `@voyantjs/legal/contracts/schema` and `@voyantjs/legal/policies/schema` → fold into the new `@voyantjs/legal/schema`
  - `@voyantjs/{products,crm,cruises,distribution,transactions,charters}/schema` now also re-export the pgTables declared inside `./booking-extension`. The runtime `./booking-extension` HonoExtension export is unchanged.

  Consumers importing from any of the removed sub-paths must switch to the consolidated `./schema` import.

  **Declarative dependency graph in `package.json`**

  Every module package gained a `voyant: { schema, requiresSchemas: [...] }` block declaring its schema entrypoint and the other modules' schemas it needs at the SQL level (e.g. `hospitality` requires `facilities` and `bookings`; `ground` requires `facilities` and `identity`; `suppliers` requires `facilities`; everyone implicitly requires `db`). The CLI reads this block to compute the dependency closure for a project.

  **`@voyantjs/cli` — `resolveSchemas` helper + `voyant db schemas` command**

  New `@voyantjs/cli/drizzle` entrypoint exporting `resolveSchemas(config, options?)` — walks `voyant.requiresSchemas` transitively from the modules listed in `voyant.config.ts`, dedupes, returns specifier strings (default) or absolute file paths (`style: "file"`). Throws on circular dependencies. New `voyant db schemas` debug command prints the resolved closure.

  ```ts
  // drizzle.config.ts
  import { defineConfig } from "drizzle-kit";
  import { resolveSchemas } from "@voyantjs/cli/drizzle";
  import voyantConfig from "./voyant.config";

  export default defineConfig({
    schema: resolveSchemas(voyantConfig),
    out: "./migrations",
    dialect: "postgresql",
    dbCredentials: { url: process.env.DATABASE_URL! },
  });
  ```

  Adding a new module to `voyant.config.ts` now picks up its schema (and transitive schema deps) automatically — no more manual schema lists, no forgotten modules.

  **Migration impact for existing operator deployments**

  Apply `0004_steady_molten_man.sql` (column + new tables, non-destructive aside from the deliberate `accessibility_needs` text → encrypted-jsonb move) and `0005_condemned_nomad.sql` (cruise booking-extension tables — only relevant when the cruises module is mounted).

### Patch Changes

- Updated dependencies [8932f60]
  - @voyantjs/bookings@0.18.0
  - @voyantjs/core@0.18.0
  - @voyantjs/db@0.18.0
  - @voyantjs/hono@0.18.0

## 0.17.0

### Patch Changes

- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
  - @voyantjs/bookings@0.17.0
  - @voyantjs/core@0.17.0
  - @voyantjs/db@0.17.0
  - @voyantjs/hono@0.17.0

## 0.16.0

### Patch Changes

- @voyantjs/bookings@0.16.0
- @voyantjs/core@0.16.0
- @voyantjs/db@0.16.0
- @voyantjs/hono@0.16.0

## 0.15.0

### Patch Changes

- @voyantjs/bookings@0.15.0
- @voyantjs/core@0.15.0
- @voyantjs/db@0.15.0
- @voyantjs/hono@0.15.0

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

  **`@voyantjs/ui`** (registry only — versionless): adds the `voyant-cruises-*` shadcn registry components — `external-badge`, `cruise-card`, `cruise-list`, `pricing-grid` (the load-bearing cabin × occupancy matrix), `quote-display`, `enrichment-program-list`. Install via `shadcn add voyant-cruises-cruise-card` etc.

  **Example app** (`examples/nextjs-booking-portal`): adds `/cruises` listing + `/cruises/[slug]` detail pages backed by `/v1/public/cruises`, with mock data showing the local-vs-external dual-source UI.

  **Design doc**: full rationale, schema, and architecture in `docs/architecture/cruises-module.md` (745 lines).

### Patch Changes

- Updated dependencies [944d244]
- Updated dependencies [cc561ce]
  - @voyantjs/bookings@0.12.0
  - @voyantjs/core@0.12.0
  - @voyantjs/db@0.12.0
  - @voyantjs/hono@0.12.0

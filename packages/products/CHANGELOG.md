# @voyantjs/products

## 0.21.1

### Patch Changes

- @voyantjs/catalog@0.21.1
- @voyantjs/core@0.21.1
- @voyantjs/db@0.21.1
- @voyantjs/hono@0.21.1
- @voyantjs/storage@0.21.1
- @voyantjs/utils@0.21.1

## 0.21.0

### Minor Changes

- 6427bad: Release the booking journey architecture train.

  This adds booking hold policy support, richer traveler and booking journey flows, operator tax policy configuration, finance billing and tax policy APIs, notification reminder target and delivery tooling, and the template/runtime wiring needed for the operator storefront checkout flow.

### Patch Changes

- Updated dependencies [6427bad]
  - @voyantjs/catalog@0.21.0
  - @voyantjs/core@0.21.0
  - @voyantjs/db@0.21.0
  - @voyantjs/hono@0.21.0
  - @voyantjs/storage@0.21.0
  - @voyantjs/utils@0.21.0

## 0.20.0

### Patch Changes

- @voyantjs/catalog@0.20.0
- @voyantjs/core@0.20.0
- @voyantjs/db@0.20.0
- @voyantjs/hono@0.20.0
- @voyantjs/storage@0.20.0
- @voyantjs/utils@0.20.0

## 0.19.0

### Patch Changes

- Updated dependencies [714c544]
  - @voyantjs/core@0.19.0
  - @voyantjs/db@0.19.0
  - @voyantjs/hono@0.19.0
  - @voyantjs/storage@0.19.0
  - @voyantjs/utils@0.19.0

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
  - @voyantjs/core@0.18.0
  - @voyantjs/db@0.18.0
  - @voyantjs/hono@0.18.0
  - @voyantjs/storage@0.18.0
  - @voyantjs/utils@0.18.0

## 0.17.0

### Minor Changes

- 66d722d: `GET /v1/products` now accepts three new optional query params: `productTypeId` (direct equality on `products.product_type_id`), `categoryId` (`EXISTS` subquery against `product_category_products`), and `tag` (Postgres jsonb `@>` containment on `products.tags`).

  `ProductsListFilters` in `@voyantjs/products-react/src/query-keys.ts` mirrors the new fields, and `getProductsQueryOptions` forwards them as URL query params. Consumers organising products by type (admin sidebars per travel-type, storefront category pages) can now filter server-side instead of fetching everything and filtering client-side.

### Patch Changes

- 66d722d: Export `destinations`, `destinationTranslations`, and `productDestinations` from the `@voyantjs/products` barrel. They were defined in `schema-taxonomy.ts` and re-exported from `schema.ts` but missing from the public `index.ts`. Consumers walking the destination tree (CRM analytics, search indexers, country-tag derivation) can now import from the package root instead of using deep paths or raw SQL.
- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
  - @voyantjs/core@0.17.0
  - @voyantjs/db@0.17.0
  - @voyantjs/hono@0.17.0
  - @voyantjs/storage@0.17.0
  - @voyantjs/utils@0.17.0

## 0.16.0

### Patch Changes

- a4bc773: Templates now default to Voyant Cloud SDK for browser-rendering (PDF brochures) and video uploads. Both are swappable per-template by editing the helper file.

  **`@voyantjs/voyant-cloud`**: bump `@voyantjs/cloud-sdk` peer to `^0.4.0` to access browser/video APIs. Re-export the new types (`BrowserPdfInput`, `BrowserPdfOptions`, `BrowserViewport`, `BrowserGoToOptions`, `BrowserScrapeInput`, `BrowserScreenshotInput`, `BrowserSnapshotResult`, `CreateVideoUploadInput`, `CreateVideoFromUrlInput`, `UpdateVideoInput`, `UploadVideoCaptionInput`, `VideoSummary`, `VideoUploadTicket`, etc.) so consumers only need one import.

  **`@voyantjs/products`**: expose `brochureBodyToHtml` from `tasks/` so consumers can compose their own printer. Previously it was internal to `brochure-printers.ts`.

  **Templates** (`dmc`, `operator`): two new helpers per template, both intentionally cleanly named so the underlying provider is swappable.

  - `src/lib/brochure-printer.ts` — `createProductBrochurePrinter(env)` returns a `ProductBrochurePrinter` that calls `client.browser.pdf({...})`. Replaces the basic pdf-lib path in `workflows.ts → products.generate-pdf`.
  - `src/lib/video-uploads.ts` — `createVideoUploadTicket(env, input)` returns a TUS upload ticket from `client.video.videos.createUpload(...)`. Wired into a new `POST /v1/uploads/video` route. The existing `POST /v1/uploads` keeps handling images/documents through the configured media storage provider (R2 by default).

  To switch providers, edit the helper body — e.g., to use direct Cloudflare API for PDFs, drop in `createCloudflareBrowserProductBrochurePrinterFromEnv`. To use a different video host, return your own TUS ticket shape.

  - @voyantjs/core@0.16.0
  - @voyantjs/db@0.16.0
  - @voyantjs/hono@0.16.0
  - @voyantjs/storage@0.16.0
  - @voyantjs/utils@0.16.0

## 0.15.0

### Patch Changes

- @voyantjs/core@0.15.0
- @voyantjs/db@0.15.0
- @voyantjs/hono@0.15.0
- @voyantjs/storage@0.15.0
- @voyantjs/utils@0.15.0

## 0.14.0

### Patch Changes

- @voyantjs/core@0.14.0
- @voyantjs/db@0.14.0
- @voyantjs/hono@0.14.0
- @voyantjs/storage@0.14.0
- @voyantjs/utils@0.14.0

## 0.13.0

### Patch Changes

- @voyantjs/core@0.13.0
- @voyantjs/db@0.13.0
- @voyantjs/hono@0.13.0
- @voyantjs/storage@0.13.0
- @voyantjs/utils@0.13.0

## 0.12.0

### Patch Changes

- Updated dependencies [944d244]
- Updated dependencies [cc561ce]
  - @voyantjs/core@0.12.0
  - @voyantjs/db@0.12.0
  - @voyantjs/hono@0.12.0
  - @voyantjs/storage@0.12.0
  - @voyantjs/utils@0.12.0

## 0.11.0

### Patch Changes

- @voyantjs/core@0.11.0
- @voyantjs/db@0.11.0
- @voyantjs/hono@0.11.0
- @voyantjs/storage@0.11.0
- @voyantjs/utils@0.11.0

## 0.10.0

### Patch Changes

- Updated dependencies [29a581a]
- Updated dependencies [b7f0501]
  - @voyantjs/core@0.10.0
  - @voyantjs/db@0.10.0
  - @voyantjs/hono@0.10.0
  - @voyantjs/storage@0.10.0
  - @voyantjs/utils@0.10.0

## 0.9.0

### Patch Changes

- @voyantjs/core@0.9.0
- @voyantjs/db@0.9.0
- @voyantjs/hono@0.9.0
- @voyantjs/storage@0.9.0
- @voyantjs/utils@0.9.0

## 0.8.0

### Patch Changes

- Updated dependencies [24dc253]
  - @voyantjs/core@0.8.0
  - @voyantjs/db@0.8.0
  - @voyantjs/hono@0.8.0
  - @voyantjs/storage@0.8.0
  - @voyantjs/utils@0.8.0

## 0.7.0

### Patch Changes

- @voyantjs/core@0.7.0
- @voyantjs/db@0.7.0
- @voyantjs/hono@0.7.0
- @voyantjs/storage@0.7.0
- @voyantjs/utils@0.7.0

## 0.6.9

### Patch Changes

- @voyantjs/core@0.6.9
- @voyantjs/db@0.6.9
- @voyantjs/hono@0.6.9
- @voyantjs/storage@0.6.9
- @voyantjs/utils@0.6.9

## 0.6.8

### Patch Changes

- b218885: Align products child-list indexes with the parent-and-sort query shapes used for
  options, units, features, FAQs, locations, itinerary days/services, versions,
  notes, category links, and destination links.
- b218885: Add global sort indexes for product feature, FAQ, and location admin lists that
  order by sort position and creation time without a parent filter.
- b218885: Add composite indexes for product feature and location admin lists that filter by
  type and order by sort position and creation time.
- b218885: Align remaining product list indexes with the current media, brochure, and taxonomy query shapes.
- b218885: add products public filter support indexes
- b218885: add products root list composite indexes
- b218885: add products settings admin list composite indexes
- b218885: Add global indexes for unscoped product settings admin lists.
- b218885: Align product taxonomy and destination indexes with active filter-and-sort list queries.
- b218885: Add global sort indexes for product type, category, and destination admin lists
  that order by taxonomy sort fields without parent or active filters.
- b218885: add products translation list composite indexes
- Updated dependencies [b218885]
  - @voyantjs/core@0.6.8
  - @voyantjs/db@0.6.8
  - @voyantjs/hono@0.6.8
  - @voyantjs/storage@0.6.8
  - @voyantjs/utils@0.6.8

## 0.6.7

### Patch Changes

- @voyantjs/core@0.6.7
- @voyantjs/db@0.6.7
- @voyantjs/hono@0.6.7
- @voyantjs/storage@0.6.7
- @voyantjs/utils@0.6.7

## 0.6.6

### Patch Changes

- @voyantjs/core@0.6.6
- @voyantjs/db@0.6.6
- @voyantjs/hono@0.6.6
- @voyantjs/storage@0.6.6
- @voyantjs/utils@0.6.6

## 0.6.5

### Patch Changes

- @voyantjs/core@0.6.5
- @voyantjs/db@0.6.5
- @voyantjs/hono@0.6.5
- @voyantjs/storage@0.6.5
- @voyantjs/utils@0.6.5

## 0.6.4

### Patch Changes

- @voyantjs/core@0.6.4
- @voyantjs/db@0.6.4
- @voyantjs/hono@0.6.4
- @voyantjs/storage@0.6.4
- @voyantjs/utils@0.6.4

## 0.6.3

### Patch Changes

- Updated dependencies [d3c6937]
  - @voyantjs/core@0.6.3
  - @voyantjs/db@0.6.3
  - @voyantjs/hono@0.6.3
  - @voyantjs/storage@0.6.3
  - @voyantjs/utils@0.6.3

## 0.6.2

### Patch Changes

- @voyantjs/core@0.6.2
- @voyantjs/db@0.6.2
- @voyantjs/hono@0.6.2
- @voyantjs/storage@0.6.2
- @voyantjs/utils@0.6.2

## 0.6.1

### Patch Changes

- @voyantjs/core@0.6.1
- @voyantjs/db@0.6.1
- @voyantjs/hono@0.6.1
- @voyantjs/storage@0.6.1
- @voyantjs/utils@0.6.1

## 0.6.0

### Patch Changes

- @voyantjs/core@0.6.0
- @voyantjs/db@0.6.0
- @voyantjs/hono@0.6.0
- @voyantjs/storage@0.6.0
- @voyantjs/utils@0.6.0

## 0.5.0

### Patch Changes

- Updated dependencies [ce72e29]
  - @voyantjs/core@0.5.0
  - @voyantjs/db@0.5.0
  - @voyantjs/hono@0.5.0
  - @voyantjs/storage@0.5.0
  - @voyantjs/utils@0.5.0

## 0.4.5

### Patch Changes

- Updated dependencies [e3f6e72]
  - @voyantjs/core@0.4.5
  - @voyantjs/db@0.4.5
  - @voyantjs/hono@0.4.5
  - @voyantjs/storage@0.4.5
  - @voyantjs/utils@0.4.5

## 0.4.4

### Patch Changes

- @voyantjs/core@0.4.4
- @voyantjs/db@0.4.4
- @voyantjs/hono@0.4.4
- @voyantjs/storage@0.4.4
- @voyantjs/utils@0.4.4

## 0.4.3

### Patch Changes

- @voyantjs/core@0.4.3
- @voyantjs/db@0.4.3
- @voyantjs/hono@0.4.3
- @voyantjs/storage@0.4.3
- @voyantjs/utils@0.4.3

## 0.4.2

### Patch Changes

- @voyantjs/core@0.4.2
- @voyantjs/db@0.4.2
- @voyantjs/hono@0.4.2
- @voyantjs/storage@0.4.2
- @voyantjs/utils@0.4.2

## 0.4.1

### Patch Changes

- @voyantjs/core@0.4.1
- @voyantjs/db@0.4.1
- @voyantjs/hono@0.4.1
- @voyantjs/storage@0.4.1
- @voyantjs/utils@0.4.1

## 0.4.0

### Minor Changes

- e84fe0f: Add code-authored brochure templates and pluggable brochure printers. Products now export Liquid-compatible brochure template helpers, a bundled basic PDF printer, and a Cloudflare Browser printer adapter so apps can generate canonical brochure versions without carrying their own rendering glue.
- e84fe0f: Add first-class brochure version history for products.

  Each brochure upsert now creates a new version, products keep one current
  brochure, admins can list brochure versions, promote an older version, and
  delete individual brochure versions without losing the rest of the history.

- e84fe0f: Add a lightweight destination taxonomy with translations and product links. Products now expose admin destination CRUD/link routes plus public catalog destination filters and destination list responses so storefronts can route and filter on shared destination semantics instead of raw product locations alone.

### Patch Changes

- e84fe0f: Add a first-class product brochure workflow.

  Products now support canonical brochure persistence via `GET/PUT/DELETE
/v1/products/:id/brochure` and `GET /v1/public/products/:id/brochure`, with
  public catalog detail exposing `brochure` separately from the normal media
  gallery. The package also exports `generateAndStoreProductBrochure()` so apps
  can generate a PDF brochure, upload it through a Voyant storage provider, and
  register it as the canonical brochure without keeping an app-local convention.

- e84fe0f: Add a reusable internal catalog hydration and search-document helper to the
  products package.

  Changes:

  - add `catalogProductsService.hydrateProducts()` for shared localized product
    hydration outside the public route module
  - add `catalogProductsService.listSearchDocuments()` and
    `getSearchDocumentByProductId()` for locale-aware indexing/search jobs
  - export catalog search-document schemas and localized catalog product schemas
  - switch `publicProductsService` to use the shared catalog hydrator so
    translation/category/tag/media joins stay aligned between public routes and
    internal indexing workflows

- e84fe0f: Add location-aware public catalog listing support.

  Public catalog product list queries now support filtering by `locationTitle`,
  `locationCity`, `locationCountryCode`, and `locationType`, and public catalog
  product summaries now include typed `locations` so storefront list pages do not
  need to hydrate full product detail just to render basic destination/location
  metadata.

- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [2d5f323]
- Updated dependencies [e84fe0f]
  - @voyantjs/core@0.4.0
  - @voyantjs/db@0.4.0
  - @voyantjs/hono@0.4.0
  - @voyantjs/storage@0.4.0
  - @voyantjs/utils@0.4.0

## 0.3.1

### Patch Changes

- 8566f2d: Advance the public storefront surface with phone contact-exists support in the
  customer portal, default-template and preview helpers in legal, localized slug
  and SEO catalog fields in products, and a new config-backed storefront settings
  module for booking/account pages.
- 8566f2d: Republish the public storefront package surfaces so published tarballs match the
  current source tree. This release restores the public finance schemas needed by
  `@voyantjs/finance-react`, publishes the public booking and product service
  exports already present in source, and ships the day/version/media product React
  exports from the package root.
- Updated dependencies [8566f2d]
- Updated dependencies [8566f2d]
  - @voyantjs/core@0.3.1
  - @voyantjs/db@0.3.1
  - @voyantjs/hono@0.3.1

## 0.3.0

### Patch Changes

- @voyantjs/core@0.3.0
- @voyantjs/db@0.3.0
- @voyantjs/hono@0.3.0

## 0.2.0

### Patch Changes

- @voyantjs/core@0.2.0
- @voyantjs/db@0.2.0
- @voyantjs/hono@0.2.0

## 0.1.1

### Patch Changes

- @voyantjs/core@0.1.1
- @voyantjs/db@0.1.1
- @voyantjs/hono@0.1.1

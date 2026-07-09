# @voyant-travel/inventory-react

## 0.31.0

### Patch Changes

- Updated dependencies [a97e845]
  - @voyant-travel/admin@0.120.0
  - @voyant-travel/catalog-react@0.147.0
  - @voyant-travel/finance-react@0.149.0
  - @voyant-travel/finance@0.149.0
  - @voyant-travel/inventory@0.7.9

## 0.30.0

### Patch Changes

- Updated dependencies [8a665f3]
  - @voyant-travel/admin@0.119.0
  - @voyant-travel/catalog-react@0.146.0
  - @voyant-travel/finance-react@0.148.0
  - @voyant-travel/finance@0.148.0
  - @voyant-travel/inventory@0.7.8

## 0.29.0

### Patch Changes

- @voyant-travel/admin@0.118.0
- @voyant-travel/catalog-react@0.145.0
- @voyant-travel/finance-react@0.147.0
- @voyant-travel/finance@0.147.0
- @voyant-travel/inventory@0.7.7

## 0.28.0

### Patch Changes

- Updated dependencies [ecdf0fc]
  - @voyant-travel/admin@0.117.0
  - @voyant-travel/catalog-react@0.144.0
  - @voyant-travel/finance-react@0.146.0
  - @voyant-travel/finance@0.146.0
  - @voyant-travel/inventory@0.7.6

## 0.27.0

### Patch Changes

- @voyant-travel/inventory@0.7.5
- @voyant-travel/catalog-react@0.143.0
- @voyant-travel/finance-react@0.145.0
- @voyant-travel/finance@0.145.0

## 0.26.0

### Patch Changes

- @voyant-travel/finance@0.144.0
- @voyant-travel/finance-react@0.144.0
- @voyant-travel/catalog-react@0.142.0
- @voyant-travel/inventory@0.7.4

## 0.25.0

### Patch Changes

- Updated dependencies [425f92e]
  - @voyant-travel/utils@0.106.0
  - @voyant-travel/inventory@0.7.3
  - @voyant-travel/finance@0.143.0
  - @voyant-travel/ui@0.108.11
  - @voyant-travel/types@0.107.1
  - @voyant-travel/catalog-react@0.141.0
  - @voyant-travel/finance-react@0.143.0

## 0.24.0

### Patch Changes

- @voyant-travel/inventory@0.7.2
- @voyant-travel/catalog-react@0.140.0
- @voyant-travel/finance-react@0.142.0
- @voyant-travel/finance@0.142.0

## 0.23.1

### Patch Changes

- e6cad60: Route reusable upload and payment-link actions through the Voyant React provider API base and fetcher so split-origin deployments do not fall back to relative `/api` URLs.
- Updated dependencies [e6cad60]
  - @voyant-travel/finance-react@0.141.1
  - @voyant-travel/finance@0.141.1

## 0.23.0

### Patch Changes

- Updated dependencies [6711f4c]
  - @voyant-travel/catalog-react@0.139.0
  - @voyant-travel/inventory@0.7.1
  - @voyant-travel/finance-react@0.141.0
  - @voyant-travel/finance@0.141.0

## 0.22.0

### Patch Changes

- Updated dependencies [62e87ee]
- Updated dependencies [8405bee]
  - @voyant-travel/admin@0.116.0
  - @voyant-travel/i18n@0.110.0
  - @voyant-travel/inventory@0.7.0
  - @voyant-travel/catalog-react@0.138.0
  - @voyant-travel/finance-react@0.140.0
  - @voyant-travel/finance@0.140.0

## 0.21.0

### Patch Changes

- Updated dependencies [c9a356f]
- Updated dependencies [fc71db1]
- Updated dependencies [fc71db1]
- Updated dependencies [77f139b]
  - @voyant-travel/types@0.107.0
  - @voyant-travel/finance@0.139.0
  - @voyant-travel/inventory@0.6.0
  - @voyant-travel/admin@0.115.4
  - @voyant-travel/finance-react@0.139.0
  - @voyant-travel/utils@0.105.6
  - @voyant-travel/catalog-react@0.137.0

## 0.20.0

### Patch Changes

- @voyant-travel/catalog-react@0.136.0
- @voyant-travel/finance-react@0.138.0
- @voyant-travel/finance@0.138.0
- @voyant-travel/inventory@0.5.13

## 0.19.5

### Patch Changes

- ea21ebc: Start product detail summaries on the product default/base language instead of
  auto-selecting the first or operator-locale translation.
- Updated dependencies [5c1294f]
  - @voyant-travel/inventory@0.5.11

## 0.19.4

### Patch Changes

- ad02eae: Reject non-image product media as cover media and surface brochure generation failures in the product detail UI.
- Updated dependencies [a10b9ba]
- Updated dependencies [e005c4d]
- Updated dependencies [ad02eae]
  - @voyant-travel/inventory@0.5.10
  - @voyant-travel/i18n@0.109.5

## 0.19.3

### Patch Changes

- 16ec0cb: Render saved additional rate-plan room/category prices in the admin product detail grid and label the price controls for assistive technology.
- Updated dependencies [66ac9f3]
- Updated dependencies [16ec0cb]
- Updated dependencies [c1d45bc]
- Updated dependencies [7bdd9cc]
  - @voyant-travel/ui@0.108.8
  - @voyant-travel/i18n@0.109.4
  - @voyant-travel/catalog-react@0.135.7
  - @voyant-travel/finance@0.137.8
  - @voyant-travel/finance-react@0.137.8

## 0.19.2

### Patch Changes

- cbd5046: Republish the product-detail entrypoint with the canonical query-option exports in the published package.

## 0.19.1

### Patch Changes

- 9a1197b: Move the operator media upload and serve routes off the bare `/v1/*` surface and onto `/v1/admin/*`.

  Uploads now post to `/v1/admin/uploads` and video tickets to `/v1/admin/uploads/video`; stored media is served from `/v1/admin/media/*`. The Hono app no longer mounts the bare `/v1/*` catch-all actor guard, and worker-runtime hosts can use `rewriteAppPath` to preserve compatibility for persisted legacy media URLs.

- Updated dependencies [9a1197b]
  - @voyant-travel/finance-react@0.137.1
  - @voyant-travel/finance@0.137.1
  - @voyant-travel/inventory@0.5.6
  - @voyant-travel/catalog-react@0.135.1

## 0.19.0

### Patch Changes

- @voyant-travel/finance@0.137.0
- @voyant-travel/inventory@0.5.5
- @voyant-travel/catalog-react@0.135.0
- @voyant-travel/finance-react@0.137.0

## 0.18.2

### Patch Changes

- 12a1eb2: Expose client-safe subpaths for validation schemas, linkable metadata, template authoring metadata, finance payment-policy primitives, and Hono reporter utilities. Move browser-facing React/operator imports off mixed runtime barrels so client bundles do not pull Hono request context or other server-only runtime code.
- Updated dependencies [12a1eb2]
  - @voyant-travel/finance@0.136.2
  - @voyant-travel/finance-react@0.136.2
  - @voyant-travel/inventory@0.5.4

## 0.18.1

### Patch Changes

- Updated dependencies [7cb6fa7]
  - @voyant-travel/i18n@0.109.0
  - @voyant-travel/admin@0.115.2
  - @voyant-travel/catalog-react@0.134.1
  - @voyant-travel/finance-react@0.136.1
  - @voyant-travel/ui@0.108.2
  - @voyant-travel/finance@0.136.1

## 0.18.0

### Patch Changes

- @voyant-travel/inventory@0.5.3
- @voyant-travel/finance-react@0.136.0
- @voyant-travel/catalog-react@0.134.0
- @voyant-travel/finance@0.136.0

## 0.17.0

### Patch Changes

- @voyant-travel/inventory@0.5.2
- @voyant-travel/finance-react@0.135.0
- @voyant-travel/catalog-react@0.133.0
- @voyant-travel/finance@0.135.0

## 0.16.1

### Patch Changes

- ba91645: Fix the product translation language picker so the "Add language" search box
  filters as you type. `LanguageCombobox` now feeds its options to the underlying
  combobox via `items` + `ComboboxCollection` with a `filter` that matches on both
  the language name and code, instead of rendering the full unfiltered list.

## 0.16.0

### Minor Changes

- 51f7dea: Share one list-response contract instead of per-module copies (voyant#2109).

  `@voyant-travel/types` now owns the canonical offset-paginated list envelope: the `ListResponse<T>` type + `listResponse(data, { total, limit, offset })` builder, plus the zod `paginationSchema` (coerced `limit` 1–200 default 50, `offset` ≥0 default 0) and the `listResponseSchema(item)` factory. Both server services and `*-react` clients import from this single source.

  Server side: every module's local `paginate()` / inline `{ data, total, limit, offset }` construction now routes through the shared `listResponse` builder, and the count read is standardized on `count` internally — fixing the drift where finance, notifications and the legal contracts/policies services read `countResult[0]?.total` while every other module read `countResult[0]?.count` (their `count(*)` selects were aliased `total`; they are now aliased `count`). The returned shape is byte-for-byte identical.

  Client side: the ~23 copied `paginatedEnvelope` zod schemas across the `*-react` packages are replaced by re-exporting the shared `listResponseSchema` factory under the same `paginatedEnvelope` name, so consumers are unchanged.

  Input alignment: `finance-contracts` and `legal-contracts` pagination `limit` caps were raised from `.max(100)` to `.max(200)` to match the framework-wide max.

  Additive and non-breaking.

### Patch Changes

- Updated dependencies [51f7dea]
- Updated dependencies [0a0a014]
  - @voyant-travel/types@0.106.0
  - @voyant-travel/finance@0.134.0
  - @voyant-travel/inventory@0.5.0
  - @voyant-travel/finance-react@0.134.0
  - @voyant-travel/admin@0.115.1
  - @voyant-travel/utils@0.105.4
  - @voyant-travel/catalog-react@0.132.0

## 0.15.0

### Patch Changes

- Updated dependencies [4abf9a2]
  - @voyant-travel/admin@0.115.0
  - @voyant-travel/i18n@0.108.0
  - @voyant-travel/utils@0.105.3
  - @voyant-travel/finance@0.133.0
  - @voyant-travel/inventory@0.4.7
  - @voyant-travel/catalog-react@0.131.0
  - @voyant-travel/finance-react@0.133.0
  - @voyant-travel/ui@0.108.1

## 0.14.0

### Patch Changes

- @voyant-travel/catalog-react@0.130.0
- @voyant-travel/inventory@0.4.6
- @voyant-travel/finance-react@0.132.0
- @voyant-travel/finance@0.132.0

## 0.13.2

### Patch Changes

- ba89f0b: Let admin departure edits choose and persist a product option so existing departures with a missing option can be repaired from the UI. Explicit slot option links are now validated against the slot product while product-level generated slots can still omit an option.
- Updated dependencies [ba89f0b]
  - @voyant-travel/i18n@0.107.4

## 0.13.1

### Patch Changes

- fcd2e0b: Add itinerary and day-service translation authoring surfaces, and localize owned itinerary content projection for translated days and service labels.
- Updated dependencies [fcd2e0b]
  - @voyant-travel/inventory@0.4.4

## 0.13.0

### Patch Changes

- Updated dependencies [310565b]
  - @voyant-travel/i18n@0.107.3
  - @voyant-travel/finance-react@0.131.0
  - @voyant-travel/catalog-react@0.129.0
  - @voyant-travel/finance@0.131.0
  - @voyant-travel/inventory@0.4.3

## 0.12.0

### Patch Changes

- Updated dependencies [dbea53e]
  - @voyant-travel/i18n@0.107.2
  - @voyant-travel/finance-react@0.130.0
  - @voyant-travel/catalog-react@0.128.0
  - @voyant-travel/finance@0.130.0
  - @voyant-travel/inventory@0.4.2

## 0.11.0

### Patch Changes

- @voyant-travel/inventory@0.4.1
- @voyant-travel/catalog-react@0.127.0
- @voyant-travel/finance-react@0.129.0
- @voyant-travel/finance@0.129.0

## 0.10.0

### Patch Changes

- Updated dependencies [9c47b00]
  - @voyant-travel/inventory@0.4.0
  - @voyant-travel/catalog-react@0.126.0
  - @voyant-travel/finance-react@0.128.0
  - @voyant-travel/finance@0.128.0

## 0.9.0

### Patch Changes

- @voyant-travel/inventory@0.3.9
- @voyant-travel/finance@0.127.0
- @voyant-travel/finance-react@0.127.0
- @voyant-travel/catalog-react@0.125.0

## 0.8.0

### Patch Changes

- @voyant-travel/inventory@0.3.6
- @voyant-travel/catalog-react@0.124.0
- @voyant-travel/finance-react@0.126.0
- @voyant-travel/finance@0.126.0

## 0.7.0

### Patch Changes

- Updated dependencies [a74471e]
- Updated dependencies [a74471e]
  - @voyant-travel/i18n@0.107.0
  - @voyant-travel/ui@0.108.0
  - @voyant-travel/admin@0.114.0
  - @voyant-travel/catalog-react@0.123.0
  - @voyant-travel/finance-react@0.125.0
  - @voyant-travel/inventory@0.3.5
  - @voyant-travel/finance@0.125.0

## 0.6.0

### Patch Changes

- 4f92198: Voyant 1.0 visual refactor of the framework UI.

  - **Tokens** (`@voyant-travel/ui` `globals.css`): warm off-white paper, near-black ink, and a single hot-orange brand accent (`--brand`, new token) reserved for charts/focus/active state. Inter Tight type. Fixed brand chart palette (`--chart-1..5`). A coherent radius system: controls + their dropdowns at `rounded-sm` (4px), cards/table surfaces at `rounded-md` (6px), dialogs/sheets at `rounded-xl`.
  - **`@voyant-travel/ui` components**: new `SegmentedControl`; `Button` gains a `brand` variant; sharper, consistent radii across Button/Input/Select/Combobox/Textarea/Toggle/Tabs/Menus/Command/Card/DataTable/Badge; bordered active sidebar items (primary + sub) and inset-panel border; assorted fixes (Command search-input radius, toggle-group corners, sidebar sub-menu spacing).
  - **`@voyant-travel/admin`**: Voyant 1.0 brand logo lockup (composed mark + wordmark, collapse-to-badge); operator shell defaults to the inset sidebar layout; dashboard KPI cards, brand chart colors, and Figma-matched sidebar (bordered active item, near-black nav text, bordered user card with open-state).
  - **Domain `*-react` packages**: card surfaces normalized to the new `rounded-md` radius; flights search bar (trip-type toggle, route cards, airport dropdown) and the resources tabs aligned to the system.

- Updated dependencies [4f92198]
- Updated dependencies [4f92198]
  - @voyant-travel/finance-react@0.124.0
  - @voyant-travel/ui@0.107.0
  - @voyant-travel/admin@0.113.0
  - @voyant-travel/catalog-react@0.122.0
  - @voyant-travel/finance@0.124.0
  - @voyant-travel/inventory@0.3.4

## 0.5.0

### Patch Changes

- Updated dependencies [94890c3]
- Updated dependencies [e9d9dbb]
- Updated dependencies [cb9b04b]
  - @voyant-travel/admin@0.112.0
  - @voyant-travel/finance@0.123.0
  - @voyant-travel/catalog-react@0.121.0
  - @voyant-travel/finance-react@0.123.0
  - @voyant-travel/inventory@0.3.3

## 0.4.0

### Patch Changes

- Updated dependencies [c9de9c4]
- Updated dependencies [14f4234]
- Updated dependencies [89d4ca9]
- Updated dependencies [51dd276]
  - @voyant-travel/finance@0.122.0
  - @voyant-travel/finance-react@0.122.0
  - @voyant-travel/inventory@0.3.1
  - @voyant-travel/catalog-react@0.120.0

## 0.3.0

### Patch Changes

- Updated dependencies [13fe70b]
- Updated dependencies [13fe70b]
  - @voyant-travel/finance@0.121.0
  - @voyant-travel/inventory@0.3.0
  - @voyant-travel/finance-react@0.121.0
  - @voyant-travel/catalog-react@0.119.0

## 0.2.2

### Patch Changes

- ecec979: Improve operator bundle boundaries by adding route-local admin message provider support, exposing admin extension route helpers, keeping pending skeletons structural, and tightening Vite route ignores and vendor chunk splitting so heavy admin route dependencies stay out of the initial entry.
- Updated dependencies [ecec979]
  - @voyant-travel/admin@0.111.3
  - @voyant-travel/finance-react@0.120.2
  - @voyant-travel/finance@0.120.2

## 0.2.1

### Patch Changes

- eef1a00: Republish notification and UI consumer packages so stale beta artifacts no longer reference legacy notification package specifiers.
- Updated dependencies [eef1a00]
  - @voyant-travel/admin@0.111.2
  - @voyant-travel/catalog-react@0.118.1
  - @voyant-travel/finance-react@0.120.1
  - @voyant-travel/finance@0.120.1

## 0.2.0

### Minor Changes

- 3cc83b6: Move extras runtime and React source behind Inventory and Bookings owner
  subpaths. The old runtime and React extras package names are removed from v1;
  first-party imports use the Inventory and Bookings owner paths.
- 65b3782: Add optional Inventory package entrypoints for operated product authoring and
  Inventory React authoring UI surfaces.
- a101971: Move the main operated Product route/service/schema/runtime and React
  authoring source under Inventory owner paths. The old Products runtime package
  names are removed from the v1 workspace surface, while the operator keeps
  stable `/products` API URLs backed by Inventory.

### Patch Changes

- 3408b2a: Move availability, allocation UI, resources, ground logistics, and places source
  under Operations owner paths. The old operated-execution package names are
  removed from the v1 workspace surface while first-party runtime, React, and
  operator imports use `@voyant-travel/operations` and `@voyant-travel/operations-react`
  surfaces.
- 47fef18: Retarget first-party imports from the removed beta package names to their owner
  packages. Operated product UI now imports Inventory React, commercial UI imports
  Commerce React, supplier UI imports Distribution React, checkout UI imports
  Finance React, and operated place/availability schema references import
  Operations owner paths.
- Updated dependencies [dd71543]
- Updated dependencies [3cc83b6]
- Updated dependencies [0fa993c]
- Updated dependencies [9e970a5]
- Updated dependencies [b711b04]
- Updated dependencies [3408b2a]
- Updated dependencies [7ea516a]
- Updated dependencies [65b3782]
- Updated dependencies [a101971]
- Updated dependencies [47fef18]
- Updated dependencies [6196b3b]
  - @voyant-travel/admin@0.111.1
  - @voyant-travel/inventory@0.2.0
  - @voyant-travel/finance@0.120.0
  - @voyant-travel/finance-react@0.120.0
  - @voyant-travel/catalog-react@0.118.0

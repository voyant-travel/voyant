# @voyant-travel/operations-react

## 0.19.2

### Patch Changes

- 3a14bd5: Expose resources admin edit and pool membership workflows, preserve resources list state across detail navigation, and improve assignment slot labels with product context.
- Updated dependencies [9f3ffdf]
- Updated dependencies [3e81078]
  - @voyant-travel/bookings-react@0.138.7

## 0.19.1

### Patch Changes

- f1090b7: Align resource assignment detail schemas around `assignedAt`, reject orphan or incoherent slot assignment lifecycle payloads, and surface assignment target validation in the admin UI.
- 42f662c: Reject inverted, duplicate, and overlapping resource closeout windows and surface matching admin form validation.
- Updated dependencies [f1090b7]
- Updated dependencies [42f662c]
- Updated dependencies [fead555]
  - @voyant-travel/operations@0.5.9
  - @voyant-travel/i18n@0.109.8
  - @voyant-travel/bookings-react@0.138.6

## 0.19.0

### Patch Changes

- @voyant-travel/bookings-react@0.138.0
- @voyant-travel/inventory-react@0.20.0
- @voyant-travel/operations@0.5.6

## 0.18.1

### Patch Changes

- fe6d8cf: Use the mounted availability product route prefix for resource-template mutations and open-slot materialization.

## 0.18.0

### Patch Changes

- @voyant-travel/operations@0.5.2
- @voyant-travel/bookings-react@0.137.0
- @voyant-travel/inventory-react@0.19.0

## 0.17.2

### Patch Changes

- 12a1eb2: Expose client-safe subpaths for validation schemas, linkable metadata, template authoring metadata, finance payment-policy primitives, and Hono reporter utilities. Move browser-facing React/operator imports off mixed runtime barrels so client bundles do not pull Hono request context or other server-only runtime code.
- Updated dependencies [12a1eb2]
  - @voyant-travel/inventory-react@0.18.2
  - @voyant-travel/operations@0.5.1
  - @voyant-travel/bookings-react@0.136.2

## 0.17.1

### Patch Changes

- Updated dependencies [7cb6fa7]
  - @voyant-travel/i18n@0.109.0
  - @voyant-travel/admin@0.115.2
  - @voyant-travel/bookings-react@0.136.1
  - @voyant-travel/inventory-react@0.18.1
  - @voyant-travel/ui@0.108.2

## 0.17.0

### Patch Changes

- Updated dependencies [787c852]
  - @voyant-travel/operations@0.5.0
  - @voyant-travel/bookings-react@0.136.0
  - @voyant-travel/inventory-react@0.18.0

## 0.16.0

### Patch Changes

- Updated dependencies [924d201]
- Updated dependencies [f311826]
  - @voyant-travel/operations@0.4.0
  - @voyant-travel/bookings-react@0.135.0
  - @voyant-travel/inventory-react@0.17.0

## 0.15.0

### Minor Changes

- 51f7dea: Share one list-response contract instead of per-module copies (voyant#2109).

  `@voyant-travel/types` now owns the canonical offset-paginated list envelope: the `ListResponse<T>` type + `listResponse(data, { total, limit, offset })` builder, plus the zod `paginationSchema` (coerced `limit` 1–200 default 50, `offset` ≥0 default 0) and the `listResponseSchema(item)` factory. Both server services and `*-react` clients import from this single source.

  Server side: every module's local `paginate()` / inline `{ data, total, limit, offset }` construction now routes through the shared `listResponse` builder, and the count read is standardized on `count` internally — fixing the drift where finance, notifications and the legal contracts/policies services read `countResult[0]?.total` while every other module read `countResult[0]?.count` (their `count(*)` selects were aliased `total`; they are now aliased `count`). The returned shape is byte-for-byte identical.

  Client side: the ~23 copied `paginatedEnvelope` zod schemas across the `*-react` packages are replaced by re-exporting the shared `listResponseSchema` factory under the same `paginatedEnvelope` name, so consumers are unchanged.

  Input alignment: `finance-contracts` and `legal-contracts` pagination `limit` caps were raised from `.max(100)` to `.max(200)` to match the framework-wide max.

  Additive and non-breaking.

### Patch Changes

- Updated dependencies [51f7dea]
  - @voyant-travel/operations@0.3.0
  - @voyant-travel/bookings-react@0.134.0
  - @voyant-travel/inventory-react@0.16.0
  - @voyant-travel/admin@0.115.1

## 0.14.0

### Patch Changes

- Updated dependencies [4abf9a2]
  - @voyant-travel/admin@0.115.0
  - @voyant-travel/i18n@0.108.0
  - @voyant-travel/operations@0.2.8
  - @voyant-travel/bookings-react@0.133.0
  - @voyant-travel/inventory-react@0.15.0
  - @voyant-travel/ui@0.108.1

## 0.13.0

### Patch Changes

- @voyant-travel/bookings-react@0.132.0
- @voyant-travel/operations@0.2.7
- @voyant-travel/inventory-react@0.14.0

## 0.12.0

### Minor Changes

- 310565b: Surface a missing-option warning in the departures (availability slots) list (#2062).

  The slots table now has an Option column that shows each departure's option name
  and flags — with an amber badge + tooltip — any slot that has no option on a
  product that actually has options (i.e. an unpriceable departure that should be
  repaired via the option picker). Products without options are not flagged. The
  column resolves names from one capped active-options query per visible product,
  so a missing linkage is discoverable from the list, not just inside the edit
  dialog.

### Patch Changes

- Updated dependencies [310565b]
  - @voyant-travel/i18n@0.107.3
  - @voyant-travel/bookings-react@0.131.0
  - @voyant-travel/inventory-react@0.13.0
  - @voyant-travel/operations@0.2.4

## 0.11.0

### Minor Changes

- dbea53e: Add an option picker to the admin departure (availability slot) form (#2059).

  The slot create/edit dialog now lets an operator choose which of the product's
  active options a departure belongs to — populated from the product's options
  (default marked), required when the product has options, and pre-selected from
  the slot's current `optionId` on edit so an unpriceable/incorrect slot can be
  repaired through the UI. Selecting a different product clears the stale option.
  This complements the pricing-correctness fixes in #2058: a departure's price is
  derived from its option's rate plans, so a slot must point at an option.

### Patch Changes

- Updated dependencies [dbea53e]
  - @voyant-travel/i18n@0.107.2
  - @voyant-travel/bookings-react@0.130.0
  - @voyant-travel/inventory-react@0.12.0
  - @voyant-travel/operations@0.2.3

## 0.10.0

### Patch Changes

- @voyant-travel/operations@0.2.2
- @voyant-travel/bookings-react@0.129.0
- @voyant-travel/inventory-react@0.11.0

## 0.9.0

### Patch Changes

- @voyant-travel/inventory-react@0.10.0
- @voyant-travel/bookings-react@0.128.0
- @voyant-travel/operations@0.2.1

## 0.8.0

### Patch Changes

- Updated dependencies [435a5d1]
  - @voyant-travel/operations@0.2.0
  - @voyant-travel/bookings-react@0.127.0
  - @voyant-travel/inventory-react@0.9.0

## 0.7.0

### Patch Changes

- @voyant-travel/bookings-react@0.126.0
- @voyant-travel/inventory-react@0.8.0
- @voyant-travel/operations@0.1.6

## 0.6.0

### Patch Changes

- Updated dependencies [a74471e]
- Updated dependencies [a74471e]
  - @voyant-travel/i18n@0.107.0
  - @voyant-travel/ui@0.108.0
  - @voyant-travel/admin@0.114.0
  - @voyant-travel/bookings-react@0.125.0
  - @voyant-travel/inventory-react@0.7.0
  - @voyant-travel/operations@0.1.5

## 0.5.0

### Patch Changes

- 4f92198: Voyant 1.0 visual refactor of the framework UI.

  - **Tokens** (`@voyant-travel/ui` `globals.css`): warm off-white paper, near-black ink, and a single hot-orange brand accent (`--brand`, new token) reserved for charts/focus/active state. Inter Tight type. Fixed brand chart palette (`--chart-1..5`). A coherent radius system: controls + their dropdowns at `rounded-sm` (4px), cards/table surfaces at `rounded-md` (6px), dialogs/sheets at `rounded-xl`.
  - **`@voyant-travel/ui` components**: new `SegmentedControl`; `Button` gains a `brand` variant; sharper, consistent radii across Button/Input/Select/Combobox/Textarea/Toggle/Tabs/Menus/Command/Card/DataTable/Badge; bordered active sidebar items (primary + sub) and inset-panel border; assorted fixes (Command search-input radius, toggle-group corners, sidebar sub-menu spacing).
  - **`@voyant-travel/admin`**: Voyant 1.0 brand logo lockup (composed mark + wordmark, collapse-to-badge); operator shell defaults to the inset sidebar layout; dashboard KPI cards, brand chart colors, and Figma-matched sidebar (bordered active item, near-black nav text, bordered user card with open-state).
  - **Domain `*-react` packages**: card surfaces normalized to the new `rounded-md` radius; flights search bar (trip-type toggle, route cards, airport dropdown) and the resources tabs aligned to the system.

- Updated dependencies [4f92198]
  - @voyant-travel/ui@0.107.0
  - @voyant-travel/admin@0.113.0
  - @voyant-travel/inventory-react@0.6.0
  - @voyant-travel/bookings-react@0.124.0
  - @voyant-travel/operations@0.1.4

## 0.4.0

### Patch Changes

- Updated dependencies [94890c3]
- Updated dependencies [cb9b04b]
  - @voyant-travel/admin@0.112.0
  - @voyant-travel/bookings-react@0.123.0
  - @voyant-travel/inventory-react@0.5.0
  - @voyant-travel/operations@0.1.3

## 0.3.0

### Patch Changes

- @voyant-travel/inventory-react@0.4.0
- @voyant-travel/bookings-react@0.122.0
- @voyant-travel/operations@0.1.2

## 0.2.0

### Patch Changes

- @voyant-travel/operations@0.1.1
- @voyant-travel/inventory-react@0.3.0
- @voyant-travel/bookings-react@0.121.0

## 0.1.2

### Patch Changes

- ecec979: Improve operator bundle boundaries by adding route-local admin message provider support, exposing admin extension route helpers, keeping pending skeletons structural, and tightening Vite route ignores and vendor chunk splitting so heavy admin route dependencies stay out of the initial entry.
- Updated dependencies [ecec979]
  - @voyant-travel/admin@0.111.3
  - @voyant-travel/bookings-react@0.120.3
  - @voyant-travel/inventory-react@0.2.2

## 0.1.1

### Patch Changes

- eef1a00: Republish notification and UI consumer packages so stale beta artifacts no longer reference legacy notification package specifiers.
- Updated dependencies [eef1a00]
  - @voyant-travel/admin@0.111.2
  - @voyant-travel/bookings-react@0.120.1
  - @voyant-travel/inventory-react@0.2.1

## 0.1.0

### Minor Changes

- 3408b2a: Move availability, allocation UI, resources, ground logistics, and places source
  under Operations owner paths. The old operated-execution package names are
  removed from the v1 workspace surface while first-party runtime, React, and
  operator imports use `@voyant-travel/operations` and `@voyant-travel/operations-react`
  surfaces.

### Patch Changes

- 47fef18: Retarget first-party imports from the removed beta package names to their owner
  packages. Operated product UI now imports Inventory React, commercial UI imports
  Commerce React, supplier UI imports Distribution React, checkout UI imports
  Finance React, and operated place/availability schema references import
  Operations owner paths.
- Updated dependencies [dd71543]
- Updated dependencies [eb17d3d]
- Updated dependencies [3cc83b6]
- Updated dependencies [44c3875]
- Updated dependencies [3408b2a]
- Updated dependencies [65b3782]
- Updated dependencies [a101971]
- Updated dependencies [47fef18]
  - @voyant-travel/admin@0.111.1
  - @voyant-travel/operations@0.1.0
  - @voyant-travel/inventory-react@0.2.0
  - @voyant-travel/bookings-react@0.120.0

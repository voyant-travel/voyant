# @voyantjs/availability-react

## 0.115.0

### Patch Changes

- @voyantjs/availability@0.115.0
- @voyantjs/products-react@0.118.0
- @voyantjs/bookings-react@0.118.0
- @voyantjs/extras-react@0.118.0
- @voyantjs/allocation-ui@0.116.0

## 0.114.1

### Patch Changes

- Updated dependencies [b7056f1]
  - @voyantjs/availability@0.114.1
  - @voyantjs/bookings-react@0.117.1
  - @voyantjs/extras-react@0.117.1
  - @voyantjs/products-react@0.117.1

## 0.114.0

### Patch Changes

- Updated dependencies [7255353]
  - @voyantjs/availability@0.114.0
  - @voyantjs/bookings-react@0.117.0
  - @voyantjs/extras-react@0.117.0
  - @voyantjs/products-react@0.117.0
  - @voyantjs/allocation-ui@0.115.0

## 0.113.0

### Patch Changes

- @voyantjs/availability@0.113.0
- @voyantjs/products-react@0.116.0
- @voyantjs/bookings-react@0.116.0
- @voyantjs/extras-react@0.116.0
- @voyantjs/allocation-ui@0.114.0

## 0.112.0

### Patch Changes

- Updated dependencies [41b08db]
- Updated dependencies [6d496d0]
  - @voyantjs/admin@0.111.0
  - @voyantjs/products-react@0.115.0
  - @voyantjs/bookings-react@0.115.0
  - @voyantjs/extras-react@0.115.0
  - @voyantjs/allocation-ui@0.113.0
  - @voyantjs/availability@0.112.0

## 0.111.0

### Patch Changes

- @voyantjs/bookings-react@0.114.0
- @voyantjs/products-react@0.114.0
- @voyantjs/extras-react@0.114.0
- @voyantjs/allocation-ui@0.112.0
- @voyantjs/availability@0.111.0

## 0.110.0

### Patch Changes

- Updated dependencies [9c909e2]
  - @voyantjs/bookings-react@0.113.0
  - @voyantjs/admin@0.110.0
  - @voyantjs/allocation-ui@0.111.0
  - @voyantjs/products-react@0.113.0
  - @voyantjs/extras-react@0.113.0
  - @voyantjs/availability@0.110.0

## 0.109.0

### Minor Changes

- 279f97c: Slim the admin entry barrels so the host's workspace-chrome chunk stops pinning domain data layers and page hosts (operator client entry: 3.74 MB → 1.83 MB).

  - Route contribution loaders now resolve query options / page-data helpers via dynamic `import()` inside the loader body, keeping clients + response schemas (and the backend validation graphs they pull) out of the eagerly evaluated entry chunk.
  - `@voyantjs/<domain>-react/admin` barrels no longer re-export page/host/dialog/widget component **values** (packaged-admin RFC §4.8 endgame rule: specific modules, never barrels). Their prop **types** still re-export from the barrels; import component values from their specific modules instead (e.g. `@voyantjs/bookings-react/admin/booking-detail-host`). New `./admin/*` subpath exports on `@voyantjs/bookings-react` and `@voyantjs/availability-react` cover the known host-side imports.
  - Widget slot ids moved into lean `admin/slots` modules (`bookings-react`, `crm-react`, `suppliers-react`); the host modules re-export them, so existing imports keep working.
  - Widget contributions (`PersonBookingsWidget`, the four finance cards) now mount through Suspense-wrapped `React.lazy` loaders, so their chunks fetch when the slot actually renders.
  - Search schemas stay synchronous: `catalogSearchSchema` re-exports from the schema-only `catalog-search-params` module instead of the catalog main barrel; the bookings search contracts already lived in the admin entry.
  - Resources detail-page skeletons extracted to `components/resource-detail-skeletons` (re-exported from the page modules) so `pendingComponent`s no longer pin the detail pages into the entry graph.

- faec538: Generated destination resolver maps (packaged-admin RFC §4.7 endgame).

  `AdminUiRouteContribution` gains `destination?: AdminDestinationKey` +
  `destinationParams?: Record<string, string>`: a route contribution now
  DECLARES which semantic destination key its path satisfies by pure param
  interpolation (e.g. `/suppliers/$id` satisfying
  `"supplier.detail": { supplierId: string }` via `{ id: "supplierId" }`).
  The eight domain packages annotate their 29 route-backed destinations, so
  `voyant admin generate --destinations` can emit the host's resolver map
  instead of the host hand-writing it — the operator's map shrank to
  `{ ...generatedAdminDestinations, ...custom }` with only seven genuinely
  custom resolvers (search-param construction, multi-route targets, and
  host-owned pages), and `voyant admin doctor` gates on drift between the
  annotations and the generated module.

### Patch Changes

- Updated dependencies [279f97c]
- Updated dependencies [faec538]
  - @voyantjs/bookings-react@0.112.0
  - @voyantjs/admin@0.109.0
  - @voyantjs/allocation-ui@0.110.0
  - @voyantjs/products-react@0.112.0
  - @voyantjs/extras-react@0.112.0
  - @voyantjs/availability@0.109.0

## 0.108.0

### Minor Changes

- 478aa7c: Packaged-admin RFC §4.8 endgame — the code-assembled extension route tree.
  Package-delivered admin pages exist as NO per-route files in the host: the
  operator deleted ~50 thin host route files across all 10 admin domains; the
  route tree for extension routes is assembled in code from the contributions
  and grafted under the file-based workspace layout, with typed links intact.

  - `@voyantjs/admin`: `AdminUiRouteContribution` grows `page?: () =>
Promise<AdminRoutePageModule>` — a lazy page-module loader (pages stay
    code-split, hover/intent preloading fetches the chunk ahead of
    navigation). The resolved component receives `AdminRoutePageProps`
    (`params`/`search`/`updateSearch`/`title`), dissolving the old "zero-prop
    components only" restriction — param-taking detail pages need no host
    route file. `AdminRouteLoaderContext` gains `params`. New helpers:
    `requireImplementedAdminRoute` (loud failure at module evaluation when a
    bound contribution loses its implementation) and `adminRoutePageModule`
    (adapter for zero-prop / all-optional-prop hosts).
  - `@voyantjs/admin-app`: new binder — `adminExtensionRouteOptions(extension,
routeId, runtime)` returns router-facing route options (lazy component,
    loader bound to `{ queryClient, runtime, params }`, per-route `ssr`,
    boundaries) ready to spread into a code-based `createRoute({...})`, and
    `attachAdminExtensionRoutes(routeTree, parentRoute, routes)` grafts the
    built routes under the workspace layout idempotently (replace-by-path,
    dev-server re-evaluation safe).
  - All 10 `*-react` admin extensions now carry full route implementations:
    lazy `page` loaders (dynamic imports of the specific host modules, never
    the admin barrel), loaders moved verbatim from the operator route files
    (SSR modes preserved exactly, `data-only` included), pending skeletons,
    and search contracts. Bookings adds host-composition options
    (`indexHeaderActions`, `detailPageComponent` + exported
    `BookingDetailPageComponentProps`) so app-owned composition rides through
    the factory instead of a route file. Finance's supplier-invoices pages
    stay metadata-only (app-owned upload/supplier-picker/cross-domain search
    wiring) and remain host route files.

  Hosts bind everything in one checked-in generated module
  (`src/admin.routes.generated.tsx`): per route a `createRoute` call with the
  path literal + typed search schema, spreading the binder options, plus
  `AdminExtensionRoutesBy*` typed-link maps that `router.tsx` merges with the
  generated `FileRouteTypes` via `_addFileTypes` — `Link`/`navigate` stay
  fully typed for file routes and extension routes alike.

### Patch Changes

- Updated dependencies [478aa7c]
  - @voyantjs/admin@0.108.0
  - @voyantjs/bookings-react@0.111.0
  - @voyantjs/allocation-ui@0.109.0
  - @voyantjs/products-react@0.111.0
  - @voyantjs/extras-react@0.111.0
  - @voyantjs/availability@0.108.0

## 0.107.0

### Minor Changes

- 6c27159: Merge each module's `*-ui` package into its `*-react` sibling (#1652). The
  `*-react` package is now the whole client tier: the headless exports (root,
  `./hooks`, `./client`, `./provider`) are unchanged, and the styled tier moves
  in under new subpaths — `./ui` (the old `*-ui` root barrel), `./components/*`,
  `./admin`, `./i18n`, `./i18n/en`, `./i18n/ro`, and `./styles.css`.

  Migration from `@voyantjs/<module>-ui`:

  - `@voyantjs/<module>-ui` → `@voyantjs/<module>-react/ui`
  - `@voyantjs/<module>-ui/<subpath>` → `@voyantjs/<module>-react/<subpath>`
  - package.json: drop the `-ui` dependency; `-react` covers both tiers.

  Styled-tier peers (`@voyantjs/ui`, `@voyantjs/admin`, `@tanstack/react-table`,
  `sonner`, `react-hook-form`, sibling `*-react` hooks packages) are optional
  peers — headless consumers that only import the root/`hooks`/`client` subpaths
  do not need them. The 27 `@voyantjs/*-ui` packages are deprecated on npm in
  favor of these subpaths; `@voyantjs/allocation-ui` and
  `@voyantjs/workflow-runs-ui` (no `-react` sibling) are unaffected.

### Patch Changes

- Updated dependencies [6c27159]
- Updated dependencies [eeb23df]
  - @voyantjs/bookings-react@0.110.0
  - @voyantjs/extras-react@0.110.0
  - @voyantjs/products-react@0.110.0
  - @voyantjs/admin@0.107.0
  - @voyantjs/allocation-ui@0.108.0
  - @voyantjs/availability@0.107.0

## 0.106.0

### Minor Changes

- f245b55: Packaged-admin RFC availability index page delivered: the last app-side
  availability wrapper moves into `@voyantjs/availability-ui/admin` as the
  `AvailabilityIndexHost`, unblocked by new client hooks in
  `@voyantjs/availability-react` for the module's existing batch endpoints.
  New hooks: `useAvailabilityRuleBatchMutation`,
  `useAvailabilityStartTimeBatchMutation`, `useAvailabilitySlotBatchMutation`,
  `useAvailabilityCloseoutBatchMutation` and
  `useAvailabilityPickupPointBatchMutation` — each a typed
  `{ batchUpdate, batchDelete }` pair posting the whole id selection to
  `POST /v1/availability/<entity>/batch-update|batch-delete` and resolving the
  server's success/partial-failure envelope (`{ total, succeeded, failed }`
  plus updated rows / `deletedIds`), validated by the new
  `batchUpdateEnvelope`/`batchDeleteEnvelope` schemas. Closeouts and pickup
  points also gain single-record mutation hooks
  (`useAvailabilityCloseoutMutation`, `useAvailabilityPickupPointMutation`)
  with their create/update input types re-exported, so neither entity is
  query-only anymore. `AvailabilityIndexHost` wires the packaged
  `AvailabilityPage`'s bulk update/delete handlers to those batch hooks
  (toasts via sonner on the shared operator admin messages), resolves slot
  opens through the `availabilitySlot.detail` semantic destination, and ships
  with `ensureAvailabilityPageData` — the index loader that awaits the slots +
  products first page and background-prefetches the slot dialog's
  rules/start-times, taking the app's cookie-forwarding client so the SSR
  loader binding stays app-side per the packaged-host recipe. The operator's
  availability index route shrinks to the loader binding; the app-side
  wrapper and its app-local `BatchMutationResponse` type are deleted. New
  availability-ui peer: `sonner`.

### Patch Changes

- @voyantjs/availability@0.106.0

## 0.105.2

### Patch Changes

- @voyantjs/availability@0.105.2

## 0.105.1

### Patch Changes

- @voyantjs/availability@0.105.1

## 0.105.0

### Patch Changes

- @voyantjs/availability@0.105.0

## 0.104.2

### Patch Changes

- Updated dependencies [cfa6af8]
  - @voyantjs/availability@0.104.2

## 0.104.1

### Patch Changes

- @voyantjs/availability@0.104.1
- @voyantjs/react@0.104.1

## 0.104.0

### Patch Changes

- e2ae9ff: Fix room-typed pricing categories leaking into the pricing grid, and make room allocation respect the booked room type (#1476).

  - **Pricing grid no longer shows a bogus price column per room type.** The rooms/seats grid built one traveler-type column from every in-scope pricing category, so a tenant whose data carries `room`/`vehicle`/`service`-typed categories — e.g. a global default set or legacy-migrated "Double room" categories — got a phantom price column for each room alongside the real Adult/Child split. Columns are now restricted to per-traveler categories via a new `isTravelerCategory` guard, with an escape hatch that still surfaces any category that actually has a price cell (no data loss). Applies to both the merged grid and the Advanced view.
  - **"Generate from rooms" now creates `room`-kind resource templates keyed by `option_unit`.** Previously each room type became its own distinct template `kind`, which the allocator couldn't use to constrain a traveler to their booked room type. Templates now share `kind: "room"` and carry `refType: "option_unit"` / `refId`, so the auto-allocator's unit match keeps a Double-booked traveler in a Double room. The `(product_option_id, kind)` unique index is widened to `(product_option_id, kind, coalesce(ref_id, ''))` to allow one room template per unit, and the per-slot materializer's skip-existing check is refined to `(kind, ref_id)`. Template upsert and delete now resolve a row by `(option, kind, ref_id)` so editing or removing one room type no longer affects its siblings, and the panel labels each room template by its unit name.

- Updated dependencies [e2ae9ff]
  - @voyantjs/availability@0.104.0
  - @voyantjs/react@0.104.0

## 0.103.0

### Patch Changes

- @voyantjs/availability@0.103.0
- @voyantjs/react@0.103.0

## 0.102.0

### Minor Changes

- b6d0673: Redesign the operator's **Booking options & prices** for low-tech travel agents and close the inventory/allocation gaps it exposed.

  - `@voyantjs/products-ui`: each option now renders **one adaptive table** — a rooms grid (rooms × traveler types) or a per-person seats list — derived from the product's inventory (rooms always win over booking mode). The rate-plan layer is hidden behind an **Advanced** disclosure (a single default plan is auto-managed); the default plan's matrix is no longer duplicated there. Single-option products show the table directly with no chrome. The unit form pins its type in the contextual add ("Add room" can't create a vehicle) and uses type-aware quantity/occupancy labels; the price dialog uses the design-system currency input and pricing-mode-aware quantity labels. New departures pre-fill **Capacity (pax)** from the configured inventory (overridable).
  - `@voyantjs/products`: `createProduct` seeds a default `Standard` option so new products open straight into the pricing table; the day-translation create route now verifies the day belongs to the product.
  - `@voyantjs/availability` + `@voyantjs/availability-react`: departure inventory templates can be **generated from the option's rooms** and **applied to existing open departures** (new bulk endpoint + hook). The full-inventory materializer now works for product-level departures (no `optionId`), so auto-seed on publish and bulk apply create the full room set. New per-slot `materialize-templates` endpoint.
  - `@voyantjs/allocation-ui`: a slot's **Generate resources** now materializes the full configured inventory across all kinds in one click, instead of the pax-derived single-kind path.

### Patch Changes

- Updated dependencies [b6d0673]
  - @voyantjs/availability@0.102.0
  - @voyantjs/react@0.102.0

## 0.101.2

### Patch Changes

- @voyantjs/availability@0.101.2
- @voyantjs/react@0.101.2

## 0.101.1

### Patch Changes

- f736ba5: Improve product booking configuration for room-based travel products.

  - `@voyantjs/products-ui`: rename the product setup UI around booking options, room inventory, traveler prices, and departure room inventory; hide traveler-age controls for room inventory units; add setup guardrails so room-based products cannot mix the legacy one-option-per-room shape with the canonical single-option/multiple-room-units shape.
  - `@voyantjs/bookings` and `@voyantjs/bookings-react`: preserve selected room/category refs through booking creation and quote travelers against the selected room plus traveler pricing category instead of falling back to unrelated rates.
  - `@voyantjs/bookings-ui`: let agents select both the room and the traveler pricing category for each traveler when the selected room exposes category-specific prices, enforce room occupancy in the booking flow, and keep the booking summary aligned with the selected room.
  - `@voyantjs/availability-react`: expose the additional resource template fields needed by room inventory setup.
  - `@voyantjs/i18n`: add Romanian product-management labels for the renamed booking option and inventory concepts.
  - `@voyantjs/catalog-ui`: localize ship-spec labels used by the catalog detail sheet.
  - @voyantjs/availability@0.101.1
  - @voyantjs/react@0.101.1

## 0.101.0

### Patch Changes

- @voyantjs/availability@0.101.0
- @voyantjs/react@0.101.0

## 0.100.0

### Patch Changes

- @voyantjs/availability@0.100.0
- @voyantjs/react@0.100.0

## 0.99.0

### Patch Changes

- @voyantjs/availability@0.99.0
- @voyantjs/react@0.99.0

## 0.98.0

### Patch Changes

- @voyantjs/availability@0.98.0
- @voyantjs/react@0.98.0

## 0.97.0

### Patch Changes

- @voyantjs/availability@0.97.0
- @voyantjs/react@0.97.0

## 0.96.0

### Patch Changes

- @voyantjs/availability@0.96.0
- @voyantjs/react@0.96.0

## 0.95.0

### Patch Changes

- @voyantjs/availability@0.95.0
- @voyantjs/react@0.95.0

## 0.94.0

### Patch Changes

- @voyantjs/availability@0.94.0
- @voyantjs/react@0.94.0

## 0.93.0

### Patch Changes

- @voyantjs/availability@0.93.0
- @voyantjs/react@0.93.0

## 0.92.0

### Patch Changes

- @voyantjs/availability@0.92.0
- @voyantjs/react@0.92.0

## 0.91.0

### Patch Changes

- @voyantjs/availability@0.91.0
- @voyantjs/react@0.91.0

## 0.90.0

### Patch Changes

- @voyantjs/availability@0.90.0
- @voyantjs/react@0.90.0

## 0.89.0

### Patch Changes

- @voyantjs/availability@0.89.0
- @voyantjs/react@0.89.0

## 0.88.0

### Patch Changes

- @voyantjs/availability@0.88.0
- @voyantjs/react@0.88.0

## 0.87.1

### Patch Changes

- @voyantjs/availability@0.87.1
- @voyantjs/react@0.87.1

## 0.87.0

### Patch Changes

- @voyantjs/availability@0.87.0
- @voyantjs/react@0.87.0

## 0.86.0

### Patch Changes

- @voyantjs/availability@0.86.0
- @voyantjs/react@0.86.0

## 0.85.4

### Patch Changes

- @voyantjs/availability@0.85.4
- @voyantjs/react@0.85.4

## 0.85.3

### Patch Changes

- @voyantjs/availability@0.85.3
- @voyantjs/react@0.85.3

## 0.85.2

### Patch Changes

- @voyantjs/availability@0.85.2
- @voyantjs/react@0.85.2

## 0.85.1

### Patch Changes

- @voyantjs/availability@0.85.1
- @voyantjs/react@0.85.1

## 0.85.0

### Patch Changes

- @voyantjs/availability@0.85.0
- @voyantjs/react@0.85.0

## 0.84.4

### Patch Changes

- @voyantjs/availability@0.84.4
- @voyantjs/react@0.84.4

## 0.84.3

### Patch Changes

- @voyantjs/availability@0.84.3
- @voyantjs/react@0.84.3

## 0.84.2

### Patch Changes

- Updated dependencies [29c6e83]
  - @voyantjs/availability@0.84.2
  - @voyantjs/react@0.84.2

## 0.84.1

### Patch Changes

- @voyantjs/availability@0.84.1
- @voyantjs/react@0.84.1

## 0.84.0

### Patch Changes

- @voyantjs/availability@0.84.0
- @voyantjs/react@0.84.0

## 0.83.1

### Patch Changes

- @voyantjs/availability@0.83.1
- @voyantjs/react@0.83.1

## 0.83.0

### Patch Changes

- @voyantjs/availability@0.83.0
- @voyantjs/react@0.83.0

## 0.82.1

### Patch Changes

- @voyantjs/availability@0.82.1
- @voyantjs/react@0.82.1

## 0.82.0

### Minor Changes

- 79ce168: Slot-detail / allocation / booking-sheet UX pass.

  - `AvailabilitySlotDetailPage`: status badge color-coded by tone (open=green, closed/sold-out=red), product-type badge, locale-formatted date range with timezone chip, financial KPI cards (Remaining/Initial Pax, Total, Paid + %, Outstanding + %, per-currency rollup), timeline-style Activity tab, `<dl>`-style Metadata tab, AlertDialog delete confirmation, host-driven Edit / Open Product / Create Booking actions.
  - Slot allocation grid: side-by-side Unallocated + resources layout kicks in at `lg:` instead of `xl:`; payment-status chip palette unchanged but Tailwind source paths now cover `@voyantjs/allocation-ui` in the operator template so the colors actually render.
  - `AvailabilitySlotsTab`: optional header / `asPanel` / `hideBulkDelete` / `bulkStatusSelect` props let hosts embed the slots table outside of a Tabs shell and replace the bulk Open/Close buttons with a single "Change status" select.
  - Allocation manifest now exposes `sellAmountCents` / `paidAmountCents` per booking (and `derivePaidAmountCents` is exported from `@voyantjs/availability`). `productOptionSchema` adds `sellCurrency` and `productType` so consumers can drive currency / badge UI off the catalog response.
  - `GET /v1/products/:id` joins `product_types` and returns `productType` alongside the product row via new `productsService.getProductByIdWithType`.
  - `BookingCreateDialog` → `BookingCreateSheet` (file + symbol + registry slug rename). Right-side wide sheet, departure picker disables when opened with a `defaultSlotId`, full-mode payment schedule defaults the due date to the departure day until the operator touches it, payment-schedule currency falls back through product → pricing → placeholder so the server's `invalid_payment_schedules` validator stops rejecting mismatched currencies, slot-allocation cache busted after create so new bookings appear without a manual refresh.
  - `BookingQuickViewSheet`: real Payer section (email/phone/language/website/address), card-per-traveler details (email/phone/language/special-requests/notes), per-traveler document list, and a collapsible "More info" that lazily calls the audit-logged reveal endpoint to surface DOB / nationality / document / dietary / accessibility / bed preference.
  - `ProductQuickViewSheet`: new component in `@voyantjs/products-ui` mirroring the booking quick view shape — cover image, booking/capacity mode badges, full description, dates, itinerary days (with location + description), options list with status badges, tags, "View full product" footer.
  - `AsyncCombobox` now forwards `disabled` to `ComboboxInput` so disabled comboboxes are actually uneditable.
  - `DataTable` selection checkboxes use bubble-phase `stopPropagation` (wrapped in a `<div>`) instead of `onClickCapture` — fixes the "checkbox doesn't fire" bug under base-ui's checkbox event flow.
  - `useBookingCreateMutation` consumers (sheet) invalidate `availabilityQueryKeys.slots()` after create.
  - `loadProductOptionUnits` in finance booking-create now uses the exported `toRows<T>` normalizer to handle both `drizzle-orm/postgres-js` and `drizzle-orm/node-postgres` return shapes.
  - Operator template: Availability nav item moved directly under Products; slot detail route hosts the new edit dialog, booking quick view, product quick view; Tailwind `@source` scans `@voyantjs/allocation-ui` dist + src.
  - I18n: en/ro keys added for `tabSlots: "List"` rename, slot detail Activity timeline filters, slot Meta block, "Change status", "Create booking", "Edit slot", traveler reveal labels, booking quick view payer.

### Patch Changes

- Updated dependencies [79ce168]
  - @voyantjs/availability@0.82.0
  - @voyantjs/react@0.82.0

## 0.81.21

### Patch Changes

- @voyantjs/availability@0.81.21
- @voyantjs/react@0.81.21

## 0.81.20

### Patch Changes

- @voyantjs/availability@0.81.20
- @voyantjs/react@0.81.20

## 0.81.19

### Patch Changes

- @voyantjs/availability@0.81.19
- @voyantjs/react@0.81.19

## 0.81.18

### Patch Changes

- @voyantjs/availability@0.81.18
- @voyantjs/react@0.81.18

## 0.81.17

### Patch Changes

- @voyantjs/availability@0.81.17
- @voyantjs/react@0.81.17

## 0.81.16

### Patch Changes

- @voyantjs/availability@0.81.16
- @voyantjs/react@0.81.16

## 0.81.15

### Patch Changes

- @voyantjs/availability@0.81.15
- @voyantjs/react@0.81.15

## 0.81.14

### Patch Changes

- @voyantjs/availability@0.81.14
- @voyantjs/react@0.81.14

## 0.81.13

### Patch Changes

- @voyantjs/availability@0.81.13
- @voyantjs/react@0.81.13

## 0.81.12

### Patch Changes

- @voyantjs/availability@0.81.12
- @voyantjs/react@0.81.12

## 0.81.11

### Patch Changes

- @voyantjs/availability@0.81.11
- @voyantjs/react@0.81.11

## 0.81.10

### Patch Changes

- @voyantjs/availability@0.81.10
- @voyantjs/react@0.81.10

## 0.81.9

### Patch Changes

- @voyantjs/availability@0.81.9
- @voyantjs/react@0.81.9

## 0.81.8

### Patch Changes

- @voyantjs/availability@0.81.8
- @voyantjs/react@0.81.8

## 0.81.7

### Patch Changes

- @voyantjs/availability@0.81.7
- @voyantjs/react@0.81.7

## 0.81.6

### Patch Changes

- @voyantjs/availability@0.81.6
- @voyantjs/react@0.81.6

## 0.81.5

### Patch Changes

- @voyantjs/availability@0.81.5
- @voyantjs/react@0.81.5

## 0.81.4

### Patch Changes

- @voyantjs/availability@0.81.4
- @voyantjs/react@0.81.4

## 0.81.3

### Patch Changes

- @voyantjs/availability@0.81.3
- @voyantjs/react@0.81.3

## 0.81.2

### Patch Changes

- Updated dependencies [6ca8aa8]
  - @voyantjs/availability@0.81.2
  - @voyantjs/react@0.81.2

## 0.81.1

### Patch Changes

- @voyantjs/availability@0.81.1
- @voyantjs/react@0.81.1

## 0.81.0

### Patch Changes

- @voyantjs/availability@0.81.0
- @voyantjs/react@0.81.0

## 0.80.18

### Patch Changes

- @voyantjs/availability@0.80.18
- @voyantjs/react@0.80.18

## 0.80.17

### Patch Changes

- @voyantjs/availability@0.80.17
- @voyantjs/react@0.80.17

## 0.80.16

### Patch Changes

- @voyantjs/availability@0.80.16
- @voyantjs/react@0.80.16

## 0.80.15

### Patch Changes

- @voyantjs/availability@0.80.15
- @voyantjs/react@0.80.15

## 0.80.14

### Patch Changes

- Updated dependencies [2dd6d0f]
  - @voyantjs/availability@0.80.14
  - @voyantjs/react@0.80.14

## 0.80.13

### Patch Changes

- @voyantjs/availability@0.80.13
- @voyantjs/react@0.80.13

## 0.80.12

### Patch Changes

- @voyantjs/availability@0.80.12
- @voyantjs/react@0.80.12

## 0.80.11

### Patch Changes

- @voyantjs/availability@0.80.11
- @voyantjs/react@0.80.11

## 0.80.10

### Patch Changes

- @voyantjs/availability@0.80.10
- @voyantjs/react@0.80.10

## 0.80.9

### Patch Changes

- @voyantjs/availability@0.80.9
- @voyantjs/react@0.80.9

## 0.80.8

### Patch Changes

- @voyantjs/availability@0.80.8
- @voyantjs/react@0.80.8

## 0.80.7

### Patch Changes

- @voyantjs/availability@0.80.7
- @voyantjs/react@0.80.7

## 0.80.6

### Patch Changes

- @voyantjs/availability@0.80.6
- @voyantjs/react@0.80.6

## 0.80.5

### Patch Changes

- @voyantjs/availability@0.80.5
- @voyantjs/react@0.80.5

## 0.80.4

### Patch Changes

- @voyantjs/availability@0.80.4
- @voyantjs/react@0.80.4

## 0.80.3

### Patch Changes

- @voyantjs/availability@0.80.3
- @voyantjs/react@0.80.3

## 0.80.2

### Patch Changes

- @voyantjs/availability@0.80.2
- @voyantjs/react@0.80.2

## 0.80.1

### Patch Changes

- @voyantjs/availability@0.80.1
- @voyantjs/react@0.80.1

## 0.80.0

### Patch Changes

- @voyantjs/availability@0.80.0
- @voyantjs/react@0.80.0

## 0.79.0

### Patch Changes

- @voyantjs/availability@0.79.0
- @voyantjs/react@0.79.0

## 0.78.0

### Patch Changes

- @voyantjs/availability@0.78.0
- @voyantjs/react@0.78.0

## 0.77.13

### Patch Changes

- @voyantjs/availability@0.77.13
- @voyantjs/react@0.77.13

## 0.77.12

### Patch Changes

- @voyantjs/availability@0.77.12
- @voyantjs/react@0.77.12

## 0.77.11

### Patch Changes

- @voyantjs/availability@0.77.11
- @voyantjs/react@0.77.11

## 0.77.10

### Patch Changes

- @voyantjs/availability@0.77.10
- @voyantjs/react@0.77.10

## 0.77.9

### Patch Changes

- @voyantjs/availability@0.77.9
- @voyantjs/react@0.77.9

## 0.77.8

### Patch Changes

- @voyantjs/availability@0.77.8
- @voyantjs/react@0.77.8

## 0.77.7

### Patch Changes

- @voyantjs/availability@0.77.7
- @voyantjs/react@0.77.7

## 0.77.6

### Patch Changes

- @voyantjs/availability@0.77.6
- @voyantjs/react@0.77.6

## 0.77.5

### Patch Changes

- @voyantjs/availability@0.77.5
- @voyantjs/react@0.77.5

## 0.77.4

### Patch Changes

- @voyantjs/availability@0.77.4
- @voyantjs/react@0.77.4

## 0.77.3

### Patch Changes

- @voyantjs/availability@0.77.3
- @voyantjs/react@0.77.3

## 0.77.2

### Patch Changes

- @voyantjs/availability@0.77.2
- @voyantjs/react@0.77.2

## 0.77.1

### Patch Changes

- @voyantjs/availability@0.77.1
- @voyantjs/react@0.77.1

## 0.77.0

### Patch Changes

- @voyantjs/availability@0.77.0
- @voyantjs/react@0.77.0

## 0.76.0

### Patch Changes

- @voyantjs/availability@0.76.0
- @voyantjs/react@0.76.0

## 0.75.7

### Patch Changes

- @voyantjs/availability@0.75.7
- @voyantjs/react@0.75.7

## 0.75.6

### Patch Changes

- @voyantjs/availability@0.75.6
- @voyantjs/react@0.75.6

## 0.75.5

### Patch Changes

- @voyantjs/availability@0.75.5
- @voyantjs/react@0.75.5

## 0.75.4

### Patch Changes

- @voyantjs/availability@0.75.4
- @voyantjs/react@0.75.4

## 0.75.3

### Patch Changes

- @voyantjs/availability@0.75.3
- @voyantjs/react@0.75.3

## 0.75.2

### Patch Changes

- @voyantjs/availability@0.75.2
- @voyantjs/react@0.75.2

## 0.75.1

### Patch Changes

- @voyantjs/availability@0.75.1
- @voyantjs/react@0.75.1

## 0.75.0

### Patch Changes

- @voyantjs/availability@0.75.0
- @voyantjs/react@0.75.0

## 0.74.2

### Patch Changes

- @voyantjs/availability@0.74.2
- @voyantjs/react@0.74.2

## 0.74.1

### Patch Changes

- @voyantjs/availability@0.74.1
- @voyantjs/react@0.74.1

## 0.74.0

### Patch Changes

- @voyantjs/availability@0.74.0
- @voyantjs/react@0.74.0

## 0.73.1

### Patch Changes

- @voyantjs/availability@0.73.1
- @voyantjs/react@0.73.1

## 0.73.0

### Patch Changes

- @voyantjs/availability@0.73.0
- @voyantjs/react@0.73.0

## 0.72.0

### Patch Changes

- Updated dependencies [6a66b2b]
  - @voyantjs/availability@0.72.0
  - @voyantjs/react@0.72.0

## 0.71.0

### Minor Changes

- 9bdc9a6: Add a visual seat-map builder for vehicle_seat resource templates. Operators can now draw the bus layout cell-by-cell with explicit `seat`, `aisle`, `door`, and `void` kinds — supporting odd bus shapes (mid-coach doors, wheelchair voids, asymmetric back rows) the legacy `layout` string couldn't express. A new `<SeatMapBuilder />` ships from `@voyantjs/allocation-ui`; the backend materializer walks the saved `layoutSpec` to create exactly the seats drawn, with positions derived from neighbouring cells; and `VehicleSeatsView` renders the map with visible aisle gaps and a striped door row when a spec is present. The legacy `layout` string path stays as the fallback when no spec is configured.

### Patch Changes

- Updated dependencies [9bdc9a6]
  - @voyantjs/availability@0.71.0
  - @voyantjs/react@0.71.0

## 0.70.0

### Minor Changes

- 09d5f82: Allocation chip polish:

  - **Fix #1079**: `derivePaymentStatus` now falls back to `bookings.paid_at` and the sum of paid `booking_payment_schedules` before declaring a booking unpaid via invoice math. Operators who bill via deposit milestones (or who confirm bookings without issuing an invoice) no longer see false-red allocation chips. Manifest SQL surfaces `paid_at`, `created_at`, and `schedules_paid_cents`; the rollup checks them in order before falling through to the legacy invoice rule.
  - **Booking sequence numbers**: each booking gets a slot-local 1-based ordinal (by `bookings.created_at`), surfaced on `AllocationManifestBooking` and `AllocationManifestTraveler` as `bookingSequence`. All chips for the same booking render with a `(N)` prefix so operators can scan the resource grid and spot at a glance which travelers belong together.
  - **Visible payment-status colors**: `paymentStatusChipClass` bumped from `/5 + /40` (basically invisible on dark themes) to `/20 + /70` plus an explicit text color. Lives in `slot-allocation-shared` so both the resource view and the seat view share the same look.
  - **Seat-view parity**: `VehicleSeatCell` now applies the payment-status color + tooltip and shows the `(N)` prefix on the occupant name. The booking ref click-through was already there; this aligns the rest of the affordances with the room view.

### Patch Changes

- Updated dependencies [09d5f82]
  - @voyantjs/availability@0.70.0
  - @voyantjs/react@0.70.0

## 0.69.1

### Patch Changes

- @voyantjs/availability@0.69.1
- @voyantjs/react@0.69.1

## 0.69.0

### Patch Changes

- @voyantjs/availability@0.69.0
- @voyantjs/react@0.69.0

## 0.68.0

### Patch Changes

- @voyantjs/availability@0.68.0
- @voyantjs/react@0.68.0

## 0.67.0

### Patch Changes

- @voyantjs/availability@0.67.0
- @voyantjs/react@0.67.0

## 0.66.6

### Patch Changes

- @voyantjs/availability@0.66.6
- @voyantjs/react@0.66.6

## 0.66.5

### Patch Changes

- @voyantjs/availability@0.66.5
- @voyantjs/react@0.66.5

## 0.66.4

### Patch Changes

- @voyantjs/availability@0.66.4
- @voyantjs/react@0.66.4

## 0.66.3

### Patch Changes

- @voyantjs/availability@0.66.3
- @voyantjs/react@0.66.3

## 0.66.2

### Patch Changes

- 3608633: Add a server-backed availability overview endpoint and React hook so operator overview metrics and attention lists are computed from the full dataset instead of the first paginated list page.
- Updated dependencies [3608633]
  - @voyantjs/availability@0.66.2
  - @voyantjs/react@0.66.2

## 0.66.1

### Patch Changes

- @voyantjs/availability@0.66.1
- @voyantjs/react@0.66.1

## 0.66.0

### Patch Changes

- @voyantjs/availability@0.66.0
- @voyantjs/react@0.66.0

## 0.65.0

### Patch Changes

- @voyantjs/availability@0.65.0
- @voyantjs/react@0.65.0

## 0.64.1

### Patch Changes

- @voyantjs/availability@0.64.1
- @voyantjs/react@0.64.1

## 0.64.0

### Patch Changes

- Updated dependencies [6d0c8f3]
  - @voyantjs/availability@0.64.0
  - @voyantjs/react@0.64.0

## 0.63.1

### Patch Changes

- @voyantjs/availability@0.63.1
- @voyantjs/react@0.63.1

## 0.63.0

### Minor Changes

- 5bff9c3: Allocation view: click traveler's booking number to open it; color-code chips by payment status.

  `@voyantjs/availability`

  - Slot allocation manifest now carries an aggregated `paymentStatus` (`paid` / `partial` / `unpaid`) on both `AllocationManifestBooking` and `AllocationManifestTraveler`. Derived from a LEFT JOIN against `invoices` (sum of `total_cents` / `paid_cents` per booking, excluding `void` invoices):
    - `paid` when fully settled, or when the booking has `sell_amount_cents <= 0` (free).
    - `partial` when any payment landed but balance remains.
    - `unpaid` when nothing has been paid, including the "no invoices issued yet" case.
  - Fallback path: when the `invoices` table doesn't exist (catalog-less / finance-less deploys), the loader retries without the join and every booking ends up `unpaid`. No crash on missing schema.
  - New exported type `AllocationPaymentStatus`.

  `@voyantjs/availability-react`

  - `allocationManifestTravelerSchema` and `allocationManifestBookingSchema` expose `paymentStatus` (defaults to `unpaid` for older API responses).
  - New exports: `allocationPaymentStatusSchema`, `AllocationPaymentStatus`.

  `@voyantjs/allocation-ui`

  - `SlotAllocationPage` accepts a new `onBookingOpen?: (bookingId: string) => void` callback. When provided, every booking number on a chip / row becomes a `<button>` that fires the callback — the host decides whether to open a side panel, navigate, etc. Threaded through `ResourceColumnsView`, `ResourceGroupTable`, `ResourceRow`, `TravelerChip`, `UnallocatedTravelersTable`, `VehicleSeatsView`, and `VehicleSeatCell`.
  - `TravelerChip` border + background tint reflects `traveler.paymentStatus` — emerald for paid, amber for partial, rose for unpaid (light tint over the existing border). Tooltip surfaces the localized label.
  - Unallocated rows pick up the same color cue (text-only, not full-width) on the booking-number column so a quick scan tells the operator what's outstanding.
  - New `paymentStatusLabels` i18n group on `AllocationUiMessages` (EN + RO).

### Patch Changes

- Updated dependencies [5bff9c3]
  - @voyantjs/availability@0.63.0
  - @voyantjs/react@0.63.0

## 0.62.3

### Patch Changes

- @voyantjs/availability@0.62.3
- @voyantjs/react@0.62.3

## 0.62.2

### Patch Changes

- @voyantjs/availability@0.62.2
- @voyantjs/react@0.62.2

## 0.62.1

### Patch Changes

- @voyantjs/availability@0.62.1
- @voyantjs/react@0.62.1

## 0.62.0

### Patch Changes

- @voyantjs/availability@0.62.0
- @voyantjs/react@0.62.0

## 0.61.0

### Patch Changes

- @voyantjs/availability@0.61.0
- @voyantjs/react@0.61.0

## 0.60.0

### Patch Changes

- @voyantjs/availability@0.60.0
- @voyantjs/react@0.60.0

## 0.59.0

### Patch Changes

- @voyantjs/availability@0.59.0
- @voyantjs/react@0.59.0

## 0.58.0

### Patch Changes

- @voyantjs/availability@0.58.0
- @voyantjs/react@0.58.0

## 0.57.0

### Patch Changes

- @voyantjs/availability@0.57.0
- @voyantjs/react@0.57.0

## 0.56.0

### Patch Changes

- @voyantjs/availability@0.56.0
- @voyantjs/react@0.56.0

## 0.55.1

### Patch Changes

- @voyantjs/availability@0.55.1
- @voyantjs/react@0.55.1

## 0.55.0

### Patch Changes

- @voyantjs/availability@0.55.0
- @voyantjs/react@0.55.0

## 0.54.0

### Patch Changes

- @voyantjs/availability@0.54.0
- @voyantjs/react@0.54.0

## 0.53.2

### Patch Changes

- @voyantjs/availability@0.53.2
- @voyantjs/react@0.53.2

## 0.53.1

### Patch Changes

- @voyantjs/availability@0.53.1
- @voyantjs/react@0.53.1

## 0.53.0

### Patch Changes

- @voyantjs/availability@0.53.0
- @voyantjs/react@0.53.0

## 0.52.4

### Patch Changes

- @voyantjs/availability@0.52.4
- @voyantjs/react@0.52.4

## 0.52.3

### Patch Changes

- @voyantjs/availability@0.52.3
- @voyantjs/react@0.52.3

## 0.52.2

### Patch Changes

- Updated dependencies [3e09123]
  - @voyantjs/availability@0.52.2
  - @voyantjs/react@0.52.2

## 0.52.1

### Patch Changes

- Updated dependencies [335d277]
  - @voyantjs/availability@0.52.1
  - @voyantjs/react@0.52.1

## 0.52.0

### Patch Changes

- @voyantjs/availability@0.52.0
- @voyantjs/react@0.52.0

## 0.51.1

### Patch Changes

- @voyantjs/availability@0.51.1
- @voyantjs/react@0.51.1

## 0.51.0

### Patch Changes

- @voyantjs/availability@0.51.0
- @voyantjs/react@0.51.0

## 0.50.8

### Patch Changes

- @voyantjs/availability@0.50.8
- @voyantjs/react@0.50.8

## 0.50.7

### Patch Changes

- @voyantjs/availability@0.50.7
- @voyantjs/react@0.50.7

## 0.50.6

### Patch Changes

- c14f0a8: Fix the booking-create flow: scrollable dialog content with reachable actions, normalized product search, future departure lookup, shared-room clearing, explicit item lines, selectable traveler people including the payer, already-paid schedule rows, and booking-create naming throughout the API/registry surface.
- Updated dependencies [c14f0a8]
  - @voyantjs/availability@0.50.6
  - @voyantjs/react@0.50.6

## 0.50.5

### Patch Changes

- @voyantjs/availability@0.50.5
- @voyantjs/react@0.50.5

## 0.50.4

### Patch Changes

- @voyantjs/availability@0.50.4
- @voyantjs/react@0.50.4

## 0.50.3

### Patch Changes

- @voyantjs/availability@0.50.3
- @voyantjs/react@0.50.3

## 0.50.2

### Patch Changes

- @voyantjs/availability@0.50.2
- @voyantjs/react@0.50.2

## 0.50.1

### Patch Changes

- @voyantjs/availability@0.50.1
- @voyantjs/react@0.50.1

## 0.50.0

### Patch Changes

- @voyantjs/availability@0.50.0
- @voyantjs/react@0.50.0

## 0.49.0

### Patch Changes

- @voyantjs/availability@0.49.0
- @voyantjs/react@0.49.0

## 0.48.0

### Patch Changes

- @voyantjs/availability@0.48.0
- @voyantjs/react@0.48.0

## 0.47.0

### Patch Changes

- @voyantjs/availability@0.47.0
- @voyantjs/react@0.47.0

## 0.46.0

### Patch Changes

- @voyantjs/availability@0.46.0
- @voyantjs/react@0.46.0

## 0.45.0

### Patch Changes

- @voyantjs/availability@0.45.0
- @voyantjs/react@0.45.0

## 0.44.0

### Patch Changes

- @voyantjs/availability@0.44.0
- @voyantjs/react@0.44.0

## 0.43.0

### Patch Changes

- @voyantjs/availability@0.43.0
- @voyantjs/react@0.43.0

## 0.42.0

### Patch Changes

- @voyantjs/availability@0.42.0
- @voyantjs/react@0.42.0

## 0.41.3

### Patch Changes

- @voyantjs/availability@0.41.3
- @voyantjs/react@0.41.3

## 0.41.2

### Patch Changes

- @voyantjs/availability@0.41.2
- @voyantjs/react@0.41.2

## 0.41.1

### Patch Changes

- @voyantjs/availability@0.41.1
- @voyantjs/react@0.41.1

## 0.41.0

### Patch Changes

- @voyantjs/availability@0.41.0
- @voyantjs/react@0.41.0

## 0.40.1

### Patch Changes

- @voyantjs/availability@0.40.1
- @voyantjs/react@0.40.1

## 0.40.0

### Patch Changes

- @voyantjs/availability@0.40.0
- @voyantjs/react@0.40.0

## 0.39.0

### Patch Changes

- @voyantjs/availability@0.39.0
- @voyantjs/react@0.39.0

## 0.38.2

### Patch Changes

- @voyantjs/availability@0.38.2
- @voyantjs/react@0.38.2

## 0.38.1

### Patch Changes

- @voyantjs/availability@0.38.1
- @voyantjs/react@0.38.1

## 0.38.0

### Patch Changes

- @voyantjs/availability@0.38.0
- @voyantjs/react@0.38.0

## 0.37.1

### Patch Changes

- @voyantjs/availability@0.37.1
- @voyantjs/react@0.37.1

## 0.37.0

### Patch Changes

- @voyantjs/availability@0.37.0
- @voyantjs/react@0.37.0

## 0.36.0

### Patch Changes

- @voyantjs/availability@0.36.0
- @voyantjs/react@0.36.0

## 0.35.0

### Patch Changes

- @voyantjs/availability@0.35.0
- @voyantjs/react@0.35.0

## 0.34.0

### Patch Changes

- @voyantjs/availability@0.34.0
- @voyantjs/react@0.34.0

## 0.33.1

### Patch Changes

- @voyantjs/availability@0.33.1
- @voyantjs/react@0.33.1

## 0.33.0

### Patch Changes

- @voyantjs/availability@0.33.0
- @voyantjs/react@0.33.0

## 0.32.3

### Patch Changes

- @voyantjs/availability@0.32.3
- @voyantjs/react@0.32.3

## 0.32.2

### Patch Changes

- @voyantjs/availability@0.32.2
- @voyantjs/react@0.32.2

## 0.32.1

### Patch Changes

- @voyantjs/availability@0.32.1
- @voyantjs/react@0.32.1

## 0.32.0

### Patch Changes

- @voyantjs/availability@0.32.0
- @voyantjs/react@0.32.0

## 0.31.4

### Patch Changes

- @voyantjs/availability@0.31.4
- @voyantjs/react@0.31.4

## 0.31.3

### Patch Changes

- @voyantjs/availability@0.31.3
- @voyantjs/react@0.31.3

## 0.31.2

### Patch Changes

- @voyantjs/availability@0.31.2
- @voyantjs/react@0.31.2

## 0.31.1

### Patch Changes

- @voyantjs/availability@0.31.1
- @voyantjs/react@0.31.1

## 0.31.0

### Patch Changes

- @voyantjs/availability@0.31.0
- @voyantjs/react@0.31.0

## 0.30.7

### Patch Changes

- @voyantjs/availability@0.30.7
- @voyantjs/react@0.30.7

## 0.30.6

### Patch Changes

- @voyantjs/availability@0.30.6
- @voyantjs/react@0.30.6

## 0.30.5

### Patch Changes

- @voyantjs/availability@0.30.5
- @voyantjs/react@0.30.5

## 0.30.4

### Patch Changes

- @voyantjs/availability@0.30.4
- @voyantjs/react@0.30.4

## 0.30.3

### Patch Changes

- @voyantjs/availability@0.30.3
- @voyantjs/react@0.30.3

## 0.30.2

### Patch Changes

- @voyantjs/availability@0.30.2
- @voyantjs/react@0.30.2

## 0.30.1

### Patch Changes

- @voyantjs/availability@0.30.1
- @voyantjs/react@0.30.1

## 0.30.0

### Patch Changes

- @voyantjs/availability@0.30.0
- @voyantjs/react@0.30.0

## 0.29.0

### Patch Changes

- Updated dependencies [828fee4]
- Updated dependencies [828fee4]
  - @voyantjs/availability@0.29.0
  - @voyantjs/react@0.29.0

## 0.28.3

### Patch Changes

- 60ef432: Let templates lift the search + filter row out of the overview cards and into the page header (matching the rest of the operator shell), and accept a per-tab toolbar slot.

  `@voyantjs/availability-ui`:

  - `<AvailabilityOverview />` accepts `showFilters?: boolean` (default `true`). When `false`, the inline search input + product filter + clear-filters button row is hidden so the consuming page can render the same controls in its own header without duplication. KPI cards and the rest of the overview still render unchanged.
  - `<AvailabilitySlotsTab />`, `<AvailabilityRulesTab />`, `<AvailabilityStartTimesTab />`, `<AvailabilityCloseoutsTab />`, `<AvailabilityPickupPointsTab />` each accept an optional `toolbar?: ReactNode` rendered between the selection action bar and the data table — for tab-scoped filter chips, pickers, etc.

  `@voyantjs/availability-react`:

  - `ProductListFilters` now accepts an optional `search` string, threaded through `getProductsQueryOptions` as a `?search=` query-string parameter so product pickers can autocomplete server-side.

  `@voyantjs/resources-ui`:

  - `<ResourcesOverview />` accepts `showFilters?: boolean` (default `true`) with the same semantics as the availability overview — hides the inline search + kind-filter row when the consuming page surfaces those controls in its header.

  `@voyantjs/i18n`:

  - Admin resources messages add `filtersButton`, `filtersKindLabel`, `filtersSupplierLabel` / `filtersSupplierAny` / `filtersSupplierEmpty`, `filtersProductLabel` / `filtersProductAny` / `filtersProductEmpty` (en + ro) for the new header-level filter popover.
  - @voyantjs/availability@0.28.3
  - @voyantjs/react@0.28.3

## 0.28.2

### Patch Changes

- @voyantjs/availability@0.28.2
- @voyantjs/react@0.28.2

## 0.28.1

### Patch Changes

- @voyantjs/availability@0.28.1
- @voyantjs/react@0.28.1

## 0.28.0

### Patch Changes

- @voyantjs/availability@0.28.0
- @voyantjs/react@0.28.0

## 0.27.0

### Patch Changes

- @voyantjs/availability@0.27.0
- @voyantjs/react@0.27.0

## 0.26.9

### Patch Changes

- @voyantjs/availability@0.26.9
- @voyantjs/react@0.26.9

## 0.26.8

### Patch Changes

- @voyantjs/availability@0.26.8
- @voyantjs/react@0.26.8

## 0.26.7

### Patch Changes

- @voyantjs/availability@0.26.7
- @voyantjs/react@0.26.7

## 0.26.6

### Patch Changes

- @voyantjs/availability@0.26.6
- @voyantjs/react@0.26.6

## 0.26.5

### Patch Changes

- @voyantjs/availability@0.26.5
- @voyantjs/react@0.26.5

## 0.26.4

### Patch Changes

- @voyantjs/availability@0.26.4
- @voyantjs/react@0.26.4

## 0.26.3

### Patch Changes

- @voyantjs/availability@0.26.3
- @voyantjs/react@0.26.3

## 0.26.2

### Patch Changes

- @voyantjs/availability@0.26.2
- @voyantjs/react@0.26.2

## 0.26.1

### Patch Changes

- @voyantjs/availability@0.26.1
- @voyantjs/react@0.26.1

## 0.26.0

### Patch Changes

- @voyantjs/availability@0.26.0
- @voyantjs/react@0.26.0

## 0.25.0

### Patch Changes

- @voyantjs/availability@0.25.0
- @voyantjs/react@0.25.0

## 0.24.3

### Patch Changes

- @voyantjs/availability@0.24.3
- @voyantjs/react@0.24.3

## 0.24.2

### Patch Changes

- @voyantjs/availability@0.24.2
- @voyantjs/react@0.24.2

## 0.24.1

### Patch Changes

- @voyantjs/availability@0.24.1
- @voyantjs/react@0.24.1

## 0.24.0

### Patch Changes

- @voyantjs/availability@0.24.0
- @voyantjs/react@0.24.0

## 0.23.0

### Patch Changes

- @voyantjs/availability@0.23.0
- @voyantjs/react@0.23.0

## 0.22.0

### Patch Changes

- @voyantjs/availability@0.22.0
- @voyantjs/react@0.22.0

## 0.21.1

### Patch Changes

- @voyantjs/availability@0.21.1
- @voyantjs/react@0.21.1

## 0.21.0

### Patch Changes

- @voyantjs/availability@0.21.0
- @voyantjs/react@0.21.0

## 0.20.0

### Patch Changes

- @voyantjs/availability@0.20.0
- @voyantjs/react@0.20.0

## 0.19.0

### Patch Changes

- @voyantjs/availability@0.19.0
- @voyantjs/react@0.19.0

## 0.18.0

### Patch Changes

- @voyantjs/availability@0.18.0
- @voyantjs/react@0.18.0

## 0.17.0

### Patch Changes

- @voyantjs/availability@0.17.0
- @voyantjs/react@0.17.0

## 0.16.0

### Patch Changes

- @voyantjs/availability@0.16.0
- @voyantjs/react@0.16.0

## 0.15.0

### Patch Changes

- @voyantjs/availability@0.15.0
- @voyantjs/react@0.15.0

## 0.14.0

### Patch Changes

- @voyantjs/availability@0.14.0
- @voyantjs/react@0.14.0

## 0.13.0

### Patch Changes

- @voyantjs/availability@0.13.0
- @voyantjs/react@0.13.0

## 0.12.0

### Patch Changes

- @voyantjs/availability@0.12.0
- @voyantjs/react@0.12.0

## 0.11.0

### Patch Changes

- @voyantjs/availability@0.11.0
- @voyantjs/react@0.11.0

## 0.10.0

### Patch Changes

- @voyantjs/availability@0.10.0
- @voyantjs/react@0.10.0

## 0.9.0

### Patch Changes

- @voyantjs/availability@0.9.0
- @voyantjs/react@0.9.0

## 0.8.0

### Patch Changes

- @voyantjs/availability@0.8.0
- @voyantjs/react@0.8.0

## 0.7.0

### Patch Changes

- @voyantjs/availability@0.7.0
- @voyantjs/react@0.7.0

## 0.6.9

### Patch Changes

- @voyantjs/availability@0.6.9
- @voyantjs/react@0.6.9

## 0.6.8

### Patch Changes

- Updated dependencies [b218885]
- Updated dependencies [b218885]
  - @voyantjs/availability@0.6.8
  - @voyantjs/react@0.6.8

## 0.6.7

### Patch Changes

- @voyantjs/availability@0.6.7
- @voyantjs/react@0.6.7

## 0.6.6

### Patch Changes

- @voyantjs/availability@0.6.6
- @voyantjs/react@0.6.6

## 0.6.5

### Patch Changes

- @voyantjs/availability@0.6.5
- @voyantjs/react@0.6.5

## 0.6.4

### Patch Changes

- @voyantjs/availability@0.6.4
- @voyantjs/react@0.6.4

## 0.6.3

### Patch Changes

- @voyantjs/availability@0.6.3
- @voyantjs/react@0.6.3

## 0.6.2

### Patch Changes

- @voyantjs/availability@0.6.2
- @voyantjs/react@0.6.2

## 0.6.1

### Patch Changes

- @voyantjs/availability@0.6.1
- @voyantjs/react@0.6.1

## 0.6.0

### Patch Changes

- @voyantjs/availability@0.6.0
- @voyantjs/react@0.6.0

## 0.5.0

### Minor Changes

- ce72e29: Enrich availability list responses with product names via LEFT JOIN

  Availability list endpoints (rules, start-times, slots, closeouts, pickup-points, meeting-configs) now return `productName` alongside the raw `productId`, resolved via a LEFT JOIN against a minimal products table reference. Operator UIs no longer need a secondary product lookup query just to render display labels. The `productNameById` utility in `@voyantjs/availability-react` now accepts the server-provided name as a third argument and falls back to the client-side lookup.

### Patch Changes

- Updated dependencies [ce72e29]
  - @voyantjs/availability@0.5.0
  - @voyantjs/react@0.5.0

## 0.4.5

### Patch Changes

- @voyantjs/availability@0.4.5
- @voyantjs/react@0.4.5

## 0.4.4

### Patch Changes

- @voyantjs/availability@0.4.4
- @voyantjs/react@0.4.4

## 0.4.3

### Patch Changes

- @voyantjs/availability@0.4.3
- @voyantjs/react@0.4.3

## 0.4.2

### Patch Changes

- @voyantjs/availability@0.4.2
- @voyantjs/react@0.4.2

## 0.4.1

### Patch Changes

- @voyantjs/availability@0.4.1
- @voyantjs/react@0.4.1

## 0.4.0

### Patch Changes

- @voyantjs/availability@0.4.0
- @voyantjs/react@0.4.0

## 0.3.1

### Patch Changes

- @voyantjs/availability@0.3.1
- @voyantjs/react@0.3.1

## 0.3.0

### Patch Changes

- Updated dependencies [e57725d]
  - @voyantjs/availability@0.3.0
  - @voyantjs/react@0.3.0

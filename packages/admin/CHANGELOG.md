# @voyantjs/admin

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

## 0.107.0

### Minor Changes

- eeb23df: Packaged-admin RFC §4.8 (route assembly, increment 1) — framework half of
  `voyant admin generate --routes`:

  - `@voyantjs/admin` exports `requireAdminRoute(extension, routeId)` (plus the
    `BindableAdminRoute` type): looks up a route contribution by id and asserts
    it carries a component, so generated thin route files fail loudly at module
    evaluation when an extension stops shipping the route they bind.
    `AdminRouteRuntime.fetcher` is narrowed to the string-URL `VoyantFetcher`
    convention every `*-react` data client uses, so host fetchers (and the
    global `fetch`) bind directly into generated loaders.
  - `@voyantjs/core` manifest grows `admin.routes` (`AdminRoutesConfig`): the
    host route-tree directory and the runtime-import bindings (`apiUrlModule`/
    `apiUrlExport`, `fetcherModule`/`fetcherExport`) the route generator emits,
    with operator-convention defaults. Validated by `validateVoyantConfig`.

  The operator's promotions index route is now generated output of the new
  command (byte-for-byte reproducible from `@voyantjs/promotions-ui/admin`).

## 0.106.0

### Minor Changes

- 4ade734: Semantic admin navigation destinations (packaged-admin RFC §4.7): packaged
  admin pages navigate to routes they don't own (booking journey, supplier
  detail, product editor) without importing a host route tree.

  - `@voyantjs/admin`: new `AdminDestinations` interface (augmented by domain
    packages via `declare module "@voyantjs/admin"`), `AdminNavigationProvider`,
    and `useAdminHref`/`useAdminNavigate`. Unresolvable keys warn once per key
    and degrade to `"#"`/no-op — never a throw in render paths.
  - `@voyantjs/admin-app`: `AdminWorkspaceShell` accepts a `destinations`
    resolver map (`satisfies AdminDestinationResolvers` for exhaustiveness) and
    mounts the provider wired to the app router via `router.navigate({ href })`.
  - `@voyantjs/catalog-ui`: declares the catalog destination keys
    (`bookingJourney.start`, `catalog.browse`, `catalog.detail`,
    `product.detail`, `supplier.detail`) covering every cross-route target the
    operator's catalog wrappers navigate to.

- ee5b530: Packaged-admin RFC Phase 2 pilot (#1643): packages can ship admin pages.

  - `@voyantjs/admin`: `AdminUiRouteContribution` grows from metadata-only to
    the full route contract — optional `component`, `loader` (receives
    `{ queryClient, runtime }` with the host's baseUrl/fetcher),
    `validateSearch`, `ssr`, pending/error components, `capability`, and
    `preload`. Metadata-only contributions remain valid. New types
    `AdminRouteRuntime` and `AdminRouteLoaderContext`.
  - `@voyantjs/promotions-ui`: first `@voyantjs/<domain>-ui/admin` entrypoint.
    `createPromotionsAdminExtension({ label, icon, order, path })` contributes
    the nav entry AND the route implementation (PromotionsPage +
    loadPromotionsPage + SSR mode); the host supplies only label, icon, and
    runtime.

  The operator template consumes both: the local promotions extension is now a
  thin call into the package, and the promotions route file is a thin host that
  binds the package-owned page/loader to the file-based route tree (per-route
  provider removed — the shell's VoyantReactProvider already supplies the same
  context).

### Patch Changes

- Updated dependencies [3bd66e9]
- Updated dependencies [344e7b6]
  - @voyantjs/ui@0.106.0

## 0.105.2

### Patch Changes

- 65183fe: Expose stable dashboard aggregate query keys and the default dashboard date window so server-rendered admin apps can preload dashboard data through direct service access while keeping client query hydration aligned.

## 0.105.1

### Patch Changes

- Updated dependencies [7122c2a]
  - @voyantjs/i18n@0.106.0
  - @voyantjs/ui@0.105.1

## 0.105.0

### Patch Changes

- Updated dependencies [d1ad572]
  - @voyantjs/i18n@0.105.0
  - @voyantjs/ui@0.105.0

## 0.104.2

### Patch Changes

- cfa6af8: feat(finance): accounts-payable supplier invoices, profitability & end-to-end FX

  Adds the full accounts-payable vertical for #1506:

  - **Supplier invoices (AP)**: `supplier_invoices` / `supplier_invoice_lines` /
    `supplier_cost_allocations`, the `supplierInvoicesService` (create/update/
    setLines/setAllocations/payments), attachments, and admin API routes.
  - **Cost allocation**: two-step product → departure picker, configurable cost
    categories (managed under Settings), searchable comboboxes.
  - **Profitability**: per-departure / per-product / per-traveller P&L read model
    - dashboards, cost-by-category breakdown, charts, CSV export.
  - **Accountant share portal**: scoped, revocable token links (no login) exposing
    financials + client/supplier invoices with downloadable attachments, ZIP
    download, and an en/ro language switcher.
  - **End-to-end FX**: supplier invoices and cost allocations snapshot their
    accounting-base value at the FX rate effective on the issue date; the
    profitability rollup sums those recorded snapshots (per-transaction-date
    rates) instead of re-valuing aggregates at the latest rate.

  Supporting additive exports: `availability`/`bookings`/`suppliers` schema and
  linkable exports consumed by the finance read model, and new TypeID prefixes in
  `schema-kit`.

- Updated dependencies [cfa6af8]
  - @voyantjs/i18n@0.104.2
  - @voyantjs/ui@0.104.4

## 0.104.1

### Patch Changes

- @voyantjs/i18n@0.104.1
- @voyantjs/react@0.104.1
- @voyantjs/ui@0.104.1

## 0.104.0

### Patch Changes

- @voyantjs/i18n@0.104.0
- @voyantjs/react@0.104.0
- @voyantjs/ui@0.104.0

## 0.103.0

### Patch Changes

- Updated dependencies [a02f2f3]
  - @voyantjs/i18n@0.103.0
  - @voyantjs/react@0.103.0
  - @voyantjs/ui@0.103.0

## 0.102.0

### Patch Changes

- Updated dependencies [b6d0673]
  - @voyantjs/i18n@0.102.0
  - @voyantjs/react@0.102.0
  - @voyantjs/ui@0.102.0

## 0.101.2

### Patch Changes

- Updated dependencies [577eaf5]
- Updated dependencies [577eaf5]
  - @voyantjs/i18n@0.101.2
  - @voyantjs/react@0.101.2
  - @voyantjs/ui@0.101.2

## 0.101.1

### Patch Changes

- Updated dependencies [f736ba5]
  - @voyantjs/i18n@0.101.1
  - @voyantjs/react@0.101.1
  - @voyantjs/ui@0.101.1

## 0.101.0

### Patch Changes

- @voyantjs/i18n@0.101.0
- @voyantjs/react@0.101.0
- @voyantjs/ui@0.101.0

## 0.100.0

### Patch Changes

- @voyantjs/i18n@0.100.0
- @voyantjs/react@0.100.0
- @voyantjs/ui@0.100.0

## 0.99.0

### Patch Changes

- @voyantjs/i18n@0.99.0
- @voyantjs/react@0.99.0
- @voyantjs/ui@0.99.0

## 0.98.0

### Patch Changes

- @voyantjs/i18n@0.98.0
- @voyantjs/react@0.98.0
- @voyantjs/ui@0.98.0

## 0.97.0

### Patch Changes

- @voyantjs/i18n@0.97.0
- @voyantjs/react@0.97.0
- @voyantjs/ui@0.97.0

## 0.96.0

### Patch Changes

- @voyantjs/i18n@0.96.0
- @voyantjs/react@0.96.0
- @voyantjs/ui@0.96.0

## 0.95.0

### Patch Changes

- @voyantjs/i18n@0.95.0
- @voyantjs/react@0.95.0
- @voyantjs/ui@0.95.0

## 0.94.0

### Patch Changes

- @voyantjs/i18n@0.94.0
- @voyantjs/react@0.94.0
- @voyantjs/ui@0.94.0

## 0.93.0

### Patch Changes

- @voyantjs/i18n@0.93.0
- @voyantjs/react@0.93.0
- @voyantjs/ui@0.93.0

## 0.92.0

### Patch Changes

- @voyantjs/i18n@0.92.0
- @voyantjs/react@0.92.0
- @voyantjs/ui@0.92.0

## 0.91.0

### Patch Changes

- @voyantjs/i18n@0.91.0
- @voyantjs/react@0.91.0
- @voyantjs/ui@0.91.0

## 0.90.0

### Patch Changes

- @voyantjs/i18n@0.90.0
- @voyantjs/react@0.90.0
- @voyantjs/ui@0.90.0

## 0.89.0

### Patch Changes

- @voyantjs/i18n@0.89.0
- @voyantjs/react@0.89.0
- @voyantjs/ui@0.89.0

## 0.88.0

### Patch Changes

- @voyantjs/i18n@0.88.0
- @voyantjs/react@0.88.0
- @voyantjs/ui@0.88.0

## 0.87.1

### Patch Changes

- @voyantjs/i18n@0.87.1
- @voyantjs/react@0.87.1
- @voyantjs/ui@0.87.1

## 0.87.0

### Patch Changes

- @voyantjs/i18n@0.87.0
- @voyantjs/react@0.87.0
- @voyantjs/ui@0.87.0

## 0.86.0

### Patch Changes

- @voyantjs/i18n@0.86.0
- @voyantjs/react@0.86.0
- @voyantjs/ui@0.86.0

## 0.85.4

### Patch Changes

- @voyantjs/i18n@0.85.4
- @voyantjs/react@0.85.4
- @voyantjs/ui@0.85.4

## 0.85.3

### Patch Changes

- @voyantjs/i18n@0.85.3
- @voyantjs/react@0.85.3
- @voyantjs/ui@0.85.3

## 0.85.2

### Patch Changes

- @voyantjs/i18n@0.85.2
- @voyantjs/react@0.85.2
- @voyantjs/ui@0.85.2

## 0.85.1

### Patch Changes

- @voyantjs/i18n@0.85.1
- @voyantjs/react@0.85.1
- @voyantjs/ui@0.85.1

## 0.85.0

### Patch Changes

- @voyantjs/i18n@0.85.0
- @voyantjs/react@0.85.0
- @voyantjs/ui@0.85.0

## 0.84.4

### Patch Changes

- @voyantjs/i18n@0.84.4
- @voyantjs/react@0.84.4
- @voyantjs/ui@0.84.4

## 0.84.3

### Patch Changes

- Updated dependencies [9eadf50]
  - @voyantjs/i18n@0.84.3
  - @voyantjs/react@0.84.3
  - @voyantjs/ui@0.84.3

## 0.84.2

### Patch Changes

- @voyantjs/i18n@0.84.2
- @voyantjs/react@0.84.2
- @voyantjs/ui@0.84.2

## 0.84.1

### Patch Changes

- @voyantjs/i18n@0.84.1
- @voyantjs/react@0.84.1
- @voyantjs/ui@0.84.1

## 0.84.0

### Patch Changes

- Updated dependencies [5462f07]
  - @voyantjs/i18n@0.84.0
  - @voyantjs/react@0.84.0
  - @voyantjs/ui@0.84.0

## 0.83.1

### Patch Changes

- @voyantjs/i18n@0.83.1
- @voyantjs/react@0.83.1
- @voyantjs/ui@0.83.1

## 0.83.0

### Patch Changes

- @voyantjs/i18n@0.83.0
- @voyantjs/react@0.83.0
- @voyantjs/ui@0.83.0

## 0.82.1

### Patch Changes

- @voyantjs/i18n@0.82.1
- @voyantjs/react@0.82.1
- @voyantjs/ui@0.82.1

## 0.82.0

### Patch Changes

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

- Updated dependencies [79ce168]
  - @voyantjs/i18n@0.82.0
  - @voyantjs/react@0.82.0
  - @voyantjs/ui@0.82.0

## 0.81.21

### Patch Changes

- @voyantjs/i18n@0.81.21
- @voyantjs/react@0.81.21
- @voyantjs/ui@0.81.21

## 0.81.20

### Patch Changes

- @voyantjs/i18n@0.81.20
- @voyantjs/react@0.81.20
- @voyantjs/ui@0.81.20

## 0.81.19

### Patch Changes

- 62e4be5: Booking detail / list overhaul, part 2:

  **Activity tab**

  - Notes moved to the top, redesigned as a card grid (no more table). Add/edit via a new `BookingNoteDialog`; delete via `AlertDialog`. New backend endpoint `PATCH /v1/bookings/:id/notes/:noteId` + `bookingsService.updateNote` + `updateBookingNoteSchema` + `update` mutation on `useBookingNoteMutation`.
  - Activity timeline refactored to match the section-header pattern (no `Card` wrapper, `h2` + `Activity` icon + filter chips). Accepts `additionalEvents` + `footer` so action-ledger entries merge into the same chronological feed. New `action` filter chip surfaces only when ledger events are present.
  - Notes + activity entries now expose hydrated `authorName` / `actorName` (+ email fallback) via a server-side `LEFT JOIN auth.user` in `listNotes` / `listActivity`. UI renders name → email → id.
  - Client-side pagination on the timeline using the design-system `Pagination` / `PaginationLink` / `PaginationNext` primitives. Default page size 10, resets to page 1 on filter change.

  **Ledger tab removed** — entries flow into the unified Activity timeline via the new `useBookingActionLedgerEvents` hook (operator template), which keeps the cursor-based "Load more" pager rendered as the timeline's `footer`. `ledgerTab` slot + `tabLedger` i18n key dropped.

  **Metadata tab**

  - Tab renamed from "Meta" → "Metadata" (`tabMetadata`, value `metadata`).
  - Content redesigned as a definition-list of label-left / value-right rows surfacing booking id, booking number, status, communication language, created, updated. Uses the same `h2` + `Info` icon header as the rest.

  **Tab URL state**

  - `BookingDetailPage` accepts `activeTab` + `onTabChange` props (typed via new exported `BookingDetailTabValue`). Operator route wires these to a `tab` enum on its `validateSearch` schema. Refreshing or sharing `/bookings/:id?tab=activity` lands on the right tab.
  - Renamed `overview` tab value → `items` to match the (already-shipped) label.

  **Bookings list filters in URL**

  - New exported `BookingListFiltersState` shape. `BookingList` + `BookingsPage` accept `initialFilters?: Partial<BookingListFiltersState>` + `onFiltersChange?: (filters) => void`. Internal state collapsed into a single state object; every change emits a snapshot.
  - Operator route wires it through `validateSearch` (status, ids, dates, pax, sort, offset). URL stays clean: defaults are stripped before push, `navigate({ replace: true })` avoids history churn.
  - Bug fix: stripping `undefined` from the partial initial filters so an empty `/bookings` URL no longer clobbers the `BOOKING_STATUS_ALL` default and shows a phantom "Filters 2" badge on first land.

  **Bookings list table polish**

  - Columns reordered: `Booking # → Created → Payer → Items → Status → Total → Pax → Dates`.
  - `Sell amount` renamed to `Total`; `Start date/time` → `Dates`; `Lead` → `Payer`; search placeholder advertises what's matched (`"Search by booking #, payer, email, phone, or item…"`).
  - Backend search additionally matches item title + product-name snapshot (`exists (select 1 from booking_items …)`).
  - New compact, locale-aware `formatBookingDateRange` collapses shared month/year — `"Jun 15 – 20, 2026"` in en, `"15 – 20 iun., 2026"` in ro (uses `Intl.DateTimeFormat.formatToParts` to detect day-first order). Avoids the `Intl` `{day,year}` nonsense output by always building from named parts.
  - Primary item label includes a muted `({count} days)` tag computed from `startsAt` / `endsAt` (added to `bookingRecordItemSummarySchema` + server projection).
  - Hand-rolled prev/next pagination replaced with the design-system `Pagination` primitives (`BookingListPagination`), with ellipsis-windowed page numbers via `computePageWindow`.

  **Admin sidebar (`@voyantjs/admin`)**

  - `DefaultOperatorAdminBrand` adds `group-data-[collapsible=icon]:justify-center` so the brand mark centres correctly when the sidebar is collapsed to icon-only.
  - @voyantjs/i18n@0.81.19
  - @voyantjs/react@0.81.19
  - @voyantjs/ui@0.81.19

## 0.81.18

### Patch Changes

- Updated dependencies [93874e4]
  - @voyantjs/i18n@0.81.18
  - @voyantjs/react@0.81.18
  - @voyantjs/ui@0.81.18

## 0.81.17

### Patch Changes

- Updated dependencies [e31a008]
  - @voyantjs/i18n@0.81.17
  - @voyantjs/react@0.81.17
  - @voyantjs/ui@0.81.17

## 0.81.16

### Patch Changes

- Updated dependencies [0a617cc]
  - @voyantjs/i18n@0.81.16
  - @voyantjs/react@0.81.16
  - @voyantjs/ui@0.81.16

## 0.81.15

### Patch Changes

- @voyantjs/i18n@0.81.15
- @voyantjs/react@0.81.15
- @voyantjs/ui@0.81.15

## 0.81.14

### Patch Changes

- @voyantjs/i18n@0.81.14
- @voyantjs/react@0.81.14
- @voyantjs/ui@0.81.14

## 0.81.13

### Patch Changes

- Updated dependencies [36421aa]
  - @voyantjs/i18n@0.81.13
  - @voyantjs/react@0.81.13
  - @voyantjs/ui@0.81.13

## 0.81.12

### Patch Changes

- @voyantjs/i18n@0.81.12
- @voyantjs/react@0.81.12
- @voyantjs/ui@0.81.12

## 0.81.11

### Patch Changes

- @voyantjs/i18n@0.81.11
- @voyantjs/react@0.81.11
- @voyantjs/ui@0.81.11

## 0.81.10

### Patch Changes

- @voyantjs/i18n@0.81.10
- @voyantjs/react@0.81.10
- @voyantjs/ui@0.81.10

## 0.81.9

### Patch Changes

- @voyantjs/i18n@0.81.9
- @voyantjs/react@0.81.9
- @voyantjs/ui@0.81.9

## 0.81.8

### Patch Changes

- @voyantjs/i18n@0.81.8
- @voyantjs/react@0.81.8
- @voyantjs/ui@0.81.8

## 0.81.7

### Patch Changes

- @voyantjs/i18n@0.81.7
- @voyantjs/react@0.81.7
- @voyantjs/ui@0.81.7

## 0.81.6

### Patch Changes

- @voyantjs/i18n@0.81.6
- @voyantjs/react@0.81.6
- @voyantjs/ui@0.81.6

## 0.81.5

### Patch Changes

- @voyantjs/i18n@0.81.5
- @voyantjs/react@0.81.5
- @voyantjs/ui@0.81.5

## 0.81.4

### Patch Changes

- @voyantjs/i18n@0.81.4
- @voyantjs/react@0.81.4
- @voyantjs/ui@0.81.4

## 0.81.3

### Patch Changes

- Updated dependencies [f157bcd]
  - @voyantjs/i18n@0.81.3
  - @voyantjs/react@0.81.3
  - @voyantjs/ui@0.81.3

## 0.81.2

### Patch Changes

- @voyantjs/i18n@0.81.2
- @voyantjs/react@0.81.2
- @voyantjs/ui@0.81.2

## 0.81.1

### Patch Changes

- @voyantjs/i18n@0.81.1
- @voyantjs/react@0.81.1
- @voyantjs/ui@0.81.1

## 0.81.0

### Patch Changes

- @voyantjs/i18n@0.81.0
- @voyantjs/react@0.81.0
- @voyantjs/ui@0.81.0

## 0.80.18

### Patch Changes

- @voyantjs/i18n@0.80.18
- @voyantjs/react@0.80.18
- @voyantjs/ui@0.80.18

## 0.80.17

### Patch Changes

- @voyantjs/i18n@0.80.17
- @voyantjs/react@0.80.17
- @voyantjs/ui@0.80.17

## 0.80.16

### Patch Changes

- Updated dependencies [dbcc0da]
  - @voyantjs/i18n@0.80.16
  - @voyantjs/react@0.80.16
  - @voyantjs/ui@0.80.16

## 0.80.15

### Patch Changes

- @voyantjs/i18n@0.80.15
- @voyantjs/react@0.80.15
- @voyantjs/ui@0.80.15

## 0.80.14

### Patch Changes

- @voyantjs/i18n@0.80.14
- @voyantjs/react@0.80.14
- @voyantjs/ui@0.80.14

## 0.80.13

### Patch Changes

- @voyantjs/i18n@0.80.13
- @voyantjs/react@0.80.13
- @voyantjs/ui@0.80.13

## 0.80.12

### Patch Changes

- 5070731: Add finance invoice number series admin UI and localize issue-document allocation errors.
- Updated dependencies [5070731]
  - @voyantjs/i18n@0.80.12
  - @voyantjs/react@0.80.12
  - @voyantjs/ui@0.80.12

## 0.80.11

### Patch Changes

- @voyantjs/i18n@0.80.11
- @voyantjs/react@0.80.11
- @voyantjs/ui@0.80.11

## 0.80.10

### Patch Changes

- @voyantjs/i18n@0.80.10
- @voyantjs/react@0.80.10
- @voyantjs/ui@0.80.10

## 0.80.9

### Patch Changes

- @voyantjs/i18n@0.80.9
- @voyantjs/react@0.80.9
- @voyantjs/ui@0.80.9

## 0.80.8

### Patch Changes

- @voyantjs/i18n@0.80.8
- @voyantjs/react@0.80.8
- @voyantjs/ui@0.80.8

## 0.80.7

### Patch Changes

- @voyantjs/i18n@0.80.7
- @voyantjs/react@0.80.7
- @voyantjs/ui@0.80.7

## 0.80.6

### Patch Changes

- @voyantjs/i18n@0.80.6
- @voyantjs/react@0.80.6
- @voyantjs/ui@0.80.6

## 0.80.5

### Patch Changes

- @voyantjs/i18n@0.80.5
- @voyantjs/react@0.80.5
- @voyantjs/ui@0.80.5

## 0.80.4

### Patch Changes

- @voyantjs/i18n@0.80.4
- @voyantjs/react@0.80.4
- @voyantjs/ui@0.80.4

## 0.80.3

### Patch Changes

- @voyantjs/i18n@0.80.3
- @voyantjs/react@0.80.3
- @voyantjs/ui@0.80.3

## 0.80.2

### Patch Changes

- @voyantjs/i18n@0.80.2
- @voyantjs/react@0.80.2
- @voyantjs/ui@0.80.2

## 0.80.1

### Patch Changes

- @voyantjs/i18n@0.80.1
- @voyantjs/react@0.80.1
- @voyantjs/ui@0.80.1

## 0.80.0

### Patch Changes

- Updated dependencies [9473eb8]
  - @voyantjs/i18n@0.80.0
  - @voyantjs/react@0.80.0
  - @voyantjs/ui@0.80.0

## 0.79.0

### Patch Changes

- @voyantjs/i18n@0.79.0
- @voyantjs/react@0.79.0
- @voyantjs/ui@0.79.0

## 0.78.0

### Patch Changes

- @voyantjs/i18n@0.78.0
- @voyantjs/react@0.78.0
- @voyantjs/ui@0.78.0

## 0.77.13

### Patch Changes

- @voyantjs/i18n@0.77.13
- @voyantjs/react@0.77.13
- @voyantjs/ui@0.77.13

## 0.77.12

### Patch Changes

- Updated dependencies [bf74cd4]
  - @voyantjs/i18n@0.77.12
  - @voyantjs/react@0.77.12
  - @voyantjs/ui@0.77.12

## 0.77.11

### Patch Changes

- @voyantjs/i18n@0.77.11
- @voyantjs/react@0.77.11
- @voyantjs/ui@0.77.11

## 0.77.10

### Patch Changes

- @voyantjs/i18n@0.77.10
- @voyantjs/react@0.77.10
- @voyantjs/ui@0.77.10

## 0.77.9

### Patch Changes

- @voyantjs/i18n@0.77.9
- @voyantjs/react@0.77.9
- @voyantjs/ui@0.77.9

## 0.77.8

### Patch Changes

- @voyantjs/i18n@0.77.8
- @voyantjs/react@0.77.8
- @voyantjs/ui@0.77.8

## 0.77.7

### Patch Changes

- @voyantjs/i18n@0.77.7
- @voyantjs/react@0.77.7
- @voyantjs/ui@0.77.7

## 0.77.6

### Patch Changes

- @voyantjs/i18n@0.77.6
- @voyantjs/react@0.77.6
- @voyantjs/ui@0.77.6

## 0.77.5

### Patch Changes

- @voyantjs/i18n@0.77.5
- @voyantjs/react@0.77.5
- @voyantjs/ui@0.77.5

## 0.77.4

### Patch Changes

- @voyantjs/i18n@0.77.4
- @voyantjs/react@0.77.4
- @voyantjs/ui@0.77.4

## 0.77.3

### Patch Changes

- @voyantjs/i18n@0.77.3
- @voyantjs/react@0.77.3
- @voyantjs/ui@0.77.3

## 0.77.2

### Patch Changes

- @voyantjs/i18n@0.77.2
- @voyantjs/react@0.77.2
- @voyantjs/ui@0.77.2

## 0.77.1

### Patch Changes

- @voyantjs/i18n@0.77.1
- @voyantjs/react@0.77.1
- @voyantjs/ui@0.77.1

## 0.77.0

### Patch Changes

- @voyantjs/i18n@0.77.0
- @voyantjs/react@0.77.0
- @voyantjs/ui@0.77.0

## 0.76.0

### Patch Changes

- @voyantjs/i18n@0.76.0
- @voyantjs/react@0.76.0
- @voyantjs/ui@0.76.0

## 0.75.7

### Patch Changes

- @voyantjs/i18n@0.75.7
- @voyantjs/react@0.75.7
- @voyantjs/ui@0.75.7

## 0.75.6

### Patch Changes

- @voyantjs/i18n@0.75.6
- @voyantjs/react@0.75.6
- @voyantjs/ui@0.75.6

## 0.75.5

### Patch Changes

- @voyantjs/i18n@0.75.5
- @voyantjs/react@0.75.5
- @voyantjs/ui@0.75.5

## 0.75.4

### Patch Changes

- @voyantjs/i18n@0.75.4
- @voyantjs/react@0.75.4
- @voyantjs/ui@0.75.4

## 0.75.3

### Patch Changes

- Updated dependencies [38167cd]
  - @voyantjs/i18n@0.75.3
  - @voyantjs/react@0.75.3
  - @voyantjs/ui@0.75.3

## 0.75.2

### Patch Changes

- @voyantjs/i18n@0.75.2
- @voyantjs/react@0.75.2
- @voyantjs/ui@0.75.2

## 0.75.1

### Patch Changes

- @voyantjs/i18n@0.75.1
- @voyantjs/react@0.75.1
- @voyantjs/ui@0.75.1

## 0.75.0

### Patch Changes

- @voyantjs/i18n@0.75.0
- @voyantjs/react@0.75.0
- @voyantjs/ui@0.75.0

## 0.74.2

### Patch Changes

- @voyantjs/i18n@0.74.2
- @voyantjs/react@0.74.2
- @voyantjs/ui@0.74.2

## 0.74.1

### Patch Changes

- @voyantjs/i18n@0.74.1
- @voyantjs/react@0.74.1
- @voyantjs/ui@0.74.1

## 0.74.0

### Patch Changes

- @voyantjs/i18n@0.74.0
- @voyantjs/react@0.74.0
- @voyantjs/ui@0.74.0

## 0.73.1

### Patch Changes

- @voyantjs/i18n@0.73.1
- @voyantjs/react@0.73.1
- @voyantjs/ui@0.73.1

## 0.73.0

### Patch Changes

- @voyantjs/i18n@0.73.0
- @voyantjs/react@0.73.0
- @voyantjs/ui@0.73.0

## 0.72.0

### Patch Changes

- @voyantjs/i18n@0.72.0
- @voyantjs/react@0.72.0
- @voyantjs/ui@0.72.0

## 0.71.0

### Patch Changes

- @voyantjs/i18n@0.71.0
- @voyantjs/react@0.71.0
- @voyantjs/ui@0.71.0

## 0.70.0

### Patch Changes

- @voyantjs/i18n@0.70.0
- @voyantjs/react@0.70.0
- @voyantjs/ui@0.70.0

## 0.69.1

### Patch Changes

- @voyantjs/i18n@0.69.1
- @voyantjs/react@0.69.1
- @voyantjs/ui@0.69.1

## 0.69.0

### Patch Changes

- @voyantjs/i18n@0.69.0
- @voyantjs/react@0.69.0
- @voyantjs/ui@0.69.0

## 0.68.0

### Patch Changes

- @voyantjs/i18n@0.68.0
- @voyantjs/react@0.68.0
- @voyantjs/ui@0.68.0

## 0.67.0

### Patch Changes

- @voyantjs/i18n@0.67.0
- @voyantjs/react@0.67.0
- @voyantjs/ui@0.67.0

## 0.66.6

### Patch Changes

- @voyantjs/i18n@0.66.6
- @voyantjs/react@0.66.6
- @voyantjs/ui@0.66.6

## 0.66.5

### Patch Changes

- @voyantjs/i18n@0.66.5
- @voyantjs/react@0.66.5
- @voyantjs/ui@0.66.5

## 0.66.4

### Patch Changes

- @voyantjs/i18n@0.66.4
- @voyantjs/react@0.66.4
- @voyantjs/ui@0.66.4

## 0.66.3

### Patch Changes

- @voyantjs/i18n@0.66.3
- @voyantjs/react@0.66.3
- @voyantjs/ui@0.66.3

## 0.66.2

### Patch Changes

- @voyantjs/i18n@0.66.2
- @voyantjs/react@0.66.2
- @voyantjs/ui@0.66.2

## 0.66.1

### Patch Changes

- @voyantjs/i18n@0.66.1
- @voyantjs/react@0.66.1
- @voyantjs/ui@0.66.1

## 0.66.0

### Patch Changes

- Updated dependencies [a74089c]
  - @voyantjs/i18n@0.66.0
  - @voyantjs/react@0.66.0
  - @voyantjs/ui@0.66.0

## 0.65.0

### Patch Changes

- @voyantjs/i18n@0.65.0
- @voyantjs/react@0.65.0
- @voyantjs/ui@0.65.0

## 0.64.1

### Patch Changes

- @voyantjs/i18n@0.64.1
- @voyantjs/react@0.64.1
- @voyantjs/ui@0.64.1

## 0.64.0

### Patch Changes

- @voyantjs/i18n@0.64.0
- @voyantjs/react@0.64.0
- @voyantjs/ui@0.64.0

## 0.63.1

### Patch Changes

- @voyantjs/i18n@0.63.1
- @voyantjs/react@0.63.1
- @voyantjs/ui@0.63.1

## 0.63.0

### Patch Changes

- @voyantjs/i18n@0.63.0
- @voyantjs/react@0.63.0
- @voyantjs/ui@0.63.0

## 0.62.3

### Patch Changes

- @voyantjs/i18n@0.62.3
- @voyantjs/react@0.62.3
- @voyantjs/ui@0.62.3

## 0.62.2

### Patch Changes

- @voyantjs/i18n@0.62.2
- @voyantjs/react@0.62.2
- @voyantjs/ui@0.62.2

## 0.62.1

### Patch Changes

- @voyantjs/i18n@0.62.1
- @voyantjs/react@0.62.1
- @voyantjs/ui@0.62.1

## 0.62.0

### Patch Changes

- @voyantjs/i18n@0.62.0
- @voyantjs/react@0.62.0
- @voyantjs/ui@0.62.0

## 0.61.0

### Patch Changes

- Updated dependencies [89f033e]
  - @voyantjs/i18n@0.61.0
  - @voyantjs/react@0.61.0
  - @voyantjs/ui@0.61.0

## 0.60.0

### Patch Changes

- @voyantjs/i18n@0.60.0
- @voyantjs/react@0.60.0
- @voyantjs/ui@0.60.0

## 0.59.0

### Minor Changes

- 48927be: Release the changes accumulated on main since 0.58.0 that landed without
  their own changesets.

  - **products / products-react / products-ui** — add `inclusionsHtml` and
    `exclusionsHtml` rich-text fields on `ProductRecord` plus the supporting
    product-form + product-detail UI (#994). Consumer test fixtures may need
    `inclusionsHtml: null, exclusionsHtml: null` added.
  - **catalog** — widen `CancelResult.status` to include `"pending"` for
    adapters that submit async cancellations (email / partner portal / batch)
    with a `pending_channel` (#991). Downstream consumers using the narrow
    `"cancelled" | "refused" | "failed"` union need to either widen their
    surface or map `"pending"` at the boundary.
  - **ui** — drop heavy passthrough re-exports from `@voyantjs/ui/components`
    barrel: `RichTextEditor`, `chart`, `dashboard-widgets`, `phone-input`,
    and all `NotificationTemplate*` / `notification-template-dialog` /
    `notification-{deliveries,reminder-rules,reminder-runs}-page` entries.
    Import these via subpath from `@voyantjs/ui/components/<file>` instead
    (e.g. `@voyantjs/ui/components/rich-text-editor`). Was leaking ~600 KB
    of tiptap/prosemirror, ~390 KB of recharts, and ~200 KB of
    libphonenumber-js into every barrel consumer.
  - **admin** — drop `DashboardPage` from the `@voyantjs/admin` barrel for
    the same reason (recharts leakage). Import from
    `@voyantjs/admin/dashboard` instead.

### Patch Changes

- Updated dependencies [48927be]
  - @voyantjs/i18n@0.59.0
  - @voyantjs/react@0.59.0
  - @voyantjs/ui@0.59.0

## 0.58.0

### Patch Changes

- @voyantjs/i18n@0.58.0
- @voyantjs/react@0.58.0
- @voyantjs/ui@0.58.0

## 0.57.0

### Patch Changes

- @voyantjs/i18n@0.57.0
- @voyantjs/react@0.57.0
- @voyantjs/ui@0.57.0

## 0.56.0

### Patch Changes

- @voyantjs/i18n@0.56.0
- @voyantjs/react@0.56.0
- @voyantjs/ui@0.56.0

## 0.55.1

### Patch Changes

- 819c847: Ship the composed trip admin workflow and booking extras integration.

  Admin surfaces now include trip list/detail/composer routes, catalog-backed
  trip assembly, aggregate checkout handoff, payment-link trip summaries, and
  trip-aware navigation. Booking journeys and regular booking creation can route
  operators into the composer when the customer is building a multi-component
  itinerary.

  Catalog booking draft shapes now expose richer add-on offers, and owned product
  booking handlers can price and commit selected extras. Product detail pages can
  manage extras, booking create can select extras, and finance booking creation
  persists selected extras as booking items so invoices and payment links include
  them.

  Checkout payment pages now render clearer trip summaries, flight booking UI
  supports the refined baggage/one-way behavior used by the composer, shared UI
  exports the date-time field, and i18n includes the new trip admin copy.

- Updated dependencies [819c847]
  - @voyantjs/i18n@0.55.1
  - @voyantjs/react@0.55.1
  - @voyantjs/ui@0.55.1

## 0.55.0

### Patch Changes

- @voyantjs/i18n@0.55.0
- @voyantjs/react@0.55.0
- @voyantjs/ui@0.55.0

## 0.54.0

### Patch Changes

- @voyantjs/i18n@0.54.0
- @voyantjs/react@0.54.0
- @voyantjs/ui@0.54.0

## 0.53.2

### Patch Changes

- @voyantjs/i18n@0.53.2
- @voyantjs/react@0.53.2
- @voyantjs/ui@0.53.2

## 0.53.1

### Patch Changes

- @voyantjs/i18n@0.53.1
- @voyantjs/react@0.53.1
- @voyantjs/ui@0.53.1

## 0.53.0

### Patch Changes

- @voyantjs/i18n@0.53.0
- @voyantjs/react@0.53.0
- @voyantjs/ui@0.53.0

## 0.52.4

### Patch Changes

- Updated dependencies [5d3c119]
  - @voyantjs/i18n@0.52.4
  - @voyantjs/react@0.52.4
  - @voyantjs/ui@0.52.4

## 0.52.3

### Patch Changes

- @voyantjs/i18n@0.52.3
- @voyantjs/react@0.52.3
- @voyantjs/ui@0.52.3

## 0.52.2

### Patch Changes

- 3e09123: Admin shell + dashboard refresh.

  - New `AdminBreadcrumbs` primitive (exported from the package root) with a context-based registry so nested layouts can contribute crumbs without prop-drilling.
  - `DashboardPage` revenue/booking charts: keep raw status keys so `ChartContainer`'s config resolves the right localized labels for both legend and tooltip, and let the chart card span the full grid width with the empty-state branch rendered consistently with the other KPI cards.
  - `OperatorAdminSidebar` cleanup: navigation items and statuses (`COMING_SOON` / `BETA`) now flow through the shared `operator-navigation` config so the sidebar, command menu, and breadcrumbs stay in sync.
  - `dashboard-query-options` exposes the bookings/finance KPI keys consumed by the new dashboard layout.

- Updated dependencies [3e09123]
- Updated dependencies [6bdfcbc]
- Updated dependencies [3e09123]
  - @voyantjs/i18n@0.52.2
  - @voyantjs/react@0.52.2
  - @voyantjs/ui@0.52.2

## 0.52.1

### Patch Changes

- @voyantjs/i18n@0.52.1
- @voyantjs/react@0.52.1
- @voyantjs/ui@0.52.1

## 0.52.0

### Patch Changes

- @voyantjs/i18n@0.52.0
- @voyantjs/react@0.52.0
- @voyantjs/ui@0.52.0

## 0.51.1

### Patch Changes

- Updated dependencies [deaacb3]
  - @voyantjs/i18n@0.51.1
  - @voyantjs/react@0.51.1
  - @voyantjs/ui@0.51.1

## 0.51.0

### Patch Changes

- Updated dependencies [2316791]
  - @voyantjs/i18n@0.51.0
  - @voyantjs/react@0.51.0
  - @voyantjs/ui@0.51.0

## 0.50.8

### Patch Changes

- @voyantjs/i18n@0.50.8
- @voyantjs/react@0.50.8
- @voyantjs/ui@0.50.8

## 0.50.7

### Patch Changes

- @voyantjs/i18n@0.50.7
- @voyantjs/react@0.50.7
- @voyantjs/ui@0.50.7

## 0.50.6

### Patch Changes

- Updated dependencies [c14f0a8]
  - @voyantjs/i18n@0.50.6
  - @voyantjs/react@0.50.6
  - @voyantjs/ui@0.50.6

## 0.50.5

### Patch Changes

- @voyantjs/i18n@0.50.5
- @voyantjs/react@0.50.5
- @voyantjs/ui@0.50.5

## 0.50.4

### Patch Changes

- @voyantjs/i18n@0.50.4
- @voyantjs/react@0.50.4
- @voyantjs/ui@0.50.4

## 0.50.3

### Patch Changes

- @voyantjs/i18n@0.50.3
- @voyantjs/react@0.50.3
- @voyantjs/ui@0.50.3

## 0.50.2

### Patch Changes

- @voyantjs/i18n@0.50.2
- @voyantjs/react@0.50.2
- @voyantjs/ui@0.50.2

## 0.50.1

### Patch Changes

- @voyantjs/i18n@0.50.1
- @voyantjs/react@0.50.1
- @voyantjs/ui@0.50.1

## 0.50.0

### Patch Changes

- @voyantjs/i18n@0.50.0
- @voyantjs/react@0.50.0
- @voyantjs/ui@0.50.0

## 0.49.0

### Patch Changes

- @voyantjs/i18n@0.49.0
- @voyantjs/react@0.49.0
- @voyantjs/ui@0.49.0

## 0.48.0

### Patch Changes

- @voyantjs/i18n@0.48.0
- @voyantjs/react@0.48.0
- @voyantjs/ui@0.48.0

## 0.47.0

### Patch Changes

- @voyantjs/i18n@0.47.0
- @voyantjs/react@0.47.0
- @voyantjs/ui@0.47.0

## 0.46.0

### Patch Changes

- @voyantjs/i18n@0.46.0
- @voyantjs/react@0.46.0
- @voyantjs/ui@0.46.0

## 0.45.0

### Patch Changes

- @voyantjs/i18n@0.45.0
- @voyantjs/react@0.45.0
- @voyantjs/ui@0.45.0

## 0.44.0

### Patch Changes

- @voyantjs/i18n@0.44.0
- @voyantjs/react@0.44.0
- @voyantjs/ui@0.44.0

## 0.43.0

### Patch Changes

- @voyantjs/i18n@0.43.0
- @voyantjs/react@0.43.0
- @voyantjs/ui@0.43.0

## 0.42.0

### Patch Changes

- @voyantjs/i18n@0.42.0
- @voyantjs/react@0.42.0
- @voyantjs/ui@0.42.0

## 0.41.3

### Patch Changes

- @voyantjs/i18n@0.41.3
- @voyantjs/react@0.41.3
- @voyantjs/ui@0.41.3

## 0.41.2

### Patch Changes

- @voyantjs/i18n@0.41.2
- @voyantjs/react@0.41.2
- @voyantjs/ui@0.41.2

## 0.41.1

### Patch Changes

- @voyantjs/i18n@0.41.1
- @voyantjs/react@0.41.1
- @voyantjs/ui@0.41.1

## 0.41.0

### Patch Changes

- @voyantjs/i18n@0.41.0
- @voyantjs/react@0.41.0
- @voyantjs/ui@0.41.0

## 0.40.1

### Patch Changes

- @voyantjs/i18n@0.40.1
- @voyantjs/react@0.40.1
- @voyantjs/ui@0.40.1

## 0.40.0

### Patch Changes

- @voyantjs/i18n@0.40.0
- @voyantjs/react@0.40.0
- @voyantjs/ui@0.40.0

## 0.39.0

### Patch Changes

- Updated dependencies [f4235ea]
  - @voyantjs/i18n@0.39.0
  - @voyantjs/react@0.39.0
  - @voyantjs/ui@0.39.0

## 0.38.2

### Patch Changes

- @voyantjs/i18n@0.38.2
- @voyantjs/react@0.38.2
- @voyantjs/ui@0.38.2

## 0.38.1

### Patch Changes

- @voyantjs/i18n@0.38.1
- @voyantjs/react@0.38.1
- @voyantjs/ui@0.38.1

## 0.38.0

### Patch Changes

- @voyantjs/i18n@0.38.0
- @voyantjs/react@0.38.0
- @voyantjs/ui@0.38.0

## 0.37.1

### Patch Changes

- @voyantjs/i18n@0.37.1
- @voyantjs/react@0.37.1
- @voyantjs/ui@0.37.1

## 0.37.0

### Patch Changes

- 712a441: Add an operator admin page shell with breadcrumb, action, sidebar trigger, and padded content slots.
- Updated dependencies [dc29b79]
- Updated dependencies [f014fd2]
- Updated dependencies [0c9b884]
  - @voyantjs/i18n@0.37.0
  - @voyantjs/react@0.37.0
  - @voyantjs/ui@0.37.0

## 0.36.0

### Patch Changes

- @voyantjs/i18n@0.36.0
- @voyantjs/react@0.36.0
- @voyantjs/ui@0.36.0

## 0.35.0

### Patch Changes

- Updated dependencies [baa6134]
  - @voyantjs/i18n@0.35.0
  - @voyantjs/react@0.35.0
  - @voyantjs/ui@0.35.0

## 0.34.0

### Minor Changes

- 74f0331: Add locale-aware admin page metadata helpers and derive workspace titles from navigation.
- 6ad175a: Add dashboard empty states, KPI empty hints, and localized first-run onboarding copy.

### Patch Changes

- Updated dependencies [6ad175a]
- Updated dependencies [70ee277]
- Updated dependencies [f2d4802]
  - @voyantjs/i18n@0.34.0
  - @voyantjs/react@0.34.0
  - @voyantjs/ui@0.34.0

## 0.33.1

### Patch Changes

- @voyantjs/i18n@0.33.1
- @voyantjs/react@0.33.1
- @voyantjs/ui@0.33.1

## 0.33.0

### Patch Changes

- Updated dependencies [db46afc]
  - @voyantjs/i18n@0.33.0
  - @voyantjs/react@0.33.0
  - @voyantjs/ui@0.33.0

## 0.32.3

### Patch Changes

- Updated dependencies [7632a66]
  - @voyantjs/i18n@0.32.3
  - @voyantjs/react@0.32.3
  - @voyantjs/ui@0.32.3

## 0.32.2

### Patch Changes

- 778d35e: Align OperatorAdminWorkspaceLayout with the shadcn sidebar composition by using SidebarInset, exposing sidebar variant controls, adding a visible sidebar trigger, and shaping the default brand as a SidebarMenuButton.
- c1de5a1: Ship reusable Voyant mark and wordmark SVG components and use them in the default operator admin sidebar brand.
  - @voyantjs/i18n@0.32.2
  - @voyantjs/react@0.32.2
  - @voyantjs/ui@0.32.2

## 0.32.1

### Patch Changes

- @voyantjs/i18n@0.32.1
- @voyantjs/react@0.32.1
- @voyantjs/ui@0.32.1

## 0.32.0

### Patch Changes

- @voyantjs/i18n@0.32.0
- @voyantjs/react@0.32.0
- @voyantjs/ui@0.32.0

## 0.31.4

### Patch Changes

- @voyantjs/i18n@0.31.4
- @voyantjs/react@0.31.4
- @voyantjs/ui@0.31.4

## 0.31.3

### Patch Changes

- @voyantjs/i18n@0.31.3
- @voyantjs/react@0.31.3
- @voyantjs/ui@0.31.3

## 0.31.2

### Patch Changes

- Updated dependencies [54ddc93]
  - @voyantjs/i18n@0.31.2
  - @voyantjs/react@0.31.2
  - @voyantjs/ui@0.31.2

## 0.31.1

### Patch Changes

- Updated dependencies [00f7c4f]
  - @voyantjs/i18n@0.31.1
  - @voyantjs/react@0.31.1
  - @voyantjs/ui@0.31.1

## 0.31.0

### Minor Changes

- ee75afb: Publish the operator dashboard page composition, dashboard skeletons, and aggregate query helpers from `@voyantjs/admin`.
- ee75afb: Publish reusable TaxesPage and TeamSettingsPage settings compositions from their owning UI packages.

### Patch Changes

- @voyantjs/i18n@0.31.0
- @voyantjs/react@0.31.0
- @voyantjs/ui@0.31.0

## 0.30.7

### Patch Changes

- @voyantjs/i18n@0.30.7
- @voyantjs/react@0.30.7
- @voyantjs/ui@0.30.7

## 0.30.6

### Patch Changes

- @voyantjs/i18n@0.30.6
- @voyantjs/react@0.30.6
- @voyantjs/ui@0.30.6

## 0.30.5

### Patch Changes

- @voyantjs/i18n@0.30.5
- @voyantjs/react@0.30.5
- @voyantjs/ui@0.30.5

## 0.30.4

### Patch Changes

- @voyantjs/i18n@0.30.4
- @voyantjs/react@0.30.4
- @voyantjs/ui@0.30.4

## 0.30.3

### Patch Changes

- @voyantjs/i18n@0.30.3
- @voyantjs/react@0.30.3
- @voyantjs/ui@0.30.3

## 0.30.2

### Patch Changes

- @voyantjs/i18n@0.30.2
- @voyantjs/react@0.30.2
- @voyantjs/ui@0.30.2

## 0.30.1

### Patch Changes

- @voyantjs/i18n@0.30.1
- @voyantjs/react@0.30.1
- @voyantjs/ui@0.30.1

## 0.30.0

### Patch Changes

- @voyantjs/i18n@0.30.0
- @voyantjs/react@0.30.0
- @voyantjs/ui@0.30.0

## 0.29.0

### Patch Changes

- 4a6523e: Reminder sequences UI (#488).

  New `@voyantjs/notifications-ui` package with the reminder-sequence editing surface:

  - `<StageList />` — ordered stages per rule, with reorder + delete and an embedded channel list.
  - `<StageEditorDialog />` — anchor / window / cadence (`once` | `every_n_days` | `escalating(buckets[])`) / `maxSendsInStage` / `respectQuietHours`.
  - `<StageChannelList />` + `<StageChannelEditorDialog />` — per-stage multi-channel rows (channel, template, recipient kind, optional role).
  - `<NotificationSettingsForm />` — quiet hours / blackout dates / weekend skip / recipient daily cap / suppression window.
  - `<RemindersPreviewList />` — read-only "what would fire on this date" table with reasoning per row.
  - Full en/ro i18n with `NotificationsUiMessagesProvider`.

  Hooks added to `@voyantjs/notifications-react`:

  - `useReminderRuleStages`, `useReminderRuleStageMutation` (create, update, delete, reorder)
  - `useReminderStageChannels`, `useReminderStageChannelMutation`
  - `useNotificationSettings`, `useNotificationSettingsMutation`
  - `useRemindersPreview`

  Operator template wires up three new routes (`/notifications/reminder-rules/:id`, `/notifications/preview`, `/notifications/settings`) and the operator nav gains Preview + Settings entries.

- Updated dependencies [4a6523e]
- Updated dependencies [4a6523e]
- Updated dependencies [4a6523e]
- Updated dependencies [4a6523e]
  - @voyantjs/i18n@0.29.0
  - @voyantjs/react@0.29.0
  - @voyantjs/ui@0.29.0

## 0.28.3

### Patch Changes

- 60ef432: Add a unified payments listing that joins customer and supplier payments into a single feed, and split the operator finance area into separate Invoices and Payments pages.

  `@voyantjs/finance`:

  - New routes `GET /v1/admin/finance/payments` and `GET /v1/admin/finance/payments/:id`. The list endpoint accepts a `kind` filter (`customer` | `supplier`) plus the usual `status` / `paymentMethod` / `currency` / `invoiceId` / `bookingId` / `supplierId` / `paymentDateFrom` / `paymentDateTo` / `search` filters and `sortBy` (`amountCents` | `status` | `paymentDate` | `createdAt`) / `sortDir`. The detail endpoint dispatches by typeid prefix — `pay_*` resolves to a customer payment, `spay_*` resolves to a supplier payment. `bookingId` is applied to both branches: directly to `supplier_payments.booking_id` on the supplier side and via `invoices.booking_id` (joined as `i`) on the customer side, so a booking-scoped query no longer returns unrelated customer rows.
  - `financeService.listAllPayments(db, query)` and `financeService.getPaymentById(db, id)` return a `UnifiedPaymentRow` shape with normalized fields (`personName`, `organizationName`, `supplierName`, `invoiceNumber`, `bookingNumber`) joined in via SQL so the operator UI doesn't need follow-up lookups.
  - New exports: `UnifiedPaymentRow` (service.ts) and `paymentKindSchema` / `paymentListQuerySchema` / `paymentListSortFieldSchema` / `paymentListSortDirSchema` (validation-payments.ts).

  `@voyantjs/finance-react`:

  - New hooks: `useAllPayments(filters)` and `usePayment(id)` plus the underlying `getAllPaymentsQueryOptions` / `getPaymentQueryOptions` query-options factories.
  - New types: `FinancePaymentKind`, `FinanceAllPaymentsListFilters`, `FinanceAllPaymentsListSortField`, `FinanceAllPaymentsListSortDir`.
  - New schemas: `paymentKindSchema`, `unifiedPaymentRecordSchema`, `allPaymentsListResponse`, `paymentSingleResponse`, plus matching `UnifiedPaymentRecord` type.
  - New invoice-payment-mutation invalidation now also invalidates `financeQueryKeys.allPayments()` so the unified feed stays in sync with single-invoice payment flows.

  `@voyantjs/admin`:

  - Operator nav `finance` entry now points at `/finance/invoices` and exposes an `items` sub-nav with `invoices` and `payments` links, matching the new operator page split.

  `@voyantjs/i18n`:

  - Operator nav messages add `invoices` and `payments` (en + ro).
  - Admin finance messages add `invoicesPageTitle`/`invoicesPageDescription`, `paymentsPageTitle`/`paymentsPageDescription`, `recordPayment`, `searchPaymentsPlaceholder`, `kindColumn`/`kindCustomer`/`kindSupplier`/`partyColumn`/`filtersKindLabel`/`filtersKindAll`, plus the `paymentDetail` and `recordPaymentDialog` message groups (en + ro).

- Updated dependencies [60ef432]
- Updated dependencies [60ef432]
- Updated dependencies [60ef432]
- Updated dependencies [60ef432]
  - @voyantjs/i18n@0.28.3
  - @voyantjs/react@0.28.3
  - @voyantjs/ui@0.28.3

## 0.28.2

### Patch Changes

- @voyantjs/i18n@0.28.2
- @voyantjs/react@0.28.2
- @voyantjs/ui@0.28.2

## 0.28.1

### Patch Changes

- Updated dependencies [9d88eae]
  - @voyantjs/i18n@0.28.1
  - @voyantjs/react@0.28.1
  - @voyantjs/ui@0.28.1

## 0.28.0

### Patch Changes

- @voyantjs/i18n@0.28.0
- @voyantjs/react@0.28.0
- @voyantjs/ui@0.28.0

## 0.27.0

### Patch Changes

- Updated dependencies [dc46e37]
  - @voyantjs/i18n@0.27.0
  - @voyantjs/react@0.27.0
  - @voyantjs/ui@0.27.0

## 0.26.9

### Patch Changes

- Updated dependencies [24a121e]
  - @voyantjs/i18n@0.26.9
  - @voyantjs/react@0.26.9
  - @voyantjs/ui@0.26.9

## 0.26.8

### Patch Changes

- @voyantjs/i18n@0.26.8
- @voyantjs/react@0.26.8
- @voyantjs/ui@0.26.8

## 0.26.7

### Patch Changes

- @voyantjs/i18n@0.26.7
- @voyantjs/react@0.26.7
- @voyantjs/ui@0.26.7

## 0.26.6

### Patch Changes

- @voyantjs/i18n@0.26.6
- @voyantjs/react@0.26.6
- @voyantjs/ui@0.26.6

## 0.26.5

### Patch Changes

- @voyantjs/i18n@0.26.5
- @voyantjs/react@0.26.5
- @voyantjs/ui@0.26.5

## 0.26.4

### Patch Changes

- @voyantjs/i18n@0.26.4
- @voyantjs/react@0.26.4
- @voyantjs/ui@0.26.4

## 0.26.3

### Patch Changes

- @voyantjs/i18n@0.26.3
- @voyantjs/react@0.26.3
- @voyantjs/ui@0.26.3

## 0.26.2

### Patch Changes

- @voyantjs/i18n@0.26.2
- @voyantjs/react@0.26.2
- @voyantjs/ui@0.26.2

## 0.26.1

### Patch Changes

- @voyantjs/i18n@0.26.1
- @voyantjs/react@0.26.1
- @voyantjs/ui@0.26.1

## 0.26.0

### Patch Changes

- @voyantjs/i18n@0.26.0
- @voyantjs/react@0.26.0
- @voyantjs/ui@0.26.0

## 0.25.0

### Patch Changes

- @voyantjs/i18n@0.25.0
- @voyantjs/react@0.25.0
- @voyantjs/ui@0.25.0

## 0.24.3

### Patch Changes

- c112761: Add a single-tenant-first operator admin bootstrap gate and update first-party
  templates to render authenticated shells from current-user readiness instead of
  workspace or organization bootstrap state.
  - @voyantjs/i18n@0.24.3
  - @voyantjs/react@0.24.3
  - @voyantjs/ui@0.24.3

## 0.24.2

### Patch Changes

- @voyantjs/i18n@0.24.2
- @voyantjs/react@0.24.2
- @voyantjs/ui@0.24.2

## 0.24.1

### Patch Changes

- ed635c7: Expose consistent Tailwind v4 style helper imports across admin and UI packages,
  and document single-tenant auth shell bootstrap without mandatory workspace
  organization routes.
- Updated dependencies [ed635c7]
  - @voyantjs/i18n@0.24.1
  - @voyantjs/react@0.24.1
  - @voyantjs/ui@0.24.1

## 0.24.0

### Patch Changes

- @voyantjs/i18n@0.24.0
- @voyantjs/react@0.24.0
- @voyantjs/ui@0.24.0

## 0.23.0

### Patch Changes

- @voyantjs/i18n@0.23.0
- @voyantjs/react@0.23.0
- @voyantjs/ui@0.23.0

## 0.22.0

### Minor Changes

- 930ec96: Package reusable operator admin shell composition and availability UI surfaces.

  `@voyantjs/admin` now exports reusable operator shell providers, navigation helpers, sidebar/workspace layout components, widget slot rendering, locale preference sync, and operator message provider utilities.

  `@voyantjs/availability-ui` now provides reusable availability overview, tab panels, dialogs with app-owned mutation adapters, table column builders, status helpers, loading skeletons, section headers, and selection-label formatting for operator apps.

### Patch Changes

- @voyantjs/i18n@0.22.0
- @voyantjs/react@0.22.0
- @voyantjs/ui@0.22.0

## 0.21.1

### Patch Changes

- @voyantjs/i18n@0.21.1

## 0.21.0

### Patch Changes

- Updated dependencies [6427bad]
  - @voyantjs/i18n@0.21.0

## 0.20.0

### Patch Changes

- @voyantjs/i18n@0.20.0

## 0.19.0

### Patch Changes

- @voyantjs/i18n@0.19.0

## 0.18.0

### Patch Changes

- @voyantjs/i18n@0.18.0

## 0.17.0

### Minor Changes

- 66d722d: Published `@voyantjs/admin` (renamed from the previously-private `@voyantjs/voyant-admin`). The redundant scope/prefix was inconsistent with the rest of the workspace (`@voyantjs/auth`, `@voyantjs/crm`, …). Templates that referenced `@voyantjs/voyant-admin` as `workspace:*` now use `@voyantjs/admin` and resolve to the published package on scaffold.

  Includes the full publish setup: `tsconfig.build.json`, `build` / `prepack` scripts, `files: ["dist"]`, `publishConfig.exports` for all 9 subpaths (`.`, `./extensions`, `./providers/{theme,locale,query-client,admin-provider}`, `./lib/{i18n,initials}`, `./types`).

### Patch Changes

- Updated dependencies [66d722d]
  - @voyantjs/i18n@0.17.0

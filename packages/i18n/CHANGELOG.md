# @voyantjs/i18n

## 0.81.4

## 0.81.3

## 0.81.2

## 0.81.1

## 0.81.0

## 0.80.18

## 0.80.17

## 0.80.16

### Patch Changes

- dbcc0da: Add admin invoice voiding and route finance admin clients through `/v1/admin/finance`.

## 0.80.15

## 0.80.14

## 0.80.13

## 0.80.12

### Patch Changes

- 5070731: Add finance invoice number series admin UI and localize issue-document allocation errors.

## 0.80.11

## 0.80.10

## 0.80.9

## 0.80.8

## 0.80.7

## 0.80.6

## 0.80.5

## 0.80.4

## 0.80.3

## 0.80.2

## 0.80.1

## 0.80.0

### Patch Changes

- 9473eb8: Add booking checkout URL helpers and operator-facing URL template labels for booking checkout/payment links.

## 0.79.0

## 0.78.0

## 0.77.13

## 0.77.12

### Patch Changes

- bf74cd4: Rename the invoice issuance status from `sent` to `issued`.

## 0.77.11

## 0.77.10

## 0.77.9

## 0.77.8

## 0.77.7

## 0.77.6

## 0.77.5

## 0.77.4

## 0.77.3

## 0.77.2

## 0.77.1

## 0.77.0

## 0.76.0

## 0.75.7

## 0.75.6

## 0.75.5

## 0.75.4

## 0.75.3

### Patch Changes

- 38167cd: Allow manually numbered legal contracts and update operator contract dialog copy for template-free uploads.

## 0.75.2

## 0.75.1

## 0.75.0

## 0.74.2

## 0.74.1

## 0.74.0

## 0.73.1

## 0.73.0

## 0.72.0

## 0.71.0

## 0.70.0

## 0.69.1

## 0.69.0

## 0.68.0

## 0.67.0

## 0.66.6

## 0.66.5

## 0.66.4

## 0.66.3

## 0.66.2

## 0.66.1

## 0.66.0

### Minor Changes

- a74089c: Add operator admin message keys across the trips, bookings, legal, products, settings, action-ledger, availability, and resources bundles (en + ro) to back the operator template's voyant components subtree. All additions are additive — existing keys are unchanged.

## 0.65.0

## 0.64.1

## 0.64.0

## 0.63.1

## 0.63.0

## 0.62.3

## 0.62.2

## 0.62.1

## 0.62.0

## 0.61.0

### Patch Changes

- 89f033e: Add product-level terms and conditions fields to products and product translations. The products API, React runtime schemas, and products UI now expose product terms content, and deployment migrations add `terms_html` plus `terms_show_on_contract`.

## 0.60.0

## 0.59.0

## 0.58.0

## 0.57.0

## 0.56.0

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

## 0.55.0

## 0.54.0

## 0.53.2

## 0.53.1

## 0.53.0

## 0.52.4

## 0.52.3

## 0.52.2

### Patch Changes

- 3e09123: Quiet/auxiliary updates.

  - `@voyantjs/notifications`: `booking.confirmed` subscriber honors a new `suppressNotifications` flag on the event payload so operators can confirm a booking without firing the customer-facing email/doc bundle (data corrections, manual hand-offs).
  - `@voyantjs/customer-portal`: public service + validation tightened around the new booking tax-preview shape; integration tests updated to assert the new response.
  - `@voyantjs/i18n`: new admin strings for the bookings billing dialog, finance tax-preview labels, CRM operator screens, and products operator surface (EN + RO).

## 0.52.1

## 0.52.0

## 0.51.1

### Patch Changes

- deaacb3: Add a `manageAvailabilityAction` message under `products.products` (en + ro) used by the dmc product detail page's new "Manage availability" button (which deep-links into `/availability?productId=…`).

## 0.51.0

### Patch Changes

- 2316791: Redesign `AvailabilitySlotDetailPage` from a debug-dump card stack into a tabbed workspace.

  - One compact header (product name + date range + nights + status pills) replaces the start-date-concatenated-with-itself title and the three "Unlimited / Past Cutoff / Too Early : Yes/No" rows.
  - 4-cell **KPI strip** (pax remaining/initial, product, date, notes).
  - 5-tab body: **Allocation** (default) · **Pickup** · **Closeouts** · **Activity** · **Meta**. Counts render as badges on the tab triggers; empty tabs show one inline message instead of a full empty card. Activity bundles the audit log + resource-assignment list; Meta holds identifiers + lifecycle timestamps.
  - Null detail rows (rule / start time / ends at / initial pickups / remaining pickups / remaining resources) hide instead of rendering a dash.
  - New slot props on the package:
    - `breadcrumb?: ReactNode` — host renders breadcrumbs in its own chrome (sidebar inset top bar).
    - `headerActions?: ReactNode` — host can override the in-page Open product / Delete buttons and render them elsewhere.
    - `renderAllocation?: ({ slotId, productId }) => ReactNode` — host mounts the allocation manager (keeps `availability-ui` free of any runtime dependency on `allocation-ui`).
  - Product / start time rows in the Meta tab are real links via the existing `onOpenProduct` / `onOpenStartTime` callbacks.

  `@voyantjs/i18n`: new keys under `availability.details.tabs.*` for the detail page's tabbed body (en + ro).

## 0.50.8

## 0.50.7

## 0.50.6

## 0.50.5

## 0.50.4

## 0.50.3

## 0.50.2

## 0.50.1

## 0.50.0

## 0.49.0

## 0.48.0

## 0.47.0

## 0.46.0

## 0.45.0

## 0.44.0

## 0.43.0

## 0.42.0

## 0.41.3

## 0.41.2

## 0.41.1

## 0.41.0

## 0.40.1

## 0.40.0

## 0.39.0

## 0.38.2

## 0.38.1

## 0.38.0

## 0.37.1

## 0.37.0

### Patch Changes

- dc29b79: Persist operator-confirmed booking totals from the create dialog and audit manual price overrides with a required reason.
- f014fd2: Capture manual base-currency settlement amounts for cross-currency customer and supplier payments, and settle invoice balances from the base invoice amount.

## 0.36.0

## 0.35.0

## 0.34.0

### Patch Changes

- 6ad175a: Add dashboard empty states, KPI empty hints, and localized first-run onboarding copy.

## 0.33.1

## 0.33.0

## 0.32.3

## 0.32.2

## 0.32.1

## 0.32.0

## 0.31.4

## 0.31.3

## 0.31.2

### Patch Changes

- 54ddc93: Add API token management powered by Better Auth API keys, including reusable React hooks, a shared auth UI package, canonical permission presets, and API-key route permission guards.

## 0.31.1

## 0.31.0

## 0.30.7

## 0.30.6

## 0.30.5

## 0.30.4

## 0.30.3

## 0.30.2

## 0.30.1

## 0.30.0

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

- 60ef432: Reject the contradictory combination of `option_price_rules.pricing_mode = "per_booking"` and child per-unit prices, and stop the admin UI from offering the unit-pricing matrix on a per-booking rule (#482).

  Before: an `option_price_rule` with `pricingMode = "per_booking"` could carry rows in `option_unit_price_rules`. The storefront totaller in `service-departures.ts` switches on the _unit-level_ `pricingMode`, so the rule-level `per_booking` badge was effectively cosmetic — the rule said "single flat amount per booking", the math actually multiplied per-unit prices by quantity. Operators saw "Per Booking" and reasonably expected a flat charge; the system did something different.

  After:

  - `pricingService.createOptionUnitPriceRule` rejects (400) creating a unit-price row whose parent rule has `pricingMode = "per_booking"`.
  - `pricingService.updateOptionPriceRule` rejects (400) flipping a rule to `pricingMode = "per_booking"` when child unit-price rows already exist.
  - The product-options pricing form in the operator template and apps/dev hides the unit-pricing matrix when the rule is per-booking and shows a helper pointing the user at Per Person / Starting From if they want unit-level prices.
  - New i18n key `priceRules.perBookingFlatHint` (en + ro).

  Choosing one mode over the other isn't lossy — operators on rules currently configured as `per_booking` with unit prices were already getting the unit-level math; the badge will now match the math after they switch the rule's mode (typically to `per_person` or `per_unit` at the unit level).

## 0.28.2

## 0.28.1

## 0.28.0

## 0.27.0

### Patch Changes

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

## 0.26.9

### Patch Changes

- 24a121e: Add admin strings for the simplified per-unit pricing table (#466).

  The operator UI now hides the unit×category pricing matrix when a price rule uses `pricingMode = "per_person"` and `allPricingCategories = true` — the pax-bucket unit (Adult / Child / Infant) already encodes the differentiation, so the 12-column room/group/category matrix is just noise on day-trip products. Three new strings power the simplified table:

  - `products.operations.priceRules.unitPricingTitle` — section title when the simple table renders
  - `products.operations.priceRules.tableSell` — Sell column header
  - `products.operations.priceRules.tableCost` — Cost column header (reserved for future per-unit cost editing)

  Existing `unitCategoryTitle` and `tableUnit` strings still drive the full matrix when `allPricingCategories` is off.

## 0.26.8

## 0.26.7

## 0.26.6

## 0.26.5

## 0.26.4

## 0.26.3

## 0.26.2

## 0.26.1

## 0.26.0

## 0.25.0

## 0.24.3

## 0.24.2

## 0.24.1

## 0.24.0

## 0.23.0

## 0.22.0

## 0.21.1

## 0.21.0

### Minor Changes

- 6427bad: Release the booking journey architecture train.

  This adds booking hold policy support, richer traveler and booking journey flows, operator tax policy configuration, finance billing and tax policy APIs, notification reminder target and delivery tooling, and the template/runtime wiring needed for the operator storefront checkout flow.

## 0.20.0

## 0.19.0

## 0.18.0

## 0.17.0

### Minor Changes

- 66d722d: Complete the UI i18n rollout: every `*-ui` package now ships locale-aware messages with English + Romanian definitions, a `MessagesProvider`, and a parity test harness. New packages adding UI components should mirror the same shape (see `packages/suppliers-ui` as the reference).

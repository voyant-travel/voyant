# @voyantjs/bookings

## 0.14.0

### Patch Changes

- @voyantjs/core@0.14.0
- @voyantjs/db@0.14.0
- @voyantjs/hono@0.14.0
- @voyantjs/utils@0.14.0

## 0.13.0

### Minor Changes

- 7dfbc05: Export `dispatchBookingStatusChange` from `@voyantjs/bookings/status-dispatch` (also re-exported from the package barrel).

  Framework-agnostic helper that maps `(currentStatus, targetStatus)` → the right verb endpoint (`/confirm`, `/expire`, `/start`, `/complete`, `/cancel`, or `/override-status` for non-adjacent jumps) and the body the server expects. Lets non-React consumers — operator tooling using a generic `api.patch`, server-to-server scripts, third-party storefront builds — reuse the dispatch table that previously lived only inside `bookings-react`'s `useBookingStatusMutation`.

  `useBookingStatusMutation` and `useBookingStatusByIdMutation` now delegate to this helper; behaviour is unchanged.

  ```ts
  import { dispatchBookingStatusChange } from "@voyantjs/bookings/status-dispatch";

  const target = dispatchBookingStatusChange(
    bookingId,
    "on_hold",
    "confirmed",
    "ok by ops"
  );
  await fetch(`${apiBase}${target.path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(target.body),
  });
  ```

- 15dda79: Add `bookingsService.createTravelerWithTravelDetails` and `updateTravelerWithTravelDetails` — convenience verbs that take the same flat payload shape `createTravelerRecord` accepted before 0.10 (with `dateOfBirth` / `nationality` / `passportNumber` / `passportExpiry` / `dietaryRequirements` / `accessibilityNeeds` / `isLeadTraveler` included) and internally fan out to `createTravelerRecord` + `BookingPiiService.upsertTravelerTravelDetails`. The storage split (plaintext columns + encrypted envelope) is preserved at rest — only the call ergonomics collapse.

  Migration boundary helper for consumers coming from the pre-0.10 single-call shape: instead of learning the encrypted PII service contract just to keep parity with the dropped `accessibility_needs` column, you can pass one flat object as before.

  Also adds `accessibilityNeeds` to `upsertTravelerTravelDetailsSchema` (the underlying PII service has always supported it; the public-facing schema was missing it).

  ```ts
  import { bookingsService, createBookingPiiService } from "@voyantjs/bookings";

  const pii = createBookingPiiService({ kms });

  const result = await bookingsService.createTravelerWithTravelDetails(
    db,
    bookingId,
    {
      participantType: "traveler",
      firstName: "Ana",
      lastName: "Traveler",
      email: "ana@example.com",
      nationality: "RO",
      passportNumber: "ABC123",
      accessibilityNeeds: "wheelchair access",
      isLeadTraveler: true,
    },
    { pii, userId: actorId, actorId }
  );
  // → { traveler, travelDetails }
  ```

  Operations are sequential, not transactional — a failure in the encrypted-fields write leaves the plaintext row in place (matching the pre-helper two-call protocol).

### Patch Changes

- @voyantjs/core@0.13.0
- @voyantjs/db@0.13.0
- @voyantjs/hono@0.13.0
- @voyantjs/utils@0.13.0

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

- 944d244: Adds the charters module — a new opt-in vertical for yacht-charter brands carved out of cruises (operators selling Aman, Four Seasons, Ritz-Carlton, SeaDream, A&K, Orient Express style products), designed natively against Voyant's existing module/extension/link conventions and the broker-mediated yacht-charter data shape (whole-yacht vs per-suite, MYBA contracts, APA, multi-currency native pricing).

  **`@voyantjs/charters`** — full server module:

  - 5 tables: charter_products (one per brand × yacht configuration), charter_voyages (a specific dated trip), charter_yachts (vessel specs + crew), charter_suites (per-voyage suite pricing, all four first-class currencies as explicit columns), charter_schedule_days (flat per-voyage itinerary; no template/override two-tier — charter schedules are negotiable).
  - Two booking modes per voyage: `per_suite` and `whole_yacht`. Voyages opt into either or both; whole-yacht requires a resolvable APA percent and an MYBA contract template ref.
  - Multi-currency native (USD/EUR/GBP/AUD as explicit price columns, not derived). `pricingService.quotePerSuite` and `quoteWholeYacht` use pure BigInt-cent math; no float drift. APA computed as integer basis points.
  - `booking_charter_details` 1:1 extension on bookings: `bookingMode` discriminator, source/sourceProvider/sourceRef provenance, multi-currency snapshot fields, MYBA contract id (soft FK to legal.contracts), and APA reconciliation state (paid / spent / refund / settledAt).
  - `chartersBookingService` with four entry points — local + external × per-suite + whole-yacht. Each commits in a single transaction (atomic booking + travelers + extension snapshot). External flows commit upstream BEFORE local writes so the upstream rejection path is loud.
  - `mybaService.generateContract` is DI-shaped — accepts a `CharterContractsService` so charters takes no hard dep on `@voyantjs/legal`. Idempotent; respects voyage override → product default → injected service default precedence.
  - APA reconciliation: `recordApaPayment` (collected from charterer pre-charter) and `reconcileApa` (records on-board spend + refund balance + optional settle stamp). Routes mounted as a `bookings` extension at `POST /v1/admin/bookings/:bookingId/charter-details/apa/{payment,reconcile}`.
  - **Provenance — local + external in one experience.** Charters can be self-managed (operator owns the rows) or external (sourced through a registered `CharterAdapter`). Admin + public routes use a unified-key parser that accepts both `chrt_*` / `chrv_*` / `chry_*` TypeIDs and `<provider>:<ref>` external keys; list endpoints fan out to all registered adapters via parallel `Promise.allSettled`. External writes return 409.
  - Adapter contract (`@voyantjs/charters/adapters`): `CharterAdapter` interface with `listEntries` / `fetchProduct` / `fetchVoyage` / `fetchVoyageSuites` / `fetchVoyageSchedule` / `fetchYacht` / `listVoyagesForProduct` / `createPerSuiteBooking` / `createWholeYachtBooking`. Process-local registry, TTL+LRU memoize decorator, and `MockCharterAdapter` for tests with seeders + `failEveryNthCall` for error-path coverage.
  - Unlike cruises, charters has NO search index — the operator universe is small (six brands in v1) so adapter fan-out per request is plenty.
  - 77 unit tests covering pricing math (USD/EUR/GBP/AUD currency resolution, fractional APA percentages, BigInt cent precision), MYBA service (idempotency, template precedence, variable propagation), booking-extension validation (mode-specific refinements, external provenance rules), routes (invalid keys, write rejections, external dispatch with adapter, MYBA endpoint without contracts service), adapter registry / mock / memoize.

  **`@voyantjs/charters-react`** — React Query hooks + Zod fetch client:

  - ~15 hooks: `useCharterProducts` / `useCharterProduct` / `useCharterProductMutation`, `useCharterVoyages` / `useCharterVoyage`, `useCharterYachts` / `useCharterYacht`, `usePerSuiteQuote` / `useWholeYachtQuote`, `useCharterBookingMutation` (per-suite + whole-yacht — server dispatches local vs external), `useGenerateMybaContract`, `useCharterDetails` / `useRecordApaPayment` / `useReconcileApa`, plus public-surface variants.
  - Mirrors `@voyantjs/cruises-react` exactly: hierarchical query keys rooted at `["voyant", "charters"]`, `queryOptions()` factories for SSR/router prefetch, envelope helpers, `VoyantChartersProvider`, mutations that invalidate the parent resource and `setQueryData` on the detail. Detail responses union local + external dispatch shapes so callers handle provenance with a discriminated check.
  - 15 unit tests across query keys, the validating fetcher (URL join, error extraction, schema mismatch handling, Content-Type defaulting), and query-option factories (URL serialisation, unified-key encoding, public-vs-admin surface routing).

  **`@voyantjs/bookings`**: no schema changes; charters integrates as a 1:1 extension table. Patch bump captures the dependency edge.

  **`@voyantjs/db`**: registers TypeID prefixes for the charter namespace (`chrt`, `chrv`, `chry`, `chst`, `chrd`).

  **`@voyantjs/voyant-ui`** (registry only — versionless): adds the `voyant-charters-*` shadcn registry components — `external-badge`, `charter-product-card` (works for both local records and external summaries), `voyage-suite-grid` (per-suite pricing matrix with category, availability badge, multi-currency price, quote/book CTA), `whole-yacht-quote-card` (charter fee + APA + total + explanatory copy; ships with a per-suite sibling), `apa-tracker` (pre-/post-charter APA reconciliation panel with collected / spent / refund / settled state). Install via `shadcn add voyant-charters-charter-product-card` etc.

  **Design doc**: full rationale, schema, and architecture in `docs/architecture/charters-module.md`.

- Updated dependencies [944d244]
- Updated dependencies [cc561ce]
  - @voyantjs/core@0.12.0
  - @voyantjs/db@0.12.0
  - @voyantjs/hono@0.12.0
  - @voyantjs/utils@0.12.0

## 0.11.0

### Minor Changes

- fe905b0: **BREAKING:** privatize the Booking state machine; add Start, Complete, and Override verbs.

  The transition graph (`BOOKING_TRANSITIONS`, `canTransitionBooking`, `transitionBooking`, `BookingStatusPatch`, `BookingTransitionError`) is no longer part of the `@voyantjs/bookings` public surface. The lifecycle laws live behind the service-verb seam — callers cross it via named verbs in the ubiquitous language. `BookingStatus` stays exported (it's data).

  **HTTP — verb routes replace the generic status PATCH:**

  - `PATCH /:id/status` is **removed**.
  - `POST /:id/start` — confirmed → in_progress (new). Emits `booking.started`.
  - `POST /:id/complete` — in_progress → completed (new). Emits `booking.completed`. Cascades confirmed allocations + items to `fulfilled`.
  - `POST /:id/override-status` — admin override that bypasses the transition graph (new). Updates the Booking row only; does **not** cascade. Requires a non-empty `reason`. Emits `booking.status_overridden` as a privileged audit signal distinct from the normal lifecycle events.

  `POST /:id/confirm`, `/:id/cancel`, `/:id/expire`, `/:id/extend-hold` are unchanged.

  **Service:**

  - `bookingsService.updateBookingStatus(...)` is **removed**.
  - `bookingsService.startBooking(...)`, `.completeBooking(...)`, `.overrideBookingStatus(...)` are added.
  - `updateBookingStatusSchema` is removed; `startBookingSchema`, `completeBookingSchema`, `overrideBookingStatusSchema` are added.
  - Activity-type enum gains `booking_started`, `booking_completed`, `status_overridden`. Run `drizzle-kit push` to sync.

  **React (`@voyantjs/bookings-react`):**

  `useBookingStatusMutation` / `useBookingStatusByIdMutation` now require `currentStatus` in their input. The hook dispatches client-side to the right verb endpoint; non-adjacent jumps fall through to `/override-status`, using the operator's note as the reason. The `<StatusChangeDialog>` UX is unchanged — pass the booking's current status from props.

  **Domain language:** `Start`, `Complete`, and `Override` are added to UBIQUITOUS_LANGUAGE.md as Booking-scoped lifecycle verbs.

  **Migration:**

  - Remove imports of `BOOKING_TRANSITIONS` / `canTransitionBooking` / `transitionBooking` / `BookingTransitionError` / `BookingStatusPatch` from `@voyantjs/bookings` — call the service verbs instead. Internal callers (within this monorepo) had none.
  - Replace `PATCH /v1/bookings/:id/status` calls with the matching verb endpoint, or `/override-status` with a `reason`.
  - Update calls to the React status hooks to pass `currentStatus`.

### Patch Changes

- @voyantjs/core@0.11.0
- @voyantjs/db@0.11.0
- @voyantjs/hono@0.11.0
- @voyantjs/utils@0.11.0

## 0.10.0

### Minor Changes

- 29a581a: Auto-rollup booking total from `booking_items`. `bookingsService.recomputeBookingTotal(db, bookingId)` is now wired into `createItem` / `updateItem` / `deleteItem`, each wrapped in `db.transaction` so partial failures can never leave the parent total stale.

  Also exposed publicly for ad-hoc invocation (saga compensation, fix-up scripts).

  Base-currency totals (`baseSellAmountCents` / `baseCostAmountCents`) are NOT recomputed by this rollup — those are FX-derived and handled by the FX rollup added in the same release.

- 29a581a: **BREAKING:** encrypt `accessibilityNeeds` at rest. Move accessibility info from a plaintext column on `booking_travelers` into the KMS-encrypted `booking_traveler_travel_details` envelope (alongside passport / nationality / DOB / dietary).

  Disability data has tighter regulatory expectations in many jurisdictions (ADA / Equality Act) than freeform notes, so it lives with the passport-class data, not with `specialRequests` or `notes`.

  **Migration:**

  - The `booking_travelers.accessibility_needs` column is dropped.
  - `accessibilityNeeds` is removed from `bookingTravelerRecord`, `BookingTraveler*` insert/update validation schemas, `redactTravelerIdentity`, and the bookings-react / finance / scripts surface.
  - Read accessibility data through `createBookingPiiService.getTravelerTravelDetails`, which decrypts via `decryptOptionalJsonEnvelope` + audits the access. Same authorisation gate as the existing dietary / identity buckets.

  Contact identifiers (email, phone, names, address) and `specialRequests` deliberately stay plaintext — see `docs/architecture/booking-pii.md` for the cost-benefit decision.

- 29a581a: FX rollup for `base_*_amount_cents` on item mutations. `bookingsService.recomputeBookingTotal` now re-derives `baseSellAmountCents` / `baseCostAmountCents` from per-item totals when the booking declares a `baseCurrency` and `fxRateSetId`.

  Schema: `bookings.fx_rate_set_id` (text, nullable) — plain text per the cross-domain FK rule (reference into the markets package).

  FX behaviour:

  - **Single-currency** (`baseCurrency` null OR every item's `sellCurrency === baseCurrency`): conversion is a no-op, `base*Cents` track `sell*Cents` 1:1. `fxStatus: "ok"`.
  - **Multi-currency with valid FX**: each item converted via `exchange_rates` (direct rate or `inverse_rate_decimal` if direct row missing), summed. `fxStatus: "ok"`.
  - **Missing rate**: short-circuits with `fxStatus: "missing_rate"`; `base*Cents` left unchanged on the parent. Caller decides.
  - **No `fxRateSetId` configured**: skipped, `fxStatus: "skipped"`, `base*Cents` stay null.

- 29a581a: Add `Idempotency-Key` header protocol for non-idempotent booking-creation endpoints.

  Same key + same body replays the original response; same key + different body returns `409 Conflict`. Records expire after 24h. Wired (with `required: false` default) into:

  - `POST /v1/admin/bookings/`
  - `POST /v1/admin/bookings/reserve`
  - `POST /v1/admin/bookings/from-product`
  - `POST /v1/admin/bookings/from-offer/:offerId/reserve`
  - `POST /v1/admin/bookings/from-order/:orderId/reserve`
  - `POST /v1/public/bookings/sessions`
  - `POST /v1/public/bookings/sessions/:sessionId/confirm`

  Ships:

  - `idempotency_keys` table in `@voyantjs/db/schema/infra` keyed by `(scope, key)`, with body-hash, captured response, and TTL.
  - `idempotencyKey({ scope, required? })` middleware in `@voyantjs/hono` that reads the header, replays/conflicts/expires, and captures `2xx` JSON responses. Echoes `Idempotency-Key` + `Idempotency-Replayed: true` on replay.
  - `purgeExpiredIdempotencyKeys()` helper for daily-cron cleanup.

  Backwards-compatible: clients without the header continue to work. Templates can flip a route to `required: true` per endpoint once their client has rolled out.

- 29a581a: Add route-layer PII redaction + mandatory audit on the bookings admin read surface.

  `GET /v1/admin/bookings`, `GET /v1/admin/bookings/:id`, and `GET /v1/admin/bookings/:id/travelers` now:

  - Check `shouldRevealBookingPii(ctx)` against actor / scopes / caller type
  - Call `logBookingPiiAccess` with reason (`list_redacted` / `detail_reveal` / `insufficient_scope`) and metadata including row count
  - Mask contact PII (name, email, phone, address) in the response unless the caller has the `bookings-pii:read` (or `bookings-pii:*` / `*` superuser) scope, or the request is internal

  Exported helpers: `shouldRevealBookingPii`, `redactBookingContact`, `redactTravelerIdentity`, `redactEmail`, `redactPhone`, `redactString`. Surface area + posture documented in `docs/architecture/booking-pii.md`.

- 29a581a: Add `refundBooking` saga — atomic credit-note + hold-release + supplier-reverse + notify, built on the existing `createWorkflow` primitive.

  Side-effect dependencies are injected (no compile-time pull on finance / transactions / notifications) so the package stays slim; templates wire the deps.

  Step graph with reverse-order compensation:

  1. `validate-state` — refundable only when `confirmed`, `in_progress`, or `on_hold`. Rejects partial amounts outside `[0, sellAmountCents]`.
  2. `create-credit-note` — short-circuits when `refundAmount === 0`. Compensation: void.
  3. `release-inventory` — releases held + confirmed allocations, restores slot capacity. Compensation: re-decrement (loud failure if re-sold, intentional).
  4. `reverse-supplier-offer` — best-effort.
  5. `transition-booking` → `cancelled` via `transitionBooking()` (state-machine guard).
  6. `notify-customer` — fire-and-forget.

  Exports `refundBooking(input, deps)` and `buildRefundBookingWorkflow(deps)` for callers that want to inspect the workflow definition or run it via a JobRunner.

- 29a581a: **BREAKING:** introduce explicit booking state machine with `transitionBooking()` guards.

  Bookings now move through a typed state graph (`draft` → `on_hold` → `confirmed` → `in_progress` → `completed`, with `cancelled` / `expired` as terminal exits). Direct status writes are no longer permitted from service code — use `transitionBooking(bookingId, nextStatus, ctx)`, which enforces `BOOKING_TRANSITIONS` and emits an activity log row per transition.

  **Migration:**

  - Replace any `db.update(bookings).set({ status: ... })` in caller code with `transitionBooking()`.
  - The `redeemed` status is removed (it was a vouchers-domain concept that didn't apply here). Anything that read it should now look at `completed`.
  - The new `in_progress` status models "booking has started but the trip is mid-delivery" — set by the operator or by a scheduled transition once `startDate` is reached.

### Patch Changes

- 29a581a: Add Postgres `CHECK` constraints across finance, bookings, and transactions schemas to enforce: if any `*_amount_cents` column is set, its companion currency column must also be set.

  Two flavours, depending on column shape:

  - **Strict XNOR** (`(currency IS NULL) = (amount IS NULL)`) — one currency to one amount: `booking_guarantees`, `booking_item_commissions`, `payments` (base).
  - **Implication** (`(amounts NULL) OR (currency NOT NULL)`) — one currency covering multiple amount columns: `bookings.base_currency`, `booking_items.cost_currency`, `offer_items.cost_currency`, `order_items.cost_currency`, `invoices.base_currency`.

  The implication form intentionally allows "currency without amount" because the currency may be pre-declared before line items roll up.

- Updated dependencies [29a581a]
- Updated dependencies [b7f0501]
  - @voyantjs/core@0.10.0
  - @voyantjs/db@0.10.0
  - @voyantjs/hono@0.10.0
  - @voyantjs/utils@0.10.0

## 0.9.0

### Patch Changes

- @voyantjs/core@0.9.0
- @voyantjs/db@0.9.0
- @voyantjs/hono@0.9.0
- @voyantjs/utils@0.9.0

## 0.8.0

### Patch Changes

- Updated dependencies [24dc253]
  - @voyantjs/core@0.8.0
  - @voyantjs/db@0.8.0
  - @voyantjs/hono@0.8.0
  - @voyantjs/utils@0.8.0

## 0.7.0

### Minor Changes

- 96612b3: Bookings-create composition surface (#223) and vouchers-as-first-class (#227) — the packages on the release train all move together, so this covers the batch.

  **Atomic booking create (#263, #264, #265, #266)**

  - `POST /v1/admin/bookings/quick-create` — one-shot endpoint that converts a product, inserts travelers + payment schedules, redeems a voucher, and creates/joins a `booking_group` inside a single DB transaction. `quickCreateBooking(db, input, { userId, runtime })` service in `@voyantjs/finance`; `useBookingQuickCreateMutation` in `@voyantjs/bookings-react`.
  - `POST /v1/admin/bookings/dual-create` — partaj flow: two bookings + one shared-room group, also atomic. `dualCreateBooking` service, `useBookingDualCreateMutation` hook.
  - `booking.quick-created` and `booking.dual-created` events emitted post-commit when a runtime eventBus is wired.
  - `QuickBookDialog` now mounts all nine picker sections (product, departure, rooms, person, shared-room, passengers, price breakdown, voucher, payment schedule) and submits via quick-create. Post-create "Confirm & notify traveler" toggle uses the new `useBookingStatusByIdMutation` to transition the fresh booking to `confirmed` — which (when `autoConfirmAndDispatch` is on) fires the doc bundle + traveler email through the existing `booking.confirmed` subscriber.
  - Bookings fix: `productDaysRef` / `getConvertProductData` now join through `product_itineraries` to match the real products schema; the existing `POST /v1/bookings/from-product` convert path works again.

  **Vouchers as first-class financial instruments (#262, #267)**

  - One-shot data migration: `migrateVouchersFromPaymentInstruments(db, opts)` in `@voyantjs/finance` (CLI wrapper `pnpm -F @voyantjs/finance migrate:vouchers`, `--dry-run` supported). Idempotent; pulls code, currency, amount, expiry from legacy JSONB metadata into the new `vouchers` table.
  - `vouchers.validFrom` (start-of-validity, maps to OpenTravel `Finance.Voucher.effectiveDate`) and `vouchers.seriesCode` (batch/campaign id, maps to `Finance.Voucher.seriesCode`) columns added. Redeem guard returns `voucher_not_started` when now < validFrom; the public `validateVoucher` `not_started` branch is now reachable. `seriesCode` exposed as a list filter. Migration pulls both from legacy metadata (honouring OpenTravel's `effectiveDate` alias).

### Patch Changes

- @voyantjs/core@0.7.0
- @voyantjs/db@0.7.0
- @voyantjs/hono@0.7.0
- @voyantjs/utils@0.7.0

## 0.6.9

### Patch Changes

- 7619ef0: Continue the traveler-first booking contract cleanup across the published booking surfaces while preserving compatibility aliases.

  - `@voyantjs/bookings`: add traveler-first public aliases for booking travel details, group traveler routes, public booking-session traveler input, and traveler-facing validation/error wording while keeping legacy participant/passenger compatibility routes and schemas.
  - `@voyantjs/bookings-react`: make traveler hooks, query options, schemas, and exports the primary surface again; keep passenger/item-participant names as compatibility aliases instead of separate primaries.
  - `@voyantjs/customer-portal` and `@voyantjs/customer-portal-react`: move booking import schemas, operations, and exports to traveler-first names while preserving legacy participant aliases and routes.
  - `@voyantjs/transactions`: expose traveler-first request/response aliases and traveler route aliases for offer/order traveler and item-traveler flows while preserving legacy participant compatibility endpoints.
  - `@voyantjs/auth-react`: add exported query keys, query options, and schemas for current workspace, organization members, and organization invitations so app surfaces can consume the auth workspace contract directly.
  - `@voyantjs/products` and `@voyantjs/products-react`: tighten the itinerary-facing public surface and query/schema exports used by the shared product itinerary UI.
  - `@voyantjs/legal` and `@voyantjs/notifications`: keep template authoring and Liquid exports available from the package roots while aligning the notification/template surface with the updated booking traveler contract.
  - Supporting packages and tests also picked up repo-wide import-order, lint, and small compatibility cleanups across auth, booking requirements, checkout, octo, pricing, sellability, storefront, and utilities as part of bringing the whole worktree back to a green release state.
  - Align the touched app/template compatibility wrappers with the new primary traveler and workspace surfaces, and keep repo `typecheck` / `lint` green after the broader cleanup.
  - @voyantjs/core@0.6.9
  - @voyantjs/db@0.6.9
  - @voyantjs/hono@0.6.9
  - @voyantjs/utils@0.6.9

## 0.6.8

### Patch Changes

- b218885: Align booking root and child-list indexes with the package’s booking-scoped sort-heavy query shapes.
- Updated dependencies [b218885]
  - @voyantjs/core@0.6.8
  - @voyantjs/db@0.6.8
  - @voyantjs/hono@0.6.8
  - @voyantjs/utils@0.6.8

## 0.6.7

### Patch Changes

- @voyantjs/core@0.6.7
- @voyantjs/db@0.6.7
- @voyantjs/hono@0.6.7
- @voyantjs/utils@0.6.7

## 0.6.6

### Patch Changes

- @voyantjs/core@0.6.6
- @voyantjs/db@0.6.6
- @voyantjs/hono@0.6.6
- @voyantjs/utils@0.6.6

## 0.6.5

### Patch Changes

- ae9933b: Align booking group and booking group member indexes with the actual parent-and-created-at list query shapes used by rooming and shared-booking group management.
  - @voyantjs/core@0.6.5
  - @voyantjs/db@0.6.5
  - @voyantjs/hono@0.6.5
  - @voyantjs/utils@0.6.5

## 0.6.4

### Patch Changes

- @voyantjs/core@0.6.4
- @voyantjs/db@0.6.4
- @voyantjs/hono@0.6.4
- @voyantjs/utils@0.6.4

## 0.6.3

### Patch Changes

- Updated dependencies [d3c6937]
  - @voyantjs/core@0.6.3
  - @voyantjs/db@0.6.3
  - @voyantjs/hono@0.6.3
  - @voyantjs/utils@0.6.3

## 0.6.2

### Patch Changes

- @voyantjs/core@0.6.2
- @voyantjs/db@0.6.2
- @voyantjs/hono@0.6.2
- @voyantjs/utils@0.6.2

## 0.6.1

### Patch Changes

- @voyantjs/core@0.6.1
- @voyantjs/db@0.6.1
- @voyantjs/hono@0.6.1
- @voyantjs/utils@0.6.1

## 0.6.0

### Patch Changes

- @voyantjs/core@0.6.0
- @voyantjs/db@0.6.0
- @voyantjs/hono@0.6.0
- @voyantjs/utils@0.6.0

## 0.5.0

### Minor Changes

- ce72e29: Add a shared-room / split-booking group model

  Multiple separate bookings can now intentionally share one room/accommodation while each booking keeps its own finance + traveler records. Inspired by the ProTravel v3 `sharing_groups` pattern: flat peer bookings, a lightweight `booking_groups` + `booking_group_members` schema, smart cleanup on cancellation.

  `@voyantjs/bookings`: new `bookingGroups` and `bookingGroupMembers` tables (TypeID prefixes `bkgr` / `bkgm`), service functions for CRUD plus reverse lookup, unified traveler list across members, and automatic group dissolution when a cancellation leaves ≤1 active members. New routes under `/v1/bookings/groups` plus the REST-nested `GET /v1/bookings/:id/group`.

  `@voyantjs/bookings-react`: hooks for `useBookingGroups`, `useBookingGroup`, `useBookingGroupForBooking`, `useBookingGroupMutation`, and `useBookingGroupMemberMutation` (stateless — accepts `groupId` per-call so create-then-add flows work with a single hook instance).

  `@voyantjs/db`: register TypeID prefixes `bkgr` (booking_groups) and `bkgm` (booking_group_members).

### Patch Changes

- Updated dependencies [ce72e29]
  - @voyantjs/core@0.5.0
  - @voyantjs/db@0.5.0
  - @voyantjs/hono@0.5.0
  - @voyantjs/utils@0.5.0

## 0.4.5

### Patch Changes

- Updated dependencies [e3f6e72]
  - @voyantjs/core@0.4.5
  - @voyantjs/db@0.4.5
  - @voyantjs/hono@0.4.5
  - @voyantjs/utils@0.4.5

## 0.4.4

### Patch Changes

- @voyantjs/core@0.4.4
- @voyantjs/db@0.4.4
- @voyantjs/hono@0.4.4
- @voyantjs/utils@0.4.4

## 0.4.3

### Patch Changes

- @voyantjs/core@0.4.3
- @voyantjs/db@0.4.3
- @voyantjs/hono@0.4.3
- @voyantjs/utils@0.4.3

## 0.4.2

### Patch Changes

- @voyantjs/core@0.4.2
- @voyantjs/db@0.4.2
- @voyantjs/hono@0.4.2
- @voyantjs/utils@0.4.2

## 0.4.1

### Patch Changes

- 4c4ea3c: Avoid deep `@voyantjs/db/schema/iam/kms` imports in published bundles by using the stable
  `@voyantjs/db/schema/iam` entrypoint instead. This reduces downstream SSR bundler resolution issues
  under pnpm-based builds.
  - @voyantjs/core@0.4.1
  - @voyantjs/db@0.4.1
  - @voyantjs/hono@0.4.1
  - @voyantjs/utils@0.4.1

## 0.4.0

### Patch Changes

- e84fe0f: Add a first-class admin booking overview lookup route and shared service helper
  that can resolve booking overviews by booking id, booking number, or booking
  code without requiring the public customer email lookup contract.
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
  - @voyantjs/core@0.4.0
  - @voyantjs/db@0.4.0
  - @voyantjs/hono@0.4.0
  - @voyantjs/utils@0.4.0

## 0.3.1

### Patch Changes

- 8566f2d: Add first-class public booking-session wizard state and storefront repricing.

  `@voyantjs/bookings` now persists wizard session state in `booking_session_states`,
  includes that state in public session reads, exposes public state read/write
  routes, and adds `POST /v1/public/bookings/sessions/:sessionId/reprice` for
  previewing or applying room/unit repricing back onto the booking session.

  `@voyantjs/bookings-react` now exports public session/state query helpers and a
  mutation helper for session state updates and repricing.

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
  - @voyantjs/utils@0.3.1

## 0.3.0

### Patch Changes

- @voyantjs/core@0.3.0
- @voyantjs/db@0.3.0
- @voyantjs/hono@0.3.0
- @voyantjs/utils@0.3.0

## 0.2.0

### Patch Changes

- @voyantjs/core@0.2.0
- @voyantjs/db@0.2.0
- @voyantjs/hono@0.2.0
- @voyantjs/utils@0.2.0

## 0.1.1

### Patch Changes

- @voyantjs/core@0.1.1
- @voyantjs/db@0.1.1
- @voyantjs/hono@0.1.1
- @voyantjs/utils@0.1.1

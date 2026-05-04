# Unified booking journey — architecture

Status: draft / proposal — pre-implementation
Audience: anyone designing or implementing the booking flow that commits an inquiry into a booked reservation.

This document specifies a single multi-step booking journey that works for **every product shape Voyant supports** (single-day excursions, multi-day tours with accommodation, transfers, accommodation-only stays) and **every source** (operator-owned inventory, Voyant Connect peers, GDS connectors, bedbanks, the demo upstream). It supersedes the one-click `Book this` action shipped in the booking-engine tracer and is the long-term replacement for the operator template's owned-product `BookingCreateDialog`.

Five load-bearing rules, in order of importance:

1. **One journey, dispatched at the engine layer.** The wizard does not branch on `source.kind` or on whether a product is owned vs. sourced. It always speaks to `POST /v1/{admin,public}/catalog/quote` and `POST /v1/{admin,public}/catalog/book`. The engine dispatches via the `SourceAdapterRegistry` (sourced) or directly through the owned-arm helpers backed by the existing `bookingsQuickCreate` (owned).
2. **The product's *shape* drives the UI, not the source.** Every quote response carries a `BookingDraftShape` descriptor — which steps to show, which fields are required per passenger, occupancy bands, addon catalog references. The same wizard renders a one-page booking for a 2h walking tour and a six-step booking for a 14-day cruise + flight package, by reading the descriptor.
3. **Live pricing is the default, not an afterthought.** Every meaningful input change (pax count, age bands, dates, addons, billing country for VAT) re-quotes. The total displayed in the sticky footer is always the price the system will commit to. No silent drift between display and commit.
4. **Build the journey once; ship it on every surface.** Operator dashboard, customer storefront, partner portal, embedded white-label widgets — all consume the same wizard shell, the same React hooks, the same UI sections, and the same engine endpoints. Surface differences (CRM picker for operators vs. inline contact for customers, B2B billing default vs. B2C, payment provider hookup) live in injectable slots, not parallel codebases. Phases E and Phase B in the rollout (§10) are sequenced for risk, not because storefront gets a different journey.
5. **The journey is a building block, not the ceiling.** Customer-composed multi-line itineraries (flight + cruise + stay + return flight, all booked together) are explicitly NOT this doc's concern — they are the [travel-composer](./ai-travel-experience-composition.md)'s concern. But the journey's shape is designed so the composer can drive it: per-line drafts, per-line quotes, per-line holds, all coordinated by the composer's saga. Decisions in this doc that block multi-line composition are bugs.

## 0.5. Single-line journey vs. composed itinerary

This doc specifies the **single-line booking journey** — the wizard a user sees when they're committing to one bookable thing (one tour, one cabin sailing, one stay, one transfer, one flight). The user picks dates, fills in passengers, picks addons, pays. One quote, one hold, one commit.

That covers the high-volume case: a customer browsing a tour catalog and clicking Book. It does NOT cover the case where a customer assembles a custom multi-line itinerary on the fly:

> "Flight Bucharest → Budapest, Danube cruise to Vienna, 3-night stay in Vienna, flight back to Bucharest." Four lines, four verticals, one customer experience, one consolidated payment.

That second case is the [travel-composer](./ai-travel-experience-composition.md)'s job. The composer:

- Holds the user-built itinerary as an `ItineraryDraft` with multiple `DraftItems`, one per line.
- Per `DraftItem`, calls the engine's `quoteEntity` (the same endpoint this journey uses).
- Aggregates per-line prices into one consolidated total + one set of taxes + one collection plan.
- On Reserve/Buy, runs a saga that calls `bookEntity` (or its hold equivalent) per line in dependency order, with compensation if any line fails.
- Hands off to the existing checkout module with one `payment_session` covering all lines.

**The journey and the composer share primitives, not UI:**

| Primitive | Owned by | Reused by composer? |
|-----------|----------|--------------------|
| `BookingDraftShape` (per-line descriptor) | journey | yes — composer fetches one per `DraftItem` |
| `BookingDraft` (per-line draft state) | journey | yes — composer holds N of these |
| `quoteEntity` / `bookEntity` engine endpoints | catalog booking-engine | yes — composer calls per line |
| `booking_drafts` row + hold | journey (§5.7) | yes — one per `DraftItem` |
| Wizard shell `<BookingJourney />` | journey | **no** — composer renders its own multi-line UI |
| Per-step section components (Travelers, Payment, etc.) | `bookings-ui` | **partially** — composer reuses Billing + Payment for the consolidated view, may also reuse Travelers if travelers are shared across lines |
| `bookingsQuickCreate` atomic transaction | bookings | **mostly no** — composer needs cross-line atomicity that's bigger than one quick-create transaction; the saga model from `@voyantjs/core/workflows` is the right primitive |

**What the journey's design must NOT lock in:**

1. **Per-line `bookings` rows.** A composed itinerary may be one `bookings` row with N `bookingItems`, or N `bookings` rows under one `bookingGroups` parent — the composer decides. The journey commits ONE booking; the composer's saga decides how to merge.
2. **Single-quote-per-draft assumption.** The journey's `booking_drafts.current_quote_id` is one-to-one. The composer's `ItineraryDraft` carries N quote ids (one per line). Don't add cross-line constraints to `booking_drafts`.
3. **Per-line payment.** The journey's Payment step assumes one payment for one line. The composer skips the journey's Payment step and runs a consolidated payment off the aggregated total. Solution: make the Payment step optional in the descriptor (see §3 — it already is).
4. **Auth scope.** The composer needs to span multiple verticals, including some that are admin-only today (flights). The journey's public/admin route split must extend to all verticals the composer might compose, including flights — that's a follow-up on flights, not this doc.

The journey is a **leaf node** in the composer's call graph. Build it leaf-first, validate it on the high-volume single-line case, then the composer builds itinerary orchestration on top without re-implementing per-line booking. This staging is also why Phase A of the rollout (§10) builds the owned-arm engine dispatch — once that's done, the composer can call `quoteEntity` against any catalog row regardless of source.

## 0.7. Reuse-before-add: existing primitives this doc explicitly composes

Before specifying anything new, this doc commits to reusing the following primitives where they already cover the problem. Several pieces of the journey were designed earlier and partially shipped; treating them as ground truth keeps the new work focused.

| Concern | Existing primitive | This doc's stance |
|---------|---------------------|--------------------|
| Encrypted PII (passport, DOB, dietary, accessibility) | `booking_traveler_travel_details` with `KmsEnvelope` columns (`identityEncrypted`, `dietaryEncrypted`, `accessibilityEncrypted`) — `packages/bookings/src/schema/travel-details.ts` | **Reuse.** Per-traveler document fields collected in the Travelers step commit through this envelope; no parallel `bookingTravelers.documents jsonb`. The Travelers step's *transient* draft state may carry plaintext during the journey, but the commit path encrypts. |
| Tax-regime catalog (jurisdiction × rate) | `tax_regimes` table — `packages/finance/src/schema.ts` | **Reuse.** New `tax_classes` (this doc, §9) carries the per-product tax-treatment decision and *resolves to* a `tax_regimes` row at quote time. They stack, not overlap. |
| Per-occupancy pricing for cruises | `cruise_prices.occupancy` column + `cruisePrices` table — `packages/cruises/src/schema-pricing.ts` | **Reuse for cruises.** The new `product_pax_pricing_tiers` (§9) is for non-cruise verticals that need single-supplement / triple-share. Cruises keep their specialized table; the engine reads from the right place per vertical. |
| Payment-collection UI (saved cards, new card, processor flow) | `checkout-ui`'s `PaymentStep` — `packages/checkout-ui/src/components/payment-step.tsx` | **Compose.** The journey's "Payment" step picks **intent + schedule** (hold vs card vs ticket-on-credit; deposit vs full vs split) — that's a journey concern. Actual provider mechanics (Netopia tokenization, Stripe Elements, etc.) hand off to `checkout-ui`'s `PaymentStep` at commit time. The journey shell does not introduce a new payment-provider seam. |
| Quantity-tier pricing (more units → cheaper per-unit) | `option_unit_tiers` — `packages/pricing/src/schema-option-rules.ts` | **Reuse.** Quantity tiers are an orthogonal axis to per-occupancy tiers; the engine consults both when pricing an option. |
| Snapshot graph at commit | `booking_catalog_snapshot` + `captureSnapshot` / `captureSnapshotGraph` — `packages/catalog/src/services/snapshot-service.ts` | **Reuse.** Both owned and sourced commits pass through these. |
| Atomic owned-product transaction | `bookingsQuickCreate` — `packages/finance/src/service-bookings-quick-create.ts` | **Bridge only.** Phase A's owned-arm dispatch maps a draft to quick-create's input shape and hits the endpoint. Quick-create's input doesn't model extras / hospitality stay details / encrypted travel details / tax lines / catalog snapshots / arbitrary draft shape — Phase C+ replaces the bridge with a richer owned commit primitive that does. |
| Public booking sessions (existing model) | `booking_session_states` keyed by `booking_id` — `packages/bookings/src/schema-operations.ts`. Public routes at `POST /v1/public/bookings/sessions`, `/state`, `/reprice`, `/confirm`. | **Sibling, not replacement.** The existing model materializes a `bookings` row first (status `draft`) and wraps it with session state. The journey's `booking_drafts` (§5.7) is the inverse — a pre-booking-row hold that may *never* materialize into a booking (abandonment is the common case). See §12.10 for the open question on whether to extend `booking_session_states` to allow `booking_id IS NULL` instead of adding `booking_drafts`. |

The rule of thumb: if a reasonable read of "I need X" finds an existing primitive in the table above, the new code uses it. Adding a parallel primitive needs a one-paragraph justification in this doc.

## 1. What's already in place

A short inventory so we don't reinvent (full survey lives in the agent reports cited in the PR description):

- **`packages/bookings/`** — `bookings`, `bookingTravelers`, `bookingItems`, `bookingAllocations`, `bookingGroups` schemas. Booking states: `draft`/`on_hold`/`confirmed`/`in_progress`/`completed`/`expired`/`cancelled`.
- **`packages/bookings-ui/`** — composable sections: `ProductPickerSection`, `RoomsStepperSection`, `PersonPickerSection`, `PassengersSection`, `PaymentScheduleSection`, `SharedRoomSection`, `VoucherPickerSection`, `PriceBreakdownSection`. Each carries a `value` / `onChange` contract, parent owns state.
- **`packages/availability/`** — `availabilitySlots`, `useSlots`, `useSlotUnitAvailability`. Departure pickers for date / time / slot.
- **`packages/pricing/`** — per-unit tier matching, `optionPriceRules` and `optionUnitPriceRules`. No unified `computeTotal()` exists yet.
- **`packages/booking-requirements/`** — `productContactRequirements`, `bookingQuestions`. Per-product per-field requirements (passport, dietary, etc.) with `scope` (booking/lead/traveler/booker), `isRequired`, `perTraveler`. **This is the canonical source of "what fields to collect" — the wizard reads from it.**
- **`packages/extras/`** — extras schema (selection types, pricing modes). No UI surface yet.
- **`packages/hospitality/`** — stay-item schema (`stayBookingItems` with check-in/out, room type, occupancy, daily rates). No operator-facing flow yet.
- **`packages/finance/`** — tax regimes, voucher redemption. Tax compute is post-book today (invoice-time).
- **`bookingsQuickCreateExtension`** — `POST /v1/admin/bookings/quick-create`. One-shot atomic transaction creating booking + travelers + payment schedules + voucher redemption + group membership. Will become the engine's owned-arm dispatcher.
- **`packages/catalog/src/booking-engine/`** — `quoteEntity`, `bookEntity`, `cancelEntity`, `SourceAdapterRegistry`, `catalog_quotes`. Dispatches sourced rows today; owned dispatch is the gap.

What we're missing, summarized: the **wizard shell**, the **billing step**, the **passenger fields per requirements**, the **addons step**, the **per-vertical accommodation step**, **live tax computation at quote time**, and the **owned arm of the booking engine** (which is the bridge to `bookingsQuickCreate`).

## 2. Patterns we've validated elsewhere

We've shipped production booking engines in adjacent codebases that we control. Without naming them, four shape decisions from those projects have proven to work in the real world and we're adopting them here:

- **Linear wizard with conditional steps**, not a single mega-form. Steps you don't need are visually skipped, not hidden mid-form.
- **Per-passenger `dateOfBirth` and document fields collected inline** at the passengers step — not deferred to a "documents" step. ID/passport requirements come from the product config; the form widens accordingly.
- **Live pricing on every input change**, with the total shown in a sticky footer. The pricing endpoint is the source of truth — the client never computes its own total.
- **Session-bound hold**: when the journey starts, the engine reserves inventory; if the user abandons or expires, the hold drops.

We're **not** adopting:

- Astro / Payload split. We stay on TanStack Start + Hono + drizzle.
- Form state via local React Context with manual serialization. We use a single source-of-truth `BookingDraft` object held at the journey root, shared with sub-steps via render props or context as suits the codebase.
- **Per-step *engine* dispatch** (one server call per step, fragmented commit). One reference shipped a `POST /api/step-1`, `/step-2`, etc. surface. We don't fragment the commit path that way — `bookEntity` runs once, atomically, against the final draft. Note: this is **not** the same as draft persistence — see §5.7. The journey *does* PUT to `/v1/{admin,public}/catalog/drafts/:id` on every step transition (so the draft survives refresh / tab loss), but those PUTs are pure draft-state writes, not engine commits.

## 3. Step model

The wizard renders only the steps the product's `BookingDraftShape` says are relevant. **Every step is optional in principle** — the descriptor controls visibility. A walking tour might use steps 1, 3, 6, 7. A 14-day cruise uses all of them, with sub-steps inside §1 and §4.

```
1. Configure        ← departure / date+time / pax bands / variant
                      sub-steps may include: cabin category → cabin number
                      (cruises), date-range + occupancy (hotels)
2. Billing          ← lead contact + B2C/B2B + address + VAT
3. Travelers        ← per-passenger fields incl. DOB + documents
4. Accommodation    ← rooms / occupancy assignment / shared-room
                      OR pre/post-cruise extensions (cruises)
5. Add-ons          ← extras catalog with stepper. Per-port excursions
                      (cruises) render here as a grouped sub-section.
6. Payment          ← payment intent + schedule (deposit / full / split)
                      includes insurance offer for verticals that ship one
7. Review & confirm ← final price recap + commit
```

Side panel (always visible, not a step) holds the live `PriceBreakdownSection` with line items + taxes + total. On wide screens it floats right; on narrow it collapses to the sticky footer.

Step navigation is linear with a stepper header — you can go back to any visited step, forward only one at a time and only when current-step validation passes. Step 7 is non-skippable; the Confirm button lives there, not in the footer's primary action.

### 3.1. Sub-steps and per-vertical composition

Within a single wizard step, **sub-steps** absorb vertical-specific complexity without bloating the top-level navigation. Sub-steps are inline (no route change), validated as a unit, and reflected in the side-panel pricing as they're filled in:

- **Configure (cruises)** — pick category (Inside / Oceanview / Balcony / Suite) → pick a specific cabin number from the available pool → confirm guest count. Two-level selection because category drives pricing, cabin number drives inventory hold.
- **Configure (hotels)** — date range + occupancy upfront, then the Accommodation step drills into specific room types within that property. The descriptor decides where the date picker sits.
- **Accommodation (cruises)** — pre/post-cruise extension hotels are picked here (one pre, one post; per-pax pricing by default). Distinct from generic addons.
- **Add-ons (cruises)** — per-port excursions render as a grouped list (`groupBy: "port"`) with a per-guest selection toggle so guest 1 can take a beach day while guest 2 takes a museum tour. Insurance offer also slots in here for verticals that ship one (it's just an addon with `kind: "insurance"`).

The descriptor encodes which sub-steps to render, never the wizard:

```ts
interface BookingDraftShape {
  // ...
  configureSubSteps?: ReadonlyArray<
    | { kind: "departure"; required: true }
    | { kind: "cabin-category"; categories: ReadonlyArray<CabinCategory> }
    | { kind: "cabin-number"; perCategory: Record<string, CabinNumberOption[]> }
    | { kind: "date-range"; minNights: number; maxNights: number }
    | { kind: "occupancy"; bands: PaxBandSpec[] }
  >
  accommodationSubSteps?: ReadonlyArray<
    | { kind: "rooms"; options: RoomOption[]; sharedRoomAllowed: boolean }
    | { kind: "extensions"; options: ExtensionOption[]; allowsPre: boolean; allowsPost: boolean }
  >
  addonGroups?: ReadonlyArray<{
    kind: "extras" | "excursions" | "insurance"
    label: string
    groupBy?: "port" | "day" | undefined
    perGuestSelection: boolean
    items: AddonOffer[]
  }>
}
```

This keeps the wizard shell thin: it loops over sub-steps and renders the right component per `kind`. Adding a new sub-step kind is a one-place change in the descriptor + one component in the shell, not a fork in the navigation logic.

## 4. Source of truth: the `BookingDraft` and its shape

Two distinct shapes, both lifted out of any sub-step:

```ts
interface BookingDraftShape {
  // Each flag controls whether the corresponding wizard step renders.
  // Returned as part of the quote response — the engine knows the shape
  // because it has the product / sourced row in front of it.
  showsConfigure: boolean
  showsBilling: boolean       // always true today; future: SSO / saved billing skips
  showsTravelers: boolean     // false only for non-named-passenger products (rare)
  showsAccommodation: boolean // true for stay-attached products, multi-day tours w/ rooms
  showsAddons: boolean        // true when extras catalog is non-empty
  showsPayment: boolean       // false only when paymentIntent is locked upstream
  showsReview: true           // always

  paxBands: ReadonlyArray<{
    code: "adult" | "child" | "infant"     // future: senior, student, etc.
    label: string
    minAge?: number
    maxAge?: number
    minCount: number
    maxCount: number
  }>
  paxBandsAllowedTotal: { min: number; max: number }

  // Per-traveler field requirements. Drives PassengersSection's columns.
  travelerFields: ReadonlyArray<TravelerFieldRequirement>
  // Lead-only fields appended to the billing step (e.g. company VAT for B2B).
  bookingFields: ReadonlyArray<BookingFieldRequirement>

  accommodation?: {
    roomOptions: ReadonlyArray<RoomOption>
    sharedRoomAllowed: boolean
  }

  addons?: { catalog: ReadonlyArray<AddonOffer> }

  paymentIntents: ReadonlyArray<"hold" | "card" | "ticket_on_credit">
}

interface BookingDraft {
  // What's being booked — populated from the catalog row and never mutated by the wizard.
  entity: { module: string; id: string; sourceKind: string; sourceRef?: string }

  // Step 1 — Configure
  configure: {
    departureSlotId?: string
    departureDate?: string  // ISO yyyy-MM-dd
    departureTime?: string  // ISO HH:mm
    pax: Record<"adult" | "child" | "infant", number>  // counts per band
    variantId?: string  // e.g. cruise cabin class, charter package tier
  }

  // Step 2 — Billing
  billing: {
    buyerType: "B2C" | "B2B"
    contact: { firstName: string; lastName: string; email: string; phone?: string }
    address: { line1?: string; line2?: string; city?: string; postal?: string; country?: string }
    company?: { name: string; vatId?: string; registrationNumber?: string }
    saveAsDefault?: boolean
  }

  // Step 3 — Travelers
  travelers: ReadonlyArray<TravelerEntry>

  // Step 4 — Accommodation
  accommodation?: {
    rooms: ReadonlyArray<{ optionUnitId: string; quantity: number }>
    travelerAssignments: Record<string /* travelerRowId */, string /* roomUnitId */>
    sharedRoom?: { mode: "create" | "join"; groupId?: string; label?: string }
  }

  // Step 5 — Add-ons
  addons: ReadonlyArray<{ extraId: string; quantity: number }>

  // Step 6 — Payment
  payment: {
    intent: "hold" | "card" | "ticket_on_credit"
    schedule: PaymentScheduleValue  // re-uses bookings-ui's existing shape
  }

  // Optional cross-step
  voucher?: { code: string }
  internalNotes?: string

  // Engine-controlled — written when /quote returns
  quoteId?: string
  quoteExpiresAt?: string
  pricing?: PricingBreakdown
}
```

`TravelerEntry` widens beyond what `PassengersSection` carries today — it gets `dateOfBirth`, `band` ("adult" / "child" / "infant"), and an open-shape `documents` map (passport, national ID, dietary, accessibility) populated according to `BookingDraftShape.travelerFields[]`.

## 4.5. Pricing tiers — single supplement, triple share

Cruises (and to a lesser extent stays / multi-pax tours) price per-pax with explicit per-occupancy tiers. Real-world cruise systems treat this as a fundamental shape, not an afterthought:

```ts
interface CabinTypePricing {
  single_price_pp:  number   // 1 guest in cabin → higher per-pax rate
  double_price_pp:  number   // 2 guests → lower per-pax rate (the "default")
  triple_price_pp?: number   // 3 guests → fold-down third bed
  quad_price_pp?:   number   // 4 guests → uncommon, suite-class
  promo_*_pp?:      number   // promotional override per tier
  taxes:            number   // fixed, applied per pax regardless of tier
  taxes_text?:      string   // e.g. "Port charges + onboard gratuities"
}
```

The engine selects the tier based on `configure.pax` total per cabin, not by computing a "supplement" delta. The pricing breakdown's `lines[]` carries the tier label so the user can see *why* the per-pax rate is higher for a single occupant.

For owned products that don't have explicit tiers, the engine falls back to a single rate. The shape is the same; tiers are an opt-in axis the descriptor can populate.

## 5. Live pricing & taxes

Every meaningful state change debounces a `POST /v1/admin/catalog/quote` call (debounce: ~250ms). The `quoteEntity` request body now carries the full `BookingDraft` (minus `quoteId`) so the engine can compute pricing from the actual selection — pax counts, age bands, addons, accommodation, billing country (for VAT), departure (for seasonal pricing).

The response carries:

```ts
interface PricingBreakdown {
  currency: string
  lines: ReadonlyArray<{
    kind: "base" | "addon" | "accommodation" | "supplement" | "discount" | "fee"
    label: string
    quantity?: number
    unitAmount: number   // cents
    totalAmount: number  // cents (quantity × unitAmount, after discounts)
    taxIncluded?: boolean
  }>
  taxes: ReadonlyArray<{
    code: string         // e.g. "vat-ro-19"
    label: string
    rate: number         // 0..1
    amount: number       // cents
    base: number         // cents, the line subtotal the tax applies to
  }>
  subtotal: number       // cents (sum of lines, pre-tax)
  taxTotal: number       // cents
  total: number          // cents (subtotal + taxTotal)
  // Optional structured pre-tax / tax columns for the snapshot row.
  basis?: PricingBasis
}
```

**Tax computation lives inside the engine, not the client.** The owned arm consults:

1. The product's tax class (a new column / lookup on `products` — see §9).
2. The supplier's tax behavior (e.g. Art. 311 margin scheme already present in `packages/finance/`).
3. The market's tax regime keyed off `billing.address.country` + `billing.buyerType`.

The sourced arm trusts the adapter — it returns `taxes[]` already broken down by jurisdiction. The engine normalizes both shapes into the same `PricingBreakdown`.

A quote always carries an `expiresAt` (default 10 min). On Confirm, the engine re-quotes one final time and rejects with `QUOTE_DRIFT` if pricing or availability changed by more than a configurable threshold (default: any line moves > 0.5%).

### 5.7. Resumable drafts and the hold lifecycle

Cruise (and complex tour) bookings span minutes-to-hours of operator effort: contacting the lead, collecting passport scans, proposing alternatives. Two production systems we've shipped have converged on the same contract worth adopting — one materializes the booking row at step 1 and mutates it through subsequent steps, the other carries an explicit `booking-sessions` row with `expiresAt`. Both share the load-bearing idea:

> Every meaningful journey has a server-side draft with a hold. The draft survives refresh, tab loss, and short walk-aways. On commit it materializes into a `bookings` row (or merges into an existing one if the journey was started against a draft booking).

We introduce `booking_drafts`:

```sql
booking_drafts
  id                  text pk        -- typeid: bdrf
  entity_module       text not null
  entity_id           text not null
  source_kind         text not null
  source_ref          text
  draft_payload       jsonb not null -- the full BookingDraft minus pricing
  current_step        text           -- "configure" | "billing" | ... | "review"
  current_quote_id    text           -- fk-by-text into catalog_quotes
  hold_expires_at     timestamptz    -- adapter-driven; null when no hold
  consumed_booking_id text           -- set on successful commit
  created_at          timestamptz
  updated_at          timestamptz
  expires_at          timestamptz    -- session abandonment ttl, default 24h
  created_by          text           -- staff user or anonymous session token
```

The wizard PUTs to `/v1/admin/catalog/drafts/:id` on every step transition. The engine attaches/refreshes a hold via `adapter.reserve` with `payment_intent: { type: "hold", soft: true }` for sourced rows; for owned rows, the hold mechanism is a row in `bookingAllocations` with `status: "held"` and a `holdExpiresAt`.

`bookEntity` now accepts a `draftId` instead of (or alongside) a `quoteId`. The draft already carries the full payload; the quote is just the most recent pricing snapshot. On commit:

1. Final re-quote; reject on drift.
2. Materialize the booking row + travelers + payment schedule (owned arm) or call `adapter.reserve` with `payment_intent.type !== "hold"` (sourced arm).
3. Capture the snapshot graph.
4. Mark the draft `consumed_booking_id`.

Drafts older than `expires_at` are reaped by a daily job; their holds are released first. Orphaned drafts (where the hold expired but the draft didn't) are surfaced in an operator "abandoned drafts" view as a recovery surface.

This split — **`catalog_quotes` for the live-pricing snapshot, `booking_drafts` for the session-bound hold** — answers Open Question §12.3 in the affirmative: keep them separate. Quotes are short-lived and engine-internal; drafts are user-facing and resumable.

## 6. Owned-arm dispatch

The catalog booking engine currently fails on `source.kind = "owned"` with `NO_ADAPTER_REGISTERED`. We introduce an owned arm via an **injected handler registry**, not by having `packages/catalog` import every vertical directly. This mirrors the existing `SourceAdapterRegistry` pattern and keeps the catalog package light:

```ts
// packages/catalog/src/booking-engine/owned-handler.ts (new)

export interface OwnedBookingHandler {
  /** Vertical this handler claims. One handler per entity_module. */
  readonly entityModule: string

  /**
   * Live-quote an owned row for a draft. Engine calls this on every
   * meaningful input change. Returns shape + pricing + availability.
   */
  computeQuote(ctx: OwnedHandlerContext, request: ComputeQuoteRequest): Promise<ComputeQuoteResult>

  /**
   * Commit the draft to a booking row. May call bookingsQuickCreate as
   * a bridge today; richer commit primitives (extras, hospitality
   * stays, encrypted travel details, tax lines, snapshot graph) land
   * on this same handler in Phase C+.
   */
  commit(ctx: OwnedHandlerContext, request: CommitOwnedRequest): Promise<CommitOwnedResult>

  /** Optional: place / extend / release a soft hold on the row. */
  placeHold?(ctx: OwnedHandlerContext, request: HoldRequest): Promise<HoldResult>
  extendHold?(ctx: OwnedHandlerContext, holdToken: string): Promise<HoldResult>
  releaseHold?(ctx: OwnedHandlerContext, holdToken: string): Promise<void>
}

export interface OwnedBookingHandlerRegistry {
  register(handler: OwnedBookingHandler): void
  resolveOrThrow(entityModule: string): OwnedBookingHandler
  has(entityModule: string): boolean
  modules(): ReadonlyArray<string>
}
```

The dispatch becomes:

```
quoteEntity({ entity, draft, scope })
  ├── if entity.sourceKind === "owned"
  │     → ownedHandlerRegistry.resolveOrThrow(entity.module).computeQuote(...)
  └── else
        → sourceAdapterRegistry.resolveOrThrow(entity.sourceKind).liveResolve(...)

bookEntity({ quoteId | draftId, draft })
  ├── owned:    ownedHandlerRegistry.resolveOrThrow(entity.module).commit(...)
  └── sourced:  sourceAdapterRegistry.resolveOrThrow(entity.sourceKind).reserve(...) + captureSnapshot(...)
```

**Where the handlers live.** Each vertical owns its handler:

- `packages/products/src/booking-engine/handler.ts` → `createProductsBookingHandler({ db })`. Composes products' existing pricing/availability + `bookingsQuickCreate` as the Phase-A bridge.
- `packages/hospitality/src/booking-engine/handler.ts` → `createHospitalityBookingHandler({ db })`. Daily-rate computation, room-type stays.
- `packages/cruises/src/booking-engine/handler.ts` → uses `cruise_prices.occupancy` for tiers, sailing-level holds.
- And so on per vertical.

Templates wire the registry at boot, the same way they wire the `SourceAdapterRegistry`:

```ts
const ownedRegistry = createOwnedBookingHandlerRegistry()
ownedRegistry.register(createProductsBookingHandler({ db }))
ownedRegistry.register(createHospitalityBookingHandler({ db }))
// ... per vertical the deployment uses
```

This inverts the dependency direction: instead of `@voyantjs/catalog` importing every vertical, each vertical imports the handler interface from `@voyantjs/catalog/booking-engine` and provides an implementation. Catalog stays a contract package; verticals stay self-contained.

This also makes Phase A genuinely small (§10) — the first owned handler ships only the products vertical, only for simple bookings, and only for the quick-create-mappable shape. Hospitality, cruises, extras, taxes, encrypted travel details all land on the same handler interface in subsequent phases without re-architecting the dispatch.

## 7. Per-product variation — concrete examples

The same wizard handles each of these by reading the descriptor; no special-case code paths in the UI:

- **Walking tour** (single-day, fixed departure, no rooms, no addons):
  - `showsAccommodation: false`, `showsAddons: false`
  - `paxBands: [{ code: "adult", min: 1, max: 8 }]`
  - `travelerFields: [{ field: "name", required: true }]` only
  - Steps shown: Configure (date+time pick), Billing, Travelers (just names), Payment, Review.

- **3-day Paris package** with optional rooms and excursions:
  - `showsAccommodation: true`, `accommodation.roomOptions = [single, double, family]`
  - `showsAddons: true`, addon catalog includes "Eiffel skip-the-line", "champagne welcome"
  - `paxBands: [adult, child]`, `child.maxAge: 11`
  - `travelerFields: [name, dateOfBirth (perTraveler), passport (perTraveler when international)]`
  - Steps shown: all seven.

- **Airport transfer** (origin + destination + pickup time):
  - `showsAccommodation: false`, `showsAddons: false` (or just "child seat" addon)
  - `bookingFields: [pickupAddress, dropoffAddress, flightNumber]` shown on the Configure step
  - Steps shown: Configure (with extra fields), Billing, Travelers (names), Payment, Review.

- **Hotel-only stay** (check-in / check-out, room type):
  - The "product" is a room type from the hospitality vertical
  - Configure step shows date-range picker + occupancy
  - Accommodation step is folded into Configure (single room type, but with meal-plan / rate-plan picks)
  - `addons` may contain "breakfast included", "spa credit"

- **Sourced (TUI / Voyant Connect)**:
  - The adapter returns a `BookingDraftShape` that mirrors the upstream's expected booking shape.
  - The wizard renders the same way; only the `bookEntity` dispatch differs.

- **Cruise** (the most demanding shape — drives every descriptor field):
  - `configureSubSteps`: `departure` (sailing date) → `cabin-category` (Inside / Oceanview / Balcony / Suite) → `cabin-number` (specific cabin from the available pool) → `occupancy` (1-4 guests, drives the per-pax pricing tier).
  - `paxBands`: adult / child / infant with cruise-line-specific age cutoffs (e.g. infant ≤ 2, child 3-11, adult 12+); pricing is per-band per-tier.
  - `travelerFields`: name, DOB (required), passport (required for international sailings — driven by `productContactRequirements`), preferred name, frequent-cruiser number, gender, nationality.
  - `accommodationSubSteps`: `extensions` with `allowsPre` and `allowsPost` true, options pulled from the cruise line's pre/post-cruise hotel catalog. Per-pax pricing.
  - `addonGroups`: an `excursions` group with `groupBy: "port"` and `perGuestSelection: true` (so guest 1 takes a beach day, guest 2 takes a museum tour), plus an `insurance` group with one offer per traveler.
  - Payment intent: cruises typically take a deposit at book and balance closer to sail date — the Payment step shows two scheduled installments.
  - Air arrangements (cruise-line-arranged or independent flights) are NOT modeled here in v1. They live in the flights vertical and would compose as a separate booking line in a v2+ multi-line booking.
  - This shape stresses every axis (sub-steps, pricing tiers, per-port grouped addons, multi-installment payment). If the descriptor and the wizard handle this cleanly, simpler products fall out for free.

## 8. UI composition: reuse vs. new

| Step | Existing component to reuse | New component / change needed |
|------|------------------------------|-------------------------------|
| Configure | `useSlots`, `useSlotUnitAvailability` from `availability-react` | New `DepartureStep` (date + time + variant + pax bands) |
| Billing | `PersonPickerSection` (CRM picker pattern) | New `BillingStep` with B2C/B2B toggle, address, VAT — generalize beyond the existing PersonPicker |
| Travelers | `PassengersSection` | Widen with `dateOfBirth`, `band`, `documents` driven by `travelerFields[]` |
| Accommodation | `RoomsStepperSection`, `SharedRoomSection` | Compose into a single `AccommodationStep` |
| Add-ons | — | New `AddonsStep` with quantity stepper per extra (per-pax / per-booking semantics) |
| Payment | `PaymentScheduleSection` (intent + schedule shape) + **compose `checkout-ui`'s `PaymentStep`** (provider mechanics) | Thin wrapper that picks intent/schedule, then mounts `checkout-ui`'s `PaymentStep` at commit transition. No new provider seam in the journey shell. |
| Review | — | New `ReviewStep` showing the full draft + final pricing |
| Side panel | `PriceBreakdownSection` | Adapt to consume the new `PricingBreakdown` shape |

The wizard shell itself (`<BookingJourney />`) is new — a route component at `/catalog/book/$entityModule/$entityId` (operator) and `/book/$entityModule/$entityId` (customer storefront, future). Step navigation, validation, draft persistence (URL + sessionStorage), and quote orchestration live there.

### 8.1. Package layout — share by default

Per Rule 4 (§overview), every piece of the journey except the wired-up route component lives in a publishable package and is consumed identically by every surface (operator dashboard, customer storefront, partner portal, embedded widgets). New code lands in packages; templates wire it. **No journey logic in template src/ directories.**

| Concern | Package | New / Existing |
|---------|---------|----------------|
| Engine endpoints + types (`POST /quote`, `POST /book`, `BookingDraftShape`, `PricingBreakdown`) | `@voyantjs/catalog/booking-engine` | Existing — extend |
| React hooks (`useBookingDraft`, `useBookingQuote`, `useBookingCommit`, `useBookingDraftShape`) | `@voyantjs/catalog-react/booking-engine` *(new sub-path)* | New |
| Wizard shell (`<BookingJourney />`, step navigation, sticky footer, draft persistence) | `@voyantjs/bookings-ui/journey` | **New** — the missing piece. Modeled on `@voyantjs/flights-ui`'s `FlightBookingShell`. |
| Step section components (Configure, Billing, Travelers, Accommodation, Add-ons, Payment, Review) | `@voyantjs/bookings-ui/journey` | New, with renderers per sub-step `kind` |
| Reusable form sections that pre-date the journey | `@voyantjs/bookings-ui` (PassengersSection, PaymentScheduleSection, RoomsStepperSection, SharedRoomSection, VoucherPickerSection, PriceBreakdownSection) | Existing — widen as §8 table notes |
| Owned-handler interface + registry (`OwnedBookingHandler`, `OwnedBookingHandlerRegistry`) | `@voyantjs/catalog/booking-engine` | New (interface only — no vertical imports) |
| Per-vertical owned handlers (e.g. `createProductsBookingHandler`) | each vertical's `<vertical>/src/booking-engine/handler.ts` | New per vertical, lands incrementally per phase |
| Adapter contract bits not already in `SourceAdapter` (`describeShape`, hold metadata) | `@voyantjs/catalog/adapter` | Existing — extend |
| Per-vertical descriptor builders (e.g. cruise-specific shape construction) | each vertical's `service-catalog-plane.ts` (cruises, products, hospitality, etc.) | Existing — extend |
| Demo upstream + plugin (already shipping in the tracer) | `apps/catalog-demo-api` + `@voyantjs/plugin-catalog-demo` | Existing |

#### Slot injection — the seam between operator and storefront

The wizard shell takes render-prop slots for the bits that legitimately differ between surfaces. The shell never branches on "am I in operator or storefront" — it just calls the slot the consumer passed:

```tsx
<BookingJourney
  entityModule={...}
  entityId={...}
  // Operator: pulls from CRM. Storefront: bare inline form.
  renderLeadContactPicker={(apply) => <CrmPersonPicker apply={apply} />}
  renderTravelerContactPicker={(apply) => <CrmPersonPicker apply={apply} />}
  // Operator: B2B default with VAT lookup. Storefront: B2C default.
  defaultBuyerType="B2B"
  // Operator: "Send confirmation to customer". Storefront: hand off to checkout/payment.
  onCommitted={(booking) => navigate({ to: "/orders/catalog" })}
  // Optional: payment-provider mechanics live in checkout-ui. The
  // journey hands the chosen intent + schedule to checkout-ui's
  // PaymentStep at commit time; the slot below lets the template pass
  // a pre-configured PaymentStep with its capabilities + saved methods.
  renderPaymentProviderStep={(intent, schedule, capabilities) => (
    <CheckoutPaymentStep value={...} onChange={...} capabilities={capabilities} />
  )}
/>
```

Slots are render-props (function children), not config flags. New slots are added to the prop type as `optional` so existing callers don't break. The shell renders a sensible default when a slot is absent — e.g. a plain inline `<Input>` for the contact pickers when no `renderLeadContactPicker` is passed (which is the storefront's default).

#### What templates own

Templates wire the shell, the auth posture, the route tree, the API base URL, and the slot implementations. Both surfaces ship in v1 (Phase B):

```
operator (admin):
  templates/operator/src/routes/_workspace/catalog_.book.$entityModule.$entityId.tsx
  templates/operator/src/components/voyant/catalog/operator-booking-journey.tsx
    → wraps <BookingJourney /> with operator slots:
      - apiBase: getApiUrl()  → /v1/admin/...
      - renderLeadContactPicker: CRM-backed PersonPicker
      - defaultBuyerType: "B2B"
      - onCommitted: navigate to /orders/catalog
      - renderPaymentProviderStep: composes `checkout-ui`'s PaymentStep
        with operator capabilities + Netopia (when configured)

storefront (customer):
  templates/storefront/src/routes/book/$entityModule/$entityId.tsx
  templates/storefront/src/components/voyant/catalog/storefront-booking-journey.tsx
    → wraps <BookingJourney /> with storefront slots:
      - apiBase: storefront's public-base URL → /v1/public/...
      - renderLeadContactPicker: omitted (default = inline contact form)
                                 OR a "Sign in to use saved details" stub
                                 that swaps to CRM picker on auth
      - defaultBuyerType: "B2C"
      - onCommitted: navigate to /confirmation/$bookingId
      - renderPaymentProviderStep: composes `checkout-ui`'s PaymentStep
        with the storefront's payment-provider capabilities
```

Same shell, same hooks, same engine — different chrome. **Adding a new template (a partner portal, a white-label embed) is a single wiring file plus its own auth.**

## 8.5. Versioned engine contracts

Today's `quoteEntity` accepts `parameters?: Record<string, unknown>` and returns `PricingBasis`. `bookEntity` takes `quoteId` only. Both are open-ended in ways that work for the tracer but won't scale across verticals + adapters + the composer + the storefront. Phase B ships explicit, versioned contracts as Zod schemas in `@voyantjs/catalog/booking-engine`:

```ts
// Names suffixed with V1 — bumped in lockstep when fields drift in
// breaking ways. Adapters and handlers declare which version they
// speak via a capability flag.

const QuoteRequestV1 = z.object({
  entityModule: z.string(),
  entityId: z.string(),
  sourceKind: z.string(),
  sourceRef: z.string().optional(),
  scope: z.object({
    locale: z.string(),
    audience: z.enum(["staff", "customer", "partner", "supplier"]),
    market: z.string(),
    currency: z.string().optional(),
  }),
  draft: BookingDraftV1.optional(),  // present once the journey has data; quote echoes shape
  ttlMs: z.number().int().positive().optional(),
  // Engine-injected; adapters / handlers don't see this.
  adapterContext: SourceAdapterContextV1,
})

const QuoteResponseV1 = z.object({
  quoteId: z.string(),
  quotedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  available: z.boolean(),
  invalidReason: z.string().optional(),
  shape: BookingDraftShapeV1.optional(),  // engine fills in for owned; adapter returns for sourced
  pricing: PricingBreakdownV1.optional(),
  upstreamPayload: z.record(z.string(), z.unknown()).optional(),
})

const BookRequestV1 = z.object({
  // Either-or: a quoteId for the legacy single-shot flow (Phase A
  // tracer style), or a draftId once Phase B's draft-persistence
  // ships. The engine resolves the most recent quote off the draft.
  quoteId: z.string().optional(),
  draftId: z.string().optional(),
  bookingId: z.string().optional(),  // existing or newly-created bookings row
  party: PartyV1.optional(),
  paymentIntent: PaymentIntentV1.optional(),
  parameters: z.record(z.string(), z.unknown()).optional(),
  // Idempotency — same key in 24h returns the existing booking.
  idempotencyKey: z.string().min(8).max(128).optional(),
  adapterContext: SourceAdapterContextV1,
}).refine((v) => v.quoteId || v.draftId, {
  message: "either quoteId or draftId must be provided",
})

const BookResponseV1 = z.object({
  bookingId: z.string(),
  orderRef: z.string(),
  status: z.enum(["held", "confirmed", "ticketed", "failed"]),
  snapshotId: z.string(),
  pricing: PricingBreakdownV1.optional(),
  upstreamPayload: z.record(z.string(), z.unknown()).optional(),
})

// Hold lifecycle as separate operations — earlier drafts buried this
// inside reserve/cancel; making it explicit lets adapters expose
// extend semantics without faking a full reserve.
const HoldExtendRequestV1 = z.object({ holdToken: z.string() })
const HoldReleaseRequestV1 = z.object({ holdToken: z.string() })
```

The `SourceAdapter` and `OwnedBookingHandler` interfaces declare which version they speak via capability flags (`supportsContractV1`, `supportsContractV2` etc.); the engine refuses to dispatch to a handler whose declared version doesn't match the request. **Backward compatibility:** when V2 lands, V1 stays callable for one full minor-version cycle of every vertical that adopted it; the engine routes by version. Adapters that haven't moved off V1 keep working.

**Why this matters now.** The journey shell needs to typecheck against the response shape; multiple adapters need to agree on what "available" means; the composer (future) needs the same contract to call N journeys' worth of quotes. Pinning the contracts in Phase B rather than after is the difference between "we can refactor when we need to" and "every vertical reinvents the contract opaquely."

## 9. Schema additions

Each addition is justified against §0.7's reuse table — the question we answered for each is "why not extend an existing primitive?". Where extending was simpler, we did.

1. **`products.tax_class_id`** — text reference to a `tax_classes` row. Drives the engine's tax computation for owned products. (Default `null` → falls through to a market-level default.) **Why new:** today there is no per-product link from `products` to `tax_regimes`; tax is computed only at invoice time.
2. **`tax_classes`** — `{ id, code, label, default_regime_id, lines: [{ regime_id, applies_to: "base"|"addon"|"all" }] }`. Lives in `packages/finance/`. **Why not extend `tax_regimes`:** `tax_regimes` is the jurisdictional rate catalog (RO 19% VAT, EU rates, etc.) and stays as-is. `tax_classes` is the *per-product treatment decision* — "this product applies the standard VAT regime; that one is exempt under Art. 311 margin scheme; the third applies a reduced regime in DE only." A product points at a class; the class points at a regime row keyed off buyer country. The two stack.
3. **`booking_drafts`** — see §5.7. **Why not extend `booking_session_states`:** the existing model is keyed by an existing `booking_id` (it wraps a materialized booking). The journey needs a *pre-booking-row* hold so abandoned drafts don't litter `bookings`. See §12.10 — extending `booking_session_states` to allow `booking_id IS NULL` is a viable alternative we want to settle before Phase B starts.
4. **`product_addon_offers` view** — convenience view over `extras` + `option_extra_configs` that the engine queries to populate `BookingDraftShape.addonGroups`. View, not a table; no source-of-truth change.
5. **`product_pax_pricing_tiers`** — per-product per-occupancy rate tier table **for non-cruise verticals**. Columns: `product_id`, `option_unit_id`, `tier_pax` (1, 2, 3, 4), `price_per_pax_cents`, `promo_price_per_pax_cents`, `effective_from`, `effective_to`. Falls back to `option_unit_tiers` (quantity, not occupancy) when no occupancy tiers exist. **Why not generalize `cruise_prices`:** cruises have specialized columns (`fareCode`, `secondGuestPricePerPerson`, `singleSupplementPercent`) the rest of the catalog doesn't need. Cruises keep `cruise_prices`; the engine reads from `cruise_prices` for cruise rows and `product_pax_pricing_tiers` for everyone else. The handler dispatches.
6. **`product_excursion_offers`** — for cruise/tour products with per-port excursion catalogs. Columns: `product_id`, `port_facility_id` or `day_number`, `excursion_extra_id` (fk into `extras` so we don't fork the addons model), `pricing_kind`, `availability_kind`. Lets the descriptor's `addonGroups` carry a grouped excursion section without a new addon table.

**Removed from earlier drafts (do not add):**

- ~~**`bookingTravelers.documents jsonb`**~~ — would have been a plaintext PII regression. The existing `booking_traveler_travel_details` table holds passport / DOB / dietary / accessibility in `KmsEnvelope` columns (per §0.7). The Travelers step's transient draft state may carry plaintext while the journey is open; the commit path encrypts through the existing service.

**Optional but recommended:**

- **`bookingTravelers.pax_band`** — explicit `"adult" | "child" | "infant"` enum so per-band pricing has a stable join key. Today `travelerCategory` is close but not enforced as the pricing axis.

## 10. Migration / rollout

Six phases. Each is shippable. Phase B has external prerequisites (see below).

**Phase B prerequisites — these block Phase B but parallel each other:**

- The `OwnedBookingHandler` interface (Phase A of this doc).
- At least the products vertical's content cache (Phase C of [`catalog-sourced-content.md`](./catalog-sourced-content.md)) — without it, the journey's Configure / Accommodation / Add-ons steps can't read sourced content.
- The `SourceAdapter` outbound contract additions (Phase A of [`channel-push-architecture.md`](./channel-push-architecture.md)) — typing-only; the engine's commit hooks need to know they exist.

The full channel-push integration work (real adapters per channel) parallels Phase B/C of the journey, not blocks it.

**Phase A — Minimal owned handler for products vertical only** (2-3 days):
- Add `OwnedBookingHandler` interface + `OwnedBookingHandlerRegistry` to `@voyantjs/catalog/booking-engine`. Pure contract — no vertical imports.
- Add **first** vertical handler: `createProductsBookingHandler({ db })` in `packages/products/src/booking-engine/handler.ts`. Composes the products vertical's existing pricing primitives + maps a draft into `bookingsQuickCreate`'s input shape for the commit. Phase A delivers ONE working handler against ONE vertical.
- Wire into `quoteEntity` / `bookEntity` so `source.kind === "owned" && entity_module === "products"` dispatches to the products handler. Other modules still fail with `NO_HANDLER_REGISTERED` (a new error code, sibling to `NO_ADAPTER_REGISTERED`).
- Operator template registers the products handler at boot. Existing one-page booking flow on this branch dispatches through the new handler for owned products.
- **Out of scope for Phase A:** taxes, addons, hospitality stays, encrypted travel details, draft persistence (still uses `catalog_quotes` with the ephemeral 10-min TTL), idempotency keys. Each lands in its own follow-up phase. This is the smallest credible "doesn't 503 anymore" milestone.

**Phase B — The shareable wizard, both surfaces** (7-10 days):
- Build `@voyantjs/bookings-ui/journey` with `<BookingJourney />` shell and all seven step section components. Slots typed as render-props (§8.1).
- Build `@voyantjs/catalog-react/booking-engine` hooks (`useBookingDraft`, `useBookingQuote`, `useBookingCommit`, `useBookingDraftShape`) — TanStack Query under the hood, identical surface for operator and storefront.
- Wire the existing `bookings-ui` sections (PassengersSection widened, PaymentScheduleSection, RoomsStepperSection, etc.) into the journey shell.
- Mount the API surface on **both** `/v1/admin/catalog/{quote,book,drafts/:id}` and `/v1/public/catalog/{quote,book,drafts/:id}` — same engine logic behind both, audience guard differs. Public surface is auth-less or session-token-bound (per the storefront's auth posture); admin surface is staff-actor as today.
- Replace the operator template's `/catalog/book/$entityModule/$entityId` page with `<BookingJourney />` + operator slots (CRM picker, B2B default, post-commit navigate to `/orders/catalog`).
- Mount `<BookingJourney />` at the storefront template's customer-facing `/book/$entityModule/$entityId` route with storefront slots (no CRM picker; B2C default; payment provider widget; post-commit handoff to the storefront's confirmation page).
- Add the `BookingDraftShape` to the quote response; engine returns a hardcoded "minimal shape" until Phase C lands.
- Travelers step still uses simple name fields — no documents yet.
- **Both surfaces are tested in this phase**, not deferred. The shell is surface-agnostic by construction; if it's not, that's a Phase B regression to chase, not a Phase E problem.

**Phase C — Per-product shape, addons, taxes** (5-7 days):
- Engine populates `BookingDraftShape` from `productContactRequirements` + extras catalog + supplier scheme + market.
- AddonsStep renders extras with quantity steppers.
- Travelers step grows its column set based on `travelerFields[]`.
- `tax_classes` schema lands; engine returns `taxes[]` in the breakdown.
- Sticky footer total reflects taxed total.

**Phase D — Existing dialog deprecation** (1-2 days):
- The operator template's `BookingCreateDialog` becomes a thin wrapper around the wizard, OR is retired.
- The "create booking" entry points across the app (top-level button, from CRM, from product detail page) all open the wizard.

**Phase E — Storefront polish** (2-3 days, post-launch hardening):
- Storefront wiring landed in Phase B; this phase is about the customer-facing chrome around it that operator doesn't need: SEO-friendly entry routes, share/save-itinerary affordances, a "log in to use saved details" upgrade path that swaps in the CRM picker slot mid-journey, abandoned-draft email recovery, anonymous → authenticated draft handoff.
- Surface-specific edge cases: anonymous draft cleanup, GDPR export of saved drafts, locale negotiation off `accept-language`, currency override for buyer's country.
- This is NOT where the wizard gets ported to storefront — that's already done. If the customer-facing flow regresses to "we need to rebuild this for storefront," Phase B has a bug to fix, not Phase E.

**Phase F — Cruise-specific shape** (5-7 days, can land in parallel with E):
- Implement `cabin-category` + `cabin-number` sub-steps in the Configure step.
- Implement `extensions` sub-step in Accommodation (pre/post-cruise hotels).
- Implement `excursions` group in the Add-ons step with `groupBy: "port"` + per-guest selection.
- Implement `product_pax_pricing_tiers` lookup for single/double/triple/quad pricing.
- Implement two-installment payment schedule (deposit at book, balance closer to sail).
- Wire the cruises catalog policy + indexer to populate the cruise descriptor variant.
- Reference: this doc's §7 cruise example covers the full shape; the rollout phase just operationalizes it.

## 11. Non-goals (v1)

- **Multi-line / composed itineraries** (flight + hotel + tour, cruise + air, customer-built routes across verticals). This is explicitly the [travel-composer](./ai-travel-experience-composition.md)'s job, not the journey's. The journey commits ONE bookable line; the composer orchestrates N journeys-worth of quote/hold/book primitives into one customer experience with one consolidated checkout. See §0.5 for the seam. The journey's design (per-line draft, per-line quote, optional Payment step, multi-vertical descriptor) is intentionally non-blocking for the composer; building the composer is a separate body of work.
- **Group bookings** beyond shared-room (corporate event, school trip).
- **Loyalty program** integration (frequent-cruiser numbers are stored as a traveler field but don't drive pricing or perks in v1).
- **Partial cancellations** (cancel only some travelers from a booking).
- **Wizard for hospitality direct-from-search** without going through the catalog page. Stage 1 entry point is the Catalog UI's "Book this".
- **Multi-cabin cruise parties** (one booking, two cabins, party split). v1 is single-cabin-per-booking; multi-cabin is a v2 feature that materializes as N drafts under a `bookingGroups` row.
- **Cruise-line-arranged air** (CL-FLIGHT). Air is a separate vertical; v1 cruise bookings don't include flights. Customer adds them as a second booking against the flights vertical.

**Moved out of non-goals — these ARE v1 (specified in sibling docs):**

- ~~**Channel manager push**~~ — promoted to v1. Real deployments integrate with TUI, Voyant Connect peers, OTAs, and similar channels from day one; the journey isn't useful without it. Specified in [`channel-push-architecture.md`](./channel-push-architecture.md). The journey doesn't drive the push (post-commit subscriber territory) but the engine's `bookEntity` commit fires the events that channel push consumes.
- ~~**Rich content for sourced rows**~~ — promoted to v1 prerequisite. Today's catalog plane has no shared "give me this sourced row's full content" path; cruises has a vertical-specific workaround. The journey's Configure / Accommodation / Add-ons steps need this content. Specified in [`catalog-sourced-content.md`](./catalog-sourced-content.md). **Phase B of the journey is blocked on at least the products vertical adopting the content cache.**

## 12. Open questions for design / product

All ten questions resolved as part of the Phase A–F implementation
(see PR #398). Strikethroughs link to the resolution; new sub-PRs
will reopen any of them only if the underlying assumption breaks.

1. ~~**Storefront vs. operator-only for v1.**~~ **Resolved:** both surfaces ship in v1 together, not sequenced. Same wizard shell, hooks, and sections; differences land in slot implementations per surface (Rule 4 + §8.1). Phase B builds the shareable pieces and wires both surfaces in the same phase — see the rewritten §10 phases.
2. ~~**Where does Configure live for hospitality?**~~ **Resolved:** date-range + occupancy stay in the dedicated Configure step on both surfaces (storefront's catalog browser may pre-fill them via search params, but the journey still owns them). Rate-plan and meal-plan picks live in the Accommodation step — they're per-room choices that depend on the room-type selection, so folding them into Configure would force the storefront catalog filters to also pick a rate plan, which is the wrong granularity. The hospitality descriptor's `RoomOption.ratePlans` is the seam.
3. ~~**Single quote table or split.**~~ **Resolved (§5.7):** keep `catalog_quotes` for the live-pricing snapshot; introduce `booking_drafts` for the resumable session-bound hold. Two tables, two lifetimes.
4. ~~**Per-band pricing rules — adult vs child vs infant — does pricing live with the band declaration, or with the optionUnit row?**~~ **Resolved: band-based is canonical; count-based is a per-band transformation.** The descriptor's `paxBands[]` carries `code` ("adult" / "child" / "infant" / vertical-specific) as the unit of pricing; per-product per-occupancy tables (`product_pax_pricing_tiers`, `cruise_prices`) are read keyed by `(option_unit_id|sailing_id, occupancy_count)` and then *broken down* into per-band charges that the wizard can render in the breakdown.
5. ~~**Validation depth.**~~ **Resolved:** hard reject only on physically-required-to-commit fields (firstName, lastName, pax band totals); everything else is a soft warning surfaced inline above the Next button. The shell's `canAdvanceFromStep` enforces hard rules; `warningsForStep` renders the soft hints. Per-product rules ride on the descriptor's `travelerFields[].required` flag.
6. ~~**Idempotency.**~~ **Resolved:** `bookEntity` accepts `idempotencyKey` (8–128 chars). Stored on `booking_catalog_snapshot.idempotency_key` with a partial unique index; duplicate calls return the prior booking. Auto-generated client-side by `useBookingCommit` so double-clicks don't double-book.
7. **Cabin number selection — actual deck plan or numbered grid?** A numbered grid is the simpler affordance and what production cruise systems we've shipped converged on; a deck plan (visual) is richer but takes a CMS and SVG assets per ship. v1 should ship the grid; deck plan is a follow-up that's purely a presentation swap (descriptor unchanged).
8. **Per-guest excursion selection vs party-level.** Per-guest selection (each guest can pick different excursions) is what production cruise systems we've shipped use; some cruise lines mandate party-level. The descriptor's `addonGroups[].perGuestSelection` boolean already covers this — but who declares the value? Probably the supplier, surfaced via supplier metadata on the cruise's catalog row.
9. ~~**Hold release semantics.**~~ **Resolved:** immediate release on `expires_at` for v1. The reaper job (`/api/draft-reaper-scheduled` cron) lists expired drafts hourly and calls each handler's `releaseHold`. Per-supplier grace periods are a follow-up that lives on adapter metadata (the contract takes a `releaseHold(token)` method that adapters can implement to delay the upstream release).
10. ~~**Extend `booking_session_states` vs. ship `booking_drafts`.**~~ **Resolved (option B):** `booking_drafts` shipped as a sibling table. `booking_session_states` stays untouched (post-booking-row session lifecycle); `booking_drafts` carries pre-booking-row resumable state. Two tables, two lifetimes.

## 13. Related documents

- [`catalog-architecture.md`](./catalog-architecture.md) — the Phase 1 foundation (provenance, snapshot graph, source-adapter contract).
- [`catalog-booking-engine.md`](./catalog-booking-engine.md) — the cross-vertical lifecycle (quote / book / cancel) the wizard speaks to.
- [`catalog-sourced-content.md`](./catalog-sourced-content.md) — **prerequisite for Phase B.** Specifies the rich-content layer for sourced rows (itinerary / media / departures / options / terms) so the journey's Configure / Accommodation / Add-ons steps work for sourced rows the way they work for owned products.
- [`channel-push-architecture.md`](./channel-push-architecture.md) — outbound supplier integration. The journey's commit triggers the booking-push subscriber. Contract additions block Phase B; full channel integrations parallel.
- [`catalog-flights-architecture.md`](./catalog-flights-architecture.md) — the flights vertical's specialized booking flow. The wizard described here borrows shape but does not replace it; flights stays special-case.
- [`payments-architecture.md`](./payments-architecture.md) — payment intent + schedule. The Payment step calls into the same primitives.
- [`ai-travel-experience-composition.md`](./ai-travel-experience-composition.md) — the proposed travel-composer module that orchestrates multi-line itineraries. The single-line journey designed here is one of the composer's leaf primitives (§0.5). Don't ship architectural decisions in this doc that block what the composer needs.

### Patterns from systems we've shipped

This doc consolidates patterns we've validated in production booking engines we built and continue to maintain in adjacent codebases. We're not naming the projects here, but the concrete shape decisions were borrowed from:

- A general-purpose travel booking engine (Astro + React + react-hook-form + Zod). Source of: linear wizard with conditional steps, per-passenger DOB + document fields collected inline at the passengers step, live pricing on every input change with sticky-footer total, session-bound inventory hold via a session token.
- A luxury cruise booking engine (Next.js + Zustand + Supabase). Source of: cabin-category → cabin-number two-step selection, per-occupancy pricing tiers (single/double/triple/quad), pre/post-cruise extension hotels separate from generic addons, per-port excursions with per-guest selection, resumable booking-row-as-draft model that informs §5.7's `booking_drafts` design.

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
- Per-step API calls for state persistence. Our journey state lives in a draft (URL + ephemeral state). On Confirm we hit `bookEntity` once.

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

The catalog booking engine currently fails on `source.kind = "owned"` with `NO_ADAPTER_REGISTERED`. We introduce a built-in owned arm at the engine layer, NOT as a registered `SourceAdapter` — the architecture doc's earlier note (`catalog-booking-engine.md` §6 "owned-vs-sourced") favored direct dispatch, and that's the right call here.

```
quoteEntity({ entity, draft, scope })
  ├── if entity.sourceKind === "owned"
  │     → ownedArm.computeQuote(db, { entity, draft, scope })
  │       which composes:
  │         · pricing module's tier matching (existing)
  │         · finance module's tax regime lookup (new helper exposed)
  │         · extras module's per-pax / per-booking pricing (new helper)
  │         · hospitality module's daily-rate computation (existing)
  │         · availability module's slot inventory check (existing)
  │       returns { available, pricing, holdToken? }
  │
  └── else
        → registry.resolveOrThrow(sourceKind).liveResolve(...)

bookEntity({ quoteId, draft })
  ├── owned: ownedArm.commit(db, { quote, draft }) — calls the existing
  │           bookingsQuickCreate transaction with the draft mapped to its
  │           shape, returns the booking id
  │
  └── sourced: registry...reserve(...) + captureSnapshot(...) (current behavior)
```

The owned-arm helpers live in `packages/catalog/src/booking-engine/owned-arm/`. They depend on `@voyantjs/products`, `@voyantjs/extras`, `@voyantjs/hospitality`, `@voyantjs/pricing`, `@voyantjs/finance`, `@voyantjs/availability`, and `@voyantjs/bookings`. This is an acceptable inversion (catalog → modules) because the modules already depend on `@voyantjs/catalog/contract` for their field policies — the dependency direction was always going to be circular at the orchestration layer, and the owned arm is where it lands.

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
| Payment | `PaymentScheduleSection` | New `PaymentStep` with intent radio (hold/card/credit) + the existing schedule section |
| Review | — | New `ReviewStep` showing the full draft + final pricing |
| Side panel | `PriceBreakdownSection` | Adapt to consume the new `PricingBreakdown` shape |

The wizard shell itself (`<BookingJourney />`) is new — a route component at `/catalog/book/$entityModule/$entityId` (operator) and `/book/$entityModule/$entityId` (customer storefront, future). Step navigation, validation, draft persistence (URL + sessionStorage), and quote orchestration live there.

### 8.1. Package layout — share by default

Per Rule 4 (§overview), every piece of the journey except the wired-up route component lives in a publishable package and is consumed identically by every surface (operator dashboard, customer storefront, partner portal, embedded widgets). New code lands in packages; templates wire it. **No journey logic in template src/ directories.**

| Concern | Package | New / Existing |
|---------|---------|----------------|
| Engine endpoints + types (`POST /quote`, `POST /book`, `BookingDraftShape`, `PricingBreakdown`) | `@voyantjs/catalog/booking-engine` | Existing — extend |
| React hooks (`useBookingDraft`, `useBookingQuote`, `useBookingCommit`, `useBookingDraftShape`) | `@voyantjs/catalog-react/booking-engine` *(new sub-path)* | New |
| Wizard shell (`<BookingJourney />`, step navigation, sticky footer, draft persistence) | `@voyantjs/booking-journey-ui` *(new package)* | **New** — the missing piece. Modeled on `@voyantjs/flights-ui`'s `FlightBookingShell`. |
| Step section components (Configure, Billing, Travelers, Accommodation, Add-ons, Payment, Review) | `@voyantjs/booking-journey-ui` | New, with renderers per sub-step `kind` |
| Reusable form sections that pre-date the journey | `@voyantjs/bookings-ui` (PassengersSection, PaymentScheduleSection, RoomsStepperSection, SharedRoomSection, VoucherPickerSection, PriceBreakdownSection) | Existing — widen as §8 table notes |
| Owned-arm engine logic (compute quote, materialize booking via `bookingsQuickCreate`) | `@voyantjs/catalog/booking-engine/owned-arm` | New |
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
  // Optional: hook a payment-provider widget into the Payment step.
  renderPaymentProviderWidget={(intent, schedule) => <NetopiaWidget ... />}
/>
```

Slots are render-props (function children), not config flags. New slots are added to the prop type as `optional` so existing callers don't break. The shell renders a sensible default when a slot is absent — e.g. a plain inline `<Input>` for the contact pickers when no `renderLeadContactPicker` is passed (which is the storefront's default).

#### What templates own

Templates wire the shell, the auth posture, the route tree, the API base URL, and the slot implementations:

```
templates/operator/src/routes/_workspace/catalog_.book.$entityModule.$entityId.tsx
templates/operator/src/components/voyant/catalog/operator-booking-journey.tsx
  → wraps <BookingJourney /> with operator slots:
    - renderLeadContactPicker: CRM-backed PersonPicker
    - defaultBuyerType: "B2B"
    - onCommitted: navigate to /orders/catalog
    - renderPaymentProviderWidget: Netopia (when configured)
```

The customer storefront does the same with different slots and different routes. Same shell, same hooks, same engine — different chrome. **Adding a new template (a partner portal, a white-label embed) is a single wiring file plus its own auth.**

## 9. Schema additions

These are net-new database changes the journey needs:

1. **`products.tax_class_id`** — text reference to a tax-class lookup. Drives the engine's tax computation for owned products. (Default `null` → falls through to a market-level default.)
2. **`tax_classes`** table — `{ id, code, label, market_id, lines: [{ jurisdiction, rate, applies_to: "base"|"addon"|"all" }] }`. Lives in `packages/finance/`.
3. **`booking_drafts`** table — see §5.7 for the full shape. Resumable session-bound draft + hold. Sibling to `catalog_quotes`, not a replacement.
4. **`product_addon_offers` view** — convenience view over `extras`+`option_extra_configs` that the engine queries to populate `BookingDraftShape.addonGroups`. Avoids a per-step UI query against multiple tables.
5. **`product_pax_pricing_tiers`** — per-product rate tier table for verticals that need single/double/triple/quad occupancy pricing (cruises primarily, also some hospitality + tour package products). Columns: `product_id`, `option_unit_id`, `tier_pax` (1, 2, 3, 4), `price_per_pax_cents`, `promo_price_per_pax_cents`, `effective_from`, `effective_to`. Falls back to `optionUnitPriceRules` when the product doesn't declare tiers.
6. **`product_excursion_offers`** — for cruise/tour products with per-port excursion catalogs. Columns: `product_id`, `port_facility_id` or `day_number`, `excursion_extra_id` (fk into `extras` so we don't fork the addons model), `pricing_kind` ("per_pax" | "per_booking"), `availability_kind` ("guaranteed" | "on_request" | "limited"). Lets the descriptor's `addonGroups` carry a grouped excursion section without adding a new addon table.

Optional but recommended:

- **`bookingTravelers.documents jsonb`** — opaque field holding passport / ID / dietary / etc. Today there's `specialRequests` text; widening to a structured map keeps the audit better.
- **`bookingTravelers.pax_band`** — explicit "adult"/"child"/"infant" enum so per-band pricing has a stable join key. Today `travelerCategory` is close but not enforced as the pricing axis.

## 10. Migration / rollout

Three phases. Each is shippable.

**Phase A — Owned arm in the engine** (1-2 days):
- Implement `ownedArm.computeQuote` and `ownedArm.commit`.
- Wire into `quoteEntity` / `bookEntity` so `source.kind === "owned"` no longer returns `NO_ADAPTER_REGISTERED`.
- Existing one-page booking flow on this branch keeps working; it just dispatches into the owned arm for owned rows now.
- No schema change yet; basic pricing (no taxes) is fine for the first cut.

**Phase B — The shareable wizard** (5-7 days):
- Build `@voyantjs/booking-journey-ui` (new package) with `<BookingJourney />` shell and all seven step section components. Slots typed as render-props (§8.1).
- Build `@voyantjs/catalog-react/booking-engine` hooks (`useBookingDraft`, `useBookingQuote`, `useBookingCommit`, `useBookingDraftShape`) — TanStack Query under the hood, identical surface for operator and storefront.
- Wire the existing `bookings-ui` sections (PassengersSection widened, PaymentScheduleSection, RoomsStepperSection, etc.) into the journey shell.
- Replace the operator template's `/catalog/book/$entityModule/$entityId` page with `<BookingJourney />` + operator slots (CRM picker, B2B default, post-commit navigate).
- Add the `BookingDraftShape` to the quote response; engine returns a hardcoded "minimal shape" until Phase C lands.
- Travelers step still uses simple name fields — no documents yet.
- **Storefront viability test:** in Phase B's last day, ship a stub `examples/storefront-booking-journey/` that mounts `<BookingJourney />` with NO slots and verifies the journey works against the public API surface end-to-end. This is the contract test that proves the shell is genuinely surface-agnostic.

**Phase C — Per-product shape, addons, taxes** (5-7 days):
- Engine populates `BookingDraftShape` from `productContactRequirements` + extras catalog + supplier scheme + market.
- AddonsStep renders extras with quantity steppers.
- Travelers step grows its column set based on `travelerFields[]`.
- `tax_classes` schema lands; engine returns `taxes[]` in the breakdown.
- Sticky footer total reflects taxed total.

**Phase D — Existing dialog deprecation** (1-2 days):
- The operator template's `BookingCreateDialog` becomes a thin wrapper around the wizard, OR is retired.
- The "create booking" entry points across the app (top-level button, from CRM, from product detail page) all open the wizard.

**Phase E — Storefront wiring** (1-2 days, not a rebuild):
- This is a wiring phase, not a build phase. The shell + hooks + sections all exist and are surface-agnostic from Phase B.
- Mount `<BookingJourney />` at a public-facing route in the storefront template.
- Pass storefront-appropriate slots: no CRM picker (or a "log in to use saved details" stub), B2C buyer default, post-commit navigate to a customer order page.
- Wire the storefront's payment-provider integration into `renderPaymentProviderWidget`.
- Make sure the public API surface (`/v1/public/catalog/quote`, `/v1/public/catalog/book`, `/v1/public/catalog/drafts/:id`) is mounted alongside the admin one — the engine routes are the same, the only difference is the audience guard.
- If this phase takes more than 2 days, Phase B over-fitted to operator and we have a regression to chase. The "Storefront viability test" stub from Phase B is the canary.

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
- **Channel manager** push (forwarding the booking to upstream channels).
- **Partial cancellations** (cancel only some travelers from a booking).
- **Wizard for hospitality direct-from-search** without going through the catalog page. Stage 1 entry point is the Catalog UI's "Book this".
- **Multi-cabin cruise parties** (one booking, two cabins, party split). v1 is single-cabin-per-booking; multi-cabin is a v2 feature that materializes as N drafts under a `bookingGroups` row.
- **Cruise-line-arranged air** (CL-FLIGHT). Air is a separate vertical; v1 cruise bookings don't include flights. Customer adds them as a second booking against the flights vertical.

## 12. Open questions for design / product

These need answers before Phase B starts:

1. ~~**Storefront vs. operator-only for v1.**~~ **Resolved (Rule 4 + §8.1):** both surfaces from day one, sharing the same wizard shell, hooks, and sections via slot injection. Phase B builds the shareable pieces; Phase E is a wiring exercise (1-2 days), not a rebuild. The remaining sequencing question is whether to ship operator's wiring first or storefront's first — operator is the obvious choice (existing logged-in users, fewer auth/payment moving parts) but the order doesn't change what gets built in Phase B.
2. **Where does Configure live for hospitality?** Hotel rooms have date range + occupancy as the *primary* configuration. Either a dedicated Configure step or fold into the entry point (catalog filter chips drive the date range + occupancy). Probably the latter for storefront, the former for operator.
3. ~~**Single quote table or split.**~~ **Resolved (§5.7):** keep `catalog_quotes` for the live-pricing snapshot; introduce `booking_drafts` for the resumable session-bound hold. Two tables, two lifetimes.
4. **Per-band pricing rules — adult vs child vs infant — does pricing live with the band declaration, or with the optionUnit row?** Today the answer is the optionUnit row (`pricingCategoryId`). The wizard's pax-bands → traveler-categories mapping needs to be deterministic. Likely needs a stable `pax_bands` lookup keyed off `pricingCategoryId` so the descriptor and the pricing rules agree. *External cruise systems we've worked on keyed pricing off `(cabin_type, occupancy_count)` instead — that's a different axis from per-band, so the patterns we borrowed elsewhere don't transfer here.* Needs a Voyant-side decision on whether band-based or count-based pricing is the canonical primitive.
5. **Validation depth.** Hard validation (reject step) vs soft warnings (allow proceed). E.g. a child-only booking with no adult — hard reject? Different products have different rules; this comes from the descriptor, not from hardcoded UI logic.
6. **Idempotency.** Should `bookEntity` accept an idempotency key so a double-click can't create two bookings? (Yes. Easy add.)
7. **Cabin number selection — actual deck plan or numbered grid?** A numbered grid is the simpler affordance and what production cruise systems we've shipped converged on; a deck plan (visual) is richer but takes a CMS and SVG assets per ship. v1 should ship the grid; deck plan is a follow-up that's purely a presentation swap (descriptor unchanged).
8. **Per-guest excursion selection vs party-level.** Per-guest selection (each guest can pick different excursions) is what production cruise systems we've shipped use; some cruise lines mandate party-level. The descriptor's `addonGroups[].perGuestSelection` boolean already covers this — but who declares the value? Probably the supplier, surfaced via supplier metadata on the cruise's catalog row.
9. **Hold release semantics.** When a draft is abandoned, do we release the hold immediately on `expires_at`, or hold for a grace period? Cruise lines often don't release for 24-72h after expiry to handle "I'll be right back" scenarios. The grace is a per-supplier knob; default to immediate release for v1 and let suppliers extend it via adapter metadata.

## 13. Related documents

- [`catalog-architecture.md`](./catalog-architecture.md) — the Phase 1 foundation (provenance, snapshot graph, source-adapter contract).
- [`catalog-booking-engine.md`](./catalog-booking-engine.md) — the cross-vertical lifecycle (quote / book / cancel) the wizard speaks to.
- [`catalog-flights-architecture.md`](./catalog-flights-architecture.md) — the flights vertical's specialized booking flow. The wizard described here borrows shape but does not replace it; flights stays special-case.
- [`payments-architecture.md`](./payments-architecture.md) — payment intent + schedule. The Payment step calls into the same primitives.
- [`ai-travel-experience-composition.md`](./ai-travel-experience-composition.md) — the proposed travel-composer module that orchestrates multi-line itineraries. The single-line journey designed here is one of the composer's leaf primitives (§0.5). Don't ship architectural decisions in this doc that block what the composer needs.

### Patterns from systems we've shipped

This doc consolidates patterns we've validated in production booking engines we built and continue to maintain in adjacent codebases. We're not naming the projects here, but the concrete shape decisions were borrowed from:

- A general-purpose travel booking engine (Astro + React + react-hook-form + Zod). Source of: linear wizard with conditional steps, per-passenger DOB + document fields collected inline at the passengers step, live pricing on every input change with sticky-footer total, session-bound inventory hold via a session token.
- A luxury cruise booking engine (Next.js + Zustand + Supabase). Source of: cabin-category → cabin-number two-step selection, per-occupancy pricing tiers (single/double/triple/quad), pre/post-cruise extension hotels separate from generic addons, per-port excursions with per-guest selection, resumable booking-row-as-draft model that informs §5.7's `booking_drafts` design.

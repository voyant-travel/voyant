# Composite Products & Component Composition

Status: active architecture decision and implementation plan (supersedes the framing of RFC voyantjs/voyant#1470)
Audience: anyone modeling tour-operator packages, group departures, cruises, accommodations, transport, and the catalog/booking/composer boundary in Voyant.

This document answers a single question:

> How should Voyant represent a **tour-operator package** — a flight (or coach)
> + a hotel + board + transfers sold and priced as one merchandised SKU —
> without forking the catalog, and without flattening its component structure at
> ingest?

It reconciles RFC #1470 ("Composite Products") with the architecture that has
actually shipped since the RFC was written, grounds the analysis in the current
codebase and connector/import patterns, stress-tests the model against three
concrete scenarios, and lands a phased resolution plan.

---

## 1. Core conclusion

RFC #1470's **instinct is correct** — keep one canonical sellable, do **not**
add a parallel "Packages" vertical — but its **framing is stale**. It assumed
*Product* is "the single canonical sellable." Since then the architecture has:

- made **Catalog Item** the cross-provenance sellable surface (Product is the
  *operated* provenance; **Sourced Inventory** is the other);
- shipped the runtime composition layer (`@voyantjs/travel-composer`, Trip /
  Package Envelope + Component Booking/Order);
- grown a rich **content-shape + sourced-content** plane keyed by
  `(entity_id, locale, market)`;
- moved operated Product pricing onto shared pricing primitives
  (`@voyantjs/pricing`): catalogs → schedules → option rules → unit rules →
  categories, with first-class per-departure overrides.

The single most important framing correction (see §3): **the package use case
does not need a new package-specific price matrix.** Operated product options,
units, categories, schedules, and per-departure overrides already flow through
`@voyantjs/pricing`; sourced packages should resolve through their source
adapter. The genuine gap is **structural and content-level**. A package needs a
way to *say it is a hotel + a coach + board* as typed components, and to render
them without flattening.

So the RFC's single "composition primitive" decomposes across **layers that
already exist** (pricing engine, content plane, composer), plus a small set of
genuinely-missing **structural/content** primitives. The concrete symptom the RFC
cites ("the hotel collapsed into a summary string") is a content-modeling gap.

**Decision proposed:** a package is a **Catalog Item carrying a package/sellable
facet**, plus **typed components** (each `ref` to a first-class entity *or*
`inline` structured sub-object; with a selection mode, commitment boundary, and
price disposition). Operated packages price through the existing
`@voyantjs/pricing` engine; sourced packages resolve through the source adapter.
Not a Packages vertical; not a products-only components table; and not a new
data-level Catalog root discriminator. The component is **shared catalog
vocabulary** the verticals converge on over time.

---

## 2. The canonical vocabulary anchor

`UBIQUITOUS_LANGUAGE.md` has evolved well past what the RFC assumes. The
relevant rows (verbatim intent):

- **Catalog Item** (`:31`) — "A normalized sellable discovery and booking record
  used by admin search, storefront, composer, or CMS sync **regardless of
  provenance**." This is the cross-provenance sellable surface, not a shared
  root table.
- **Operated / Sourced Inventory** (`:32-33`) — the two provenances a Catalog
  Item resolves to.
- **Product** (`:51`) — "A sellable travel offering" with smells *tour, trip,
  experience, package*. Canonical **module-owned truth** (`:208`), i.e. the
  *operated* provenance only.
- **Operated Group Departure** (`:63`) — "A fixed Product instance/departure
  with capacity and product-internal components such as bus transport, stays,
  included excursions, guide assignment, rooming list, and dependent Extras."
- **Trip / Package Envelope** (`:64`) — "A customer-facing aggregate that groups
  one or more Component Bookings/Orders into one itinerary, checkout, support,
  document, and cancellation-preview experience. Not necessarily one Booking."
- **Component Booking / Order** (`:66`) — "One independently committed part …
  with its own supplier/provider reference, cancellation rules, tax treatment,
  fulfillment state, and operational owner."
- **Extra** (`:67`) — "A child line that … shares that component's lifecycle
  closely enough to be cancelled, fulfilled, taxed, and supported with it."
- **Accommodation Component** (`:56`) / **Stay Component** (`:60`).

Two load-bearing rules:

- `:211-213` — *"A **Trip / Package Envelope** groups Component Bookings/Orders
  for customer experience and checkout; it does not erase the lifecycle
  boundaries of those components. Product-internal bundles and dependent
  **Extras** stay inside their Component Booking. Customer-composed additions
  with independent supplier/cancellation/tax/fulfillment state become sibling
  Component Bookings/Orders under the same Trip / Package Envelope."*
- `:254` — *"Do not import external inventory into Product just to make it
  searchable."*

`:254` is decisive: a **sourced** wholesaler package must not become a Product
with a components table. It is a Catalog Item backed by an adapter. This is why
RFC #1470's literal Option B (a `product_components` table on products) is the
wrong default — it re-introduces exactly the anti-pattern the language warns
against.

---

## 3. Codebase grounding

The current repo supports the main conclusion without relying on customer-specific
operator data. Pricing, sourced content, and runtime trip composition already
exist. The missing pieces are component content, component authoring, and
booking-descriptor integration.

### 3.1. Product/package pricing already has the right primitives

`@voyantjs/pricing` owns the product/package pricing stack:

| Table / contract | Role |
|---|---|
| `price_catalogs` | public, channel-specific, or internal price books |
| `price_schedules` | seasonal or recurring schedule windows |
| `pricing_categories` | adult, child, occupancy, room, or other price categories |
| `option_price_rules` | per-(product, option, catalog, schedule) rule headers |
| `option_unit_price_rules` | per-(unit × pricing category) amounts |
| `option_unit_tiers` | quantity/occupancy tier amounts under a unit rule |
| `departure_price_overrides` | first-class per-(departure × unit × catalog) deviations |

The resolution order is explicit in `schema-departure-overrides.ts`: a departure
with an active override takes the override amount; units without one fall
through to the schedule-matched option/unit rule.

The storefront path already consumes these overrides. `resolvePricingContext`
loads `departure_price_overrides` for a departure, and `selectUnitAmount` prefers
override amounts before scheduled unit-rule tiers.

### 3.2. `product_pax_pricing_tiers` is not the package pricing model

`product_pax_pricing_tiers` is an owned-arm occupancy-tier table in
`packages/products/src/schema-core.ts`. The products booking handler treats it as
a later-phase pricing path and falls back to `product.sellAmountCents × pax` when
no richer resolver is supplied.

For composite packages, the canonical operated pricing path should stay in
`@voyantjs/pricing`. A package-specific matrix table would duplicate the pricing
engine and force storefront, booking, reporting, and admin surfaces to reconcile
two customer-facing price sources.

### 3.3. Per-departure matrix authoring is still a real UX problem

Many tour operators author prices as a departure × room × occupancy matrix.
Voyant's runtime pricing model is deliberately catalog/schedule-centric, so a
direct import often needs translation:

- common values become `option_unit_price_rules`;
- date/season patterns become `price_schedules`;
- deviating departures become `departure_price_overrides`;
- historical import data may be kept as audit-only migration evidence.

That argues for an admin matrix editor/importer over the existing pricing
tables, not a new runtime price source.

### 3.4. The structural/content gaps are visible in current code

The remaining gaps are structural/content gaps:

1. **Transport has no structured package component home.** Products only expose a
   `transport` capability flag; `packages/ground` models dispatch/operations,
   not a catalog-projected package transport leg.
2. **Product content has no component block.** `productContentSchema` has
   product summary, options, days, media, policies, and departures, but nothing
   for accommodation, board basis, transport, or component choice sets.
3. **Booking configuration has no component-choice step.** `configureSubStepV1`
   supports departure, product option, cabin category, cabin number, date range,
   occupancy, and air arrangement. It does not yet support component choice.
4. **Board basis is not a shared enum.** Accommodations has a string convention
   and meal-plan booleans; products and cruises do not have a typed board-basis
   field.

In short: the pricing primitives exist. The component model does not.

---

## 4. Scenario analysis

Each scenario bends a different axis. Verdicts are grounded in §2 and §3.

### Scenario A — single hotel, occupancy + board, fixed transport

*"5-day Antalya package: flights + accommodation + half board; per-person price
by occupancy × departure."*

| Part | Native home today? | Reality |
|---|---|---|
| Occupancy (SGL/DBL/TWN/TPL) | ✅ `product_options` + `option_units` | works |
| **Pricing (occupancy × departure)** | ✅ `@voyantjs/pricing` | `option_price_rules` + `option_unit_price_rules` + `pricing_categories`, with `departure_price_overrides` for per-departure deviation. **Not a gap.** |
| **Transport (coach/flight)** | ❌ | only a `transport` capability flag; structured legs usually collapse into connector payloads, import metadata, or title/description copy |
| **Hotel identity (star, room types)** | ❌ | product name/description; no structured accommodation component |
| **Board / meals (HB)** | ❌ | no canonical shared enum; accommodations has the closest convention (`accommodationMealPlanSchema.basis` is a string, plus meal-plan booleans) — this is #1469 |
| **Content / display** | ❌ | `productContentSchema` has no components block; hotel + transport + board flatten to strings |

Verdict: the **configuration axis** (occupancy) and the **pricing** model
cleanly. The gaps are **transport**, **board basis**, **structured accommodation
identity**, and the **content shape** — all structural/content, not pricing.

`bookingMode` is also single-axis (`productBookingModeEnum`:
`date`/`stay`/`transfer`/…) while a flight **+** multi-night stay is two modes at
once — you pick `date` and lean on `capabilities={multi_day, transport,
accommodation}`.

### Scenario B — multiple hotels to choose from

*"7-night Antalya: choose Hotel X 4★ or Hotel Y 5★; each has room types
(standard/sea-view) + board (HB/AI); priced by hotel × room × board × occupancy
× departure."*

Five orthogonal axes: hotel-choice · room-type · board · occupancy · departure
(+ transport). In A the single `product_options` list was already spent on
occupancy. B has nowhere to put the other axes.

- The `@voyantjs/pricing` engine can *price* any `(option × unit × category ×
  schedule/departure)` cell — pricing is not the constraint. The constraint is
  **structural**: `product_options` is a flat list, so it can't carry hotel ×
  room-type × board as separate, nestable axes. Exploding the cross-product
  (~24 options) loses structure ("show me all 5★ options") and multiplies rules;
  options don't nest.
- This *structural* shape is already solved in adjacent models:
  - **Cruises:** `cabin_categories` (choose-one) × `sailings` (departures) ×
    occupancy.
  - **Tour-operator imports:** rate plan = hotel + board per departure →
    room-type rows or matrix cells.

Verdict: the flat-options *structure* breaks (pricing does not). You need a typed
component carrying its own choice-set; its cells then price through the existing
engine. Cruises and tour-operator import formats independently converge on the
same *structural* shape.

### Scenario C — independent-lifecycle components

*"Package + an optional excursion from a different supplier (separately
cancellable) + travel insurance."*

This bends the **lifecycle** axis. The runtime homes already exist:

| Component | Lifecycle | Lands as |
|---|---|---|
| flight + hotel + board (core) | all-or-nothing | **one Component Booking** (OGD) |
| optional excursion, different supplier, separately cancellable | independent | **sibling Component Booking/Order under a Trip/Package Envelope** (`travel-composer`) |
| travel insurance | dependent add-on | **Extra** (`product_extras`, `configureSubStepV1` group `insurance`) |

Verdict: the three buckets exist, but the catalog-layer package has no way to
**declare** which bucket each component falls into. The missing piece is a
per-component commitment boundary plus price disposition:
`internal | dependent_component | independent_component`, and
`included | add_on`. That routes booking to one booking, nest-as-extra, or split
to a Trip / Package Envelope.

---

## 5. The convergence insight

Two layers are at different stages of convergence:

**The operated Product pricing primitive is already shared.** `@voyantjs/pricing`
handles catalogs → schedules → option rules → unit rules → categories +
per-departure overrides for product/package-style inventory today. Composite
work should **reuse** it for operated packages, and use adapter `liveResolve` for
sourced packages, not invent a package price matrix.

**Structure/content is not converged.** Each vertical re-implements "a
configurable, separately-priced sub-thing":

| Vertical | "choice" structure | "departure" | prices via |
|---|---|---|---|
| products | `product_options` + `option_units` | `availability_slots` | `@voyantjs/pricing` |
| cruises | `cabin_categories` | `sailings` | (cruise pricing) |
| charters | `suites` | `voyages` | — |
| accommodations | `room_types` + `rate_plans` + `meal_plans` | (stay dates) | — |

The package's accommodation component resembles a cruise's cabin model; the
package's transport component is a generalized transport-leg shape. The
composite-package work is the forcing function to converge the **structure +
content** layer first. Pricing convergence should stay incremental: reuse the
existing shared product/package pricing path where it already exists, and avoid
assuming cruises, charters, and accommodations have fully converged.

---

## 6. Required primitives (union of A + B + C)

1. **Catalog-item sellable facet** (`package` / `tour` / `activity` /
   `transfer` / `accommodation` / `cruise` / `charter` / …) — #1470 Option A,
   scoped as a projection/search/content facet. This must not become a universal
   data-level Catalog root discriminator unless `catalog-architecture.md` is
   deliberately reopened. Operated products may additionally get a narrow
   `productKind` column. (No `productKind` exists today.)
   `group_departure` is deliberately excluded: an Operated Group Departure is a
   fixed operated Product departure/slot, not a sellable kind.
2. **Typed component primitive** on a composite — #1470 Option B, reframed:
   - `componentKind`: `accommodation` · `transport` · `activity` · `meal` ·
     `insurance` · `other`
   - `binding`: **`ref`** (link to a first-class entity via the link service) **or
     `inline`** (structured sub-object) — both conform to the same per-kind
     shared shape
   - `selection`: `fixed` · `choose_one` · `multi` · `optional` (+ choice-set)
   - `commitmentBoundary`: `internal` · `dependent_component` ·
     `independent_component`
   - `priceDisposition`: `included` · `add_on`
   - **pricing**: operated component choices resolve through `@voyantjs/pricing`
     (option/unit rules + departure overrides); sourced choices resolve through
     the source adapter — no new package pricing structure
   - **content depth**: stable display/search fields live in content; volatile
     price/availability/cancellation details resolve at quote/checkout
3. **Shared component sub-schemas** (kills the flattening; resolves #1469):
   - **accommodation**: property + room_type + `board_basis` (shared enum) +
     images + star + amenities — the `accommodations/v1` shape lifted to a
     shared contract
   - **transport**: define a transport-leg shape `{mode:
     coach|flight|rail|ferry|transfer, carrier, number, class, from/to,
     duration}` (covers charter flight **and** coach) — the one genuinely-missing
     *structural* component
   - **board basis**: shared enum (#1469), used as an accommodation/rate-plan
     attribute and cruise/package inclusion facet. It is not a standalone
     component unless a meal is sold or operated independently.
4. **Content-shape composition block** — `products/v1` gains a structured
   `components` block so detail pages render hotel/board/transport instead of a
   title string.
5. **Booking-engine integration** — extend `configureSubStepV1` (today:
   `departure` · `product-option` · `cabin-category` · `cabin-number`; add-on
   groups `extras` · `excursions` · `insurance`) with a `component-choice`
   sub-step, sibling to `cabin-category`.
6. **Composer bridge** — `commitmentBoundary = independent_component` components
   feed a `travel-composer` Trip Envelope as a `catalog_booking` component.

Note what is **not** on this list: a package-specific per-departure price matrix.
The operated package path already has `@voyantjs/pricing` +
`departure_price_overrides`; sourced packages live-resolve through their adapter.

---

## 7. Resolution plan

**Anchor decision:** a package is a **Catalog Item carrying a package/sellable
facet** and **typed components** (`ref` | `inline`, selection mode, commitment
boundary, price disposition). Not a parallel vertical; not a products-only
components table; not a universal data-level Catalog discriminator. **Sourced**
packages express components in the content/live layer and resolve through the
source adapter; **operated** packages persist the structure and price through the
existing engine.

| Phase | Deliverable | Why / evidence | Touches |
|---|---|---|---|
| **0 — Reconcile & decide** | This doc + ADR-0004 (*"Shared travel component content contract"*). Update #1470 to the Catalog-Item anchor + the convergence finding: product/package pricing primitives exist; component structure/content does not. Lock component taxonomy, `ref`/`inline` rules, commitment boundary, price disposition, content-depth rules, and OGD/package separation. Resolve #1469 board-basis enum as shared vocab. | RFC is stale; the north star must be documented before code | `docs/adr/`, issues #1470, #1469 |
| **1 — Shared sub-schemas in the content layer** | Create `@voyantjs/travel-components-contracts` with `boardBasis`, `componentRef`, `accommodationComponent`, `transportComponent`, `travelComponent`, commitment boundary, and price disposition. Add a `components` block to `products/v1`; stop adapter/synthesizer flattening; render in the detail sheet. | Directly fixes "hotel → string" and "coach-only-in-the-title". Additive, **no migration**. Extend cruises/charters only after the package shape proves useful. | `travel-components-contracts`, `products-contracts`, source adapters/synthesizers, `catalog-ui`, storefront detail pages |
| **2 — Sellable facet** | Projection/search/content `sellableKind` facet for package-like sellables, inferred first from explicit package markers and the existing `multi_day` + `accommodation` + `transport` capability combination. Optional operated `productKind` column remains deferred until authoring evidence requires storage. Do not add `group_departure` as a product kind. | #1470 Option A; lightweight, additive, no migration. Keep this out of shared Catalog root identity unless an ADR reopens the no-root-discriminator rule. | products contracts, catalog projection/indexing, public/catalog content shapes |
| **3 — Operated component structure** | Canonical `product_components` for operated products only (typed, ref/inline, selection, commitment boundary, price disposition) + a structured **transport component**; wire operated component choices to existing pricing IDs where relevant; extend `configureSubStepV1` with `component-choice`. **No new package pricing model**. | B's structural break; transport is the genuinely-missing component (§3.4) | `products` schema + service + routes, `catalog-contracts/booking-engine`, integration with `@voyantjs/pricing` |
| **4 — Pricing authoring + commitment routing** | Add a package/rate-plan matrix authoring/import surface that writes `price_schedules`, `pricing_categories`, `option_price_rules`, `option_unit_price_rules`, and `departure_price_overrides`. Route booking by `commitmentBoundary`: `internal` → one booking; `dependent_component` → nest as Extra/add-on; `independent_component` → `travel-composer` `catalog_booking`. | Keeps runtime pricing canonical while making per-departure room matrices authorable. Closes C without blurring catalog and composer responsibilities. | pricing/admin UI, `travel-composer`, booking engine |
| **5 — Deferred** | Charter flight **allotment**; app-specific storefront/productization polish for room-step or rate-plan presentation; **converge** cruise cabins / charter suites / accommodation rooms onto the shared component structure only once it is proven on packages; commercial `PackageOffer` record only if package-level cross-vertical terms demand it | #1470 charter follow-up + optional convergence. No upstream `departure_price_overrides` surfacing task remains in this repo. | storefront/app surfaces, charters, flights, cruises, accommodations |

**Sequencing logic.** Phases 1–2 are additive contract/content work — ship value
and fix the content gap fast, zero migration, no risk to existing products.
Phase 3 adds the structural component model and maps operated component choices
onto the existing pricing identifiers. Phase 4 adds the authoring and commitment
workflow needed to make that model usable. Phase 5 (vertical convergence +
app-specific productization) is deliberately last and mostly optional.

**Implementation status as of 2026-06-02.**

- Phases 0–2 are implemented: ADR-0004 exists,
  `@voyantjs/travel-components-contracts` owns the shared component contract,
  `products/v1` content has `components`, catalog UI renders component detail,
  and `sellableKind` is projected through content/search/public payloads.
- Phase 3 has its first structural slice implemented for operated products:
  `product_components` stores typed `ref`/`inline` components with selection,
  commitment boundary, price disposition, choices, media, tags, and metadata;
  products service/routes expose CRUD; owned product content projects persisted
  rows into `ProductContent.components`.
- Phase 3 now has the booking contract bridge: component choices can carry
  pricing refs to existing product option/unit identifiers, the booking-engine V1
  contract has `component-choice` configure descriptors and
  `draft.configure.componentSelections`, and the products owned handler can quote
  and commit selected components through existing pricing/item-line paths. The
  operator booking-engine runtime wires persisted `product_components` into that
  descriptor path.
- Phase 3 now has an operator authoring/import slice: products React exposes
  component hooks and the operator product detail page can create/edit
  components, manage choices, maintain component choice option/unit pricing
  refs, and run typed JSON component imports with dry-run plus append/replace
  modes.
- Phase 4 has its first pricing authoring/import slice: pricing exposes a typed
  rate-plan matrix import that dry-runs or upserts `price_schedules`,
  `pricing_categories`, `option_price_rules`, `option_unit_price_rules`, and
  `departure_price_overrides`; pricing React exposes the import mutation; the
  operator option pricing panel can run unit-by-pricing-category grid imports,
  pasted spreadsheet-style matrices, or raw JSON imports against the active
  price catalog. The first commitment-routing invariant is also implemented:
  `independent_component` product choices no longer fold into the core product
  quote or booking item lines, and `travel-composer` exposes a projection helper
  for turning selected independent component refs into catalog-backed trip
  component inputs. The operator catalog booking route now materializes a Trip /
  Package Envelope when a committed product booking contains selected
  independent component refs: the core product booking is recorded as the
  committed component and selected independent refs are appended as catalog-backed
  sibling components for composer pricing/reservation. The catalog book response
  echoes the materialized `tripEnvelopeId` in `upstreamPayload` so UI surfaces
  can hand off to the composer without widening the booking-engine contract; the
  operator booking journey uses that reference to open the materialized trip,
  and the storefront confirmation page preserves a customer-safe package
  reference for the committed booking. For customer card and bank-transfer
  checkout, the storefront now reserves the materialized trip and starts
  envelope-level checkout instead of charging only the core product booking.
  When the aggregate trip payment completes, the operator runtime completes the
  Trip / Package Envelope and fans booking-scoped payment completion events back
  out to the component bookings so the existing checkout-finalize workflow can
  confirm bookings, issue invoices, and trigger contract/document side effects.
  Inquiry/no-payment cleanup is also wired: when the core booking is released
  into inquiry mode, the materialized package trip and active sibling components
  are cancelled so no stale holds remain. Remaining Phase 4 polish is limited to
  broader authoring ergonomics such as bulk import audit records and richer
  per-departure override spreadsheet tooling.

---

## 8. Answered questions and risks

### 8.1. Where does the shared component contract live?

**Decision:** create `@voyantjs/travel-components-contracts`.

Do not put this in `catalog-contracts` by default. `catalog-contracts` owns the
catalog plane: adapter contracts, projections, field policy, provenance,
snapshot, and booking-engine contracts. Travel component content is domain
vocabulary consumed by products, cruises, charters, accommodations, source
adapters, catalog UI, and storefronts.

Do not put it in a single vertical's `*-contracts` package either. The whole
point is that `boardBasis`, `transportComponent`, `accommodationComponent`,
`componentRef`, `commitmentBoundary`, and `priceDisposition` are reusable across
vertical content aggregates.

`@voyantjs/travel-components-contracts` should be pure contract code: Zod
schemas, inferred types, schema-version constants, validators, and enum
vocabularies. Start with a `zod`-only dependency. Avoid depending on
`@voyantjs/catalog-contracts` unless the component ref truly needs an existing
catalog contract type.

The initial exports should be small:

- `./board-basis`
- `./component-ref`
- `./content-shape`

Vertical contract packages then import these schemas into their own `<vertical>/v1`
content shapes. Runtime packages continue to depend runtime -> contracts, in the
ADR-0002 direction.

### 8.2. When is a component `ref` vs `inline`?

**Decision:** choose by identity and lifecycle, not by operated vs sourced
provenance.

Use `ref` when the component has a first-class Voyant identity, is reused across
parents, is queryable/bookable on its own, has independently governed content, or
needs its own commitment lifecycle.

Use `inline` when the component exists only inside the package, has no stable
local identity, is supplier-internal, or is stable display/configuration data
that should snapshot with the parent.

That means sourced packages are not always `inline`. A source may emit a
wholesaler package that references a separately discoverable sourced hotel entry
with a stable source ref. In that case the component can be a `ref`. If the
hotel only exists inside the package payload, it stays `inline`.

Operated packages are not always `ref`. A product-internal coach leg, a board
basis, or a one-off included stay can be inline. A reusable owned excursion,
hotel/resale entry, or independently cancellable activity should be a ref.

Validation rules should follow commitment:

- `internal` may be `inline` or `ref`.
- `dependent_component` may be `inline` or `ref`, but must map to an Extra/add-on
  path if it creates a selectable child line.
- `independent_component` should require either a `ref` or a source-resolvable
  pointer, because it must become its own Component Booking / Order.

Persisted cross-package refs still obey `schema-discipline.md`: plain text
entity fields plus template-level links, never cross-package Drizzle FKs.

### 8.3. How much component detail lives in content?

**Decision:** content carries stable browse/detail/snapshot shape; quote and
checkout resolve volatile fields live.

Content should include stable customer-visible facts: component kind, title,
summary, selection mode, commitment boundary, price disposition, board basis,
planned transport legs, accommodation identity, star/rating/amenity summaries,
room/rate descriptors, media, source refs, and any search/filter facets.

Content should not be the authority for volatile sellability: current price,
remaining availability, live room inventory, expiring fare class, hold token, or
date-sensitive cancellation penalty. Those resolve through the owned booking
handler, `@voyantjs/pricing`, or source-adapter `liveResolve`, then snapshot at
quote/booking.

A `ref` component may carry a denormalized summary so detail pages render without
an extra live lookup. The ref remains the authority for deep drill-in and
booking.

### 8.4. What is the pricing source of truth?

**Decision:** operated package sell price is `@voyantjs/pricing`; sourced package
sell price is source-adapter live resolution.

For operated packages, `@voyantjs/pricing` remains the customer-facing price
source: price catalogs, schedules, pricing categories, option rules, unit rules,
tiers, and `departure_price_overrides`. `product_pax_pricing_tiers` is not the
package canonical model.

Component costs may exist for margin, supplier reconciliation, or operator
audit, but they do not override the published package sell price. If both a
package sell price and a component roll-up exist, the package sell price wins;
the roll-up is internal cost/margin evidence unless a future product explicitly
opts into derived pricing.

For independent components, each component quotes through its own resolver and
the Trip / Package Envelope aggregates the totals. That is a composed trip, not
one all-or-nothing package price.

For sourced packages, cached prices in content/projection are hints only. The
source adapter's `liveResolve` response is authoritative at quote/checkout.

### 8.5. How do we handle per-departure matrix authoring?

**Decision:** add an authoring/import surface over existing pricing tables; do
not add a new runtime price matrix.

The authoring friction is real: operators often author departure x room x
occupancy prices as a matrix. The runtime model should still be:

- `price_schedules` for reusable seasonal/common prices,
- `pricing_categories` for adult/child/occupancy/rate categories,
- `option_price_rules` and `option_unit_price_rules` for baseline unit prices,
- `departure_price_overrides` for per-departure deviations.

The operator UI now has an admin matrix editor/importer for the common baseline
case: option units as rows, pricing categories as columns, pasted CSV/TSV matrix
support, and a raw JSON escape hatch over the same import contract. It writes
the canonical pricing rows coherently instead of introducing a package price
matrix.

Richer per-departure override spreadsheet tooling can still be added on top of
the same contract. It should pick common values as baseline rules and emit
overrides only for departures that deviate.

Migration audit records are acceptable as import tooling, but not as the runtime
booking or storefront source of truth.

### 8.6. How does cancellation work?

**Decision:** cancellation follows `commitmentBoundary`.

`internal` components are part of one package commitment. Customer-facing
cancellation is package-level. Internal component terms may be stored for ops or
supplier reconciliation, but they are not separate customer commitments.

`dependent_component` components are child add-ons/Extras. They may have their
own conditions, but they cancel, fulfill, tax, and support closely enough with
the parent booking to stay nested under it.

`independent_component` components become sibling Component Bookings/Orders under
a Trip / Package Envelope. Each keeps its own cancellation snapshot, supplier
reference, tax treatment, fulfillment state, and operational owner. The envelope
can preview aggregate cancellation impact, but it does not erase the component
boundaries.

For sourced packages, the content layer may display a cancellation summary, but
the live source response and booking snapshot are authoritative.

### 8.7. What is the relationship between OGD and package?

**Decision:** OGD and package are orthogonal.

An **Operated Group Departure** is a fixed operated Product instance/departure
with capacity and operational execution. A **package** is a sellable/composition
facet: transport + accommodation + board + other components sold as one
merchandised SKU.

Many operated packages will be sold as OGDs, but not every OGD is a package and
not every package is operated. A sourced wholesaler package is not an OGD; it is
a sourced Catalog Item carrying a package facet and component content.

Do not add `group_departure` as `productKind`. If the UI needs a "fixed group
departure" filter, derive it from booking mode, slots/departures, capacity mode,
and operated provenance.

### 8.8. How far should vertical convergence go?

**Decision:** converge content contracts first; do not collapse vertical tables
until repeated implementation proves the maintenance win.

The shared contract should let products, cruises, charters, accommodations, and
source adapters describe comparable component content. It should not force those
verticals to abandon their own operational schemas.

Cruise cabins, charter suites, accommodation rooms/rate plans, and package
components have similar customer-facing shape, but their availability, pricing,
operations, and legal terms still differ. Keep those implementations local until
two or more verticals need the same deeper behavior behind the same public
contract.

The first adoption target is products/packages. Cruises, charters, and
accommodations should map into the shared content vocabulary for display/search
after the package path proves stable.

### 8.9. Remaining risks

- `@voyantjs/travel-components-contracts` can become a junk drawer. Keep it to
  pure, cross-vertical travel component payloads and move vertical-specific
  fields back into the vertical contracts.
- `product_components` can become a shallow mirror of the content block. It
  should exist only for operated products whose component structure must be
  authored, validated, priced, or routed in booking.
- Per-departure override authoring may need bulk APIs and import audit records.
  Those are authoring concerns; they should not create a second runtime pricing
  source.

---

## 9. Relationship to adjacent architecture

- **Pricing** (`@voyantjs/pricing`) — the shared, catalog-centric product/package
  pricing engine
  (`schema-catalogs.ts`, `schema-option-rules.ts`, `schema-categories.ts`,
  `schema-departure-overrides.ts`). Operated composite components price through
  it; sourced packages live-resolve through their adapter; no new package pricing
  model is introduced.
- **Catalog plane** (`catalog-architecture.md`, `catalog-sourced-content.md`) —
  the package is a Catalog Item; sourced packages flow through `SourceAdapter`
  (`discover` → projection, `getContent` → content block, `liveResolve` →
  price/availability). The component block lives in the per-vertical content cache
  keyed by `(entity_id, locale, market)`.
- **Travel composer** (`ai-travel-experience-composition.md`,
  `travel-composer-implementation-plan.md`) — the *runtime* counterpart. A
  composite Catalog Item feeds a Trip Envelope as one `catalog_booking` component;
  `commitmentBoundary = independent_component` components become sibling
  Component Bookings. This plan does not introduce **`PackageOffer`**; keep it
  deferred unless package-level cross-vertical terms become non-trivial.
- **Operated Group Departure** — the operated departure/execution layer. A
  package may be sold as an OGD, but OGD is not a package kind. Product-internal
  components stay inside one Component Booking per `:211-213`.
- **Board / meal-basis standardization** — #1469. The shared `boardBasis` enum in
  Phase 1 is the resolution; accommodations currently has only a string
  convention and meal-plan booleans.
- **Schema discipline** (`schema-discipline.md`) — cross-module component `ref`s
  use plain text IDs + the link service, never cross-package `.references()`.

---

## 10. References

- RFC: voyantjs/voyant#1470 — *Composite Products* (this doc supersedes its
  framing; its Option A survives, its literal Option B is reframed).
- Board basis: voyantjs/voyant#1469.
- `UBIQUITOUS_LANGUAGE.md` — Catalog Item (`:31`), Product (`:51`, `:208`),
  Operated Group Departure (`:63`), Trip/Package Envelope (`:64`), Component
  Booking/Order (`:66`), Extra (`:67`), lifecycle rules (`:211-213`), no-import
  rule (`:254`).
- Pricing engine: `packages/pricing/src/schema-catalogs.ts`,
  `schema-option-rules.ts`, `schema-categories.ts`,
  `schema-departure-overrides.ts` (per-departure overrides, commit `dc46e37a8`,
  #472 / fix #467).
- Products: `packages/products/src/schema-core.ts` (products, product_options,
  option_units; `product_pax_pricing_tiers` is the owned-arm Phase C+ table),
  `booking-engine/handler.ts` (Phase A scope), `schema-shared.ts:66`
  (`transport` capability flag).
- Content shapes: `packages/products-contracts/src/content-shape.ts`,
  `packages/cruises-contracts/src/content-shape.ts`,
  `packages/accommodations-contracts/src/content-shape.ts`.
- Proposed shared contract: `@voyantjs/travel-components-contracts` (new pure
  contract package for board basis, travel component refs, component content
  schemas, commitment boundary, and price disposition).
- Catalog contracts: `packages/catalog-contracts/src/adapter/contract.ts`
  (`CatalogProjection`, `SourceAdapter`, `getContent`),
  `booking-engine/contracts.ts` (`configureSubStepV1`).
- Composer: `packages/travel-composer/src/schema.ts`.

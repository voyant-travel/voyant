# AI Travel Experience Composition

Status: draft / planning reference
Audience: anyone designing AI-assisted storefront, itinerary planning, package composition, and checkout flows in Voyant.

This document captures the missing product and architecture layer needed for
Voyant to support **AI Travel Experiences**: an operator's customer can chat
with an AI assistant, shape an itinerary, receive hotels, flights, products,
transfers, extras, and other services, then reserve or buy through a clean
checkout path.

The core conclusion is:

**AI should be a caller, not the domain module.** Voyant needs a deterministic
composition module that turns customer intent into a priced, holdable,
checkout-ready itinerary. AI agents, staff quote builders, storefront wizards,
and partner APIs can all call that same module.

Implementation status: `@voyantjs/travel-composer` does **not** exist yet.
This is the active planning reference for that package. The surrounding
building blocks listed below exist in varying depth; the composer work should
reuse them rather than introduce parallel planning, quoting, holding, checkout,
or AI-tool infrastructure.

## 1. Current foundation

Voyant already has many of the required primitives:

- **Catalog plane** for normalized discovery across operated and sourced
  inventory, with resolved views, provenance, overlays, search, and booking
  snapshots.
- **Catalog booking engine** in `@voyantjs/catalog/booking-engine` for
  per-line `quoteEntity`, `bookEntity`, `cancelEntity`, `catalog_quotes`,
  `booking_drafts`, `BookingDraftShape`, owned-handler dispatch, and
  snapshot capture.
- **Pre-booking holds** through `booking_drafts` plus `availability_holds` for
  owned product slots. The operator template ships a scheduled draft reaper
  that releases expired holds and deletes abandoned drafts.
- **Catalog RAG** in `@voyantjs/catalog-rag` for embedding providers,
  semantic/hybrid search orchestration, model-version helpers, and
  cross-audience federated search.
- **Catalog MCP** in `@voyantjs/catalog-mcp` for AI-safe catalog tools:
  `search_catalog`, `get_entity`, `suggest_alternatives`,
  `check_availability`, and `get_quote`.
- **Flights vertical** in `@voyantjs/flights` for live-API flight contracts,
  multi-connection fan-out, itinerary fingerprinting, booking snapshots, and
  reference-data provider contracts. Public/admin route mounting remains a
  template concern.
- **Ground transport** in `@voyantjs/ground` for operators, vehicles,
  drivers, dispatch, execution, assignments, positions, shifts, and related
  operational records.
- **Booking Sessions** for public booking-session flows and scoped checkout
  capabilities, including storefront bootstrap paths.
- **Checkout** for collection plans, bank-transfer/card initiation, and
  booking-session-backed collection bootstrap.
- **Operator storefront checkout wiring** for `POST
  /v1/public/catalog/checkout/start`, including card, bank transfer, inquiry,
  and hold intents. This is currently template-owned glue, not a reusable
  composer API.
- **Workflows** for durable orchestration, retries, compensation, and the
  booking-engine checkout-finalize flow.
- **Storefront/public contracts** that separate customer-facing routes from
  admin CRUD semantics.
- **React/runtime layers** such as `catalog-react`, `storefront-react`,
  `checkout-react`, and source-installed UI packages that keep public flows
  reusable without owning the final storefront shell.

The missing piece is not more CRUD around those modules. The missing piece is a
first-class **composition layer** between catalog discovery and the commercial
ladder.

## 2. Desired customer journey

A representative storefront flow:

1. Customer opens chat on an operator storefront.
2. Customer says: "Plan a 9-day Egypt trip in October for two adults, boutique
   hotels, private guides, no overnight trains, budget around EUR 7,000."
3. AI asks only the missing questions needed to produce a useful draft.
4. System creates an itinerary draft with day-by-day structure and candidate
   sellable items.
5. Customer revises: "Add one beach day and make the Cairo hotel nicer."
6. System reprices and validates availability.
7. Customer sees a clean itinerary summary with live prices, expiry warnings,
   cancellation/payment terms, and alternatives.
8. Customer clicks **Reserve now** to place time-limited holds or **Buy now** to
   proceed directly to collection.
9. System creates the right Booking / Order / Payment Session records, captures
   catalog snapshots, and starts checkout.

The AI should never invent sellable inventory or mutate bookings directly. It
should call deterministic tools backed by Voyant modules.

## 3. Proposed module

Working name:

`@voyantjs/travel-composer`

Alternative names:

- `@voyantjs/itinerary-composer`
- `@voyantjs/package-offers`
- `@voyantjs/travel-experiences`

Recommendation: use a domain name, not an AI name. The module's job is
composition. AI is one caller.

### 3.1. Responsibility

The composer owns the pre-commitment itinerary composition lifecycle:

- capture customer intent and constraints
- create candidate itinerary drafts
- attach candidate CatalogEntries and live-API offers
- compare alternatives
- price the full draft
- validate live availability
- reserve the selected draft
- start checkout or convert into the existing commercial ladder

It does not own:

- catalog indexing or semantic search
- catalog MCP discovery tools
- single-line booking journey state
- vertical-specific pricing topology
- payment-provider integration
- final storefront brand/UI shell
- provider-specific source adapters
- LLM prompting as a hard dependency

### 3.2. Minimal interface

The composer interface should stay small and deterministic:

```ts
createDraft(intent)
reviseDraft(draftId, instruction)
priceDraft(draftId)
reserveDraft(draftId)
startCheckout(draftId | bookingId)
```

The implementation behind those calls can be deep: catalog search, vertical
quote calls, hold creation, booking-session writes, workflow orchestration,
checkout bootstrap, audit, and compensation.

## 4. Domain concepts

These are planning terms. Add them to `UBIQUITOUS_LANGUAGE.md` once the names
settle.

### Itinerary Draft

A mutable pre-commitment plan produced from customer intent. It can contain
freeform narrative, day-by-day structure, candidate sellable items, unresolved
requirements, rejected alternatives, and AI rationale.

It is not a Booking, Order, or Offer. It has not committed inventory.

### Draft Item

One proposed component of an Itinerary Draft. It may reference:

- a CatalogEntry
- a vertical-specific live offer, such as a flight offer
- a catalog booking-engine `booking_drafts` row and/or `catalog_quotes` row for
  a single bookable line
- a freeform placeholder needing staff action
- an informational/non-sellable activity

Do not overload the booking engine's `booking_drafts` table with the whole
multi-line itinerary. A booking draft is a per-line, resumable booking-journey
primitive. An Itinerary Draft is the multi-line composition envelope that can
point at zero or more booking drafts.

### Priced Draft

A Draft after live pricing and availability validation. Prices may have expiry
timestamps, warnings, unavailable items, or alternatives.

### Reserved Draft

A Draft whose selected items have been held or booked upstream and converted
into Voyant's Booking Session / Booking / Order structures as appropriate.

A Reserved Draft may resolve to one Booking with many items, multiple Bookings
under a booking group, or a future package-level transactional record. The
composer must keep that grouping decision behind its service interface until a
formal `PackageOffer` / composite package vertical exists.

### Experience Session

The customer-facing planning session: conversation transcript summary,
customer constraints, selected draft, current state, and consent/approval
history. This is the AI/storefront wrapper around one or more Itinerary Drafts.

## 5. Relationship to existing architecture

### 5.1. Catalog plane

The composer reads the catalog plane for discovery:

- "find family-friendly Nile cruises"
- "show boutique hotels in Cairo"
- "suggest day tours near Luxor"
- "find alternatives similar to this product"

The catalog plane remains upstream of the commercial ladder. The composer does
not introduce a universal CatalogEntry table or universal pricing engine.

### 5.2. Vertical modules

Each vertical keeps its own truth:

- products resolve product options, units, slots, pricing, and itinerary days
- hospitality resolves room types, rate plans, stay rules, and room-night
  availability
- flights resolve live offers, repricing, booking, and order status through
  adapters
- cruises resolve sailings, cabins, pricing, and itinerary
- charters resolve charter-specific pricing and contracts
- extras attach to a parent booking or product flow

The composer coordinates verticals. It does not flatten them.

### 5.3. Catalog booking engine and booking drafts

The single-line booking journey and catalog booking engine now provide the
leaf primitives the composer should reuse:

- `BookingDraftShape` describes one bookable line's required steps, traveler
  fields, payment intents, accommodation sub-steps, and add-ons.
- `booking_drafts` stores one resumable pre-booking-row draft for that line.
- `catalog_quotes` stores short-lived live pricing for that line.
- `quoteEntity` and `bookEntity` dispatch to the correct owned handler or
  source adapter and capture booking snapshots.

The composer should hold N Draft Items and call those primitives per item. It
should not create a second single-line booking engine, and it should not force
the booking journey to understand a whole custom itinerary.

Current caveat: `booking_drafts.current_quote_id` is one-to-one. The composer
must store quote references per Draft Item, not on the Itinerary Draft root.

### 5.4. Commercial ladder

Voyant's ladder remains:

**Quote -> Offer -> Order -> Booking -> Fulfillment**

The composer sits before and around that ladder:

- Itinerary Draft is pre-commitment.
- Priced Draft is a customer-facing priced proposal, but not necessarily a
  formal Offer record.
- Reserved Draft creates holds and/or Booking Session state.
- Checkout turns the held/reserved commitment into collection.

Open design question: whether a formal `PackageOffer` should be introduced as
the cross-vertical transactional artifact. If package-level cancellation,
terms, pricing, margin, and snapshot semantics become non-trivial, a dedicated
composite package vertical likely earns its keep.

### 5.5. Booking Sessions

Booking Sessions support public customer checkout state after a booking row
exists, protected by a scoped checkout capability. The storefront also exposes
booking-session bootstrap helpers for customer-facing product departures.

They are too late and too item-concrete to be the full AI planning state. The
composer should create or update Booking Sessions only after a Draft has been
priced and the customer asks to reserve/buy, or when handing a single Draft Item
to the existing booking journey.

### 5.6. Checkout

Checkout remains provider-agnostic. The composer should call checkout once it
has a booking-backed or booking-session-backed target and a clear collection
intent, using the existing collection primitives:

- deposit
- full amount
- schedule line
- exact amount
- bank transfer
- card

The relevant code surface is `previewCheckoutCollection`,
`initiateCheckoutCollection`, and `bootstrapCheckoutCollection`; the composer
should not mint arbitrary payment amounts in a public flow.

### 5.7. Workflows

Cross-vertical reserve/buy is a saga. Use workflows for:

- live repricing all selected items
- checking availability
- placing holds/bookings
- capturing snapshots
- releasing holds on partial failure
- aligning expiries
- starting checkout
- sending notifications

Do not put cross-item compensation in a prompt, route handler, or React hook.
The reserve/buy path needs an explicit workflow/service boundary with durable
step recording, because partial upstream holds are normal in multi-vertical
travel composition.

## 6. AI tool surface

The existing MCP catalog tools are necessary but not sufficient.

Already shipped catalog tools:

- `search_catalog`
- `get_entity`
- `suggest_alternatives`
- `check_availability`
- `get_quote`

AI Travel Experiences need composition tools on top of those catalog tools.

Candidate tools:

- `create_experience_session`
- `update_traveler_intent`
- `create_itinerary_draft`
- `revise_itinerary_draft`
- `search_catalog`
- `suggest_alternatives`
- `check_availability`
- `price_itinerary_draft`
- `explain_itinerary_terms`
- `reserve_itinerary_draft`
- `start_checkout`
- `handoff_to_staff`

Tool rule:

**Tools mutate only through deterministic domain services.** The LLM proposes
intent and choices; services validate, price, reserve, and persist.

## 7. Safety and control policy

The system needs a policy layer before any AI-controlled action can reserve or
collect money.

Required controls:

- **Inventory provenance**: every sellable item must resolve to a CatalogEntry,
  source adapter offer, or explicitly marked manual placeholder.
- **Freshness**: live prices and availability must be checked immediately
  before reserve/buy.
- **Expiry disclosure**: customer-facing UI must show quote/hold expiry.
- **Budget guardrails**: price increases beyond a configured tolerance require
  customer confirmation.
- **Terms disclosure**: cancellation, payment, guarantee, baggage/fare, and
  supplier terms must be surfaced before reserve/buy.
- **PII boundaries**: collect traveler PII only when required, store it through
  existing booking/customer-profile paths, and avoid embedding it.
- **Tool audit**: record AI-requested actions, tool inputs, service results,
  and user confirmations.
- **Human handoff**: unsupported, ambiguous, high-value, or policy-blocked
  drafts can become staff tasks instead of failed chats.

The policy should be deterministic and testable. It should not live in prompts.

## 8. Storefront and developer experience

Voyant should not ship a closed turnkey AI storefront. It should ship reusable
pieces that developers can compose into an operator-owned storefront.

Framework-owned:

- public contracts for experience sessions and drafts
- React hooks for composer state
- MCP/tool definitions for composer operations, layered above
  `@voyantjs/catalog-mcp`
- workflow helpers
- default policy implementation
- source-installed UI blocks for chat, itinerary cards, alternative selection,
  price/expiry badges, and checkout handoff

Template/app-owned:

- final brand expression
- page routes and layout
- model provider choice
- prompting/personality
- lead-capture and marketing integrations
- staff escalation workflow details

## 9. Data model sketch

Possible tables, subject to refinement:

```txt
experience_sessions
  id
  actor_type
  customer_user_id
  person_id
  organization_id
  locale
  market
  channel
  status
  intent_summary
  constraints_json
  selected_draft_id
  created_at
  updated_at

itinerary_drafts
  id
  experience_session_id
  status
  title
  start_date
  end_date
  pax
  currency
  total_amount_cents
  pricing_status
  reserved_booking_id
  reserved_booking_group_id
  checkout_session_id
  checkout_collection_id
  created_at
  updated_at

itinerary_draft_days
  id
  draft_id
  day_number
  date
  title
  summary

itinerary_draft_items
  id
  draft_id
  day_id
  item_kind
  vertical
  entity_id
  booking_draft_id
  quote_id
  booking_id
  booking_item_id
  hold_token
  hold_expires_at
  source_offer_id
  source_snapshot_id
  title
  quantity
  status
  price_json
  availability_json
  terms_json
  metadata

experience_tool_events
  id
  experience_session_id
  draft_id
  tool_name
  requested_by
  input_json
  result_json
  created_at
```

Do not commit to this schema prematurely. The important decision is the seam:
multi-line planning state is separate from per-line `booking_drafts` and from
Booking Session state until the customer asks to reserve or buy.

Avoid making the root draft depend on exactly one Booking. Multi-line
composition may need one Booking with many items, several Bookings under a
group, or a later `PackageOffer`/package vertical. The schema should preserve
line-level commit references and an optional aggregate reference.

## 10. Reserve / buy workflow

High-level reserve flow:

1. Load selected Itinerary Draft.
2. Validate required customer and traveler information.
3. For every selected Draft Item, create/update a per-line booking draft where
   the catalog booking journey applies.
4. Reprice every selected item through `quoteEntity`, the relevant
   vertical/source adapter, or flight repricing.
5. Check availability for every selected item.
6. Apply policy gates: budget, terms, expiry, PII, unsupported items.
7. Place holds/bookings in dependency order.
8. On partial failure, release successful holds and return alternatives.
9. Create or update Booking Session / Booking / Order structures.
10. Capture catalog snapshots for committed items.
11. Return checkout-ready target and hold expiry summary.

High-level buy flow:

1. Run reserve flow or reuse an unexpired Reserved Draft.
2. Compute collection plan.
3. Start checkout collection bootstrap/initiation against the booking or
   booking session.
4. Return provider redirect / payment session / bank transfer instructions.
5. Continue fulfillment through existing booking, finance, legal, and
   notification workflows.

## 11. Open questions

1. **Module name.** `travel-composer` is descriptive, but `package-offers` may
   fit better if the primary output becomes a formal `PackageOffer`.
2. **PackageOffer vs Itinerary Draft only.** If cross-vertical pricing,
   cancellation, and terms need a durable transactable proposal, introduce
   `PackageOffer`. If not, keep Draft + Booking Session.
3. **Where to store conversation state.** The composer should store structured
   summaries and decisions, not raw prompt dependence. Raw transcript retention
   may be app-owned or configurable.
4. **Staff handoff shape.** Could use CRM Opportunity, Quote, Activity, or a
   dedicated support task depending on operator workflow.
5. **Public vs admin AI tools.** Customer agents need strict customer-audience
   access. Staff agents may federate across audience pools and see operational
   fields.
6. **Flights in public surface.** The `@voyantjs/flights` package now provides
   contracts, fan-out, snapshots, and reference-data providers, but AI
   storefront use still needs public-safe route mounting for search, price,
   reserve, and order-status surfaces.
7. **Manual placeholders.** Real operators often need "we will confirm this
   hotel manually." The composer should support placeholders without pretending
   they are live inventory.
8. **Ground transport boundary.** `@voyantjs/ground` is an operational module.
   The composer still needs a sellable transfer/search surface before it can
   treat ground services like normal Draft Items.
9. **Hold-release primitive for sourced drafts.** The draft reaper can release
   owned holds through owned handlers. Sourced adapters currently expose
   `cancel`, not a hold-only release primitive, so sourced soft-hold cleanup
   needs a SourceAdapter contract addition before broad multi-source reserve
   flows are safe.
10. **Aggregate commit shape.** Decide whether MVP reserve produces one Booking
    with many Booking Items, several Bookings in a booking group, or a narrower
    package-level artifact. The composer interface can hide this, but checkout,
    documents, cancellation, and support UI need a consistent target.
11. **Template-owned checkout extraction.** `POST
    /v1/public/catalog/checkout/start` exists in the operator template. The
    composer should not depend on template-local code long term; extract the
    reusable parts into framework-owned services before shipping a generic
    composer package.

## 12. MVP slices

### Slice 0: settle reusable boundaries

- Confirm the MVP aggregate commit shape: one Booking, booking group, or a
  minimal package artifact.
- Extract reusable checkout-start behavior from the operator template if the
  composer needs to call it outside that template.
- Add or design a SourceAdapter hold-release primitive for sourced soft holds.
- Decide whether flight public routes are in scope for the first composer
  demo, or explicitly exclude flights from the first vertical set.
- Decide whether ground services enter as manual placeholders, product-linked
  transfers, or a new sellable transfer surface.

### Slice 1: make AI access complete for discovery

- Use the existing catalog MCP tools (`search_catalog`, `get_entity`,
  `suggest_alternatives`, `check_availability`, `get_quote`) as the discovery
  base.
- Add customer-safe public MCP or tool-call routes for storefront agents where
  templates need hosted agent access.
- Fill adapter-backed availability/quote coverage for adopted verticals rather
  than leaving tools wired only to products/extras.
- Ensure semantic search downgrades cleanly when embeddings are not configured.

### Slice 2: introduce Itinerary Drafts

- Add `@voyantjs/travel-composer` with Draft, Draft Day, and Draft Item
  contracts.
- Support create/revise/read draft operations.
- Store structured intent and constraints.
- Keep all mutation deterministic and service-validated.
- Keep Itinerary Draft state separate from catalog booking-engine
  `booking_drafts`; store per-line references instead of merging the concepts.

### Slice 3: price a draft

- Add `priceDraft`.
- Resolve live prices and availability per vertical, using `quoteEntity` where
  available and the flight adapter repricing path for flights.
- Return warnings, expiries, unavailable items, and alternatives.
- Add tests for stale price, unavailable item, and partial quote failure.

### Slice 4: reserve a draft

- Add workflow-backed `reserveDraft`.
- Create Booking Session / Booking records only at this point.
- Implement compensation for partial hold failure.
- Capture snapshots and preserve source provenance.
- Cover owned-hold release, sourced-hold release, quote expiry, and one-line
  success / one-line failure in tests.

### Slice 5: checkout handoff

- Add `startCheckout`.
- Support deposit/full/exact-amount collection through existing checkout
  collection primitives.
- Provide UI-ready output for "Reserve now" and "Buy now".

### Slice 6: ship a reference storefront block

- Chat panel
- Itinerary timeline/cards
- Alternative selector
- Live price and expiry badges
- Reserve/buy CTA
- Staff handoff state

## 13. Success criteria

The architecture is working when a developer can build this without inventing
app-local glue:

```txt
Customer intent
  -> AI tool calls
  -> Itinerary Draft
  -> priced Draft
  -> Reserved Draft / Booking Session
  -> checkout bootstrap
  -> Booking / Order / Payment Session
```

The same composer should also support non-AI callers. If a staff quote builder
or conventional storefront wizard can use the same module, the seam is in the
right place.

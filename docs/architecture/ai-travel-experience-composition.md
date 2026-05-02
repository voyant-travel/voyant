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

## 1. Current foundation

Voyant already has many of the required primitives:

- **Catalog plane** for normalized discovery across operated and sourced
  inventory, with resolved views, provenance, overlays, search, and booking
  snapshots.
- **Catalog RAG and MCP scaffolding** for AI-safe access to search, resolved
  entities, alternatives, live availability, and live quote paths.
- **Flights vertical** shape for live-API flight search, repricing, booking,
  order lookup, and cancellation.
- **Booking Sessions** for public hold/reserve flows.
- **Checkout** for collection plans and payment-session/bootstrap flows.
- **Workflows** for durable orchestration, retries, and compensation.
- **Storefront/public contracts** that separate customer-facing routes from
  admin CRUD semantics.

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
- a freeform placeholder needing staff action
- an informational/non-sellable activity

### Priced Draft

A Draft after live pricing and availability validation. Prices may have expiry
timestamps, warnings, unavailable items, or alternatives.

### Reserved Draft

A Draft whose selected items have been held or booked upstream and converted
into Voyant's Booking Session / Booking / Order structures as appropriate.

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

### 5.3. Commercial ladder

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

### 5.4. Booking Sessions

Booking Sessions already support public hold/reserve flows, but they are too
late and too item-concrete to be the full AI planning state. The composer should
create or update Booking Sessions only after a Draft has been priced and the
customer asks to reserve/buy.

### 5.5. Checkout

Checkout remains provider-agnostic. The composer should call checkout once it
has a booking-backed or session-backed target and a clear collection intent:

- deposit
- full amount
- schedule line
- exact amount
- bank transfer
- card

### 5.6. Workflows

Cross-vertical reserve/buy is a saga. Use workflows for:

- live repricing all selected items
- checking availability
- placing holds/bookings
- capturing snapshots
- releasing holds on partial failure
- aligning expiries
- starting checkout
- sending notifications

## 6. AI tool surface

The existing MCP catalog tools are necessary but not sufficient. AI Travel
Experiences need composition tools on top.

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
- MCP/tool definitions
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
  checkout_session_id
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
planning state is separate from Booking Session state until the customer asks
to reserve or buy.

## 10. Reserve / buy workflow

High-level reserve flow:

1. Load selected Itinerary Draft.
2. Validate required customer and traveler information.
3. Reprice every selected item through its vertical or source adapter.
4. Check availability for every selected item.
5. Apply policy gates: budget, terms, expiry, PII, unsupported items.
6. Place holds/bookings in dependency order.
7. On partial failure, release successful holds and return alternatives.
8. Create or update Booking Session / Booking / Order structures.
9. Capture catalog snapshots for committed items.
10. Return checkout-ready target and hold expiry summary.

High-level buy flow:

1. Run reserve flow or reuse an unexpired Reserved Draft.
2. Compute collection plan.
3. Start checkout bootstrap.
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
6. **Flights in public surface.** The current flight routes are admin-oriented
   in the operator template. AI storefront use needs public-safe search, price,
   reserve, and order-status surfaces.
7. **Manual placeholders.** Real operators often need "we will confirm this
   hotel manually." The composer should support placeholders without pretending
   they are live inventory.

## 12. MVP slices

### Slice 1: make AI access complete for discovery

- Wire catalog MCP `resolveEntity`, `checkAvailability`, and `getQuote` for all
  adopted verticals, not only products/extras.
- Add customer-safe public MCP or tool-call routes for storefront agents.
- Ensure semantic search downgrades cleanly when embeddings are not configured.

### Slice 2: introduce Itinerary Drafts

- Add `@voyantjs/travel-composer` with Draft, Draft Day, and Draft Item
  contracts.
- Support create/revise/read draft operations.
- Store structured intent and constraints.
- Keep all mutation deterministic and service-validated.

### Slice 3: price a draft

- Add `priceDraft`.
- Resolve live prices and availability per vertical.
- Return warnings, expiries, unavailable items, and alternatives.
- Add tests for stale price, unavailable item, and partial quote failure.

### Slice 4: reserve a draft

- Add workflow-backed `reserveDraft`.
- Create Booking Session / Booking records only at this point.
- Implement compensation for partial hold failure.
- Capture snapshots and preserve source provenance.

### Slice 5: checkout handoff

- Add `startCheckout`.
- Support deposit/full/exact-amount collection through existing checkout.
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


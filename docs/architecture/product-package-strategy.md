# Product Package Strategy

Status: draft. ADR-0005 and the frontend package model are settled, but target
package moves remain proposed until the package-closure, Interface-proof,
schema-move, and migration issues listed in §8.1 are completed.
Audience: contributors changing package/module shape, starter templates,
domain vocabulary, or first-party product positioning.

Related:

- [Voyant module, provider, extension, and plugin taxonomy](./module-provider-plugin-taxonomy.md)
- [Catalog architecture](./catalog-architecture.md)
- [Storefront and public contract architecture](./storefront-architecture.md)
- [Schema discipline](./schema-discipline.md)
- [Accommodation resale boundary](./accommodation-resale-boundary.md)
- [Frontend package strategy](../frontend-package-strategy.md)
- [ADR-0002: Pure framework contracts ship as standalone packages](../adr/0002-contract-packages.md)
- [ADR-0004: Quotes are the travel-native sales artifact](../adr/0004-quotes-as-travel-native-sales-artifact.md)
- [ADR-0005: Retire transactions runtime before v1](../adr/0005-retire-transactions-runtime.md)

## 1. Thesis

Voyant should be organized around travel-business modes and product audiences,
not around every internal slice becoming a separately installed package.

The current package graph has too many shallow install seams. The operator
template mounts most domain packages together, and core runtime flows already
cross many packages:

- `storefront` needs catalog, products, availability, pricing, sellability,
  bookings, finance, and customer-facing contracts.
- `sellability` needs products, availability, pricing, markets, distribution,
  and transactions.
- `products-react`, `bookings-react`, and `finance-react` import broad stacks of
  other React packages because real staff workflows do not stop at package
  names.

That is a signal that separate installability is often fictional. Packages that
are normally installed, tested, and reasoned about together should become deeper
Modules with smaller Interfaces and more local Implementation.

This does not mean collapsing Voyant into one package. It means moving from many
thin Modules to fewer, deeper Modules whose seams match real product choices.

## 2. Implementation Modes

Voyant should describe first-party deployments as modes over one shared travel
commerce core.

### Retail OTA / Reseller

An OTA or reseller sells sourced inventory through catalog discovery, live quote,
booking, checkout, finance records, and support workflows.

Typical emphasis:

- sourced inventory and supplier/source adapters
- public storefront and booking sessions
- live price and availability checks
- finance records and customer documents
- support and authenticated storefront account area

Usually optional:

- owned logistics
- ground dispatch
- guide/vehicle/resource assignment
- long-lived room or space blocks

### Tour Operator

A tour operator uses the same commercial core, plus owned products, departures,
local availability, allocations, fulfillment, and operational execution.

Typical emphasis:

- owned products and operated group departures
- availability and allocation
- extras and product-internal add-ons
- bookings, traveler records, rooming lists
- documents, vouchers, checkout, finance
- supplier costs and profitability

### B2B DMC

A DMC may sell mostly to other tour operators or travel agents. The customer is
often a business buyer, not the end traveler. The workflow is quote-first and
logistics-heavy.

Typical emphasis:

- B2B accounts and negotiated commercial terms
- custom Quote and Quote Version workflows
- itinerary composition and manual placeholders
- supplier costing and margin control
- local operations: guides, vehicles, transfers, meeting points, allocations
- staged invoices, payment terms, vouchers, and operational documents

This is not a separate architecture family from tour operators. It is the same
core with a B2B quotes surface and deeper operations.

### MICE / Corporate Travel

MICE and corporate travel are group/business modes over the same core.

Typical emphasis:

- RFP and bid comparison
- group Programs
- venues, function spaces, room blocks, delegate or attendee rosters
- approvals, budgets, purchase orders, payment terms
- supplier costing and program profitability
- operational run sheets and logistics

MICE should not force a parallel platform. It should be implemented as an
optional `mice` Module with Program as its central entity, reusing Quotes,
Bookings, Operations, Finance, Distribution, Relationships, and Legal through
explicit Interfaces. `corporate` is a bundle/persona label for corporate buyers
and corporate-travel implementations; it is not the Module name.

## 3. Product Audiences

Implementation modes are not the same as audiences. These product audiences are
not raw auth values. Voyant's canonical Actor type vocabulary remains `staff`,
`customer`, `partner`, and `supplier`; product audiences map onto Actor type plus
domain role and relationship context.

| Product audience | Canonical Actor type | Domain role / record | Notes |
| --- | --- | --- | --- |
| Staff | `staff` | Operator User, often linked to a Person | Sales, operations, finance, support, and admin users. |
| Retail customer / traveler | `customer` | Person, Traveler, Participant | A customer buying or managing their own trip. The Traveler may differ from the booker. |
| B2B buyer | `customer` | Organization buyer with Person Participants | Direct B2B commerce with an agency, tour operator, corporate buyer, event organizer, or client organization. |
| Channel / reseller | `partner` | Channel, usually backed by an Organization | Distribution counterparty selling the Operator's inventory onward. |
| Supplier | `supplier` | Supplier and supplier-side Users / contacts | Vendor or operating party delivering inventory or services to the Operator. |
| Delegate / attendee | Usually no standalone Actor type; `customer` only for self-service access | Person, Traveler, Participant, delegate role on a Program | A MICE participant, often distinct from the business buyer and payer. |
| External finance user | Contextual: `customer`, `partner`, or `supplier` | Participant, payer, document recipient, finance contact | Should be workflow-scoped access, not a new auth audience by default. |

The B2B buyer and the Channel are deliberately distinct. A DMC selling to another
tour operator is B2B commerce. It becomes distribution only when the counterparty
is selling the Operator's inventory onward as a Channel.

Do not persist `b2b_buyer`, `delegate`, or `external_finance_user` as new Actor
types without a separate auth/access decision.

External delegate and finance access is a security-sensitive workflow, not just
a package-choice question. Any storefront delegate portal, external finance
document access, supplier self-service, or channel self-service surface must be
gated by the auth/access-control and audit-log work for workflow-scoped access;
this strategy only says those flows should not create new raw Actor types.

## 4. Target Module Map

The target architecture should use fewer, deeper Modules. Domain Modules should
own a real capability with durable records, behavior, routes, and tests.
Surface/runtime Modules such as `admin` and `storefront` own shell integration
and extension Interfaces, not domain records.

| Target Module | Owns | Does not own |
| --- | --- | --- |
| `catalog` | Catalog Item projection/search plane, provenance, overlays, content cache, source freshness, booking snapshot capture, search/indexer contracts | owned product authoring, vertical operational truth, quote-time price formation, checkout, finance documents |
| `inventory` | optional operated-inventory authoring: Product structure, Product Versions, product-internal components, owned inventory publication lifecycle, and future operated-inventory subdomains | sourced catalog projection/search, generic catalog overlays, OTA/reseller default installs, checkout, finance documents |
| `commerce` | commercial decision orchestration for Catalog Items: markets, pricing rules, quote-time FX, promotions, sellability decisions, buyer/channel/audience rules, and commercial snapshots | vertical-native live fare/offer engines, invoices, payments, operated availability/resource truth, catalog indexing |
| `relationships` | Person, Organization, relationship/account records, customer profile context, segments, signals, support activities, quote-linked activity references | auth/session identity, Quote / Quote Version records and state transitions, bookings, finance ledger state |
| `quotes` | Quote, Quote Version, proposal lifecycle, B2B quote pipeline, send/view/accept decisions, accept-to-reserve handoff | Person/Organization master records, Trip Envelope editing internals, legacy transactions Offer/Order records, final financial documents, operational fulfillment |
| `trip-composer` | Trip Envelope draft workspace, component ordering, manual placeholders, catalog-backed component references, traveler party, pricing snapshots, reservation plans, and checkout handoff handles | catalog projection/search, Quote / Quote Version records and send/view/accept state, legacy transactions Offer/Order records, final bookings/payments, active reservation orchestration |
| `bookings` | booking sessions, reservation orchestration, booking requirements, travelers, booking items, allocations as commitment records, fulfillment/redemption, customer-safe booking state | slot/resource truth, price-rule authoring |
| `operations` | operated execution: availability, resources, allocation resources, places, ground logistics, guides, vehicles, Room Resource Holds, and Space Resource Holds | sourced catalog discovery, invoices/payments, Quote / Quote Version records and state transitions |
| `mice` | MICE Program lifecycle, program requirements, agenda/sessions, delegate/attendee roster, rooming manifest, RFP/bid workflow, Program Room Blocks, Program Space Blocks, program-level status, and links to bookings, quotes, contracts, and invoices | low-level availability/resource/space truth, Room Resource Hold / Space Resource Hold execution, Quote / Quote Version lifecycle, booking commitment records, invoices/payments/ledger state, supplier/channel identity |
| `finance` | checkout collection orchestration, payment sessions, payment schedules, invoices, credit notes, tax persistence, supplier invoices, vouchers, settlement, profitability | quote-time price-rule selection, catalog content |
| `distribution` | supplier-side and channel-side commercial network: suppliers, channels, source/operator links, external refs, mappings, allotments, channel push, webhooks, reconciliation, and supplier/channel identity links | internal price formation and finance ledger state |
| `legal` | contracts, terms, signatures, templates, legal documents | quote composition, payments |
| `admin` | packaged staff shell and extension surfaces | domain records |
| `storefront` | public and authenticated customer-facing runtime contracts, booking/checkout/account surfaces, and shell integration | admin CRUD, internal service records, domain records |

Target names in this map are the proposed v1 strategy. A later ADR may change
spelling or reject a recommendation, especially where this document explicitly
calls out unresolved Interface proof.

### 4.1 Install Posture

This document uses a stricter test than "does more than one product mode use
it?" A Module stays independently installable when a real deployment mode can
run without it and the Module still has durable behavior behind its Interface.
A package seam is fictional when most deployments install it with its neighbors
and deleting it only moves the same decisions into every caller.

| Posture | Modules | Rule |
| --- | --- | --- |
| Retail commerce spine | `catalog`, `commerce`, `bookings`, `finance`, `distribution`, plus `storefront` / `admin` surfaces where the product assembly needs them | This is a target posture, not the current package closure. A reseller/OTA can omit operated Inventory only after the retail-spine closure gate in §8 passes. |
| Mode-gated domain Modules | `inventory`, `operations`, `relationships`, `quotes`, `trip-composer`, `legal`, `mice` | Installed only when the implementation mode needs their durable behavior: owned authoring, local execution, account/support depth, bespoke quote pursuit, composition workspace, contracts/signatures, or group-business Programs. |
| Vertical/source Modules | `cruises`, `charters`, `flights`, accommodation resale, source adapters, provider plugins | Kept separate when pricing topology, booking semantics, source contracts, or operational behavior differ enough to justify their own Interface. |
| Infrastructure Modules | `core`, `db`, `hono`, `auth`, `identity`, `workflows`, `storage`, `notifications`, `action-ledger`, shared React/UI/type/build packages | Installed as required by runtime wiring, not by travel-domain mode. |

### 4.2 Interface Depth Requirements

Consolidation is only worthwhile if the target Module exposes a narrower
Interface than the package cluster it replaces. Subpaths such as
`@voyantjs/commerce/pricing` or `@voyantjs/operations/resources` are internal
organization by default. They should become public v1 Interfaces only when they
are deliberate extension seams with at least two real adapters or consumers.

Keystone Interface sketches before broad moves:

| Module | Proposed narrow Interface | Must hide |
| --- | --- | --- |
| `commerce` | `evaluateCommercialDecision(input): CommercialDecision` for "can this buyer/channel buy this Catalog Item or vertical item, for this date, pax, market, channel, and currency, and at what price?" | direct Pricing + Markets + Sellability + Promotions choreography, direct Product/Inventory dependency for sourced/vertical items, and vertical-native fare/offer internals |
| `operations` | `checkOperationalAvailability`, `createResourceHold`, `confirmResourceHold`, and `releaseResourceHold` over resources, places, vehicles, guides, Room Resource Holds, and Space Resource Holds | separate availability/resources/ground/facilities choreography |
| `distribution` | `resolveCounterparty`, `linkExternalReference`, `routeCounterpartyEvent`, and `reconcileCounterpartyActivity` across Supplier and Channel roles | separate supplier/channel/external-ref plumbing and adapter reference mapping |

If implementation preserves the old subpackage choreography as public v1 API,
the move has failed the depth test and should remain a package rename rather
than an accepted architecture decision.

Quote lifecycle ownership is singular: `quotes` owns Quote and Quote Version
records, pipeline/stage movement, send/view/accept decisions, accepted-version
state, and accept-to-reserve handoff. Other Modules may reference quote ids,
display quote-linked activity, freeze/read composer snapshots, or react to quote
events, but they should not mutate quote lifecycle state except through the
Quotes Interface.

Distribution ownership is consolidated, but Supplier and Channel vocabulary stay
distinct. A Supplier is a delivery, procurement, or source-side counterparty. A
Channel is a resale or outbound distribution counterparty. They share enough
external identity, reference mapping, adapter, webhook, allotment, and
reconciliation machinery to belong behind one Distribution Interface, but they
should not collapse into one role or table shape. In this strategy,
Distribution means the broader supplier-side and channel-side commercial network,
not only outbound resale distribution.

MICE ownership is optional and program-centric. The `mice` Module owns the
Program as the umbrella group engagement and the records that are only coherent
at Program scope: requirements, RFPs, bids, agenda sessions, delegates, rooming
manifests, and program status. It coordinates with other Modules instead of
absorbing them: Quotes owns proposal lifecycle, Operations owns resource and
block execution truth, Bookings owns commitments, Finance owns documents and
ledger state, Distribution owns suppliers/channels/external refs, Relationships
owns Person/Organization records, and Legal owns contracts.

## 5. Concrete Consolidation Candidates

### 5.1 Commerce

Candidate packages:

- `@voyantjs/pricing`
- `@voyantjs/pricing-react`
- `@voyantjs/markets`
- `@voyantjs/markets-react`
- `@voyantjs/sellability`
- `@voyantjs/sellability-react`
- `@voyantjs/promotions`
- `@voyantjs/promotions-react`

Problem:

Pricing, markets, and sellability are one quote-time commercial workflow split
across multiple install seams. `sellability` already imports pricing, markets,
availability, products, distribution, and transactions to answer one question:
can this buyer buy this product for this date, pax, market, channel, and
currency?

Solution:

Create `@voyantjs/commerce` and `@voyantjs/commerce-react` with internal source
folders such as:

- `src/pricing`
- `src/markets`
- `src/sellability`
- `src/promotions`
- `src/fx`

The public Commerce Interface should be narrower than those subpaths. The
primary Interface is the commercial decision: given buyer/channel/audience
context, Catalog Item or vertical item reference, date/time, party, market, and
currency, answer whether the item is buyable and return the resolved commercial
snapshot. Commerce orchestrates market, pricing-rule, sellability, promotion,
FX, and policy decisions; it does not become a universal fare engine for every
vertical/source adapter. Flights, cruises, charters, and sourced adapters can
keep native live-offer or fare topology behind price-availability adapters that
Commerce calls.

Finance consumes the selected commercial snapshot later; it does not own
price-rule selection.

Interface semantics:

- `evaluateCommercialDecision(input)` should be side-effect-free by default: it
  evaluates buyability, price, market, FX, promotion, and policy facts and
  returns a `CommercialDecision`.
- Persisted audit evidence should use an explicit call such as
  `recordCommercialSnapshot(decision, target)` or a caller-owned write path.
- The returned decision must include traceability: buyable/unbuyable reason,
  rule ids, market, promotion ids, adapter calls, source handles, validity, and
  the calculation inputs needed to explain the result.
- Adapter output is part of the decision trace, not Commerce-internal schema.
  Catalog/vertical/source adapters can return live quote or offer handles, but
  Commerce should not import their native fare tables directly.
- Idempotency belongs at the decision/snapshot seam: callers should be able to
  supply an idempotency key or target ref so replaying a decision does not mint
  conflicting commercial evidence.
- Optional Modules, including operated Inventory, register price-availability
  adapters with Commerce at boot. Commerce should treat Inventory the same way
  it treats a sourced vertical adapter, not as a hard schema dependency.

Prerequisite cleanup:

- Stop constructing `transactions` Offers from sellability.
- Feed catalog price/availability responses, Quote Versions, booking drafts, or
  trip-composer price snapshots instead.
- Decouple offer-oriented sellability state before moving the package seam.
- Make `sellability_policies` real by evaluating them, or remove/defer them.
- Keep snapshots only if they provide audit evidence for what was buyable and
  priced at decision time.
- Blocker for OTA/reseller optionality: current `pricing`, `sellability`, and
  `promotions` packages depend directly on `@voyantjs/products`. Before Commerce
  can support an install without Inventory, Commerce must depend on Catalog Item
  references, vertical price-availability adapters, and optional Inventory
  adapters instead of directly requiring Product/Inventory schemas.
- Do not expose `pricing`, `markets`, `sellability`, `promotions`, and `fx`
  as package exports for the normal public choreography. Public subpaths are
  allowed only for deliberate extension Interfaces.
- Invert the current `promotions` -> `storefront` edge before Commerce lands.
  Storefront should consume Commerce display contracts/events; Commerce should
  not import Storefront or the merged Module creates a `commerce` <-> `storefront`
  cycle.

### 5.2 Operations

Candidate packages:

- `@voyantjs/availability`
- `@voyantjs/availability-react`, including `@voyantjs/availability-react/allocation`
- `@voyantjs/allocation-ui` as a temporary compatibility facade
- `@voyantjs/resources`
- `@voyantjs/resources-react`
- `@voyantjs/ground`
- `@voyantjs/ground-react`
- `@voyantjs/facilities`
- `@voyantjs/facilities-react`
- future room-block / space-block execution slices

MICE Program coordination belongs to the optional `mice` Module. Operations
owns the resource, availability, and block execution truth that Programs
coordinate.

Problem:

Tour operators, DMCs, and MICE teams use operated execution as one
workflow: capacity, places, resources, vehicles, guides, dispatch, room blocks,
space blocks, and allocation. Separate packages make internal nouns look like
product-level installation choices.

Solution:

Create `@voyantjs/operations` and `@voyantjs/operations-react` with subpaths for
availability, allocation resources, resources, places, and ground.

Required cleanup:

- Reframe `facilities` as shared places/locations, not property operations.
- Keep hotel/property operations out of first-party scope.
- Expose Room Resource Hold and Space Resource Hold execution through Operations
  Interfaces so MICE can coordinate Program-level blocks without owning
  low-level availability or resource truth.
- Keep availability truth separate from booking commitment records.

### 5.3 Relationships And Quotes

Candidate packages:

- `@voyantjs/crm`
- `@voyantjs/crm-react`

Adjacent packages to integrate through an explicit Interface, not fold blindly:

- `@voyantjs/travel-composer`
- `@voyantjs/travel-composer-react`

Adjacent legacy packages to decouple and retire through a dedicated ADR:

- `@voyantjs/transactions`
- `@voyantjs/transactions-react`

Problem:

`crm` currently contains multiple concerns:

- relationship/account records: Person, Organization, relationships, segments,
  profile context, customer signals, and activities
- quote pursuit records: Pipeline, Stage, Quote, Quote Version
- admin/runtime surfaces for both

Those are domain concerns, not core platform concerns. `core` currently owns
structural primitives such as Module, Extension, Plugin, Link, EventBus,
container, Actor type, query, hooks, and workflow descriptors. Merging CRM into
`core` would force every Voyant installation to carry CRM schemas, routes,
identity dependencies, action-ledger dependencies, and relationship/quote vocabulary. It
would also create pressure to pull `db`, `hono`, and `identity` into the package
that everything else depends on.

ADR-0004 also decided that Quote is the travel-native sales artifact, while the
repo still contains overlapping Opportunity, CRM Quote, transactions Offer, and
Trip Envelope concepts.

Solution:

Do not merge CRM into `core`. Keep `core` as the platform kernel.

Instead, split or deepen the current CRM package along two target domain seams:

- a Relationships Module for Person, Organization, relationship/account
  records, profile context, segments, signals, and activities
- a Quotes Module for Quote as the tracked sales pursuit, Quote Version as the
  immutable proposal revision or alternative, references to frozen Trip Envelope
  snapshots, accept-to-reserve handoff, B2B buyer context, and RFP-style work
  where needed

Quotes should own the pursuit and proposal lifecycle. It should not own
Person/Organization master records, the whole composer workspace, or
`transactions` Offer.

Target a real split, not a permanent combined CRM Module. Because Voyant is
still beta, this can be a breaking v1 package move: introduce Relationships and
Quotes, move internal consumers, update templates, and remove `@voyantjs/crm`
and `@voyantjs/crm-react` before v1. Temporary facades are acceptable inside the
migration branch only when they keep intermediate commits verifiable; they
should not ship as public v1 API.

Prerequisite cleanup:

- Continue retiring Opportunity vocabulary.
- Target `relationships` for the non-quote CRM Module name; treat `crm` only as
  the current package name that will be removed or renamed before v1.
- Split Relationships first, then Quotes inside the v1 migration branch. Quotes
  currently reference Person and Organization records; moving schema ownership
  must either preserve those tables in the same package until the split lands or
  convert cross-domain references to schema-discipline-compliant links/plain ids.
- Move React consumers in slices: person/organization pickers and profile UI to
  Relationships React, Quote boards and proposal UI to Quotes React, then remove
  `crm-react`.
- Treat `transactions` Offer as adjacent legacy, not a Quotes
  consolidation candidate.
- Decouple Quotes from `transactions` Offer first, then retire the runtime
  `transactions` packages per ADR-0005.
- Do not introduce another generic Offer concept.

### 5.4 Transactions Retirement

Candidate packages:

- `@voyantjs/transactions`
- `@voyantjs/transactions-react`
- `@voyantjs/transactions-contracts`

Problem:

`transactions` was built as a generic commercial ladder between sellability and
bookings: Offer, Order, travelers/participants, items, contact assignments,
staff assignments, order terms, PII audit, and a booking extension linking
Bookings back to offer/order ids.

ADR-0004 changed the most important part of that ladder: bespoke travel
proposals are now Quote and Quote Version, not Transactions Offer. At the same
time, the catalog booking engine already proves that a generic orders table is
not required for cross-vertical booking flows: it writes short-lived adapter
quote records currently named `catalog_quotes`, reserves through adapters or
owned handlers, captures `booking_catalog_snapshot`, and exposes its read-side
"orders" from snapshots.

The deletion test says `transactions` is no longer deep enough as a Module. If
deleted, its useful behavior reappears in existing deeper Modules:

- proposal lifecycle belongs in Quotes and Quote Versions
- quote-time commercial snapshots belong in Commerce and Trip Composer
- promotional offers belong in Commerce/Promotions
- booking commitments, travelers, items, allocations, fulfillment, and
  booking-origin/provenance belong in Bookings
- invoices, payment sessions, schedules, guarantees, settlement, and
  profitability belong in Finance
- legal terms, policy acceptance, contracts, and signatures belong in Legal
- Person/Organization/contact truth belongs in Relationships
- provider/source order ids belong in vertical adapters, Catalog snapshots, or
  Distribution external refs

Keeping a renamed `orders` or `commitments` Module would mostly preserve the
same shallow pass-through seam under a less confusing name. It would also force
Bookings, Finance, Legal, Quotes, Trip Composer, and source adapters to keep
coordinating through a generic record even when their local records already
carry the durable truth.

Solution:

ADR-0005 retires the `transactions` runtime packages before v1. Do not rename
`transactions` to `orders` or `commitments` as a target Module.

ADR-0005 answers the hard replacement question: the generic commercial
commitment role currently played by Transactions Order is replaced by Booking
origin/provenance for durable commitment context, Finance and Legal generic
target links for documents/terms/collection, Trip Component committed refs for
composed-line handles, and vertical/source provider order refs captured in
Catalog or vertical snapshots.

Move the current responsibilities as follows:

- Transactions Offer creation from sellability moves to Commerce outputs:
  catalog price/availability responses, sellability snapshots, Quote Versions,
  booking drafts, or Trip Composer price snapshots.
- Bespoke proposal state moves to Quotes and Quote Versions.
- Trip composition and reservation planning stays in Trip Composer; active
  reservation orchestration belongs in Bookings so direct B2C storefront and
  accepted Quote Version flows use the same reservation path.
- Order-like commitment references become either Booking-owned origin/provenance
  records, Trip Component commitment refs, or vertical/source-specific order ids
  captured in Catalog snapshots.
- `booking_transaction_details` is replaced by a Bookings-owned origin table or
  fields that can reference Quote Version, Trip snapshot, Catalog quote/snapshot,
  provider order ref, and any legacy migrated transaction ids.
- `order_terms` move to Legal policy acceptance / contract terms, with payment
  terms modeled in Finance where they affect collection.
- Transaction contact/staff assignment snapshots move to Relationships,
  Bookings, Quotes, or Trip Composer depending on lifecycle.
- Transaction PII access logging is replaced by the existing Booking/Quote PII
  and action-ledger patterns.
- Storefront promotional-offer metadata moves to Commerce/Promotions.
- OCTO and external API projections read Bookings, booking origin/provenance,
  Catalog snapshots, and vertical/source refs instead of joining
  `transactions.offers` / `transactions.orders`.

Compatibility policy:

- Keep `@voyantjs/transactions-contracts` only as a temporary legacy contract
  package if external integrations still consume those zod schemas. Do not make
  it part of the v1 default product bundles.
- Temporary runtime facades may exist only inside the migration branch to keep
  intermediate commits verifiable.
- No public v1 package should expose `@voyantjs/transactions` or
  `@voyantjs/transactions-react` unless a later ADR explicitly reverses this
  retirement plan.

Required cleanup:

- Remove the `@voyantjs/transactions` dependency from Sellability before
  Commerce consolidation.
- Remove `transactionsHonoModule` and `transactionsBookingExtension` from
  template composition after Bookings owns origin/provenance.
- Replace Legal/Finance `orderId` and `offerId` references with Booking, Quote
  Version, Program, Trip Component, provider order ref, or generic target links
  as appropriate.
- Update `UBIQUITOUS_LANGUAGE.md` to match ADR-0005 so canonical Order/Offer
  language is legacy/provider-scoped rather than first-party v1 Module
  language.

ADR acceptance checklist:

- No non-legacy runtime package imports `@voyantjs/transactions` or
  `@voyantjs/transactions-react`.
- Default templates no longer mount `transactionsHonoModule`,
  `transactionsBookingExtension`, or transactions link tables.
- Sellability no longer constructs or persists Transactions Offers.
- `booking_transaction_details` is replaced by Bookings-owned
  origin/provenance records or fields.
- Legal policy acceptances and contracts no longer expose generic
  `transactions.offerId` / `transactions.orderId` fields in public v1 contracts;
  they point to Booking, Quote Version, Program, provider order ref, or a
  generic target shape as appropriate.
- Finance payment authorization and collection surfaces no longer expose
  generic `transactions.orderId` public v1 fields except in explicitly legacy
  compatibility contracts.
- Public v1 contract fields named `offerId` / `orderId` are either
  source/vertical provider identifiers, not Transactions ids, or explicitly
  marked legacy.
- The ADR explicitly decides whether canonical `Order` remains in
  `UBIQUITOUS_LANGUAGE.md`, is narrowed to provider/source order refs, or is
  retired from first-party public Interfaces.
- Generated schema manifests and package-closure checks for default templates
  have no runtime Transactions dependency.
- Old transactions route/unit/integration tests are either ported to the owning
  Modules' Interface tests or removed with documented coverage replacement.

### 5.5 Trip Composer / Proposal Workspace

Candidate packages:

- `@voyantjs/travel-composer`
- `@voyantjs/travel-composer-react`

Problem:

The composer is related to Catalog because it searches and references Catalog
Items, but it is not the Catalog Module. Catalog is the projection/search/
overlay/snapshot plane. The composer owns a live Trip Envelope workspace that
can mix catalog-backed components, manual placeholders, flight placeholders,
external order refs, pricing snapshots, reserve state, and checkout handles.

The composer is also related to Quotes because a Quote Version freezes the result
of that workspace. But the workspace and the quote pursuit are different
concerns: staff or automation may compose, reprice, and reserve before or after a
Quote Version exists.

Renaming `travel-composer` to `offers` would make the vocabulary worse. ADR-0004
preserves `transactions` Offer as a separate primitive, and vertical/source
packages already use offer nouns for live supplier responses such as flight
offers. The composer output should become a Quote Version snapshot, booking
draft, reservation, or checkout flow, not another generic Offer.

Solution:

Rename the current `@voyantjs/travel-composer` and
`@voyantjs/travel-composer-react` packages to `@voyantjs/trip-composer` and
`@voyantjs/trip-composer-react` in the v1 package move. Keep the composer as a
distinct standalone workspace Module, not a `quotes` subpath. `trip-composer` is
more precise because the Module owns the Trip Envelope workspace, and it avoids
the vocabulary collision that `offers` would create. Let Quotes
reference frozen composer snapshots through a narrow Interface; let Catalog
provide source/search/price-availability Interfaces; let Bookings and Finance
own final commitment and collection records.

Required cleanup:

- Replace misleading `catalogQuoteId` wording with catalog price/availability
  response terminology when that schema can be migrated.
- Make the composer Interface explicit: create, revise, price, freeze proposal
  snapshot, reserve, start checkout.
- Keep manual and dynamic composition in the same workspace if they converge on
  the same Trip Envelope semantics.
- Remove `travel-composer` public package names before v1. Temporary aliases are
  acceptable only inside the migration branch if they keep intermediate commits
  verifiable.

Proposal-to-reserve trace:

1. Quotes records that a Quote Version was accepted. It owns the accepted-version
   state and closes the Quote won.
2. Quotes calls the Trip Composer Interface with the accepted Quote Version's
   frozen Trip snapshot reference. Quotes does not reserve inventory directly.
3. Trip Composer asks Commerce to re-evaluate each priced line through the
   Commerce Interface. Commerce returns commercial snapshots and provider or
   adapter quote handles where applicable.
4. Trip Composer submits a reservation plan to the Bookings Interface. Bookings
   owns active reservation orchestration for both direct B2C storefront flows
   and accepted Quote Version / Trip Envelope flows. Catalog-backed sourced lines
   reserve through Catalog/vertical adapters; operated lines reserve through
   Bookings and Operations Interfaces; manual placeholders enter staff
   confirmation workflow.
5. Bookings owns the durable commitment records: booking origin/provenance,
   booking session or booking items, traveler records, fulfillment state, and
   customer-safe booking status. Trip Composer may keep reservation-plan refs and
   component refs, but not final booking truth.
6. Finance starts collection against Booking, Invoice, Payment Session,
   Schedule, or Guarantee targets. It does not require a generic Transactions
   Order.
7. Legal attaches policy acceptances, contracts, or terms to Booking, Quote
   Version, Program, provider order ref, or generic target links according to the
   accepted ADR.

Rule for order-like refs: use Booking origin/provenance for the overall
accepted source, Trip Component committed refs for per-component provider
handles, and Catalog/vertical snapshots for source-specific order ids. Do not
recreate a generic Order record.

The accepted Quote Version reservation proof is captured in
[`accepted-quote-version-reservation-golden-flow.md`](./accepted-quote-version-reservation-golden-flow.md).

### 5.6 Bookings

Candidate packages:

- `@voyantjs/bookings`
- `@voyantjs/bookings-react`
- `@voyantjs/booking-requirements`
- `@voyantjs/booking-requirements-react`
- booking session and journey surfaces currently split across catalog/storefront
  glue

Problem:

Booking requirements are not a separate product decision; they describe what
must be collected to commit a booking. Booking sessions, traveler records,
booking items, requirements, fulfillment, and redemption need one consistent
Interface.

Solution:

Fold requirements and booking journey/session primitives into the Bookings
Module. Bookings should own the unified reservation orchestrator used by direct
B2C checkout, accepted Quote Versions, and Trip Envelope reservation plans. Keep
Operations-owned resource and availability truth separate.

Required cleanup:

- Decouple booking requirements from `@voyantjs/products` before folding it into
  Bookings. Otherwise the move makes Bookings depend on operated Inventory and
  breaks the retail-spine optionality goal.

### 5.7 Finance

Candidate packages:

- `@voyantjs/finance`
- `@voyantjs/finance-react`
- `@voyantjs/checkout`
- `@voyantjs/checkout-react`

Problem:

Checkout is collection orchestration against bookings, invoices, schedules, and
guarantees. It is not a standalone travel-domain concept.

Solution:

Fold checkout into finance as the collection/session subdomain. Keep public
checkout contracts explicit and customer-safe.

Required cleanup:

- Invert the current Checkout -> Notifications and Notifications -> Finance
  cycle before Checkout folds into Finance. Finance should emit collection,
  payment, invoice, and reminder events; Notifications should subscribe or attach
  through a provider/adapter seam rather than Finance importing Notifications.
- Retarget checkout consumers such as payment plugins, `storefront-sdk`, and
  template payment routes to Finance collection/payment-session Interfaces.
- Remove direct Product and operated Availability dependencies from Finance
  where they are only used to derive payment context; use Booking, Invoice,
  Schedule, Guarantee, Catalog snapshot, or CommercialDecision refs instead.

### 5.8 Distribution

Candidate packages:

- `@voyantjs/distribution`
- `@voyantjs/distribution-react`
- `@voyantjs/suppliers`
- `@voyantjs/suppliers-react`
- `@voyantjs/external-refs`
- `@voyantjs/external-refs-react`

Problem:

Supplier and Channel are distinct domain roles, but the package split makes
shared external counterparty plumbing look like separate product Modules.
Distribution already needs suppliers, sourced inventory links, channel mappings,
allotments, push/reconciliation, webhooks, and external references to operate as
one workflow.

Solution:

Fold supplier runtime and external reference runtime into Distribution in the v1
package move. Keep Supplier and Channel distinct inside the Distribution domain:
Supplier is procurement/source/delivery-side, while Channel is outbound resale or
distribution-side. The shared Module should own external identity, mappings,
source/operator links, adapter-facing references, channel push, allotments, and
reconciliation.

The name `distribution` only works if Voyant defines it as the broader
commercial network Module, not just the outbound sales-channel Module. Current
`suppliers` scope includes procurement-side services, rates, availability,
contracts, payment terms, and facility links. Those concerns should be split by
durable owner during the move: supplier identity, services, source links,
external references, and counterparty mappings belong in Distribution; supplier
invoices, settlement, and ledger state belong in Finance; legal contract
documents and signatures belong in Legal; facility/place references move through
Operations or plain links according to schema discipline.

If the broader definition remains confusing in review, rename the target Module
to `counterparties` or `commercial-network` instead of forcing supplier-side
procurement language into an outbound-only Distribution meaning.

Required cleanup:

- Keep `@voyantjs/suppliers-contracts` separate unless ADR-0002 changes.
- Move schema ownership only through the migration contract below; do not strand
  supplier tables behind a deleted package name.
- Replace broad `external-refs-react` imports with Distribution React surfaces
  or narrow extension points.
- Keep supplier costing and invoices in Finance; Distribution can reference
  them but should not own ledger state.
- Update `UBIQUITOUS_LANGUAGE.md` so Distribution clearly covers supplier-side
  and channel-side commercial network concerns.

Schema migration plan:

- Move supplier identity and directory records (`suppliers`,
  `supplier_directory_projections`, contact projections, external refs, and
  source/operator links) behind Distribution.
- Move supplier service catalog records that describe counterparty capability
  (`supplier_services`, high-level service availability, adapter-facing service
  refs) behind Distribution, but keep low-level operated resource truth in
  Operations.
- Split supplier rate/cost semantics deliberately: supplier tariff/rate inputs
  used for quoting can be Distribution or Commerce inputs, but supplier invoices,
  payments, settlement, AP state, and profitability belong in Finance.
- Move supplier contract documents, signatures, terms templates, and policy
  acceptances to Legal. Distribution can retain contract metadata needed for
  routing or commercial-network rules, but not legal document truth.
- Convert facility/place references to Operations place/resource links; do not
  keep cross-package FKs to old Facilities tables.
- Replace Product-specific mappings and commission scopes with Catalog Item,
  vertical/source, or optional Inventory adapter refs so Distribution does not
  force operated Inventory into the retail spine.
- Keep channel push, channel reconciliation, channel allotments, and external ref
  mapping in Distribution, but route accounting postings and ledger effects
  through Finance Interfaces.

### 5.9 MICE / Programs

Future packages:

- `@voyantjs/mice`
- `@voyantjs/mice-react`

Problem:

MICE and corporate travel are not just operations. A Program starts before
execution, often as an RFP or Quote pursuit, and continues through planning,
contracting, room/space blocks, delegate management, bookings, invoices, and
on-site fulfillment. Folding Program into Operations would make Operations own
sales/planning records that Quotes, Finance, Legal, Relationships, and Bookings
all need to reference.

Solution:

Create an optional `mice` Module for full MICE support. Name the Module after
the product mode and make Program the central entity inside it. Do not name the
Module `corporate`: corporate travel is broader than MICE, and corporate buyer
workflows should mostly be expressed through Relationships, Quotes, Finance,
Bookings, and Storefront account surfaces. A Program is the umbrella group
engagement, such as a corporate meeting, incentive trip, conference, exhibition,
or complex group travel event.

The `mice` Module should own:

- Program records: buyer organization, primary contacts, dates, destination,
  status, budget, owner, and high-level lifecycle.
- Program Requirements: demand such as rooms, function spaces, catering, AV,
  transfers, sessions, staffing, and accessibility needs.
- RFP and Bid workflow: supplier invitations, bid lines, comparison, scoring,
  award decisions, and handoff to Legal, Distribution, Operations, and Finance.
- Agenda / Sessions: timed program activities, tracks, capacity, space
  references, inclusions, and session enrollment.
- Delegates / Attendees: roster, role, status, arrival/departure context,
  session enrollment, badge/check-in state, and links to Person/Traveler records.
- Rooming manifest: rooming assignments and sharing groups at Program scope,
  linked to Bookings and room blocks where applicable.
- Program-level orchestration: status rollups, milestone tracking, run sheets,
  program P&L views, and links to Quote Versions, bookings, contracts, invoices,
  suppliers, and operational blocks.

MICE passes the deletion test only if Program owns real behavior, not merely a
join table over other Modules. The first implementation slice must include at
least one durable Program behavior such as RFP/bid scoring and award workflow,
rooming-manifest conflict detection and assignment rules, agenda/session
capacity enrollment, delegate lifecycle/check-in, or Program P&L/status rollups.
If the implementation is only cross-module links plus a status field, keep it as
template/application composition until the deeper Program behavior exists.

The `mice` Module should not own:

- Person/Organization master data; that belongs to Relationships.
- Quote and Quote Version lifecycle; that belongs to Quotes.
- Low-level resource, availability, guide, vehicle, room, or function-space
  truth; that belongs to Operations.
- Booking commitments, traveler fulfillment, or redemption; those belong to
  Bookings.
- Invoices, payment schedules, payments, tax, supplier invoices, settlement, or
  ledger state; those belong to Finance.
- Supplier/channel identity, mappings, and external refs; those belong to
  Distribution.
- Contract documents, signatures, and terms templates; those belong to Legal.

Required cleanup:

- Treat the existing MICE RFC as the product-mode design input, but align table
  ownership with the target Module map before implementation.
- Use `mice` as the package name while Program remains the central entity.
  Keep `corporate` as a bundle/persona label, not a Module name. Use `programs`
  only if Program becomes a broader non-MICE concept.
- Use Program Room Block and Program Space Block for MICE demand, assignments,
  and rollups. Keep Room Resource Hold and Space Resource Hold execution behind
  Operations Interfaces.
- Keep delegate self-service inside Storefront surfaces; MICE owns delegate
  records and workflow, not the public runtime shell.
- Keep Program, Delegate, Program Room Block, Program Space Block, Room Resource
  Hold, Space Resource Hold, RFP, and Bid aligned with
  `UBIQUITOUS_LANGUAGE.md` as implementation details sharpen.

### 5.10 Catalog And Inventory

Candidate packages:

- `@voyantjs/catalog`
- `@voyantjs/catalog-react`
- `@voyantjs/catalog-authoring`
- `@voyantjs/products`
- `@voyantjs/products-react`
- `@voyantjs/extras`
- `@voyantjs/extras-react`
- vertical runtime packages where their differences are real

Problem:

Products are operated inventory, but "product" is overloaded across catalog,
commerce, storefront, and vertical packages. Catalog is the cross-vertical
projection, search, overlay, and snapshot plane. Many implementations need both,
and the current naming can make Products look like the whole catalog or Catalog
look like the owner of inventory authoring.

Solution:

Keep the catalog architecture decision: Catalog Item is a projection/contract
shape, not a root table, and Catalog is not a vertical Module. Move owned
product authoring toward an optional `inventory` Module, with current
`products` surfaces becoming Inventory subpaths/packages in the v1 move. Do not
overload `catalog` or keep `products` as the long-term public Module name.

`inventory` must remain an optional operated-inventory Module, not a default
dependency of Catalog or reseller/OTA starter bundles. OTA/reseller deployments
should be able to install Catalog, Commerce, Bookings, Finance, Distribution, and
Storefront without carrying product-authoring routes, schemas, or staff UI.
They should opt into Inventory only when they own or operate inventory.

The name `inventory` is risky because travel systems also use "inventory" for
availability, allotments, sourced inventory, and resource capacity. If the v1
package name stays `@voyantjs/inventory`, public docs should consistently call
the domain "operated Inventory authoring" and avoid using unqualified Inventory
for Operations availability/resource truth, Distribution allotments, or sourced
Catalog inventory.

`catalog-authoring` needs classification before any move. The current package
manifest depends on availability, extras, pricing, and products, so the likely
answer is that today's package is operated-inventory authoring and should move
under Inventory, probably as `inventory-authoring`. Keep or recreate a narrow
Catalog merchandising surface only for real Catalog overlay/source-governance
authoring: editorial overlays, source governance, freshness controls, search
projection metadata, and index governance. That surface may be named
`catalog-merchandising`, `catalog-overlays`, or a narrowed `catalog-authoring`,
but it must stay installable for OTA/reseller staff who curate sourced inventory
without operated Inventory. If overlay authoring is not real yet, do not keep a
separate public `catalog-authoring` name just for continuity.

Catalog AI access should also collapse into Catalog rather than survive as a
separate first-party Module. Semantic/vector retrieval, compact agent result
shapes, and hybrid keyword/semantic/BYO-vector search are Catalog search
capabilities exposed through Catalog HTTP APIs and supported Catalog Interfaces.
First-party MCP wrappers should not be a package boundary; if an application
needs MCP, it can wrap the same HTTP APIs at the app/runtime edge.

Required cleanup:

- Rename legacy `CatalogEntry` documentation wording to canonical Catalog Item
  terminology. There is no broad `CatalogEntry` public code identifier to alias;
  the existing projection contract is `CatalogProjection`, so the migration
  issue should reconcile docs, comments, and any stray `CatalogItem` identifiers
  against the actual Catalog Projection Interface instead of inventing a
  compatibility alias.
- Fold extras into the product/booking flow if they remain dependent add-ons.
- Avoid promoting non-sellable shared reference entities into Catalog Items.
- Keep sourced vertical contract packages where ADR-0002 requires them.

## 6. What Should Stay Separate

Some packages represent real seams and should not be collapsed merely to reduce
package count:

- `*-contracts` packages where ADR-0002 requires zod-only external contracts.
  Keeping the contract seam separate does not freeze legacy domain names; a
  runtime package move can still require renamed, split, or legacy-only contract
  packages.
- Provider/adapter packages such as payment, accounting, source, and channel
  adapters.
- External or sibling SDK packages such as `@voyantjs/data-sdk`,
  `@voyantjs/cloud-sdk`, `@voyantjs/connect-sdk`,
  `@voyantjs/connect-adapter`, and `@voyantjs/connect-cruises` are out of scope
  for this workspace package topology unless they are moved into this repo.
- `core`, `db`, `hono`, `storage`, `auth`, `identity`, `workflows`, and other
  infrastructure Modules.
- Domain packages such as `crm` should not merge into `core`; if they are too
  broad, split their domain seams instead.
- `legal`, unless future evidence shows it is only a finance or quotes helper.
- Vertical runtime packages where the vertical has genuinely distinct schemas,
  live pricing topology, booking semantics, or adapter contracts.

The goal is not fewer names at any cost. The goal is deeper Modules with real
Interfaces.

## 7. Product Modes Versus Package Bundles

Voyant should ship product bundles around implementation modes while keeping the
runtime Module seams explicit.

Possible starter bundles:

| Bundle | Includes |
| --- | --- |
| `reseller` / `ota` | catalog, commerce, bookings, finance, distribution, storefront, admin; inventory only if owned inventory is sold |
| `tour-operator` | reseller bundle plus inventory, operations, and owned product authoring |
| `dmc-b2b` | relationships, quotes, commerce, operations, bookings, distribution, finance, legal, admin; storefront optional |
| `mice` / `corporate` | dmc-b2b bundle plus `mice`, Program lifecycle, room/space block coordination, delegates, rooming, agenda, RFP/bid workflows |

These bundles are distribution choices. They should not force every underlying
slice to be an installable Module.

Authenticated account, support, and profile-heavy reseller deployments should
add Relationships explicitly. Contract-heavy reseller deployments should add
Legal explicitly. The starter bundle stays lean unless those workflows are part
of the implementation mode.

Retail-spine package closure is an acceptance gate, not a current property.
Before the `reseller` / `ota` bundle can claim to omit operated Inventory, the
runtime closure for Catalog + Commerce + Bookings + Finance + Distribution +
Storefront + Admin must have no hard dependency on `@voyantjs/products`,
`@voyantjs/products-react`, operated Availability/Operations schemas,
`@voyantjs/crm`, or runtime Transactions except through deliberate optional
adapters or compatibility packages. Current blockers include Distribution,
Finance, Storefront, Commerce candidates, and Booking Requirements.

Run `pnpm verify:retail-spine-closure` as the pre-v1 package-closure gate for
[#1791](https://github.com/voyantjs/voyant/issues/1791). The command computes
the current manifest closure from the retail-spine package candidates, reports
hard runtime blockers with package paths and dependency edges, and keeps optional
adapter/shim exceptions as edge-specific allowlist entries. It is a named
pre-v1 gate rather than part of `verify:architecture` until the documented
blockers are removed; once it passes, wire it into the normal architecture lane.

## 8. Migration Strategy

1. File the required migration issues before broad package moves: retail-spine
   closure, Commerce Interface proof, reservation choreography coverage, and
   schema-move issues for each affected Module.
2. Update `UBIQUITOUS_LANGUAGE.md` with implementation modes, audiences, and
   Inventory/Product wording.
3. Complete the legacy `CatalogEntry` wording cleanup and reconcile
   Catalog Item language with the existing `CatalogProjection` Interface before
   new public package Interfaces depend on those names.
4. Implement `commerce` first, because it has the clearest package-cluster
   evidence.
5. Migrate `pricing`, `markets`, `sellability`, and promotions under commerce
   subpaths/packages as a breaking v1 package move.
6. Rework sellability to feed catalog price/availability responses, booking
   drafts, Quote Versions, or trip-composer price snapshots instead of
   transactions Offers.
7. Create the optional `inventory` target Interface and classify
   `catalog-authoring`; then move `products` and dependent extras toward
   Inventory without adding Inventory to OTA/reseller bundles by default.
8. Implement `operations` next, starting with availability/allocation/resources
   and the facilities-to-places reframing.
9. Implement optional `mice` as the MICE/corporate group-business Module, with
   Program as its central entity and explicit Interfaces to Quotes, Operations,
   Bookings, Finance, Distribution, Relationships, and Legal.
10. Retire `@voyantjs/transactions` and `@voyantjs/transactions-react` as
   public v1 runtime packages per ADR-0005. Move each
   durable concern into Quotes, Commerce, Trip Composer, Bookings, Finance,
   Legal, Relationships, Distribution, or vertical adapters as described in
   §5.4.
11. Rename `@voyantjs/travel-composer` and
   `@voyantjs/travel-composer-react` to standalone `@voyantjs/trip-composer`
   and `@voyantjs/trip-composer-react`; do not expose the composer as a
   `quotes` subpath and do not rename it to `offers`.
12. Fold suppliers and external-refs into distribution as the external
   counterparty/integration Module, while preserving Supplier and Channel as
   distinct roles.
13. Fold checkout into finance.
14. Fold booking requirements into bookings.
15. Apply the frontend package strategy before relying on UI package moves:
    `*-react` owns hooks, clients, providers, query keys, view-model helpers,
    and reusable module components; separate `*-ui` packages are not a target
    v1 layer; `admin` and `storefront` own shell/application composition;
    retired registry/source-installed block wording must be removed from
    architecture docs.
16. Consolidate React packages after backend Module seams settle, folding any
    historical `*-ui` package contents into the corresponding `*-react`
    package.
17. Remove old public package names before v1 unless a package has a deliberate
    adapter, contract, or external-compatibility reason to survive.
18. Update template manifests only after the new Module exports and schema
    manifests are stable.

Critical path:

- Gating: retail-spine package closure must prove sourced-only reseller bundles
  can install without operated Inventory; Commerce must lose direct
  Product/Inventory dependency; Booking Requirements must lose direct Product
  dependency before folding into Bookings; Storefront must lose hard CRM/Product
  edges; Distribution and Finance must lose direct Product/operated Availability
  edges where the target bundle omits Inventory/Operations; Sellability must stop
  constructing Transactions Offers; target Module Interface tests must exist
  before old package tests are deleted; template schema parity must be proven
  before template manifests move.
- Invert central cycles before package consolidation: Commerce must not import
  Storefront after Promotions moves, and Finance must not import Notifications
  through Checkout while Notifications imports Finance. Use events, provider
  adapters, or surface-owned subscribers instead of hard package edges.
- Frontend package ownership is gating for public package names: `-react` owns
  runtime hooks/view-models and reusable module components, while
  Admin/Storefront own shell/page composition.
- Parallel after Interfaces exist: Operations/facilities reframing,
  Distribution supplier/external-ref migration, admin/storefront package
  rationalization, and contract-package rename/compatibility planning.
- Deferred if time-boxed: optional MICE can wait unless v1 explicitly ships MICE
  support; `trip-composer` rename can wait only if no public v1 package exposes
  the old `travel-composer` name. Do not ship half-moved public packages: either
  finish the target move or keep the old package with an explicit legacy/deferred
  status.

### 8.1 Execution Tracking

Readiness gates:

- [#1791: v1 packages: add retail-spine package-closure gate](https://github.com/voyantjs/voyant/issues/1791)
- [#1792: commerce: define CommercialDecision Interface before consolidation](https://github.com/voyantjs/voyant/issues/1792)
- [#1793: bookings: add accepted Quote Version to reservation golden flow](https://github.com/voyantjs/voyant/issues/1793)

Schema and package moves:

- [#1794: commerce: move pricing, markets, sellability, and promotions under Commerce](https://github.com/voyantjs/voyant/issues/1794)
- [#1795: inventory: move operated product authoring into optional Inventory](https://github.com/voyantjs/voyant/issues/1795)
- [#1796: relationships/quotes: split CRM into Relationships and Quotes](https://github.com/voyantjs/voyant/issues/1796)
- [#1797: bookings: own requirements, extras runtime, and booking origin/provenance](https://github.com/voyantjs/voyant/issues/1797)
- [#1798: finance: fold checkout into Finance and replace transaction order refs](https://github.com/voyantjs/voyant/issues/1798)
- [#1799: legal: replace order terms and transaction refs with target-linked legal records](https://github.com/voyantjs/voyant/issues/1799)
- [#1800: distribution: fold suppliers and external refs into Distribution](https://github.com/voyantjs/voyant/issues/1800)
- [#1801: operations: consolidate availability, resources, allocation, ground, and places](https://github.com/voyantjs/voyant/issues/1801)
- [#1802: trip-composer: rename travel-composer and own reservation plans](https://github.com/voyantjs/voyant/issues/1802)

Existing package-scope issues that now fit this strategy:

- [#1709: catalog: collapse AI access around HTTP APIs; remove catalog-mcp and fold catalog-rag into catalog](https://github.com/voyantjs/voyant/issues/1709)
- [#1786: Fold allocation UI into availability-react](https://github.com/voyantjs/voyant/issues/1786)
- [#1787: Rationalize admin package boundaries](https://github.com/voyantjs/voyant/issues/1787)
- [#1788: Fold booking-requirements into bookings package family](https://github.com/voyantjs/voyant/issues/1788)
- [#1789: Move extras into Inventory and Bookings; retire standalone extras packages](https://github.com/voyantjs/voyant/issues/1789)
- [#1790: Reframe facilities as shared places/locations](https://github.com/voyantjs/voyant/issues/1790)

Migration contract:

- Create target packages and subpath exports first; move callers only after the
  new Interface exists.
- Schema ownership stays with the original package until a specific migration
  issue or ADR moves the owning tables, Drizzle schemas, migrations, and schema
  docs.
- Temporary facades may exist inside the migration branch to keep intermediate
  commits verifiable, but they must be removed before the v1 public package
  surface unless explicitly retained as adapters/contracts.
- While temporary facades exist, they must keep enough `voyant.schema` metadata,
  package exports, and `voyant.config.ts` compatibility for affected templates
  to resolve the same schema closure.
- A schema move is complete only after generated manifest parity is proven for
  the affected templates, including `drizzle.schemas.generated.ts` and link
  table generation where applicable.
- A behavior move is complete only after old package tests are ported to target
  Module Interface tests, replaced by equivalent coverage, or explicitly removed
  with a documented reason.
- Template manifests move last. Do not update starter `voyant.config.ts` entries
  until schema parity and route/export compatibility are verified.
- Cross-package references continue to follow schema discipline: cross-domain
  associations go through links unless a documented vertical-extension
  exception applies.
- Because `@voyantjs/*` packages are already published, removed public package
  names need an external-consumer policy: changelog entry, migration target,
  npm deprecation or final compatibility release where appropriate, and no
  silent deletion of a published import path before v1.

## 9. Draft Target Recommendations

The strategic review questions raised during drafting are answered below as
current target recommendations. They are strong enough to plan migration issues,
but not accepted architecture until the package-closure gate, Interface
sketches/tests, schema moves, and test-parity gates are complete.

| Topic | Recommendation | Implementation follow-up |
| --- | --- | --- |
| Products / Inventory | Move owned product authoring from `products` toward optional `inventory` packages or subpaths. Do not install Inventory by default for OTA/reseller bundles. | Treat current `catalog-authoring` as likely Inventory authoring unless a real Catalog overlay/source-governance surface is split out; create the target Inventory Interface first; move schemas, docs, generated manifests, and templates only through explicit migration issues. |
| Commerce | Use `commerce` as the target Module. Fold `pricing`, `markets`, `sellability`, and promotions into Commerce. | Build the Commerce Interface before moving callers. Stop Sellability from constructing Transactions Offers and migrate callers to commerce outputs, Quote Versions, booking drafts, or trip-composer price snapshots. |
| CRM | Replace current `crm` packages with `relationships` plus `quotes` in the big-bang v1 package move. Do not ship a public v1 `crm` facade. | Move Person/Organization/account surfaces to Relationships and Quote/Quote Version/pipeline surfaces to Quotes. Temporary facades are allowed only inside the migration branch. |
| Distribution | Fold `suppliers` and `external-refs` into `distribution`, while preserving Supplier and Channel as distinct domain roles. | Move supplier/channel/external-ref schemas, routes, and mappings behind Distribution Interfaces without flattening Supplier and Channel vocabulary. |
| MICE / Corporate | Implement optional `mice` as the group-business Module. Use Program as the central entity. Keep `corporate` as a bundle/persona label, not the Module name. | Start from one vertical slice: Program plus group block coordination, delegate/rooming workflow, or RFP/bid workflow. Keep low-level resource truth in Operations and connect through explicit Interfaces. |
| Catalog Item | Use canonical Catalog Item terminology in docs and product language while preserving the actual Catalog Projection Interface where that is the supported code contract. | Do not invent a `CatalogEntry` compatibility alias; reconcile docs/comments and any stray `CatalogItem` identifiers with `CatalogProjection` intentionally. |
| Trip Composer | Rename `travel-composer` to standalone `trip-composer`. Do not expose it as a `quotes` subpath and do not rename it to `offers`. | Migrate package names, route prefixes, admin extension ids, tests, and template manifests as part of the v1 package move. |
| Transactions | Retire runtime `transactions` packages per ADR-0005. Do not rename them to `orders` or `commitments`. Keep `transactions-contracts` only as temporary legacy contracts if external consumers still need them. | Replace `booking_transaction_details`, remove Sellability's Offer construction, and move remaining order/term references to their owning Modules as described in §5.4. |

## 10. Current Package Disposition

This section records the proposed direction for the current package set. It is
not an implementation plan by itself and does not override the ADR follow-ups
above; it prevents the strategy from silently assuming that unmentioned packages
stay unchanged.

### 10.1 Travel Runtime Packages

| Current package(s) | Direction | Notes |
| --- | --- | --- |
| `@voyantjs/catalog`, `@voyantjs/catalog-react` | Keep as the catalog projection/search/overlay/snapshot plane. | Catalog remains a contract/infrastructure plane, not a universal root table and not owned product authoring. |
| `@voyantjs/catalog-authoring` | Move current package scope toward Inventory unless a real overlay/source-governance surface is split out. | The manifest depends on Products, Availability, Pricing, and Extras, so today's package looks like operated-inventory authoring. Keep a Catalog authoring package only for overlays, source governance, freshness, search projection metadata, or index governance. |
| `@voyantjs/products`, `@voyantjs/products-react` | Move to optional `inventory` subpaths/packages in the v1 package move. | Products are operated inventory. They should not be mistaken for all sellable inventory, for the Catalog plane, or for a default OTA/reseller dependency. |
| `@voyantjs/accommodations` | Keep as a vertical runtime for accommodation resale where the schema/booking semantics are real. | Do not revive hotel/property operations. Room-block work may be Operations/Program-facing while accommodation resale remains vertical. |
| `@voyantjs/cruises`, `@voyantjs/cruises-react` | Keep as a vertical runtime package. | Cruises have distinct content, sailing, cabin, fare, itinerary, and booking semantics. They should participate in catalog, commerce, bookings, and operations rather than be folded into any one of them. |
| `@voyantjs/charters`, `@voyantjs/charters-react` | Keep as a vertical runtime package. | Yacht/charter contracts, APA, suite/whole-vessel pricing, and booking semantics are distinct enough to keep a vertical seam. |
| `@voyantjs/flights`, `@voyantjs/flights-react` | Keep as a vertical/source runtime package. | Flights are live-offer/source-adapter driven and intentionally do not behave like owned product inventory. |
| `@voyantjs/extras`, `@voyantjs/extras-react` | Fold into product/booking flow under Inventory and Bookings subpaths as appropriate. | Extras are dependent add-ons discovered through a parent, not independently sellable inventory. |
| `@voyantjs/octo` | Keep as an adapter/API compatibility package unless it grows into a first-class product seam. | OCTO should project from Bookings, booking origin/provenance, Catalog snapshots, and vertical/source refs after Transactions retirement. |

### 10.2 Commercial Runtime Packages

| Current package(s) | Direction | Notes |
| --- | --- | --- |
| `@voyantjs/pricing`, `@voyantjs/pricing-react` | Fold into `commerce`. | Price catalogs, schedules, option/unit rules, departure overrides, and cancellation policy attachment are quote-time commercial behavior. |
| `@voyantjs/markets`, `@voyantjs/markets-react` | Fold into `commerce`. | Markets, market currencies, market price catalogs, market product/channel rules, and quote-time FX are commercial context. |
| `@voyantjs/sellability`, `@voyantjs/sellability-react` | Fold into `commerce` after prerequisite decoupling. | Keep the concept, but rework it to feed catalog price/availability responses, Quote Versions, booking drafts, or composer snapshots instead of transactions Offers. |
| `@voyantjs/promotions`, `@voyantjs/promotions-react` | Fold into `commerce`. | Promotions alter quote-time commercial facts and storefront display. Keep workflow subscribers internal to commerce or template wiring. |

### 10.3 Relationships, Quotes, Booking, And Commitment Packages

| Current package(s) | Direction | Notes |
| --- | --- | --- |
| `@voyantjs/crm`, `@voyantjs/crm-react` | Replace with `relationships` plus `quotes` in the v1 package move. | ADR-0004 moves supported proposal language to Quote. Customer/account records should move toward Relationships; quote pursuit should move toward Quotes. Temporary facades are allowed only inside the migration branch, not as public v1 API. |
| `@voyantjs/transactions`, `@voyantjs/transactions-react` | Retire as public v1 runtime packages per ADR-0005. | Do not rename to `orders` or `commitments`. Move proposal state to Quotes, quote-time commercial snapshots to Commerce/Trip Composer, booking origin/provenance to Bookings, terms to Legal/Finance, promotional offers to Commerce/Promotions, and provider order refs to vertical adapters/Catalog snapshots/Distribution external refs. |
| `@voyantjs/travel-composer`, `@voyantjs/travel-composer-react` | Rename to `@voyantjs/trip-composer` / `@voyantjs/trip-composer-react` in the v1 package move. | Keep it as a standalone workspace Module. It reads Catalog and feeds Quotes, Bookings, and Finance, but does not belong wholly to any of them. Do not expose it as a `quotes` subpath and do not rename it to `offers` while `transactions` Offer and vertical live-offer vocabulary still exist. |
| `@voyantjs/bookings`, `@voyantjs/bookings-react` | Keep as the Bookings Module and deepen it. | Booking sessions, booking items, travelers, fulfillment, and commitment records belong here. |
| `@voyantjs/booking-requirements`, `@voyantjs/booking-requirements-react` | Fold into `bookings`. | Requirements define what must be collected to commit a booking. |
| `@voyantjs/checkout`, `@voyantjs/checkout-react` | Fold into `finance`. | Checkout is collection orchestration against booking, invoice, schedule, and guarantee targets. |

### 10.4 Operations Packages

| Current package(s) | Direction | Notes |
| --- | --- | --- |
| `@voyantjs/availability`, `@voyantjs/availability-react` | Fold into `operations`. | Availability is operated execution truth: slots, rules, pickup points, holds, and operational availability state. |
| `@voyantjs/allocation-ui` | Deprecated compatibility facade; the active UI lives in `@voyantjs/availability-react/allocation` until the later Operations React surface exists. | This is a UI slice over availability allocation resources, not a standalone Module, and must not move into Resources. |
| `@voyantjs/resources`, `@voyantjs/resources-react` | Fold into `operations`. | Resources are operational assets and pools used by operated products and logistics. |
| `@voyantjs/ground`, `@voyantjs/ground-react` | Fold into `operations`. | Ground is operational logistics: vehicles, drivers, dispatch, shifts, checkpoints. |
| `@voyantjs/facilities`, `@voyantjs/facilities-react` | Reframe as places/locations under `operations`, or split generic places from accommodation/property remnants. | Physical places are useful; hotel/property operations are out of first-party scope. |
| Future `@voyantjs/mice`, `@voyantjs/mice-react` | Create as an optional MICE/corporate group-business Module. | Program is the central entity. The Module owns Program lifecycle, requirements, agenda, delegates, rooming, and RFP/bid workflow while reusing Quotes, Operations, Bookings, Finance, Distribution, Relationships, and Legal. |

### 10.5 Finance, Legal, Distribution, And Counterparty Packages

| Current package(s) | Direction | Notes |
| --- | --- | --- |
| `@voyantjs/finance`, `@voyantjs/finance-react` | Keep as Finance and deepen it with checkout. | Finance owns invoices, payments, payment sessions, tax persistence, supplier invoices, vouchers, settlement, and profitability. |
| `@voyantjs/legal`, `@voyantjs/legal-react` | Keep separate. | Legal documents, contracts, terms, templates, signatures, and legal workflows cut across quotes, bookings, Distribution, and finance. |
| `@voyantjs/suppliers`, `@voyantjs/suppliers-react` | Fold into `distribution` in the v1 package move. | Supplier remains a distinct role/entity inside Distribution; it should not be flattened into Channel. |
| `@voyantjs/distribution`, `@voyantjs/distribution-react` | Keep as the proposed Distribution Module name and absorb supplier/external-ref scope if the broader commercial-network definition is accepted. | Distribution owns supplier-side and channel-side commercial network concerns: Suppliers, Channels, mappings, allotments, channel push, source/operator links, reconciliation, and integration-facing references. |
| `@voyantjs/external-refs`, `@voyantjs/external-refs-react` | Fold into `distribution` in the v1 package move. | External refs are shared integration plumbing for channels, suppliers, sourced inventory, and external systems. |

### 10.6 Admin And Surface Packages

| Current package(s) | Direction | Notes |
| --- | --- | --- |
| `@voyantjs/admin` | Keep as packaged staff shell and extension surface. | Admin is a surface/extension host, not a domain Module. App-shell exports live under `@voyantjs/admin/app/*`. |
| `@voyantjs/admin-app` | Keep as the first-party admin composition package until the domain-backed core extension can be inverted. | It re-exports the shell helpers for compatibility and owns `core-extension`, because that bundle imports domain React packages that depend back on `@voyantjs/admin`. First-party shell imports should still move to `@voyantjs/admin/app/*`. |
| `@voyantjs/admin-client`, `@voyantjs/admin-contracts` | Keep if the framework-neutral admin client contract remains useful. | This is a client/contract seam, not a domain seam. |
| `@voyantjs/admin-react` | Keep separate only as the React Query adapter over `admin-client`; fold before v1 if no independent React SDK consumers are confirmed. | It is not part of the packaged shell/runtime surface moved into `admin`. |
| `@voyantjs/storefront`, `@voyantjs/storefront-react` | Keep as the customer-facing runtime/surface concept. | Storefront composes public and authenticated customer flows; it should not own product, price, booking, or finance truth. |
| `@voyantjs/customer-portal`, `@voyantjs/customer-portal-react` | Fold into `storefront` as authenticated account/after-booking surfaces in the v1 package move. | The portal composes bookings, finance, legal, identity, and Relationships; it should not own those records or remain a separate public v1 package. |
| `@voyantjs/storefront-sdk` | Keep as a framework-agnostic facade if public flows stay cross-module. | SDK shape may simplify once commerce/bookings/finance consolidate. |
| `@voyantjs/storefront-verification` | Keep as a public-surface support package unless folded into storefront. | Verification is a support capability for storefront/public flows. |

### 10.7 Infrastructure, Platform, And Cross-Cutting Packages

| Current package(s) | Direction | Notes |
| --- | --- | --- |
| `@voyantjs/core`, `@voyantjs/db`, `@voyantjs/hono` | Keep separate. | Core framework, database helpers, and route composition are real infrastructure seams. |
| `@voyantjs/auth`, `@voyantjs/auth-react`, `@voyantjs/identity`, `@voyantjs/identity-react` | Keep separate, but keep audience/customer terminology aligned. | Auth/session identity and contact/person identity are cross-cutting infrastructure. |
| `@voyantjs/action-ledger`, `@voyantjs/action-ledger-react` | Keep separate as an infrastructure/audit Module. | Audit/action timelines cut across domains. |
| `@voyantjs/notifications`, `@voyantjs/notifications-react` | Keep separate. | Notifications are infrastructure with provider/adapters and domain event consumers. |
| `@voyantjs/storage` | Keep separate. | Storage is infrastructure. |
| `@voyantjs/workflows`, `@voyantjs/workflows-react`, `@voyantjs/workflow-runs`, `@voyantjs/workflows-orchestrator`, `@voyantjs/workflows-orchestrator-node`, `@voyantjs/workflows-orchestrator-cloudflare`, `@voyantjs/workflows-cloud-adapter` | Keep as workflow infrastructure family. | These are runtime/orchestration seams, not travel-domain seams. |
| `@voyantjs/catalog-rag`, `@voyantjs/catalog-mcp` | Fold Catalog retrieval into `catalog` and remove first-party `catalog-mcp`. | Semantic/vector/hybrid search and compact agent results are Catalog API capabilities; MCP wrappers belong at the application/runtime edge when needed. |
| `@voyantjs/ui`, `@voyantjs/react`, `@voyantjs/i18n` | Keep separate. | Shared frontend/runtime infrastructure. |
| `@voyantjs/schema-kit`, `@voyantjs/types`, `@voyantjs/utils`, `@voyantjs/templating` | Keep separate. | Shared type, TypeID, formatting, templating, and utility infrastructure. |
| `@voyantjs/voyant-test-utils`, `@voyantjs/voyant-typescript-config`, `@voyantjs/vite-config`, `@voyantjs/worker-runtime` | Keep separate. | Test/build/runtime support packages. |

### 10.8 Contract Packages

| Current package(s) | Direction | Notes |
| --- | --- | --- |
| `@voyantjs/accommodations-contracts`, `@voyantjs/bookings-contracts`, `@voyantjs/catalog-contracts`, `@voyantjs/charters-contracts`, `@voyantjs/crm-contracts`, `@voyantjs/cruises-contracts`, `@voyantjs/extras-contracts`, `@voyantjs/finance-contracts`, `@voyantjs/flights-contracts`, `@voyantjs/identity-contracts`, `@voyantjs/legal-contracts`, `@voyantjs/products-contracts`, `@voyantjs/suppliers-contracts`, `@voyantjs/transactions-contracts` | Keep the zod-only contract seam separate unless ADR-0002 is replaced. | Runtime consolidation does not automatically collapse contract packages, but v1 package moves can still rename, split, or retire legacy contract names. Treat `crm-contracts`, `products-contracts`, `suppliers-contracts`, `extras-contracts`, and `transactions-contracts` as migration/compatibility concerns for their target Modules, not as proof that old runtime Module names should survive. |

### 10.9 Plugin Packages

| Current package(s) | Direction | Notes |
| --- | --- | --- |
| `@voyantjs/plugin-catalog-demo`, `@voyantjs/plugin-flights-demo` | Keep as demo/source plugin packages. | These are integration examples and seed connectors, not domain Modules. Their public shape may change when Catalog, Inventory, and Flights settle, but they should remain plugins. |
| `@voyantjs/plugin-netopia` | Keep as a finance/payment plugin. | Payment-provider logic belongs outside Finance core and should attach through provider/plugin seams. |
| `@voyantjs/plugin-smartbill` | Keep as a finance/accounting plugin. | Accounting-provider logic belongs outside Finance core and should attach through provider/plugin seams. |
| `@voyantjs/plugin-payload-cms`, `@voyantjs/plugin-sanity-cms` | Keep as content/source plugins. | CMS-specific implementation should stay outside catalog core and expose provider/plugin integration points. |

### 10.10 Apps And Templates

| Workspace package(s) | Direction | Notes |
| --- | --- | --- |
| `operator` template | Keep as the reference product assembly. | The template should change after package seams settle, because it is the proof that product modes compose cleanly. |
| `@voyantjs/agent-control-plane`, `@voyantjs/agent-runner` | Keep as agentic engineering applications. | These are repository tooling/runtime apps, not travel-domain Modules. Follow `docs/architecture/agentic-engineering-orchestration.md` for changes. |
| `@voyantjs/scripts` | Keep as repository automation. | This is not part of the product package topology. |
| `catalog-demo-api`, `flights-demo-api` | Keep as demo applications. | These may need dependency updates after Catalog, Inventory, or Flights package moves, but they should not drive Module boundaries. |
| `@voyantjs/workflow-runs-dashboard`, `@voyantjs/workflows-local-dashboard` | Keep as workflow/admin tooling apps. | They are consumers of workflow infrastructure. |
| `@voyantjs/workflows-node-step-container`, `@voyantjs/workflows-orchestrator-worker`, `@voyantjs/workflows-selfhost-cloudflare-worker`, `@voyantjs/workflows-selfhost-node-server`, `@voyantjs/workflows-tenant-worker` | Keep as workflow runtime/deployment apps. | These are deployment targets for workflow infrastructure and should remain outside travel-domain consolidation. |

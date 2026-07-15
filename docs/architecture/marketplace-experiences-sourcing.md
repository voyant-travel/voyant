# Marketplace Experiences Sourcing

Status: planning reference
Audience: anyone designing Viator, GetYourGuide, or similar marketplace integrations for experiences, tours, attractions, day trips, and local activities.

This document defines how Voyant should let an operator or agency plug marketplace experience inventory into the catalog plane while preserving the core truth that the operator does **not** own or operate that inventory.

The immediate target sources are:

- Viator Partner API: `https://docs.viator.com/partner-api/technical/`
- Viator local OpenAPI reference: `/Users/mihai/builds/internal/voyant-all/docs/viator-openapi.json`
- GetYourGuide Partner API spec: `https://code.getyourguide.com/partner-api-spec/spec/api.yaml`

## 1. Core Distinction

Viator and GetYourGuide products are **sourced inventory**, not owned inventory.

In Voyant vocabulary:

- **Owned Product**: the operator runs the experience. Voyant owns product data, availability slots, capacity allocation, fulfillment, and operational status.
- **Sourced Experience**: an upstream marketplace or supplier owns the sellable experience and remains the source of truth for live availability, price, hold, booking, cancellation, Service Voucher, and status.
- **Catalog Projection**: the local normalized browse/search record that makes sourced inventory visible in admin and storefront surfaces.
- **Catalog Overlay**: local merchandising changes, such as title rewrites, hero images, SEO copy, tags, and internal notes, stored without mutating upstream data.
- **Booking Snapshot**: the immutable record of what was sold, what the customer saw, what they paid, and which upstream handle must be used after booking.

The implementation must not import Viator/GetYourGuide inventory as if the local operator owns it.

## 2. Architectural Rule

Marketplace integrations should be **source adapters for `products`**, not new vertical modules.

Standalone excursions, activities, attraction tickets, guided tours, and one-day local trips fit the existing `packages/products` vertical. What changes is provenance and execution:

- Owned products use local product rows, local availability, and local booking allocation.
- Sourced experiences use marketplace projections, live adapter calls, and upstream booking handles.

The catalog plane is the right cross-cutting layer because it already has:

- a public `SourceAdapter` contract for discovery, live resolution, reservation, cancellation, and drift events
- catalog overlays keyed by `(entity_module, entity_id, field_path, locale, audience, market)`
- booking catalog snapshots with source callback fields
- an indexer contract intended to interleave owned and sourced inventory

## 3. Current State

Voyant has much of the foundation:

- `packages/catalog/src/adapter/contract.ts` defines `SourceAdapter`.
- `packages/catalog/src/overlay/schema.ts` defines the overlay store.
- `packages/catalog/src/snapshot/schema.ts` defines booking catalog snapshots.
- `packages/products` has product, option, unit, content, media, location, destination, and public catalog surfaces.
- `packages/availability` has local slots, recurrence, cutoff, pickup, and capacity tracking.
- `packages/bookings` has hold, confirm, cancel, expire, allocation, fulfillment, and redemption concepts.

The main blocker is that the products runtime still assumes owned inventory:

- `packages/products/src/service-catalog-plane.ts` synthesizes `source.kind = "owned"` for product projections.
- `packages/products/src/service-catalog-plane.ts` documents sourced products as future work.
- `packages/products/src/service-public.ts` reads local `products` rows directly for public browse.
- `packages/bookings/src/validation.ts` requires a local `availabilitySlotId` for reservation items.
- `packages/bookings/src/service.ts` decrements local slot capacity when reserving.

That is correct for owned inventory, but it is the wrong path for Viator/GetYourGuide.

## 4. Target Shape

The target shape is:

```txt
Marketplace source
  -> SourceAdapter
  -> Products sourced projection
  -> Catalog overlay resolver
  -> Catalog index
  -> Admin/storefront browse
  -> Live adapter quote/check
  -> Upstream hold/book
  -> Local Voyant booking + snapshot + upstream handle
```

The local Voyant booking remains valuable even when upstream owns fulfillment. It is the operator's commercial, CRM, finance, support, audit, and reconciliation record.

## 5. Product Storage Model

Do not force marketplace rows into the same semantics as owned `products`.

The cleanest path is to add a products-owned sourced projection store, for example:

```txt
product_source_entries
  id
  source_kind                 -- marketplace:viator, marketplace:getyourguide
  source_connection_id
  source_ref                  -- Viator productCode, GYG tour_id or option key
  source_option_ref           -- optional, when upstream option is the true bookable unit
  status
  visibility
  language_tag
  title
  description
  short_description
  duration
  location_summary
  country_code
  latitude
  longitude
  destination_refs
  category_refs
  tag_refs
  media
  rating
  review_count
  from_price_amount
  from_price_currency
  available_from
  available_to
  confirmation_type
  cancellation_summary
  booking_requirements_summary
  raw_payload
  payload_hash
  last_sourced_at
  source_updated_at
  created_at
  updated_at
```

This table is a projection, not operational truth. The upstream source remains authoritative for live fields.

Recommended identity:

- Use stable local `id` values so overlays, snapshots, links, and search documents have durable keys.
- Enforce uniqueness on `(source_kind, source_connection_id, source_ref, source_option_ref, language_tag)` where applicable.
- Store raw payloads only as source evidence and adapter recovery material, not as the public contract.

## 6. Adapter Contract Usage

Viator and GetYourGuide adapters should implement the catalog `SourceAdapter` contract.

### 6.1 Adapter kind

Suggested adapter kinds:

- `marketplace:viator`
- `marketplace:getyourguide`

### 6.2 Discovery

`discover()` should emit normalized product projections:

- Viator sources from product ingestion/search endpoints such as product modified-since, bulk, tags, destinations, attractions, locations, and reviews.
- GetYourGuide sources from tours, options, categories, suppliers, reviews, and related endpoints.

Adapters should normalize upstream concepts into products field-policy paths and sourced projection rows.

### 6.3 Live Resolution

`liveResolve()` should fetch volatile-live fields:

- availability status
- bookable dates/times
- available options
- traveler categories or age bands
- pickup/meeting constraints
- final price and price breakdown
- cancellation/refund quote where available
- booking questions or required answers

Browse can show cached "from" information. Detail and checkout must go live.

### 6.4 Reserve And Book

`reserve()` must support the source's actual booking model:

- Viator can perform availability check, hold, book, status, and cancellation flows depending on partner access.
- GetYourGuide may support API booking/cart flows or redirect-to-marketplace flows depending on access and commercial mode.

The adapter should return:

- upstream booking reference
- upstream status
- hold expiry, if any
- ticket or Service Voucher metadata, if already available
- opaque upstream payload for snapshot/audit

### 6.5 Cancel And Status

`cancel()` should call upstream cancellation APIs where direct cancellation is supported.

Status sync should be modeled explicitly. The current catalog adapter contract has cancellation but no first-class `status()` method. Add one before implementing production-grade marketplace booking reconciliation.

## 7. Admin Experience

Admins should be able to:

- create a marketplace source connection
- enter credentials securely
- see source capabilities, such as browse-only, live pricing, booking, cancellation, amendments, Service Voucher support
- choose import scope: all inventory, destinations, attractions, categories, curated product codes, or manual allowlist
- run initial sync
- inspect sync health, rate limits, last cursor, and errors
- preview sourced entries
- publish/unpublish sourced entries locally
- apply catalog overlays
- map categories, destinations, languages, pickup policies, and traveler categories
- see provenance on every sourced item

Admin UI must use clear provenance labels such as:

- Owned
- Sourced from Viator
- Sourced from GetYourGuide

Avoid labels that imply the operator runs the experience.

## 8. Storefront Experience

Storefront browse should interleave owned and sourced inventory in one customer-facing catalog.

Storefront list pages should read from the catalog index/projection, not fan out to marketplace APIs at request time.

Storefront detail pages may:

- read cached projection and overlay fields locally
- call the adapter live for volatile fields
- cache non-transactional live detail for a short TTL

Checkout must always call live adapter flows for final price, availability, requirements, and booking.

Customer-facing copy should distinguish source only when useful for trust, support, cancellation, or Service Voucher expectations. The API contract must preserve provenance even when the UI chooses not to foreground it.

## 9. Booking Flow

### 9.1 Owned Product Flow

Owned products keep the existing flow:

```txt
local product
  -> local availability slot
  -> local allocation
  -> local hold
  -> local confirm
```

### 9.2 Sourced Experience Flow

Sourced experiences need a separate reservation path:

```txt
sourced catalog entry
  -> adapter live availability/price
  -> adapter hold or book
  -> local booking row
  -> local booking item(s)
  -> catalog snapshot
  -> upstream booking link
  -> fulfillment/Service Voucher records
```

This path must not require local `availabilitySlotId` and must not decrement local `availability_slots`.

The local booking should store:

- source type: marketplace/direct/API partner as appropriate
- upstream booking reference
- source connection id
- source kind
- selected product/option/date/time/category
- traveler/category breakdown
- final price breakdown
- required booking answers
- cancellation policy snapshot
- Service Voucher/ticket metadata
- raw upstream response where needed for support/reconciliation

## 10. Booking Requirements

Marketplace experiences need dynamic requirements.

Required data can vary per product, option, date, traveler category, pickup mode, and language. The booking UI cannot rely only on static storefront form settings.

Needed capabilities:

- adapter returns normalized booking requirement descriptors
- checkout renders dynamic per-booking and per-traveler questions
- answers are stored on the booking/session
- answers are forwarded to upstream during hold/book
- snapshot captures the answered question set

Examples:

- traveler names
- dates of birth
- age bands or ticket categories
- lead traveler contact
- pickup hotel or meeting point
- preferred guide/audio language
- accessibility or dietary notes
- supplier-specific free-text answers

## 11. Pricing And Payments

Marketplace pricing must keep these concerns separate:

- retail amount shown to customer
- partner net price or commission basis, if supplied
- booking fees, taxes, surcharges, destination charges
- operator markup/discount overlays where contractually allowed
- payment owner: operator, marketplace, or split
- refund/cancellation owner

Viator/GYG access tier and commercial model determine whether Voyant collects payment, redirects checkout, or records an externally paid booking.

Do not assume every marketplace source is merchant-of-record through the operator.

## 12. Fulfillment, Vouchers, And Redemption

Sourced bookings may produce upstream Service Voucher URLs, QR codes, barcodes, supplier references, or instructions.

Voyant should store these as booking fulfillments/artifacts, not as product data.

The local fulfillment record should be able to represent:

- Service Voucher URL
- PDF/ticket URL
- QR/barcode value
- supplier booking code
- per-traveler or per-booking artifact
- emergency contact information
- delivery restrictions
- revocation/cancellation state

Redemption may remain manual unless the upstream supports redemption status APIs.

## 13. Reconciliation And Drift

Sourced inventory changes frequently. The platform needs two loops:

### 13.1 Catalog drift

Detect changes to:

- title/content/media
- availability windows
- cancellation rules
- booking requirements
- price/rate structures
- active/inactive status

Use drift events where available and scheduled delta sync otherwise.

### 13.2 Booking reconciliation

Detect changes to:

- upstream booking status
- manual confirmation outcome
- cancellation outcome
- Service Voucher issuance
- amendment state
- refund status
- source-side price/status mismatch

Viator has modified-since booking endpoints. GetYourGuide behavior depends on access mode and API surface. The adapter should hide that variation behind a common reconciliation surface.

## 14. Required Platform Changes

To make this production-ready, Voyant needs:

1. Products sourced projection schema and service.
2. Source connection schema, encrypted credentials, capability state, and sync cursors.
3. Viator adapter package.
4. GetYourGuide adapter package.
5. Catalog index ingestion from sourced projections.
6. Admin source connection and curation UI.
7. Public browse/detail routes that read across owned and sourced catalog entries.
8. Live quote/availability endpoint routed by provenance.
9. Booking session support for dynamic adapter requirements.
10. Sourced booking reserve/confirm path that does not require local slots.
11. Upstream booking link table or extension fields with source connection/ref/status.
12. Adapter-aware cancellation, status sync, Service Voucher ingestion, and reconciliation jobs.
13. Finance/distribution handling for commission, net price, payment owner, and cancellation owner.
14. Certification/rate-limit posture per source.

## 15. Implementation Slices

### Slice 1: Sourced Catalog Read-Only

Goal: admins and storefront users can browse sourced experiences.

Deliver:

- source connection records
- product sourced projection table
- Viator read-only adapter
- GetYourGuide read-only adapter
- catalog index population
- admin browse with provenance labels
- storefront browse/detail read path

No checkout yet.

### Slice 2: Live Detail And Quote

Goal: detail pages and checkout preflight use live source data.

Deliver:

- adapter live availability/price calls
- normalized traveler category and option model
- dynamic booking requirement descriptors
- public live quote endpoint
- short-TTL cache for non-transactional live responses

### Slice 3: Sourced Booking Sessions

Goal: customers can start checkout for sourced experiences.

Deliver:

- booking session support without local `availabilitySlotId`
- dynamic form rendering contract
- answer persistence
- sourced price snapshot
- source-aware validation

### Slice 4: Upstream Hold/Book

Goal: customers can book sourced experiences end to end.

Deliver:

- Viator hold/book flow
- GetYourGuide supported booking or redirect flow
- local booking creation with snapshot
- upstream booking link persistence
- Service Voucher/artifact ingestion
- idempotency and failure recovery

### Slice 5: Post-Book Operations

Goal: support and operations can manage sourced bookings.

Deliver:

- status sync
- cancellation quote/cancel where supported
- amendment support where source supports it
- reconciliation jobs
- support/audit UI

## 16. Open Questions

- Which commercial modes do we support first: affiliate redirect, merchant API booking, or both?
- Should GetYourGuide launch as redirect-only first if booking access is not guaranteed?
- Do sourced experiences get local SEO pages by default, or only when explicitly published?
- How do we expose "fulfilled by marketplace/supplier" in customer-facing copy?
- Where do we store source credentials: shared provider connection table or products-specific source table?
- Do we need local allowlists before full-catalog ingestion to control volume and certification risk?
- What is the minimum finance model for marketplace bookings: commission-only, net-rate resale, or both?
- Which cancellation and amendment operations are required for v1 certification?
- How should sourced entries interact with AI itinerary composition and catalog RAG?

## 17. Non-Goals

For the first implementation, do not build:

- a new `experiences` vertical separate from `products`
- a universal catalog root table
- local operational availability slots for marketplace inventory
- a fake supplier/operator record that implies the local operator runs the experience
- source-specific UI paths that bypass the catalog plane
- full upstream payload mirroring as a public contract

## 18. Design Bar

The integration is correct when:

- an admin can tell which experiences are owned and which are sourced
- storefront users can browse both in one catalog
- checkout always uses live upstream availability and pricing for sourced entries
- local bookings preserve audit, support, finance, and CRM value
- upstream remains the source of truth for sourced inventory
- disconnecting a source does not erase historic booking truth
- adding a third marketplace later does not require rewriting products, bookings, storefront, or finance

# Accommodation Resale Boundary

Status: active
Audience: contributors changing catalog, booking, storefront, product, or
vertical module surfaces.

Voyant targets three implementation scenarios:

- OTAs
- tour operators
- DMCs

Accommodation is still in scope for those scenarios. What is out of scope is a
hotel, resort, property manager, or lodging operator using Voyant as its
property-management or hotel-operations system.

## Product Rule

Voyant supports selling accommodation. Voyant does not support operating a hotel
as a first-party deployment scenario.

That distinction drives package, template, route, UI, and documentation changes.

## In Scope

Accommodation may appear as sellable or composable inventory when an OTA, tour
operator, or DMC is acting as a reseller, packager, or trip operator.

Allowed surfaces include:

- sourced accommodation catalog entries from bedbanks, GDSs, channel managers,
  direct supplier APIs, Voyant Connect, CSV imports, or other inventory sources
- hotel, apartment, lodge, camp, villa, or similar lodging content shown in
  catalog search, storefront pages, offers, quotes, bookings, and snapshots
- room or unit options needed for resale, including occupancy, board basis,
  rate plan, cancellation policy, and supplier reference data
- accommodation components inside products, packages, FIT itineraries, DMC
  programs, pre/post cruise extensions, and custom trip composition
- traveler rooming lists, shared-room grouping, bed preference, room assignment,
  and accommodation-related booking requirements
- supplier, channel, external-reference, distribution, finance, checkout, and
  document flows that support reselling accommodation

These surfaces must be framed as resale, sourced inventory, or trip-component
capabilities for OTAs, tour operators, and DMCs.

## Out Of Scope

Voyant should not expose a first-party hotel-operations product surface.

Out-of-scope surfaces include:

- a hotel staff workspace for managing a property's own rooms and operations
- PMS-style property, room-unit, rate-grid, and operational inventory management
  as a first-party module scenario
- housekeeping tasks, room maintenance blocks, room-unit status events, stay
  operations, folios, room moves, and in-stay service posting as starter
  template workflows
- documentation that positions hotels, resorts, property managers, or lodging
  operators as a first-party Voyant implementation scenario
- starter app dependencies, API mounts, route trees, registry blocks, or admin
  navigation that imply a hotel logs into Voyant to run its own property

Historical migrations may retain old object names. Active runtime wiring,
starter UX, generated registries, and positioning docs should not present those
surfaces as part of the current first-party scope.

## Module Framing

The retained module families should be described relative to the three target
implementation scenarios:

- `products`, `availability`, `bookings`, `finance`, `pricing`, `legal`,
  `checkout`, `storefront`, `crm`, and related packages are core OTA,
  tour-operator, and DMC capabilities.
- `charters` and `cruises` are optional inventory and operations capabilities
  for those scenarios. They may represent sourced supplier inventory or
  small-scale/specialized operations owned by a tour operator or DMC.
- `flights` is a supplier-integration and sourced-inventory surface. Voyant is
  not an airline or flight-operator system.
- `facilities` and `ground` support DMC and tour-operator operations:
  attractions, hubs, restaurants, airports, meeting points, vehicles, drivers,
  pickup points, dispatch, and transfers.
- `distribution`, `suppliers`, and `external-refs` are cross-cutting support for
  channels, supplier relationships, and external-system mappings. They are not
  implementation scenarios by themselves.
- accommodation belongs in catalog, product composition, booking journey,
  storefront, supplier, and external-source contracts unless a future product
  decision approves a narrower first-party accommodation module.

## Naming Guidance

Use accommodation terms when the surface is about resale or trip composition:

- accommodation
- lodging
- hotel content
- room option
- board basis
- rate plan
- stay component
- accommodation booking line
- sourced accommodation

Use hotel-operations terms only for legacy or explicitly out-of-scope material:

- housekeeping
- room-unit status
- room maintenance block
- stay operation
- folio
- PMS
- property operations

Avoid using `hospitality` as a first-party module family name in new active
surfaces. If a reusable accommodation resale contract survives the de-scoping
work, prefer a narrower name that reflects resale or catalog composition rather
than hotel operations.

## Migration And Generated Artifact Policy

Removing or narrowing the existing hospitality surfaces needs to preserve the
line between history and active product surface:

- historical migrations remain as audit history unless the template's migration
  strategy is intentionally reset
- new forward migrations should drop or archive hotel-ops tables and enums from
  active starter schemas when those runtime surfaces are removed
- generated schema docs and registry JSON must be regenerated after active
  schema or registry inputs change
- mechanical checks should block hotel-ops package references from re-entering
  starter templates and generated registries, while allowing legitimate
  accommodation resale vocabulary in catalog, booking, storefront, supplier, and
  migration-history contexts

## Implementation Sequence

1. Classify existing `hospitality*` code into accommodation-resale contracts
   versus hotel-operations surfaces.
2. Move or preserve resale contracts under catalog, products, bookings,
   storefront, supplier integration, or a narrowly named accommodation resale
   surface.
3. Remove hotel-operations routes, admin screens, registry blocks, starter
   dependencies, and module mounts from first-party templates.
4. Regenerate schema and registry artifacts.
5. Add a scoped checker that prevents active starter/runtime references to
   hotel-operations surfaces while allowing resale vocabulary and historical
   migrations.

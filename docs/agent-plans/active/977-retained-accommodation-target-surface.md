# Issue 977 - Retained Accommodation Target Surface

Status: active
Parent plan: `docs/agent-plans/active/977-accommodation-resale-boundary.md`

This defines where the retained accommodation resale contracts should live
after the `hospitality*` package family is split. The goal is to preserve hotel
and lodging resale for OTAs, tour operators, and DMCs without exposing a hotel
operations product surface.

## Decision

Create a narrow accommodation resale surface for retained contracts. Use
`accommodations` as the active package and route family name.

Target package family:

- `@voyantjs/accommodations`
- `@voyantjs/accommodations-react`, only if retained client hooks are still
  needed after route split
- no first-party `@voyantjs/accommodations-ui` package until there is a
  non-admin resale UI need

Target route family:

- `/v1/accommodations`
- `/v1/admin/accommodations/:id/content`
- `/v1/public/accommodations/:id/content`

Migration stance:

- Do not add `/hospitality` compatibility aliases by default.
- Production does not depend on the current hospitality surface, so runtime
  references can be removed or repointed directly.
- Historical migrations and generated artifacts may still contain
  `entity_module = "hospitality"` until the relevant source change regenerates
  or replaces them.
- New source code, package names, route names, docs, and registry entries should
  use `accommodations`.

## Target Surface By Concern

### Catalog And Content

Owner: `@voyantjs/accommodations`

Move or recreate these retained contracts:

- content aggregate currently in `packages/hospitality/src/content-shape.ts`
- sourced-content cache currently in
  `packages/hospitality/src/schema-sourced-content.ts`
- content service currently in `packages/hospitality/src/service-content.ts`
- content synthesizer currently in
  `packages/hospitality/src/service-content-synthesizer.ts`
- field policy currently in `packages/hospitality/src/catalog-policy.ts`
- catalog-plane projection currently in
  `packages/hospitality/src/service-catalog-plane.ts`

Rename public types from `Hospitality*` to `Accommodation*` where feasible.
Payload vocabulary may still use `hotel` for the lodging property summary
because hotel content is legitimate resale inventory. The package and route
surface should make clear that this is sourced/resold accommodation.

### Booking Journey

Owner: `@voyantjs/accommodations`, with stable integration points in
`@voyantjs/catalog/booking-engine` and `@voyantjs/bookings`.

Move or recreate:

- draft-shape projection currently in `packages/hospitality/src/draft-shape.ts`
- owned booking handler currently in
  `packages/hospitality/src/booking-engine/*`
- stay booking orchestration currently in
  `packages/hospitality/src/service-bookings.ts`, after removing dependency on
  hotel-ops inventory-grid semantics
- booking extension schema for accommodation booking lines and daily rates,
  currently part of `packages/hospitality/src/schema-bookings.ts`

Retained booking facts:

- property/accommodation reference
- room option reference
- rate plan reference
- optional board/meal plan reference
- check-in/check-out dates
- occupancy
- room count
- supplier confirmation/voucher/reference fields
- daily sell/cost/tax/fee/commission facts needed for booking snapshots and
  finance

Do not retain:

- check-in/check-out operations as a staff workflow
- room moves
- service posts
- folios
- housekeeping or maintenance tasks

### Pricing And Payment Policy

Owner: `@voyantjs/accommodations` for accommodation-specific rate-plan policy;
`@voyantjs/pricing` and `@voyantjs/finance` remain the cross-cutting engines.

Move or recreate:

- rate plan / room option payment-policy lookup currently read from
  `ratePlans.customerPaymentPolicy`
- rate-plan shape required by the storefront and booking journey
- room-type rate shape only if it remains a resale quote input

Do not retain first-party daily room inventory grids or property-admin
stop-sell override CRUD. Supplier-sourced availability and allotments should be
modeled as sourced availability/adapter state or booking-engine hold state, not
as hotel staff inventory management.

### Storefront And Public Detail Pages

Owner: operator template/storefront code, consuming
`@voyantjs/accommodations/content-shape`.

Keep the current customer-facing behavior:

- detail page renders lodging content
- room option selection
- rate plan selection
- dates and occupancy
- quote/book flow through the catalog booking engine

Move imports and URLs from hospitality to accommodations:

- content type imports
- public content endpoint URL
- catalog entity module labels
- booking journey selection keys only where they name the package/vertical

Do not keep historical URL aliases unless a concrete migration blocker appears.

### Admin And Registry UI

Owner: no retained first-party package for now.

Remove first-party registry exposure for:

- room type admin CRUD tabs/dialogs
- room unit management
- room inventory grids
- rate-plan admin CRUD
- rate-plan inventory overrides
- room blocks
- maintenance blocks
- housekeeping tasks
- stay operations
- folios

If the product later needs OTA/DMC accommodation merchandising UI, it should be
designed under catalog/products/storefront workflows and should not manage a
hotel's own rooms or in-stay operations.

## Current Consumers And Target Mapping

### Retain And Repoint

- `templates/operator/src/api/catalog-content.ts`
  - Current: inline `/v1/{admin,public}/hospitality/:id/content`
  - Target: `/v1/{admin,public}/accommodations/:id/content`, backed by
    `getAccommodationContent`

- `templates/operator/src/api/lib/booking-engine-runtime.ts`
  - Current: imports `hospitalityBookingsService`,
    `createHospitalityBookingHandler`, and `getHospitalityContent`
  - Target: import accommodation booking service, booking handler, and content
    service from `@voyantjs/accommodations`.

- `templates/operator/src/api/lib/catalog-runtime.ts`
  - Current: `hospitalityCatalogPolicy`, `hospitality` slices
  - Target: `accommodationCatalogPolicy`, `accommodations` slices.

- `templates/operator/scripts/reindex.ts`
  - Current: indexes `roomTypes` as vertical `hospitality`
  - Target: indexes accommodation entries as `accommodations`.

- `templates/operator/scripts/sync-sources.ts`
  - Current: policy registry includes `hospitality`
  - Target: source adapters emit `accommodations` projections.

- `templates/operator/src/routes/(storefront)/shop_.products.$entityModule.$entityId.tsx`
  - Current: renders `HospitalityContent` through `/v1/public/hospitality`
  - Target: `AccommodationContent` through `/v1/public/accommodations`.

- `templates/operator/src/routes/(storefront)/shop_.book.$entityModule.$entityId.tsx`
  - Current: summary fetches `/v1/public/hospitality`
  - Target: `/v1/public/accommodations`, preserving hotel/lodging summary.

- `templates/operator/src/api/booking-schedule.ts`
  - Current: reads `stayBookingItems` and `ratePlans` from hospitality schema
    for accommodation-specific payment policy.
  - Target: reads the retained accommodation booking-line and rate-plan tables
    from `@voyantjs/accommodations/schema`.

- `templates/dmc/src/api/mcp.ts`
  - Current: resolves `hospitality` via `getResolvedRoomTypeById`
  - Target: resolves `accommodations` via the accommodation catalog-plane
    resolver.

### Remove Or Quarantine

- `apps/dev/src/components/voyant/hospitality/**`
  - Current: removed in this slice. The dev app no longer ships the
    hotel/property admin workspace route or source.

- `apps/dev/src/components/voyant/properties/property-detail-page.tsx`
  - Current: hotel-ops setup/inventory/stays/tasks tabs removed. Property
    detail keeps property metadata and editing only.

- `apps/dev/src/api/app.ts` and `apps/dev/src/api/api-types.ts`
  - Current: `/v1/hospitality` CRUD route mount removed. Add accommodation
    resale routes only after replacement package exists.

- `templates/dmc/src/api/app.ts` and `templates/dmc/src/api/api-types.ts`
  - Current: `/v1/hospitality` CRUD route mount removed. DMC keeps
    accommodation resale via catalog, booking, supplier, and storefront flows.

- `packages/ui/registry/hospitality/**`
  - Current: registry wrappers for hotel-ops tabs/dialogs and a few reusable
    comboboxes.
  - Target: removed in this slice. Rebuild any future resale UI under
    catalog/product/storefront-owned registry paths.

- `packages/ui/registry.json`, `packages/ui/public/r/**`,
  `apps/registry/public/r/**`
  - Generated artifacts. Removed matching `voyant-hospitality-*` entries after
    deleting hospitality registry sources.

### Historical Or Generated Only

- `templates/*/migrations/**`
- `SCHEMA.md`
- `pnpm-lock.yaml`

Do not edit these first. Migrations remain historical until a dedicated schema
migration/reset decision. Generated docs and lockfile update only after source
changes.

## Package Shape

Initial `@voyantjs/accommodations` exports should be narrow:

- `.`
  - module metadata only if needed
  - retained booking service APIs
- `./schema`
  - accommodation sourced content
  - accommodation booking lines / daily rates
  - retained room option / rate plan / board basis shapes
- `./content-shape`
- `./service-content`
- `./service-content-synthesizer`
- `./catalog-policy`
- `./service-catalog-plane`
- `./draft-shape`
- `./booking-engine`
- optionally `./routes-content`

Avoid exporting generic CRUD `./routes`, `./validation`, or a full Hono module
until a retained resale route surface is intentionally designed.

## Sequencing Implications

1. Remove registry/admin exposure first. It is the clearest hotel-ops product
   surface and does not block accommodation resale.
2. Add `@voyantjs/accommodations` and move retained content/catalog/booking
   contracts.
3. Repoint operator storefront/catalog/booking consumers to the new package,
   without keeping hospitality compatibility aliases.
4. Remove `/v1/hospitality` starter mounts from dev and DMC.
5. Split or migrate schema after routes and consumers no longer require the
   mixed package.
6. Regenerate registry and schema artifacts after source removal/move.

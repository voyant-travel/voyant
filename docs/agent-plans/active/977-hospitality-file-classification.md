# Issue 977 - Hospitality File Classification

Status: active
Parent plan: `docs/agent-plans/active/977-accommodation-resale-boundary.md`

This classifies `packages/hospitality`, `packages/hospitality-react`, and
`packages/hospitality-ui` for the accommodation resale boundary.

Legend:

- Retain: accommodation resale, sourced inventory, catalog, storefront, booking,
  product composition, supplier, or external-source contract.
- Remove: hotel/property operations surface that should not remain in
  first-party runtime, starter UX, registry, or public package positioning.
- Split: mixed file. Preserve the resale contract, but remove or move the
  hotel-operations portions before deleting the old package family.

## Package Summary

`packages/hospitality` is mixed. The content, catalog-plane, sourced-content,
draft-shape, and stay-booking-line contracts are resale-oriented. The CRUD
routes and service layer expose property-operated rooms, room units, inventory
grids, housekeeping, maintenance, in-stay operations, service posts, and folios.

`packages/hospitality-react` is mostly first-party admin API hooks. Keep only
query/client pieces needed by a future accommodation resale surface, and only
after renaming/re-homing away from `hospitality`.

`packages/hospitality-ui` is primarily hotel/property operations UI. The only
candidate resale UI is the catalog card and some option comboboxes, but they
should be moved to catalog/product/storefront-owned surfaces if still needed.

## `packages/hospitality`

### Retain

- `src/booking-engine/index.ts`: resale booking-engine entry point.
- `src/booking-engine/handler.ts`: resale booking-engine handler; verify it
  does not depend on active hotel-ops CRUD before re-homing.
- `src/catalog-policy.ts`: room-type catalog field policy for sourced lodging.
- `src/content-shape.ts`: sourced accommodation content aggregate.
- `src/draft-shape.ts`: booking draft projection for dates, occupancy, rooms,
  rate plans, and meal-plan-style add-ons.
- `src/schema-sourced-content.ts`: sourced accommodation content cache.
- `src/service-catalog-plane.ts`: projects room-type rows into catalog-plane
  entries; revise wording from owned hotel/operator provenance during re-home.
- `src/service-content.ts`: sourced-content read/refresh service.
- `src/service-content-synthesizer.ts`: sourced-content fallback synthesizer.
- `tests/unit/catalog-policy.test.ts`: resale catalog policy coverage.
- `tests/unit/content-shape.test.ts`: resale content-shape coverage.
- `tests/unit/draft-shape.test.ts`: resale booking draft coverage.
- `tests/unit/service-catalog-plane.test.ts`: resale catalog-plane coverage.
- `tests/unit/service-content-synthesizer.test.ts`: resale sourced-content
  coverage.

### Split

- `package.json`: keep only exports/dependencies for retained resale contracts;
  remove route, CRUD service, schema, and validation exports from any replacement
  public package.
- `README.md`: already marked legacy; eventually replace with deprecation or
  migration note after retained contracts move.
- `src/index.ts`: currently exports retained contracts and hotel-ops schema,
  routes, validation, and service APIs.
- `src/schema.ts`: barrel exports retained and hotel-ops schema together.
- `src/schema-shared.ts`: keep resale enums for inventory mode, charge
  frequency, guarantee mode, and booking status; remove housekeeping,
  maintenance, stay-operation, checkpoint, service-post, and folio enums.
- `src/schema-inventory.ts`: keep room type, bed config, meal/board plan, rate
  plan, and rate-plan-to-room-type concepts as accommodation resale option
  shapes; remove physical `roomUnits` as a managed property asset. Future room
  assignment should use booking/supplier references instead of a hotel-managed
  room-unit table.
- `src/schema-pricing.ts`: keep stay rules and room-type rates if represented as
  supplier/commercial resale constraints; remove first-party inventory-grid
  management and stop-sell override CRUD unless reworked as sourced availability
  or allotment import state.
- `src/schema-bookings.ts`: keep `stayBookingItems` and `stayDailyRates` as
  accommodation booking-line/snapshot facts; split or replace `roomBlocks` if
  tour-operator allotments remain needed; remove `roomUnitStatusEvents`,
  `maintenanceBlocks`, and `housekeepingTasks`.
- `src/schema-relations.ts`: regenerate after schema split. Keep relations among
  retained room/rate/booking entities only.
- `src/validation-accommodation.ts`: keep room type, bed config, meal/board
  plan, rate plan, rate-plan-room-type, and room-type-rate validation; remove
  room-unit validation.
- `src/validation-operations.ts`: keep stay-rule, stay-booking-item, and
  stay-daily-rate validation if retained; remove inventory-grid,
  maintenance, housekeeping, stay-operation, checkpoint, service-post, and folio
  validation.
- `src/validation-shared.ts`: split with `schema-shared.ts`.
- `src/validation.ts`: regenerate as retained validation barrel only.
- `src/routes-accommodation.ts`: currently exposes first-party CRUD for
  accommodation master data and room units. Preserve only read/booking-facing
  endpoints if a replacement surface needs them; remove hotel/operator admin
  management routes.
- `src/routes-stays.ts`: keep booking-line/stay-rule/daily-rate routes only if
  they are still needed by booking workflows; remove stay operations,
  checkpoints, service posts, and folio routes.
- `src/routes.ts`: split route mount so first-party starters no longer expose
  hotel-ops routes.
- `src/routes-shared.ts`: keep only if retained routes survive.
- `src/service.ts`: monolithic CRUD and reservation service. Extract retained
  booking/resale functions and delete hotel-ops CRUD methods.
- `src/service-bookings.ts`: keep stay booking orchestration intent, but remove
  dependency on `reserveStay` inventory-grid semantics if availability moves to
  catalog/booking adapters.
- `src/pricing-ref.ts`: keep only if retained room-rate resolution still reads
  local pricing schedules.
- `tests/integration/atomic-stay-reserve.test.ts`: split; reservation semantics
  may stay, inventory-grid mutation should not.
- `tests/integration/multi-night-mixed-room.test.ts`: split around retained
  booking-line/reservation behavior.
- `tests/integration/rate-resolver.test.ts`: likely retain if rate resolution
  remains a resale contract.
- `tests/integration/rate-resolver-schedules.test.ts`: likely retain if price
  schedule integration remains.
- `tests/integration/routes.test.ts`: split; it covers both retained booking
  routes and hotel-ops CRUD.
- `tests/integration/serialized-stay-reserve.test.ts`: split; serialized
  physical rooms are hotel-ops unless represented as supplier-assigned room refs.

### Remove

- `src/routes-inventory.ts`: first-party room inventory, blocks, room-unit
  status, maintenance, and housekeeping CRUD.
- `src/routes-operations.ts`: aggregates hotel-ops route surfaces.
- `src/schema-operations.ts`: stay operations, checkpoints, service posts, and
  folios are PMS/in-stay operations.
- `CHANGELOG.md`, `tsconfig.json`, `vitest.config.ts`: package support files;
  remove when the old package is deleted, or keep only while transitional tests
  still run.

## `packages/hospitality-react`

### Split

- `package.json`: remove `@voyantjs/hospitality` public family positioning;
  retain dependencies only for a renamed accommodation resale client if needed.
- `src/client.ts`: generic fetch/validation client; keep only if reused by a
  renamed accommodation resale client package.
- `src/index.ts`: barrel mixes retained and hotel-ops hooks.
- `src/provider.tsx`: package provider is reusable only if the client family
  survives under a new name.
- `src/query-keys.ts`: mixed key registry; split into retained and removed keys.
- `src/query-options.ts`: mixed query options; split by endpoint.
- `src/schemas.ts`: keep room type, bed/board/rate plan, stay booking item, and
  daily-rate records; remove room-unit, inventory-grid, maintenance,
  housekeeping, stay-operation, service-post, and folio records.
- `src/hooks/index.ts`: barrel mixes retained and hotel-ops hooks.
- `src/hooks/use-meal-plan.ts`
- `src/hooks/use-meal-plan-mutation.ts`
- `src/hooks/use-meal-plans.ts`
- `src/hooks/use-rate-plan.ts`
- `src/hooks/use-rate-plan-mutation.ts`
- `src/hooks/use-rate-plan-room-type-mutation.ts`
- `src/hooks/use-rate-plan-room-types.ts`
- `src/hooks/use-rate-plans.ts`
- `src/hooks/use-room-type.ts`
- `src/hooks/use-room-type-mutation.ts`
- `src/hooks/use-room-type-rate-mutation.ts`
- `src/hooks/use-room-type-rates.ts`
- `src/hooks/use-room-types.ts`
- `src/hooks/use-stay-booking-item-mutation.ts`
- `src/hooks/use-stay-booking-items.ts`
- `src/hooks/use-stay-rule-mutation.ts`
- `src/hooks/use-stay-rules.ts`

The hook files above are only retained if their replacement endpoints are
resale-facing and no longer expose hotel/property operator admin workflows.

### Remove

- `CHANGELOG.md`, `tsconfig.json`: package support files; remove when the old
  package is deleted.
- `src/hooks/use-housekeeping-task-mutation.ts`
- `src/hooks/use-housekeeping-tasks.ts`
- `src/hooks/use-maintenance-block-mutation.ts`
- `src/hooks/use-maintenance-blocks.ts`
- `src/hooks/use-rate-plan-inventory-override-mutation.ts`
- `src/hooks/use-rate-plan-inventory-overrides.ts`
- `src/hooks/use-room-block-mutation.ts`
- `src/hooks/use-room-blocks.ts`
- `src/hooks/use-room-inventory-mutation.ts`
- `src/hooks/use-room-inventory.ts`
- `src/hooks/use-room-unit-mutation.ts`
- `src/hooks/use-room-unit.ts`
- `src/hooks/use-room-units.ts`
- `src/hooks/use-stay-folio-mutation.ts`
- `src/hooks/use-stay-folios.ts`
- `src/hooks/use-stay-operation-mutation.ts`
- `src/hooks/use-stay-operations.ts`

## `packages/hospitality-ui`

### Split

- `package.json`: remove public first-party hospitality UI package positioning;
  re-home any retained components under catalog/products/storefront/booking.
- `README.md`: already marks the package as transitional; replace once removal
  or re-home is complete.
- `src/index.ts`: barrel mostly exports hotel-ops UI; keep only re-homed resale
  components.
- `src/components/cancellation-policy-combobox.tsx`: potentially reusable for
  resale rate plan selection; re-home if needed.
- `src/components/hotel-catalog-card.tsx`: candidate catalog/storefront resale
  UI; rename/framing should make sourced accommodation clear.
- `src/components/meal-plan-combobox.tsx`: keep only as board-basis selection
  UI for resale.
- `src/components/pagination-footer.tsx`: generic UI; re-home only if needed.
- `src/components/price-catalog-combobox.tsx`: generic pricing selector; re-home
  only if needed.
- `src/components/rate-plan-combobox.tsx`: keep only as resale rate-plan
  selection UI.
- `src/components/room-type-combobox.tsx`: keep only as resale room-option
  selection UI.
- `src/i18n/index.ts`, `src/i18n/en.ts`, `src/i18n/ro.ts`,
  `src/i18n/messages.ts`, `src/i18n/provider.tsx`: mixed message catalog;
  retain only messages for re-homed resale components.
- `src/i18n.test.tsx`: update after message split.
- `src/styles.css`: retain only if re-homed components need package-local styles.

### Remove

- `CHANGELOG.md`, `tsconfig.json`, `tsconfig.build.json`: package support files;
  remove when the old package is deleted.
- `src/components/maintenance-block-dialog.tsx`
- `src/components/maintenance-blocks-tab.tsx`
- `src/components/meal-plan-dialog.tsx`
- `src/components/meal-plans-tab.tsx`
- `src/components/rate-plan-dialog.tsx`
- `src/components/rate-plans-tab.tsx`
- `src/components/room-block-dialog.tsx`
- `src/components/room-blocks-tab.tsx`
- `src/components/room-inventory-dialog.tsx`
- `src/components/room-inventory-tab.tsx`
- `src/components/room-type-dialog.tsx`
- `src/components/room-types-tab.tsx`
- `src/components/room-unit-combobox.tsx`
- `src/components/room-unit-dialog.tsx`
- `src/components/room-units-tab.tsx`
- `src/components/stay-rule-dialog.tsx`
- `src/components/stay-rules-tab.tsx`

These are admin CRUD tabs/dialogs for a property-operated accommodation system.
The room/rate/meal-plan concepts can remain in resale contracts, but these
first-party management screens should not.

## Next Slice Implications

1. Start removal with `packages/hospitality-ui` registry exposure. Most UI is
   out of scope, and retaining catalog/storefront resale does not depend on
   these admin tabs.
2. Do not remove `packages/hospitality/src/content-shape.ts`,
   `schema-sourced-content.ts`, `service-content.ts`, `draft-shape.ts`,
   `booking-engine/*`, or catalog-plane files until their replacement home is
   decided.
3. Treat room units, room inventory, room blocks, and stay rules carefully:
   room assignment, supplier allotments, and stay restrictions can be legitimate
   resale needs, but the current implementation exposes them as property/admin
   operations.
4. Any future public package should avoid the `hospitality` family name.

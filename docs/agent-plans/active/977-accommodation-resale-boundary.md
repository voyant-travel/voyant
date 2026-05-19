# Issue 977 - Accommodation Resale Boundary Plan

Status: active
Issue: https://github.com/voyantjs/voyant/issues/977

## Product Decision

Voyant targets OTAs, tour operators, and DMCs.

Accommodation remains in scope as catalog inventory for resale, packaging, FIT
composition, storefront, booking, supplier, and external-source workflows.

Hotel/property operations are out of scope as a first-party implementation
scenario. Voyant should not position itself as a PMS or as a system a hotel logs
into to manage its own rooms, housekeeping, maintenance, folios, or in-stay
operations.

The architecture rule is now documented in
`docs/architecture/accommodation-resale-boundary.md`.

## Current State

The existing `hospitality*` package family mixes both concerns:

- accommodation resale contracts: content, room options, board/rate choices,
  stay booking lines, catalog policy, booking snapshots
- hotel-operations surfaces: room units, room inventory grids, maintenance
  blocks, housekeeping, stay operations, folios, and related admin UI

Do not delete the package family blindly. First split retained accommodation
resale contracts from hotel-operations surfaces.

## Keep

- accommodation content and catalog projections for sourced lodging inventory
- room option, board basis, rate plan, cancellation policy, and occupancy shapes
  needed to sell accommodation through OTAs, tour operators, and DMCs
- accommodation booking-line and snapshot shapes
- storefront/catalog detail pages for sourced or composed accommodation
- product/trip composition support for accommodation components
- booking rooming-list, shared-room, bed preference, and room assignment support
- supplier, external-ref, distribution, checkout, finance, and document support
  for accommodation resale

## Remove Or Quarantine

- hotel/property operator positioning
- starter dependencies and route mounts that expose hotel operations as a
  first-party workspace
- registry blocks for hotel operations: room-unit management, room inventory,
  maintenance blocks, housekeeping, stay operations, folios, room service posts
- package READMEs or docs that instruct new users to install hospitality as a
  normal first-party module
- generated registry/schema artifacts after active source removal

## Implementation Slices

1. Classify `packages/hospitality`, `packages/hospitality-react`, and
   `packages/hospitality-ui` file-by-file into retained resale contracts versus
   hotel-operations surfaces. Completed in
   `docs/agent-plans/active/977-hospitality-file-classification.md`.
2. Define the retained target surface. Completed in
   `docs/agent-plans/active/977-retained-accommodation-target-surface.md`.
   The target is a narrow `accommodations` resale surface. Do not add
   hospitality compatibility aliases by default; production does not depend on
   the current hospitality surface.
3. Remove hotel-operations UI registry entries first. Completed by deleting the
   `voyant-hospitality-*` registry source blocks and generated registry entries.
4. Update starter runtime wiring only after replacement accommodation resale
   routes/contracts are in place.
5. Regenerate `packages/ui/public/r`, `apps/registry/public/r`, route trees,
   and `SCHEMA.md` after source changes.
6. Add a scoped checker after removal. It should block active starter/runtime
   references to hotel-operations surfaces while allowing:
   - accommodation resale vocabulary
   - catalog/storefront/booking resale contracts
   - historical migrations
   - legacy notes that explicitly mark the surface as out of scope

## Verification Plan

- `git diff --check` after each docs/code slice
- package-scoped typechecks for any touched package family
- template typechecks for any touched starter:
  - `pnpm --filter operator typecheck`
  - `pnpm --filter dmc typecheck`
- registry/schema regeneration checks when UI/schema inputs change:
  - `pnpm registry:build`
  - `pnpm generate:schema-docs`
- final confidence:
  - `pnpm verify:fast`

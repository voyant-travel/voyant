# Issue 977 - Accommodation Resale Boundary Plan

> Note (2026-06): `templates/dmc`, `apps/dev`, and the shadcn registry (`apps/registry` + `packages/ui/registry`) have since been deleted per the packaged-admin RFC (§5); path references to them below are historical.

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
4. Remove active first-party starter/runtime exposure for hotel operations.
   Completed for dev and DMC by removing `/v1/hospitality` Hono mounts,
   deleting the dev hospitality workspace route/source, and stripping
   hotel-operations tabs from dev property detail.
5. Regenerate `packages/ui/public/r`, `apps/registry/public/r`, route trees,
   and `SCHEMA.md` after source changes. Route tree cleanup is complete for
   the removed dev hospitality workspace route.
6. Add a scoped checker after removal. Completed in
   `scripts/check-accommodation-resale-boundary.mjs`. It blocks active
   starter/runtime references to hotel-operations surfaces while allowing:
   - accommodation resale vocabulary
   - catalog/storefront/booking resale contracts
   - historical migrations
   - legacy notes that explicitly mark the surface as out of scope
7. Remove package documentation that instructs users to adopt hospitality as a
   normal first-party module. Completed for the `hospitality`,
   `hospitality-react`, and `hospitality-ui` READMEs; the checker now blocks
   new install or mount examples for the legacy package docs.
8. Add the retained accommodation resale package and repoint active resale
   consumers. Completed initial `@voyantjs/accommodations` package for content,
   catalog policy/projection, draft shape, content routes, and the booking
   engine descriptor. Operator and DMC resale consumers now use
   `accommodations` routes/imports instead of `hospitality`; the old
   stay-booking commit bridge was intentionally not carried forward.
9. Repoint shared catalog examples and permission surfaces from hospitality to
   accommodations. Completed for catalog UI tabs/messages, catalog MCP examples,
   booking journey summary typing, catalog booking-engine comments/tests,
   service API-key descriptors, and active catalog architecture docs. The
   boundary checker now covers these shared surfaces.
10. Repoint active schema wiring from hospitality to accommodations. Completed
    for dev, DMC, and operator drizzle configs plus `generate-schema-docs`.
    `SCHEMA.md` now documents the retained accommodation resale tables instead
    of the old hotel-operations tables, and the boundary checker blocks the
    legacy schema wiring from returning.
11. Repoint remaining active non-legacy wording from hospitality to
    accommodations. Completed for dev property copy, products/extras/charters
    comments, booking travel-detail comments, legal contract variable
    descriptors, payments architecture, and cruise pricing notes. The boundary
    checker now covers those files too.
12. Remove the legacy hospitality package family. Completed for
    `packages/hospitality`, `packages/hospitality-react`, and
    `packages/hospitality-ui` after retained resale contracts moved to
    `@voyantjs/accommodations`; the lockfile was refreshed and the boundary
    checker now treats those package paths as forbidden.

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

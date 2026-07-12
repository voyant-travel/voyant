# Route Ownership Inventory — `starters/operator/src/api`

Status: living document (baseline 2026-06-15)

This is the Phase 0 inventory called for by
[API Route Ownership And Runtime Composition](./api-route-ownership-and-composition.md).
It classifies every route-bearing file under `starters/operator/src/api` so each
carries an ownership decision, and it is the human-readable companion to the
machine baseline in `scripts/route-ownership-baseline.json` enforced by
`pnpm verify:route-ownership` (`scripts/check-route-ownership.mjs`).

Buckets:

- **package-owned-reusable** — a package factory already exists; only the manual
  mount needs to move into composition.
- **package-owned-manual** — a package owns or should own this; currently
  hand-mounted in the starter.
- **mixed** — a reusable contract wrapped in operator-specific enrichment that
  must be split before extraction.
- **deployment-owned** — genuinely local; should stay, but be wrapped as a
  deployment-local module/extension in the registry.
- **diagnostic** — health checks, one-off/migration, or operational probes.

The `/v1/` route counts below are authoritative as produced by the checker's
regex (single/double/backtick quotes, multi-line calls). As route families move
into packages (RFC Phases 3–4), lower the matching count in the baseline JSON;
the checker warns when a file drops below its baseline so the baseline stays
honest.

## Inventory

| File | Bucket | `/v1/` routes | Mount | Target owner | Notes |
| --- | --- | --- | --- | --- | --- |
| `action-ledger-health.ts` | diagnostic | 2 | lazy | deployment-local | Synthetic ledger-drift health probe; not product surface. Wrap as deployment-local module (Phase 5). |
| `app.ts` | — | 1 | — | deployment | App bootstrap; owns the single allowed `additionalRoutes` block + `publicPaths`/`dbTransactionalPaths`. |
| `booking-schedule.ts` | package-owned-manual | 2 | eager + lazy | `@voyant-travel/finance` | Payment-schedule regen + public payment-policy resolve. Finance is **already composed** → add as a finance extension. |
| `catalog-booking.ts` | package-owned-manual | 4 | lazy | `@voyant-travel/catalog` | Booking-engine routes via `createCatalogBookingRoutes`; slots/orders/snapshot enrichment stays local until classified. Move once lazy contributions land. |
| `catalog-checkout.ts` | mixed | 1 | lazy | catalog/trips (composite) | Thin adapter to `startCatalogCheckout`; the service (event bus, runtime resolution) is not yet extracted. Explicitly deferred to Phase 4+. |
| `catalog-offers.ts` | mixed | 6 | lazy | `@voyant-travel/catalog` + connect | Connect-sourced offer/search/pricing (`@voyant-travel/connect-sdk`); operator search enrichment (Typesense, geo-resolver) stays as adapters. Split reusable contract from enrichment. |
| `contract-document-routes.ts` | package-owned-manual | 2 | lazy | `@voyant-travel/legal` / document delivery | Contract generation + private document serving. Needs storage + generator adapters. |
| `flights.ts` | package-owned-manual | 11 | lazy | `@voyant-travel/flights` | Package exists but ships **no HonoModule** — `createFlightsHonoModule` is net-new. The proving slice for lazy extraction (Phase 4). Connector integrations remain project-selected. |
| `invitations.ts` | package-owned-reusable | 0 | graph | `@voyant-travel/auth` | Moved with team management into auth-owned graph units; deployment config and notification delivery enter through a typed runtime port. |
| `lazy-additional-routes.ts` | package-owned-manual | 7 | lazy | `@voyant-travel/finance` (checkout) | Public payment-link / checkout-status routes. Finance already receives the checkout options → public route contribution on the existing finance module. |
| `mcp.ts` | deployment-owned | 1 | lazy | deployment / agent tooling | Agent tool dispatch over trips MCP tools. Keep local unless agents become supported framework surface. |
| `media-upload-routes.ts` | mixed | 7 | lazy | storage/media + `@voyant-travel/inventory` | Upload/serve are reusable; product brochure generation is an inventory extension. Needs storage adapter, video ticket signer, public-URL policy. |
| `proposal-routes.ts` | mixed | 4 | lazy | `@voyant-travel/quotes` | Quote-version send + public proposal accept/decline are package-owned; acceptance orchestration (trip reserve, checkout handoff) is deployment-coupled. Split contract from orchestration. |
| `quote-version-snapshot-routes.ts` | package-owned-manual | 1 | — | `@voyant-travel/quotes` | Quote-version snapshot route; belongs with quotes. |
| `settings.ts` | package-owned-manual | 10 | eager | `@voyant-travel/operator-settings` (new) or `@voyant-travel/finance` | Operator profile/payment instructions/defaults — framework infrastructure consumed by legal, checkout, storefront. Promote table + routes together. |

## Final state (migration complete)

Every route family above now composes through `OPERATOR_RUNTIME_MANIFEST` /
`operatorComposition` as a module or extension. `app.ts`'s `additionalRoutes`
contains only the **workflow-runs** admin surface, which is genuinely coupled to
the app-level runner registry that bundle bootstraps populate at construction.

- Package-owned extensions: `channel-push` (distribution), `booking-tax`
  (finance).
- Deployment-local single-surface lazy modules/extensions (relative routes):
  `flights`, `mcp`, `booking-schedule`, `quote-version-snapshot`,
  `action-ledger-health`, `proposal`, `catalog-offers`, `catalog-checkout`,
  `booking-maintenance`.
- Deployment-local multi-prefix lazy modules (`lazyRoutes` — explicit paths over
  the existing absolute-route mount functions): `catalog-booking`,
  `catalog-content`, `media`, `payment-link`, `operator-settings`,
  `contract-document`.

The route-ownership checker baseline is down to the deployment-local route files
that still *define* their routes in the starter (they compose cleanly now rather
than mounting ad-hoc); promoting any of them into shared packages is the natural
follow-up where a second deployment would reuse them.

## How this maps to the migration phases

- **Already composed (no action):** the ~20 modules + 6 extensions in
  `OPERATOR_RUNTIME_MANIFEST` / `operatorComposition`. This inventory only covers
  the `additionalRoutes` stragglers.
- **Phase 3 (mount-only moves) — DONE:** `channel-push` (distribution
  extension), `booking-tax` (finance `createBookingTaxHonoExtension`),
  `booking-schedule` (bookings extension + `payment-policy` public path), and
  `quote-version-snapshot` (trips extension) now compose through the registry;
  `booking-tax-preview.ts` deleted. `catalog-booking.ts` remains (it is lazy —
  deferred until Phase 1 lazy contributions land, so it does not regress Worker
  cold-start by going eager).
- **Phase 4 (extraction):** `flights.ts` (proving slice), `lazy-additional-routes.ts`,
  `proposal-routes.ts`, `media-upload-routes.ts`, `contract-document-routes.ts`,
  `catalog-offers.ts`.
- **Phase 5 (classify local):** `action-ledger-health.ts`,
  `mcp.ts`, `catalog-checkout.ts` (composite), `settings.ts` (decide reusable vs
  local).

When a file is extracted, lower its count in `scripts/route-ownership-baseline.json`
to zero (or delete the entry) and update its row here.

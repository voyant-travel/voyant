---
"@voyant-travel/framework": minor
---

Relocate the 7 lazy `operator/*` standard extension factories into `frameworkComposition.extensions` (Workstream B, Tier 4b — completes Tier 4): booking-schedule, quote-version-snapshot, booking-maintenance, action-ledger-health, proposal, catalog-offers, catalog-checkout.

The framework owns each extension's `{ name, module }` metadata + `publicPath`; the deployment injects the builders/loaders. `FrameworkProviders` gains 8 fields — 2 `() => HonoExtension` builders (`createBookingScheduleExtension`, `createQuoteVersionSnapshotExtension`) and 6 `LazyRoutesLoader`s (`loadBookingMaintenanceRoutes`, `loadActionLedgerHealthRoutes`, `loadProposalAdminRoutes`, `loadProposalPublicRoutes`, `loadCatalogOffersRoutes`, `loadCatalogCheckoutRoutes`).

The deployment's `operatorComposition.extensions` is now just `{ ...frameworkComposition.extensions }`. All standard modules **and** extensions are framework-owned; only `operator/invitations` + `operator/operator-settings` remain as deployment-local module factories (→ `extensions[]` at convergence).

---
"@voyant-travel/framework": minor
---

Relocate the 7 lazy `operator/*` standard module factories into `frameworkComposition.modules` (Workstream B, Tier 4a): flights, mcp, catalog-booking, catalog-content, media, payment-link, contract-document.

The framework now owns each family's manifest entry **and its stable absolute route-path matchers** (the URL contract); the deployment injects only the `load` closure that wires its providers into the package-owned route bundle. `FrameworkProviders` gains 7 `LazyRoutesLoader` fields (`loadFlightAdminRoutes`, `loadMcpAdminRoutes`, `loadCatalogBookingRoutes`, `loadCatalogContentRoutes`, `loadMediaRoutes`, `loadPaymentLinkRoutes`, `loadContractDocumentRoutes`). `OPERATOR_RUNTIME_MANIFEST` is unchanged, preserving exact mount order. Only `operator/invitations` and `operator/operator-settings` remain in the deployment registry.

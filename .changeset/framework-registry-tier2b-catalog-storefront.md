---
"@voyant-travel/framework": minor
---

Relocate the **catalog** and **storefront** module factories into `frameworkComposition` (Workstream B, Tier 2b). `FrameworkProviders` gains:

- `resolveCatalogRuntime` — typed `CatalogSearchRoutesOptions["resolveRuntime"]`. The deployment adapts its `buildCatalogContext` (a Hono-`Context` → catalog runtime mapping) into this shape, so the framework factory consumes the package's runtime contract directly.
- `storefrontIntakePersistence` — the exported `StorefrontIntakePersistence`, built from the deployment's relationships-backed intake runtime.

The framework's storefront factory builds its commerce offer resolvers from the package (`createCommerceStorefrontOfferResolvers`); only the deployment-specific intake persistence + `resolveDb` are injected.

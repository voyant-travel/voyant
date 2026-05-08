---
"@voyantjs/products": minor
---

Part 1 of #493: ship the destinations child-entity catalog registry plus the `projectionExtensions` plumbing the rest of #493 will use.

New surface:

- `productDestinationsCatalogPolicy` (`@voyantjs/products/catalog-policy-destinations`) — `FieldPolicy[]` declaring `regions[]`, `countries[]`, `cities[]`, `destinationSlugs[]`, `destinationIds[]`. Locale-aware label fields (`regions[]`, `countries[]`, `cities[]`) carry `localized: true` and `reindex: "entry-locale"` so per-locale slices reindex independently. Compose with `productCatalogPolicy` via `createFieldPolicyRegistry([...productCatalogPolicy, ...productDestinationsCatalogPolicy])`.
- `createProductDestinationsProjectionExtension` (`@voyantjs/products/service-catalog-plane-destinations`) — runtime extension that joins `product_destinations` → `destinations` → `destination_translations` and contributes the field-keyed projection. Locale comes from the `IndexerSlice`; missing translations fall back to the destination's canonical slug.
- `ProductProjectionExtension` interface + `extensions` parameter on `createProductDocumentBuilder` (`@voyantjs/products/service-catalog-plane`) — generic seam for any child-entity registry to denormalize fields onto the product search doc. Extensions run in parallel after the base row fetch; their projection entries merge into the base before `buildIndexerDocument` filters by registry.
- `createProductsRegistry(...extensionPolicies)` — convenience for composing the base products policy with any number of child-entity policies.

Wired into the operator template (`templates/operator/src/api/lib/catalog-runtime.ts` + `catalog-bridge.ts`): the `products` registry now includes destination paths, and `createProductDocumentBuilder` runs the destinations extension on every product reindex.

Out of scope here, will land as separate PRs under #493:

- Coordinates / geopoints — destinations have no coordinate columns; product geolocation lives on `product_locations` and ships with its own policy in a follow-up.
- Categories + tags + slug (PR2), departures (PR3), priceFrom (PR4) — see the comment on #493 for the full plan.

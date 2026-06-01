---
"@voyantjs/cruises": patch
"@voyantjs/catalog-ui": patch
---

Fix sourced cruises rendering blank in the catalog (#1466).

- `@voyantjs/cruises`: the catalog source-adapter shim (`toCatalogProjection`) now emits the field-policy keys the indexer and catalog UI expect (`cruiseType`, `nights`, `status`, `heroImageUrl`/`thumbnailUrl`, `lowestPriceCached`, `lineSupplierId`/`defaultShipId`, `source.kind`/`source.ref`) instead of unrecognized snake_case keys that were silently dropped — so sourced cruises carry Type/Nights/Status/Supplier/Ship/Price/Source into the index. `CruiseSearchProjectionEntry` gains `lineExternalId`/`shipExternalId` (surfaced by `@voyantjs/connect-cruises` ≥0.3.1). The content route (`GET /:key/content`) and `parseUnifiedKey` now accept the catalog sourced entity-id form (`crus_sr_<base64>`) via the new `isEncodedSourceEntityId` helper, and dispatch sourced ids without the owned-key opt-in — previously they returned `400 invalid_key`, leaving the detail sheet empty.
- `@voyantjs/catalog-ui`: `createCatalogEnrichmentFetchers` routes the detail-content fetch per vertical via `contentBasePathByVertical`, and `CatalogPage` wires `onLoadDetail` on every vertical tab (not just products) so non-product detail sheets (cruises, etc.) actually fetch their enrichment from the correct content route.

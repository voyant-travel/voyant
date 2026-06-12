# @voyantjs/cruises

## 0.116.1

### Patch Changes

- Updated dependencies [b7056f1]
- Updated dependencies [b7056f1]
- Updated dependencies [b7056f1]
- Updated dependencies [b7056f1]
- Updated dependencies [b7056f1]
- Updated dependencies [b7056f1]
  - @voyantjs/bookings@0.117.1
  - @voyantjs/core@0.109.0
  - @voyantjs/db@0.107.0
  - @voyantjs/hono@0.108.0
  - @voyantjs/catalog@0.115.1

## 0.116.0

### Patch Changes

- Updated dependencies [7255353]
- Updated dependencies [7255353]
- Updated dependencies [7255353]
- Updated dependencies [7255353]
- Updated dependencies [7255353]
- Updated dependencies [7255353]
- Updated dependencies [7255353]
  - @voyantjs/bookings@0.117.0
  - @voyantjs/catalog@0.115.0
  - @voyantjs/core@0.108.0
  - @voyantjs/db@0.106.0
  - @voyantjs/hono@0.107.0

## 0.115.0

### Patch Changes

- Updated dependencies [418fa82]
- Updated dependencies [418fa82]
- Updated dependencies [418fa82]
  - @voyantjs/core@0.107.0
  - @voyantjs/db@0.105.0
  - @voyantjs/hono@0.106.0
  - @voyantjs/bookings@0.116.0
  - @voyantjs/catalog@0.114.0

## 0.114.0

### Patch Changes

- @voyantjs/bookings@0.115.0
- @voyantjs/catalog@0.113.0

## 0.113.0

### Patch Changes

- @voyantjs/bookings@0.114.0
- @voyantjs/catalog@0.112.0

## 0.112.0

### Patch Changes

- @voyantjs/bookings@0.113.0
- @voyantjs/catalog@0.111.0

## 0.111.0

### Patch Changes

- @voyantjs/bookings@0.112.0
- @voyantjs/catalog@0.110.0

## 0.110.0

### Patch Changes

- @voyantjs/bookings@0.111.0
- @voyantjs/catalog@0.109.0

## 0.109.0

### Patch Changes

- Updated dependencies [eeb23df]
  - @voyantjs/core@0.106.0
  - @voyantjs/bookings@0.110.0
  - @voyantjs/catalog@0.108.0
  - @voyantjs/db@0.104.4
  - @voyantjs/hono@0.105.3

## 0.108.0

### Patch Changes

- Updated dependencies [344e7b6]
  - @voyantjs/core@0.105.1
  - @voyantjs/bookings@0.109.0
  - @voyantjs/catalog@0.107.0
  - @voyantjs/hono@0.105.2

## 0.107.0

### Patch Changes

- Updated dependencies [7122c2a]
  - @voyantjs/catalog@0.106.0
  - @voyantjs/cruises-contracts@0.105.1
  - @voyantjs/bookings@0.108.0

## 0.106.1

### Patch Changes

- Updated dependencies [656b25d]
  - @voyantjs/hono@0.105.0
  - @voyantjs/bookings@0.107.1
  - @voyantjs/catalog@0.105.1

## 0.106.0

### Patch Changes

- Updated dependencies [c2aef18]
  - @voyantjs/core@0.105.0
  - @voyantjs/catalog@0.105.0
  - @voyantjs/db@0.104.3
  - @voyantjs/bookings@0.107.0
  - @voyantjs/hono@0.104.2

## 0.105.3

### Patch Changes

- @voyantjs/bookings@0.106.0

## 0.105.2

### Patch Changes

- 72d4c0d: Normalize cruise search/catalog from-prices to integer cents, add explicit catalog price-unit metadata for legacy-safe rendering, add departure counts to cruise search rows, and expose `GET /sailings/:key/pricing` for reading sailing pricing directly.
  - @voyantjs/catalog@0.104.5

## 0.105.1

### Patch Changes

- 60e3bb1: Map sourced cruise embark and disembark port facility ids into catalog projections.

## 0.105.0

### Minor Changes

- 921f4fc: Add a canonical board-basis contract enum and reuse it across accommodation meal plans, product options, and cruise sailings.

### Patch Changes

- Updated dependencies [921f4fc]
  - @voyantjs/cruises-contracts@0.105.0
  - @voyantjs/catalog@0.104.4
  - @voyantjs/bookings@0.105.0

## 0.104.2

### Patch Changes

- 23a3dad: Thread rich cruise cabin and ship media through the sourced content contract and catalog detail UI.
- Updated dependencies [23a3dad]
  - @voyantjs/cruises-contracts@0.104.2
  - @voyantjs/catalog@0.104.2

## 0.104.1

### Patch Changes

- @voyantjs/bookings@0.104.1
- @voyantjs/catalog@0.104.1
- @voyantjs/core@0.104.1
- @voyantjs/cruises-contracts@0.104.1
- @voyantjs/db@0.104.1
- @voyantjs/hono@0.104.1

## 0.104.0

### Patch Changes

- @voyantjs/bookings@0.104.0
- @voyantjs/catalog@0.104.0
- @voyantjs/core@0.104.0
- @voyantjs/cruises-contracts@0.104.0
- @voyantjs/db@0.104.0
- @voyantjs/hono@0.104.0

## 0.103.0

### Patch Changes

- @voyantjs/bookings@0.103.0
- @voyantjs/catalog@0.103.0
- @voyantjs/core@0.103.0
- @voyantjs/cruises-contracts@0.103.0
- @voyantjs/db@0.103.0
- @voyantjs/hono@0.103.0

## 0.102.0

### Patch Changes

- @voyantjs/bookings@0.102.0
- @voyantjs/catalog@0.102.0
- @voyantjs/core@0.102.0
- @voyantjs/cruises-contracts@0.102.0
- @voyantjs/db@0.102.0
- @voyantjs/hono@0.102.0

## 0.101.2

### Patch Changes

- @voyantjs/bookings@0.101.2
- @voyantjs/catalog@0.101.2
- @voyantjs/core@0.101.2
- @voyantjs/cruises-contracts@0.101.2
- @voyantjs/db@0.101.2
- @voyantjs/hono@0.101.2

## 0.101.1

### Patch Changes

- 26c6908: Fix sourced cruises rendering blank in the catalog (#1466).

  - `@voyantjs/cruises`: the catalog source-adapter shim (`toCatalogProjection`) now emits the field-policy keys the indexer and catalog UI expect (`cruiseType`, `nights`, `status`, `heroImageUrl`/`thumbnailUrl`, `lowestPriceCached`, `lineSupplierId`/`defaultShipId`, `source.kind`/`source.ref`) instead of unrecognized snake*case keys that were silently dropped — so sourced cruises carry Type/Nights/Status/Supplier/Ship/Price/Source into the index. `CruiseSearchProjectionEntry` gains `lineExternalId`/`shipExternalId` (surfaced by `@voyantjs/connect-cruises` ≥0.3.1). The content route (`GET /:key/content`) and `parseUnifiedKey` now accept the catalog sourced entity-id form (`crus_sr*<base64>`) via the new `isEncodedSourceEntityId`helper, and dispatch sourced ids without the owned-key opt-in — previously they returned`400 invalid_key`, leaving the detail sheet empty. Adds `getCruiseSailingPricing`+ a`GET /:key/sailings/:sailingExternalId/pricing`content route serving live per-cabin pricing for sourced sailings (volatile-live, fetched fresh — never cached). The source-adapter shim now drops a sailing's`lowest_price_cents`/`currency` unless both are present (the content schema requires both-or-neither) so an adapter that surfaces a price without its currency can't fail content validation.
  - `@voyantjs/catalog-ui`: `createCatalogEnrichmentFetchers` routes the detail-content fetch per vertical via `contentBasePathByVertical`, and `CatalogPage` wires `onLoadDetail` on every vertical tab (not just products) so non-product detail sheets (cruises, etc.) actually fetch their enrichment from the correct content route. Adds `loadDeparturePricing` (lazy per-cabin pricing fetched on departure-row expand, matched to cabins by code → per-cabin price + availability). The detail sheet labels the cruise options tab "Cabins", renders the entity id as a compact copyable chip, falls back the Itinerary tab to the first sailing's stops, and sanitizes cabin names + descriptions (strips HTML tags and decodes entities like `&nbsp;`). Cabin cards are redesigned as a photo gallery (new `MediaGallery` — a carousel thumbnail that opens a full-screen lightbox carousel on click) alongside size (sqft), capacity, description, and de-duplicated amenity chips. The Overview drops the canonical-geography id columns (`country_iso`/`region_ids`/`port_ids`/`waterway_ids`) and empty array rows, and adds a media gallery (cruise cover + cabin photos) when imagery is available.
  - `@voyantjs/catalog-ui`: the cruise detail sheet gains a **Ship** tab showing the vessel the cruise sails on — gallery (carousel + lightbox), name/type, key specs (capacity, decks, year built) and description.
  - `@voyantjs/catalog-ui`: for the cruises vertical the detail sheet's **Departures** tab is relabeled **Sailings** (industry term), along with its empty-state and filtered no-results copy — other verticals keep "Departures".
  - `@voyantjs/cruises-contracts`: the cabin-category content shape gains `images` + `square_feet` so cabin photos and size flow end-to-end (the cruise shim maps them from the adapter's `images`/`floorplanImages`/`squareFeet`; the data was previously dropped). The ship content shape gains `ship_type` + `gallery` so the vessel's class and photos reach the Ship tab.

- Updated dependencies [f736ba5]
- Updated dependencies [26c6908]
  - @voyantjs/bookings@0.101.1
  - @voyantjs/catalog@0.101.1
  - @voyantjs/core@0.101.1
  - @voyantjs/cruises-contracts@0.101.1
  - @voyantjs/db@0.101.1
  - @voyantjs/hono@0.101.1

## 0.101.0

### Patch Changes

- @voyantjs/bookings@0.101.0
- @voyantjs/catalog@0.101.0
- @voyantjs/core@0.101.0
- @voyantjs/cruises-contracts@0.101.0
- @voyantjs/db@0.101.0
- @voyantjs/hono@0.101.0

## 0.100.0

### Patch Changes

- @voyantjs/bookings@0.100.0
- @voyantjs/catalog@0.100.0
- @voyantjs/core@0.100.0
- @voyantjs/cruises-contracts@0.100.0
- @voyantjs/db@0.100.0
- @voyantjs/hono@0.100.0

## 0.99.0

### Patch Changes

- Updated dependencies [b7dde79]
  - @voyantjs/bookings@0.99.0
  - @voyantjs/catalog@0.99.0
  - @voyantjs/core@0.99.0
  - @voyantjs/cruises-contracts@0.99.0
  - @voyantjs/db@0.99.0
  - @voyantjs/hono@0.99.0

## 0.98.0

### Patch Changes

- @voyantjs/bookings@0.98.0
- @voyantjs/catalog@0.98.0
- @voyantjs/core@0.98.0
- @voyantjs/cruises-contracts@0.98.0
- @voyantjs/db@0.98.0
- @voyantjs/hono@0.98.0

## 0.97.0

### Patch Changes

- Updated dependencies [2555264]
  - @voyantjs/bookings@0.97.0
  - @voyantjs/catalog@0.97.0
  - @voyantjs/core@0.97.0
  - @voyantjs/cruises-contracts@0.97.0
  - @voyantjs/db@0.97.0
  - @voyantjs/hono@0.97.0

## 0.96.0

### Minor Changes

- 2d8d59b: Add lightweight catalog and cruises contract packages for external consumers.

  `@voyantjs/catalog-contracts` now owns the pure catalog adapter contracts,
  adapter Zod schemas, field-policy contracts, provenance, drift event payloads,
  and pure content locale/overlay helpers. `@voyantjs/cruises-contracts` now owns
  the `cruises/v1` rich content schema (including the cabin feature, bed,
  accessibility, and view-type facet vocabularies), version, types, and validator.

  The pure content primitives (`isStale`, `pickBestCachedLocale`, the JSON-pointer
  overlay applier, and `mergeOverlaysIntoContent`) now have a single source of
  truth in `@voyantjs/catalog-contracts`; `@voyantjs/catalog`'s content service
  re-exports them and retains only the runtime-bound (Drizzle/Postgres) primitives.
  The cruise cabin facet vocabularies likewise live in `@voyantjs/cruises-contracts`
  and are re-exported from `@voyantjs/cruises`.

  The existing `@voyantjs/catalog` and `@voyantjs/cruises` contract import paths
  remain available through compatibility re-exports.

### Patch Changes

- Updated dependencies [2d8d59b]
  - @voyantjs/bookings@0.96.0
  - @voyantjs/catalog@0.96.0
  - @voyantjs/core@0.96.0
  - @voyantjs/cruises-contracts@0.96.0
  - @voyantjs/db@0.96.0
  - @voyantjs/hono@0.96.0

## 0.95.0

### Minor Changes

- a8d3a3f: Carry canonical cruise geography through cruise models and catalog indexing so sourced and owned cruise documents can facet on regions, waterways, ports, and countries.

### Patch Changes

- Updated dependencies [a8d3a3f]
  - @voyantjs/bookings@0.95.0
  - @voyantjs/catalog@0.95.0
  - @voyantjs/core@0.95.0
  - @voyantjs/db@0.95.0
  - @voyantjs/hono@0.95.0

## 0.94.0

### Minor Changes

- 43c409b: Promote cruise cabin and deck facets into the catalog plane and add structured cabin feature fields for bed configuration, accessibility, and view filtering.

### Patch Changes

- @voyantjs/bookings@0.94.0
- @voyantjs/catalog@0.94.0
- @voyantjs/core@0.94.0
- @voyantjs/db@0.94.0
- @voyantjs/hono@0.94.0

## 0.93.0

### Minor Changes

- 5df6824: Add canonical place references for product destinations and cruise itinerary geography.

### Patch Changes

- @voyantjs/bookings@0.93.0
- @voyantjs/catalog@0.93.0
- @voyantjs/core@0.93.0
- @voyantjs/db@0.93.0
- @voyantjs/hono@0.93.0

## 0.92.0

### Patch Changes

- Updated dependencies [5de3d72]
  - @voyantjs/bookings@0.92.0
  - @voyantjs/catalog@0.92.0
  - @voyantjs/core@0.92.0
  - @voyantjs/db@0.92.0
  - @voyantjs/hono@0.92.0

## 0.91.0

### Minor Changes

- dc8554b: Add cruise voyage group schema, validation, service helpers, and admin routes for combined voyages, grand voyages, world cruises, cruise-tours, and pre/post extensions.

### Patch Changes

- Updated dependencies [dc8554b]
  - @voyantjs/bookings@0.91.0
  - @voyantjs/catalog@0.91.0
  - @voyantjs/core@0.91.0
  - @voyantjs/db@0.91.0
  - @voyantjs/hono@0.91.0

## 0.90.0

### Minor Changes

- 0cdd0ea: Add cruise pricing fields for compare-at prices, fare variants, explicit single pricing, and early-booking metadata.

### Patch Changes

- @voyantjs/bookings@0.90.0
- @voyantjs/catalog@0.90.0
- @voyantjs/core@0.90.0
- @voyantjs/db@0.90.0
- @voyantjs/hono@0.90.0

## 0.89.0

### Patch Changes

- @voyantjs/bookings@0.89.0
- @voyantjs/catalog@0.89.0
- @voyantjs/core@0.89.0
- @voyantjs/db@0.89.0
- @voyantjs/hono@0.89.0

## 0.88.0

### Minor Changes

- 27afa4b: Add provider-agnostic external cruise catalog refresh and reindex helpers.

### Patch Changes

- Updated dependencies [27afa4b]
  - @voyantjs/bookings@0.88.0
  - @voyantjs/catalog@0.88.0
  - @voyantjs/core@0.88.0
  - @voyantjs/db@0.88.0
  - @voyantjs/hono@0.88.0

## 0.87.1

### Patch Changes

- @voyantjs/bookings@0.87.1
- @voyantjs/catalog@0.87.1
- @voyantjs/core@0.87.1
- @voyantjs/db@0.87.1
- @voyantjs/hono@0.87.1

## 0.87.0

### Patch Changes

- Updated dependencies [85505e6]
  - @voyantjs/bookings@0.87.0
  - @voyantjs/catalog@0.87.0
  - @voyantjs/core@0.87.0
  - @voyantjs/db@0.87.0
  - @voyantjs/hono@0.87.0

## 0.86.0

### Patch Changes

- Updated dependencies [ddf4a19]
  - @voyantjs/bookings@0.86.0
  - @voyantjs/catalog@0.86.0
  - @voyantjs/core@0.86.0
  - @voyantjs/db@0.86.0
  - @voyantjs/hono@0.86.0

## 0.85.4

### Patch Changes

- @voyantjs/bookings@0.85.4
- @voyantjs/catalog@0.85.4
- @voyantjs/core@0.85.4
- @voyantjs/db@0.85.4
- @voyantjs/hono@0.85.4

## 0.85.3

### Patch Changes

- 7f0970e: Expose cruise sourced-content sailing price summaries as `lowest_price_cents` integer minor units plus `currency`, and map cruise sailings directly into catalog UI departure prices.
  - @voyantjs/bookings@0.85.3
  - @voyantjs/catalog@0.85.3
  - @voyantjs/core@0.85.3
  - @voyantjs/db@0.85.3
  - @voyantjs/hono@0.85.3

## 0.85.2

### Patch Changes

- Updated dependencies [2aac1f9]
  - @voyantjs/bookings@0.85.2
  - @voyantjs/catalog@0.85.2
  - @voyantjs/core@0.85.2
  - @voyantjs/db@0.85.2
  - @voyantjs/hono@0.85.2

## 0.85.1

### Patch Changes

- 8605177: Document the external cruise adapter contract and export a provider-neutral compatibility fixture for adapter packages.
  - @voyantjs/bookings@0.85.1
  - @voyantjs/catalog@0.85.1
  - @voyantjs/core@0.85.1
  - @voyantjs/db@0.85.1
  - @voyantjs/hono@0.85.1

## 0.85.0

### Minor Changes

- d8ec16f: Align the external cruise adapter contract for Connect-backed inventory by preserving full SourceRef route keys, passenger composition, external pricing terms, and booking snapshots.

### Patch Changes

- @voyantjs/bookings@0.85.0
- @voyantjs/catalog@0.85.0
- @voyantjs/core@0.85.0
- @voyantjs/db@0.85.0
- @voyantjs/hono@0.85.0

## 0.84.4

### Patch Changes

- @voyantjs/bookings@0.84.4
- @voyantjs/catalog@0.84.4
- @voyantjs/core@0.84.4
- @voyantjs/db@0.84.4
- @voyantjs/hono@0.84.4

## 0.84.3

### Patch Changes

- Updated dependencies [9eadf50]
  - @voyantjs/bookings@0.84.3
  - @voyantjs/catalog@0.84.3
  - @voyantjs/core@0.84.3
  - @voyantjs/db@0.84.3
  - @voyantjs/hono@0.84.3

## 0.84.2

### Patch Changes

- @voyantjs/bookings@0.84.2
- @voyantjs/catalog@0.84.2
- @voyantjs/core@0.84.2
- @voyantjs/db@0.84.2
- @voyantjs/hono@0.84.2

## 0.84.1

### Patch Changes

- Updated dependencies [b9ef614]
  - @voyantjs/bookings@0.84.1
  - @voyantjs/catalog@0.84.1
  - @voyantjs/core@0.84.1
  - @voyantjs/db@0.84.1
  - @voyantjs/hono@0.84.1

## 0.84.0

### Patch Changes

- Updated dependencies [4ea42b3]
  - @voyantjs/bookings@0.84.0
  - @voyantjs/catalog@0.84.0
  - @voyantjs/core@0.84.0
  - @voyantjs/db@0.84.0
  - @voyantjs/hono@0.84.0

## 0.83.1

### Patch Changes

- @voyantjs/bookings@0.83.1
- @voyantjs/catalog@0.83.1
- @voyantjs/core@0.83.1
- @voyantjs/db@0.83.1
- @voyantjs/hono@0.83.1

## 0.83.0

### Patch Changes

- @voyantjs/bookings@0.83.0
- @voyantjs/catalog@0.83.0
- @voyantjs/core@0.83.0
- @voyantjs/db@0.83.0
- @voyantjs/hono@0.83.0

## 0.82.1

### Patch Changes

- @voyantjs/bookings@0.82.1
- @voyantjs/catalog@0.82.1
- @voyantjs/core@0.82.1
- @voyantjs/db@0.82.1
- @voyantjs/hono@0.82.1

## 0.82.0

### Patch Changes

- @voyantjs/bookings@0.82.0
- @voyantjs/catalog@0.82.0
- @voyantjs/core@0.82.0
- @voyantjs/db@0.82.0
- @voyantjs/hono@0.82.0

## 0.81.21

### Patch Changes

- Updated dependencies [b9fb5b0]
  - @voyantjs/bookings@0.81.21
  - @voyantjs/catalog@0.81.21
  - @voyantjs/core@0.81.21
  - @voyantjs/db@0.81.21
  - @voyantjs/hono@0.81.21

## 0.81.20

### Patch Changes

- Updated dependencies [e60a50d]
  - @voyantjs/bookings@0.81.20
  - @voyantjs/catalog@0.81.20
  - @voyantjs/core@0.81.20
  - @voyantjs/db@0.81.20
  - @voyantjs/hono@0.81.20

## 0.81.19

### Patch Changes

- Updated dependencies [62e4be5]
  - @voyantjs/bookings@0.81.19
  - @voyantjs/catalog@0.81.19
  - @voyantjs/core@0.81.19
  - @voyantjs/db@0.81.19
  - @voyantjs/hono@0.81.19

## 0.81.18

### Patch Changes

- @voyantjs/bookings@0.81.18
- @voyantjs/catalog@0.81.18
- @voyantjs/core@0.81.18
- @voyantjs/db@0.81.18
- @voyantjs/hono@0.81.18

## 0.81.17

### Patch Changes

- @voyantjs/bookings@0.81.17
- @voyantjs/catalog@0.81.17
- @voyantjs/core@0.81.17
- @voyantjs/db@0.81.17
- @voyantjs/hono@0.81.17

## 0.81.16

### Patch Changes

- Updated dependencies [0a617cc]
  - @voyantjs/bookings@0.81.16
  - @voyantjs/catalog@0.81.16
  - @voyantjs/core@0.81.16
  - @voyantjs/db@0.81.16
  - @voyantjs/hono@0.81.16

## 0.81.15

### Patch Changes

- @voyantjs/bookings@0.81.15
- @voyantjs/catalog@0.81.15
- @voyantjs/core@0.81.15
- @voyantjs/db@0.81.15
- @voyantjs/hono@0.81.15

## 0.81.14

### Patch Changes

- @voyantjs/bookings@0.81.14
- @voyantjs/catalog@0.81.14
- @voyantjs/core@0.81.14
- @voyantjs/db@0.81.14
- @voyantjs/hono@0.81.14

## 0.81.13

### Patch Changes

- Updated dependencies [28dca55]
  - @voyantjs/bookings@0.81.13
  - @voyantjs/catalog@0.81.13
  - @voyantjs/core@0.81.13
  - @voyantjs/db@0.81.13
  - @voyantjs/hono@0.81.13

## 0.81.12

### Patch Changes

- @voyantjs/bookings@0.81.12
- @voyantjs/catalog@0.81.12
- @voyantjs/core@0.81.12
- @voyantjs/db@0.81.12
- @voyantjs/hono@0.81.12

## 0.81.11

### Patch Changes

- @voyantjs/bookings@0.81.11
- @voyantjs/catalog@0.81.11
- @voyantjs/core@0.81.11
- @voyantjs/db@0.81.11
- @voyantjs/hono@0.81.11

## 0.81.10

### Patch Changes

- @voyantjs/bookings@0.81.10
- @voyantjs/catalog@0.81.10
- @voyantjs/core@0.81.10
- @voyantjs/db@0.81.10
- @voyantjs/hono@0.81.10

## 0.81.9

### Patch Changes

- Updated dependencies [1a58939]
  - @voyantjs/bookings@0.81.9
  - @voyantjs/catalog@0.81.9
  - @voyantjs/core@0.81.9
  - @voyantjs/db@0.81.9
  - @voyantjs/hono@0.81.9

## 0.81.8

### Patch Changes

- Updated dependencies [688ac4f]
  - @voyantjs/bookings@0.81.8
  - @voyantjs/catalog@0.81.8
  - @voyantjs/core@0.81.8
  - @voyantjs/db@0.81.8
  - @voyantjs/hono@0.81.8

## 0.81.7

### Patch Changes

- Updated dependencies [410cd17]
  - @voyantjs/bookings@0.81.7
  - @voyantjs/catalog@0.81.7
  - @voyantjs/core@0.81.7
  - @voyantjs/db@0.81.7
  - @voyantjs/hono@0.81.7

## 0.81.6

### Patch Changes

- @voyantjs/bookings@0.81.6
- @voyantjs/catalog@0.81.6
- @voyantjs/core@0.81.6
- @voyantjs/db@0.81.6
- @voyantjs/hono@0.81.6

## 0.81.5

### Patch Changes

- @voyantjs/bookings@0.81.5
- @voyantjs/catalog@0.81.5
- @voyantjs/core@0.81.5
- @voyantjs/db@0.81.5
- @voyantjs/hono@0.81.5

## 0.81.4

### Patch Changes

- Updated dependencies [6daefc4]
  - @voyantjs/bookings@0.81.4
  - @voyantjs/catalog@0.81.4
  - @voyantjs/core@0.81.4
  - @voyantjs/db@0.81.4
  - @voyantjs/hono@0.81.4

## 0.81.3

### Patch Changes

- Updated dependencies [f157bcd]
  - @voyantjs/bookings@0.81.3
  - @voyantjs/catalog@0.81.3
  - @voyantjs/core@0.81.3
  - @voyantjs/db@0.81.3
  - @voyantjs/hono@0.81.3

## 0.81.2

### Patch Changes

- @voyantjs/bookings@0.81.2
- @voyantjs/catalog@0.81.2
- @voyantjs/core@0.81.2
- @voyantjs/db@0.81.2
- @voyantjs/hono@0.81.2

## 0.81.1

### Patch Changes

- @voyantjs/bookings@0.81.1
- @voyantjs/catalog@0.81.1
- @voyantjs/core@0.81.1
- @voyantjs/db@0.81.1
- @voyantjs/hono@0.81.1

## 0.81.0

### Patch Changes

- Updated dependencies [f35e63c]
  - @voyantjs/bookings@0.81.0
  - @voyantjs/catalog@0.81.0
  - @voyantjs/core@0.81.0
  - @voyantjs/db@0.81.0
  - @voyantjs/hono@0.81.0

## 0.80.18

### Patch Changes

- @voyantjs/bookings@0.80.18
- @voyantjs/catalog@0.80.18
- @voyantjs/core@0.80.18
- @voyantjs/db@0.80.18
- @voyantjs/hono@0.80.18

## 0.80.17

### Patch Changes

- @voyantjs/bookings@0.80.17
- @voyantjs/catalog@0.80.17
- @voyantjs/core@0.80.17
- @voyantjs/db@0.80.17
- @voyantjs/hono@0.80.17

## 0.80.16

### Patch Changes

- @voyantjs/bookings@0.80.16
- @voyantjs/catalog@0.80.16
- @voyantjs/core@0.80.16
- @voyantjs/db@0.80.16
- @voyantjs/hono@0.80.16

## 0.80.15

### Patch Changes

- Updated dependencies [0d8d14e]
  - @voyantjs/bookings@0.80.15
  - @voyantjs/catalog@0.80.15
  - @voyantjs/core@0.80.15
  - @voyantjs/db@0.80.15
  - @voyantjs/hono@0.80.15

## 0.80.14

### Patch Changes

- @voyantjs/bookings@0.80.14
- @voyantjs/catalog@0.80.14
- @voyantjs/core@0.80.14
- @voyantjs/db@0.80.14
- @voyantjs/hono@0.80.14

## 0.80.13

### Patch Changes

- @voyantjs/bookings@0.80.13
- @voyantjs/catalog@0.80.13
- @voyantjs/core@0.80.13
- @voyantjs/db@0.80.13
- @voyantjs/hono@0.80.13

## 0.80.12

### Patch Changes

- @voyantjs/bookings@0.80.12
- @voyantjs/catalog@0.80.12
- @voyantjs/core@0.80.12
- @voyantjs/db@0.80.12
- @voyantjs/hono@0.80.12

## 0.80.11

### Patch Changes

- @voyantjs/bookings@0.80.11
- @voyantjs/catalog@0.80.11
- @voyantjs/core@0.80.11
- @voyantjs/db@0.80.11
- @voyantjs/hono@0.80.11

## 0.80.10

### Patch Changes

- @voyantjs/bookings@0.80.10
- @voyantjs/catalog@0.80.10
- @voyantjs/core@0.80.10
- @voyantjs/db@0.80.10
- @voyantjs/hono@0.80.10

## 0.80.9

### Patch Changes

- Updated dependencies [37aa8b6]
  - @voyantjs/bookings@0.80.9
  - @voyantjs/catalog@0.80.9
  - @voyantjs/core@0.80.9
  - @voyantjs/db@0.80.9
  - @voyantjs/hono@0.80.9

## 0.80.8

### Patch Changes

- @voyantjs/bookings@0.80.8
- @voyantjs/catalog@0.80.8
- @voyantjs/core@0.80.8
- @voyantjs/db@0.80.8
- @voyantjs/hono@0.80.8

## 0.80.7

### Patch Changes

- @voyantjs/bookings@0.80.7
- @voyantjs/catalog@0.80.7
- @voyantjs/core@0.80.7
- @voyantjs/db@0.80.7
- @voyantjs/hono@0.80.7

## 0.80.6

### Patch Changes

- @voyantjs/bookings@0.80.6
- @voyantjs/catalog@0.80.6
- @voyantjs/core@0.80.6
- @voyantjs/db@0.80.6
- @voyantjs/hono@0.80.6

## 0.80.5

### Patch Changes

- @voyantjs/bookings@0.80.5
- @voyantjs/catalog@0.80.5
- @voyantjs/core@0.80.5
- @voyantjs/db@0.80.5
- @voyantjs/hono@0.80.5

## 0.80.4

### Patch Changes

- @voyantjs/bookings@0.80.4
- @voyantjs/catalog@0.80.4
- @voyantjs/core@0.80.4
- @voyantjs/db@0.80.4
- @voyantjs/hono@0.80.4

## 0.80.3

### Patch Changes

- Updated dependencies [6d816bb]
  - @voyantjs/bookings@0.80.3
  - @voyantjs/catalog@0.80.3
  - @voyantjs/core@0.80.3
  - @voyantjs/db@0.80.3
  - @voyantjs/hono@0.80.3

## 0.80.2

### Patch Changes

- Updated dependencies [7a94871]
- Updated dependencies [9d6be13]
  - @voyantjs/bookings@0.80.2
  - @voyantjs/catalog@0.80.2
  - @voyantjs/core@0.80.2
  - @voyantjs/db@0.80.2
  - @voyantjs/hono@0.80.2

## 0.80.1

### Patch Changes

- @voyantjs/bookings@0.80.1
- @voyantjs/catalog@0.80.1
- @voyantjs/core@0.80.1
- @voyantjs/db@0.80.1
- @voyantjs/hono@0.80.1

## 0.80.0

### Patch Changes

- @voyantjs/bookings@0.80.0
- @voyantjs/catalog@0.80.0
- @voyantjs/core@0.80.0
- @voyantjs/db@0.80.0
- @voyantjs/hono@0.80.0

## 0.79.0

### Patch Changes

- @voyantjs/bookings@0.79.0
- @voyantjs/catalog@0.79.0
- @voyantjs/core@0.79.0
- @voyantjs/db@0.79.0
- @voyantjs/hono@0.79.0

## 0.78.0

### Patch Changes

- @voyantjs/bookings@0.78.0
- @voyantjs/catalog@0.78.0
- @voyantjs/core@0.78.0
- @voyantjs/db@0.78.0
- @voyantjs/hono@0.78.0

## 0.77.13

### Patch Changes

- @voyantjs/bookings@0.77.13
- @voyantjs/catalog@0.77.13
- @voyantjs/core@0.77.13
- @voyantjs/db@0.77.13
- @voyantjs/hono@0.77.13

## 0.77.12

### Patch Changes

- @voyantjs/bookings@0.77.12
- @voyantjs/catalog@0.77.12
- @voyantjs/core@0.77.12
- @voyantjs/db@0.77.12
- @voyantjs/hono@0.77.12

## 0.77.11

### Patch Changes

- @voyantjs/bookings@0.77.11
- @voyantjs/catalog@0.77.11
- @voyantjs/core@0.77.11
- @voyantjs/db@0.77.11
- @voyantjs/hono@0.77.11

## 0.77.10

### Patch Changes

- @voyantjs/bookings@0.77.10
- @voyantjs/catalog@0.77.10
- @voyantjs/core@0.77.10
- @voyantjs/db@0.77.10
- @voyantjs/hono@0.77.10

## 0.77.9

### Patch Changes

- @voyantjs/bookings@0.77.9
- @voyantjs/catalog@0.77.9
- @voyantjs/core@0.77.9
- @voyantjs/db@0.77.9
- @voyantjs/hono@0.77.9

## 0.77.8

### Patch Changes

- @voyantjs/bookings@0.77.8
- @voyantjs/catalog@0.77.8
- @voyantjs/core@0.77.8
- @voyantjs/db@0.77.8
- @voyantjs/hono@0.77.8

## 0.77.7

### Patch Changes

- @voyantjs/bookings@0.77.7
- @voyantjs/catalog@0.77.7
- @voyantjs/core@0.77.7
- @voyantjs/db@0.77.7
- @voyantjs/hono@0.77.7

## 0.77.6

### Patch Changes

- @voyantjs/bookings@0.77.6
- @voyantjs/catalog@0.77.6
- @voyantjs/core@0.77.6
- @voyantjs/db@0.77.6
- @voyantjs/hono@0.77.6

## 0.77.5

### Patch Changes

- @voyantjs/bookings@0.77.5
- @voyantjs/catalog@0.77.5
- @voyantjs/core@0.77.5
- @voyantjs/db@0.77.5
- @voyantjs/hono@0.77.5

## 0.77.4

### Patch Changes

- @voyantjs/bookings@0.77.4
- @voyantjs/catalog@0.77.4
- @voyantjs/core@0.77.4
- @voyantjs/db@0.77.4
- @voyantjs/hono@0.77.4

## 0.77.3

### Patch Changes

- @voyantjs/bookings@0.77.3
- @voyantjs/catalog@0.77.3
- @voyantjs/core@0.77.3
- @voyantjs/db@0.77.3
- @voyantjs/hono@0.77.3

## 0.77.2

### Patch Changes

- @voyantjs/bookings@0.77.2
- @voyantjs/catalog@0.77.2
- @voyantjs/core@0.77.2
- @voyantjs/db@0.77.2
- @voyantjs/hono@0.77.2

## 0.77.1

### Patch Changes

- Updated dependencies [574684d]
  - @voyantjs/bookings@0.77.1
  - @voyantjs/catalog@0.77.1
  - @voyantjs/core@0.77.1
  - @voyantjs/db@0.77.1
  - @voyantjs/hono@0.77.1

## 0.77.0

### Patch Changes

- Updated dependencies [1da934d]
  - @voyantjs/bookings@0.77.0
  - @voyantjs/catalog@0.77.0
  - @voyantjs/core@0.77.0
  - @voyantjs/db@0.77.0
  - @voyantjs/hono@0.77.0

## 0.76.0

### Patch Changes

- @voyantjs/bookings@0.76.0
- @voyantjs/catalog@0.76.0
- @voyantjs/core@0.76.0
- @voyantjs/db@0.76.0
- @voyantjs/hono@0.76.0

## 0.75.7

### Patch Changes

- @voyantjs/bookings@0.75.7
- @voyantjs/catalog@0.75.7
- @voyantjs/core@0.75.7
- @voyantjs/db@0.75.7
- @voyantjs/hono@0.75.7

## 0.75.6

### Patch Changes

- @voyantjs/bookings@0.75.6
- @voyantjs/catalog@0.75.6
- @voyantjs/core@0.75.6
- @voyantjs/db@0.75.6
- @voyantjs/hono@0.75.6

## 0.75.5

### Patch Changes

- @voyantjs/bookings@0.75.5
- @voyantjs/catalog@0.75.5
- @voyantjs/core@0.75.5
- @voyantjs/db@0.75.5
- @voyantjs/hono@0.75.5

## 0.75.4

### Patch Changes

- @voyantjs/bookings@0.75.4
- @voyantjs/catalog@0.75.4
- @voyantjs/core@0.75.4
- @voyantjs/db@0.75.4
- @voyantjs/hono@0.75.4

## 0.75.3

### Patch Changes

- @voyantjs/bookings@0.75.3
- @voyantjs/catalog@0.75.3
- @voyantjs/core@0.75.3
- @voyantjs/db@0.75.3
- @voyantjs/hono@0.75.3

## 0.75.2

### Patch Changes

- @voyantjs/bookings@0.75.2
- @voyantjs/catalog@0.75.2
- @voyantjs/core@0.75.2
- @voyantjs/db@0.75.2
- @voyantjs/hono@0.75.2

## 0.75.1

### Patch Changes

- @voyantjs/bookings@0.75.1
- @voyantjs/catalog@0.75.1
- @voyantjs/core@0.75.1
- @voyantjs/db@0.75.1
- @voyantjs/hono@0.75.1

## 0.75.0

### Patch Changes

- Updated dependencies [1eab599]
  - @voyantjs/bookings@0.75.0
  - @voyantjs/catalog@0.75.0
  - @voyantjs/core@0.75.0
  - @voyantjs/db@0.75.0
  - @voyantjs/hono@0.75.0

## 0.74.2

### Patch Changes

- @voyantjs/bookings@0.74.2
- @voyantjs/catalog@0.74.2
- @voyantjs/core@0.74.2
- @voyantjs/db@0.74.2
- @voyantjs/hono@0.74.2

## 0.74.1

### Patch Changes

- @voyantjs/bookings@0.74.1
- @voyantjs/catalog@0.74.1
- @voyantjs/core@0.74.1
- @voyantjs/db@0.74.1
- @voyantjs/hono@0.74.1

## 0.74.0

### Patch Changes

- @voyantjs/bookings@0.74.0
- @voyantjs/catalog@0.74.0
- @voyantjs/core@0.74.0
- @voyantjs/db@0.74.0
- @voyantjs/hono@0.74.0

## 0.73.1

### Patch Changes

- @voyantjs/bookings@0.73.1
- @voyantjs/catalog@0.73.1
- @voyantjs/core@0.73.1
- @voyantjs/db@0.73.1
- @voyantjs/hono@0.73.1

## 0.73.0

### Patch Changes

- @voyantjs/bookings@0.73.0
- @voyantjs/catalog@0.73.0
- @voyantjs/core@0.73.0
- @voyantjs/db@0.73.0
- @voyantjs/hono@0.73.0

## 0.72.0

### Patch Changes

- @voyantjs/bookings@0.72.0
- @voyantjs/catalog@0.72.0
- @voyantjs/core@0.72.0
- @voyantjs/db@0.72.0
- @voyantjs/hono@0.72.0

## 0.71.0

### Patch Changes

- @voyantjs/bookings@0.71.0
- @voyantjs/catalog@0.71.0
- @voyantjs/core@0.71.0
- @voyantjs/db@0.71.0
- @voyantjs/hono@0.71.0

## 0.70.0

### Patch Changes

- @voyantjs/bookings@0.70.0
- @voyantjs/catalog@0.70.0
- @voyantjs/core@0.70.0
- @voyantjs/db@0.70.0
- @voyantjs/hono@0.70.0

## 0.69.1

### Patch Changes

- @voyantjs/bookings@0.69.1
- @voyantjs/catalog@0.69.1
- @voyantjs/core@0.69.1
- @voyantjs/db@0.69.1
- @voyantjs/hono@0.69.1

## 0.69.0

### Patch Changes

- @voyantjs/bookings@0.69.0
- @voyantjs/catalog@0.69.0
- @voyantjs/core@0.69.0
- @voyantjs/db@0.69.0
- @voyantjs/hono@0.69.0

## 0.68.0

### Patch Changes

- @voyantjs/bookings@0.68.0
- @voyantjs/catalog@0.68.0
- @voyantjs/core@0.68.0
- @voyantjs/db@0.68.0
- @voyantjs/hono@0.68.0

## 0.67.0

### Patch Changes

- @voyantjs/bookings@0.67.0
- @voyantjs/catalog@0.67.0
- @voyantjs/core@0.67.0
- @voyantjs/db@0.67.0
- @voyantjs/hono@0.67.0

## 0.66.6

### Patch Changes

- @voyantjs/bookings@0.66.6
- @voyantjs/catalog@0.66.6
- @voyantjs/core@0.66.6
- @voyantjs/db@0.66.6
- @voyantjs/hono@0.66.6

## 0.66.5

### Patch Changes

- Updated dependencies [ee36ef5]
  - @voyantjs/bookings@0.66.5
  - @voyantjs/catalog@0.66.5
  - @voyantjs/core@0.66.5
  - @voyantjs/db@0.66.5
  - @voyantjs/hono@0.66.5

## 0.66.4

### Patch Changes

- Updated dependencies [83ff2de]
  - @voyantjs/bookings@0.66.4
  - @voyantjs/catalog@0.66.4
  - @voyantjs/core@0.66.4
  - @voyantjs/db@0.66.4
  - @voyantjs/hono@0.66.4

## 0.66.3

### Patch Changes

- @voyantjs/bookings@0.66.3
- @voyantjs/catalog@0.66.3
- @voyantjs/core@0.66.3
- @voyantjs/db@0.66.3
- @voyantjs/hono@0.66.3

## 0.66.2

### Patch Changes

- @voyantjs/bookings@0.66.2
- @voyantjs/catalog@0.66.2
- @voyantjs/core@0.66.2
- @voyantjs/db@0.66.2
- @voyantjs/hono@0.66.2

## 0.66.1

### Patch Changes

- @voyantjs/bookings@0.66.1
- @voyantjs/catalog@0.66.1
- @voyantjs/core@0.66.1
- @voyantjs/db@0.66.1
- @voyantjs/hono@0.66.1

## 0.66.0

### Patch Changes

- @voyantjs/bookings@0.66.0
- @voyantjs/catalog@0.66.0
- @voyantjs/core@0.66.0
- @voyantjs/db@0.66.0
- @voyantjs/hono@0.66.0

## 0.65.0

### Patch Changes

- @voyantjs/bookings@0.65.0
- @voyantjs/catalog@0.65.0
- @voyantjs/core@0.65.0
- @voyantjs/db@0.65.0
- @voyantjs/hono@0.65.0

## 0.64.1

### Patch Changes

- @voyantjs/bookings@0.64.1
- @voyantjs/catalog@0.64.1
- @voyantjs/core@0.64.1
- @voyantjs/db@0.64.1
- @voyantjs/hono@0.64.1

## 0.64.0

### Patch Changes

- 6d0c8f3: Extract `withOptionalTransaction` into `@voyantjs/db/transaction` so the soft-fallback helper that action-ledger has used since 0.62.0 can be shared by any package that needs it. Add `Module.requiresTransactionalDb` so modules whose write paths use interactive transactions declare it, and have `createApp()` assert on first request that the resolved db adapter supports `db.transaction(async (tx) => …)`. With the neon-http (edge) adapter that assertion now throws an actionable error pointing at `createServerlessDbClient` (neon-serverless / WebSocket) or `createDbClient(url, { adapter: "node" })` — instead of the cryptic "No transactions support in neon-http driver" exception thrown on first write.
- Updated dependencies [6d0c8f3]
  - @voyantjs/bookings@0.64.0
  - @voyantjs/catalog@0.64.0
  - @voyantjs/core@0.64.0
  - @voyantjs/db@0.64.0
  - @voyantjs/hono@0.64.0

## 0.63.1

### Patch Changes

- @voyantjs/bookings@0.63.1
- @voyantjs/catalog@0.63.1
- @voyantjs/core@0.63.1
- @voyantjs/db@0.63.1
- @voyantjs/hono@0.63.1

## 0.63.0

### Patch Changes

- Updated dependencies [5bff9c3]
  - @voyantjs/bookings@0.63.0
  - @voyantjs/catalog@0.63.0
  - @voyantjs/core@0.63.0
  - @voyantjs/db@0.63.0
  - @voyantjs/hono@0.63.0

## 0.62.3

### Patch Changes

- @voyantjs/bookings@0.62.3
- @voyantjs/catalog@0.62.3
- @voyantjs/core@0.62.3
- @voyantjs/db@0.62.3
- @voyantjs/hono@0.62.3

## 0.62.2

### Patch Changes

- @voyantjs/bookings@0.62.2
- @voyantjs/catalog@0.62.2
- @voyantjs/core@0.62.2
- @voyantjs/db@0.62.2
- @voyantjs/hono@0.62.2

## 0.62.1

### Patch Changes

- @voyantjs/bookings@0.62.1
- @voyantjs/catalog@0.62.1
- @voyantjs/core@0.62.1
- @voyantjs/db@0.62.1
- @voyantjs/hono@0.62.1

## 0.62.0

### Patch Changes

- Updated dependencies [77aad68]
  - @voyantjs/bookings@0.62.0
  - @voyantjs/catalog@0.62.0
  - @voyantjs/core@0.62.0
  - @voyantjs/db@0.62.0
  - @voyantjs/hono@0.62.0

## 0.61.0

### Patch Changes

- @voyantjs/bookings@0.61.0
- @voyantjs/catalog@0.61.0
- @voyantjs/core@0.61.0
- @voyantjs/db@0.61.0
- @voyantjs/hono@0.61.0

## 0.60.0

### Patch Changes

- @voyantjs/bookings@0.60.0
- @voyantjs/catalog@0.60.0
- @voyantjs/core@0.60.0
- @voyantjs/db@0.60.0
- @voyantjs/hono@0.60.0

## 0.59.0

### Patch Changes

- Updated dependencies [48927be]
  - @voyantjs/bookings@0.59.0
  - @voyantjs/catalog@0.59.0
  - @voyantjs/core@0.59.0
  - @voyantjs/db@0.59.0
  - @voyantjs/hono@0.59.0

## 0.58.0

### Patch Changes

- Updated dependencies [5b21488]
  - @voyantjs/bookings@0.58.0
  - @voyantjs/catalog@0.58.0
  - @voyantjs/core@0.58.0
  - @voyantjs/db@0.58.0
  - @voyantjs/hono@0.58.0

## 0.57.0

### Patch Changes

- @voyantjs/bookings@0.57.0
- @voyantjs/catalog@0.57.0
- @voyantjs/core@0.57.0
- @voyantjs/db@0.57.0
- @voyantjs/hono@0.57.0

## 0.56.0

### Patch Changes

- @voyantjs/bookings@0.56.0
- @voyantjs/catalog@0.56.0
- @voyantjs/core@0.56.0
- @voyantjs/db@0.56.0
- @voyantjs/hono@0.56.0

## 0.55.1

### Patch Changes

- Updated dependencies [819c847]
  - @voyantjs/bookings@0.55.1
  - @voyantjs/catalog@0.55.1
  - @voyantjs/core@0.55.1
  - @voyantjs/db@0.55.1
  - @voyantjs/hono@0.55.1

## 0.55.0

### Patch Changes

- @voyantjs/bookings@0.55.0
- @voyantjs/catalog@0.55.0
- @voyantjs/core@0.55.0
- @voyantjs/db@0.55.0
- @voyantjs/hono@0.55.0

## 0.54.0

### Patch Changes

- @voyantjs/bookings@0.54.0
- @voyantjs/catalog@0.54.0
- @voyantjs/core@0.54.0
- @voyantjs/db@0.54.0
- @voyantjs/hono@0.54.0

## 0.53.2

### Patch Changes

- @voyantjs/bookings@0.53.2
- @voyantjs/catalog@0.53.2
- @voyantjs/core@0.53.2
- @voyantjs/db@0.53.2
- @voyantjs/hono@0.53.2

## 0.53.1

### Patch Changes

- @voyantjs/bookings@0.53.1
- @voyantjs/catalog@0.53.1
- @voyantjs/core@0.53.1
- @voyantjs/db@0.53.1
- @voyantjs/hono@0.53.1

## 0.53.0

### Patch Changes

- Updated dependencies [a315df6]
  - @voyantjs/bookings@0.53.0
  - @voyantjs/catalog@0.53.0
  - @voyantjs/core@0.53.0
  - @voyantjs/db@0.53.0
  - @voyantjs/hono@0.53.0

## 0.52.4

### Patch Changes

- Updated dependencies [5d3c119]
  - @voyantjs/bookings@0.52.4
  - @voyantjs/catalog@0.52.4
  - @voyantjs/core@0.52.4
  - @voyantjs/db@0.52.4
  - @voyantjs/hono@0.52.4

## 0.52.3

### Patch Changes

- Updated dependencies [9679a57]
  - @voyantjs/bookings@0.52.3
  - @voyantjs/catalog@0.52.3
  - @voyantjs/core@0.52.3
  - @voyantjs/db@0.52.3
  - @voyantjs/hono@0.52.3

## 0.52.2

### Patch Changes

- Updated dependencies [3e09123]
  - @voyantjs/bookings@0.52.2
  - @voyantjs/catalog@0.52.2
  - @voyantjs/core@0.52.2
  - @voyantjs/db@0.52.2
  - @voyantjs/hono@0.52.2

## 0.52.1

### Patch Changes

- Updated dependencies [335d277]
  - @voyantjs/bookings@0.52.1
  - @voyantjs/catalog@0.52.1
  - @voyantjs/core@0.52.1
  - @voyantjs/db@0.52.1
  - @voyantjs/hono@0.52.1

## 0.52.0

### Patch Changes

- @voyantjs/bookings@0.52.0
- @voyantjs/catalog@0.52.0
- @voyantjs/core@0.52.0
- @voyantjs/db@0.52.0
- @voyantjs/hono@0.52.0

## 0.51.1

### Patch Changes

- @voyantjs/bookings@0.51.1
- @voyantjs/catalog@0.51.1
- @voyantjs/core@0.51.1
- @voyantjs/db@0.51.1
- @voyantjs/hono@0.51.1

## 0.51.0

### Patch Changes

- @voyantjs/bookings@0.51.0
- @voyantjs/catalog@0.51.0
- @voyantjs/core@0.51.0
- @voyantjs/db@0.51.0
- @voyantjs/hono@0.51.0

## 0.50.8

### Patch Changes

- Updated dependencies [f35014f]
  - @voyantjs/bookings@0.50.8
  - @voyantjs/catalog@0.50.8
  - @voyantjs/core@0.50.8
  - @voyantjs/db@0.50.8
  - @voyantjs/hono@0.50.8

## 0.50.7

### Patch Changes

- @voyantjs/bookings@0.50.7
- @voyantjs/catalog@0.50.7
- @voyantjs/core@0.50.7
- @voyantjs/db@0.50.7
- @voyantjs/hono@0.50.7

## 0.50.6

### Patch Changes

- Updated dependencies [c14f0a8]
  - @voyantjs/bookings@0.50.6
  - @voyantjs/catalog@0.50.6
  - @voyantjs/core@0.50.6
  - @voyantjs/db@0.50.6
  - @voyantjs/hono@0.50.6

## 0.50.5

### Patch Changes

- @voyantjs/bookings@0.50.5
- @voyantjs/catalog@0.50.5
- @voyantjs/core@0.50.5
- @voyantjs/db@0.50.5
- @voyantjs/hono@0.50.5

## 0.50.4

### Patch Changes

- @voyantjs/bookings@0.50.4
- @voyantjs/catalog@0.50.4
- @voyantjs/core@0.50.4
- @voyantjs/db@0.50.4
- @voyantjs/hono@0.50.4

## 0.50.3

### Patch Changes

- @voyantjs/bookings@0.50.3
- @voyantjs/catalog@0.50.3
- @voyantjs/core@0.50.3
- @voyantjs/db@0.50.3
- @voyantjs/hono@0.50.3

## 0.50.2

### Patch Changes

- @voyantjs/bookings@0.50.2
- @voyantjs/catalog@0.50.2
- @voyantjs/core@0.50.2
- @voyantjs/db@0.50.2
- @voyantjs/hono@0.50.2

## 0.50.1

### Patch Changes

- @voyantjs/bookings@0.50.1
- @voyantjs/catalog@0.50.1
- @voyantjs/core@0.50.1
- @voyantjs/db@0.50.1
- @voyantjs/hono@0.50.1

## 0.50.0

### Patch Changes

- @voyantjs/bookings@0.50.0
- @voyantjs/catalog@0.50.0
- @voyantjs/core@0.50.0
- @voyantjs/db@0.50.0
- @voyantjs/hono@0.50.0

## 0.49.0

### Patch Changes

- @voyantjs/bookings@0.49.0
- @voyantjs/catalog@0.49.0
- @voyantjs/core@0.49.0
- @voyantjs/db@0.49.0
- @voyantjs/hono@0.49.0

## 0.48.0

### Patch Changes

- @voyantjs/bookings@0.48.0
- @voyantjs/catalog@0.48.0
- @voyantjs/core@0.48.0
- @voyantjs/db@0.48.0
- @voyantjs/hono@0.48.0

## 0.47.0

### Patch Changes

- @voyantjs/bookings@0.47.0
- @voyantjs/catalog@0.47.0
- @voyantjs/core@0.47.0
- @voyantjs/db@0.47.0
- @voyantjs/hono@0.47.0

## 0.46.0

### Patch Changes

- @voyantjs/bookings@0.46.0
- @voyantjs/catalog@0.46.0
- @voyantjs/core@0.46.0
- @voyantjs/db@0.46.0
- @voyantjs/hono@0.46.0

## 0.45.0

### Patch Changes

- @voyantjs/bookings@0.45.0
- @voyantjs/catalog@0.45.0
- @voyantjs/core@0.45.0
- @voyantjs/db@0.45.0
- @voyantjs/hono@0.45.0

## 0.44.0

### Patch Changes

- @voyantjs/bookings@0.44.0
- @voyantjs/catalog@0.44.0
- @voyantjs/core@0.44.0
- @voyantjs/db@0.44.0
- @voyantjs/hono@0.44.0

## 0.43.0

### Patch Changes

- Updated dependencies [d07215e]
  - @voyantjs/bookings@0.43.0
  - @voyantjs/catalog@0.43.0
  - @voyantjs/core@0.43.0
  - @voyantjs/db@0.43.0
  - @voyantjs/hono@0.43.0

## 0.42.0

### Patch Changes

- @voyantjs/bookings@0.42.0
- @voyantjs/catalog@0.42.0
- @voyantjs/core@0.42.0
- @voyantjs/db@0.42.0
- @voyantjs/hono@0.42.0

## 0.41.3

### Patch Changes

- @voyantjs/bookings@0.41.3
- @voyantjs/catalog@0.41.3
- @voyantjs/core@0.41.3
- @voyantjs/db@0.41.3
- @voyantjs/hono@0.41.3

## 0.41.2

### Patch Changes

- @voyantjs/bookings@0.41.2
- @voyantjs/catalog@0.41.2
- @voyantjs/core@0.41.2
- @voyantjs/db@0.41.2
- @voyantjs/hono@0.41.2

## 0.41.1

### Patch Changes

- 533785f: Fix admin cruise route ordering so static subresource endpoints like `/sailings`, `/ships`, and `/prices` are handled before generic cruise-key routes.
  - @voyantjs/bookings@0.41.1
  - @voyantjs/catalog@0.41.1
  - @voyantjs/core@0.41.1
  - @voyantjs/db@0.41.1
  - @voyantjs/hono@0.41.1

## 0.41.0

### Patch Changes

- 20fd32e: Add cruise lifecycle events for local create, update, and delete/archive mutations so catalog and search subscribers can reindex cruise documents.
  - @voyantjs/bookings@0.41.0
  - @voyantjs/catalog@0.41.0
  - @voyantjs/core@0.41.0
  - @voyantjs/db@0.41.0
  - @voyantjs/hono@0.41.0

## 0.40.1

### Patch Changes

- @voyantjs/bookings@0.40.1
- @voyantjs/catalog@0.40.1
- @voyantjs/core@0.40.1
- @voyantjs/db@0.40.1
- @voyantjs/hono@0.40.1

## 0.40.0

### Patch Changes

- @voyantjs/bookings@0.40.0
- @voyantjs/catalog@0.40.0
- @voyantjs/core@0.40.0
- @voyantjs/db@0.40.0
- @voyantjs/hono@0.40.0

## 0.39.0

### Patch Changes

- Updated dependencies [f4235ea]
  - @voyantjs/bookings@0.39.0
  - @voyantjs/catalog@0.39.0
  - @voyantjs/core@0.39.0
  - @voyantjs/db@0.39.0
  - @voyantjs/hono@0.39.0

## 0.38.2

### Patch Changes

- @voyantjs/bookings@0.38.2
- @voyantjs/catalog@0.38.2
- @voyantjs/core@0.38.2
- @voyantjs/db@0.38.2
- @voyantjs/hono@0.38.2

## 0.38.1

### Patch Changes

- @voyantjs/bookings@0.38.1
- @voyantjs/catalog@0.38.1
- @voyantjs/core@0.38.1
- @voyantjs/db@0.38.1
- @voyantjs/hono@0.38.1

## 0.38.0

### Patch Changes

- @voyantjs/bookings@0.38.0
- @voyantjs/catalog@0.38.0
- @voyantjs/core@0.38.0
- @voyantjs/db@0.38.0
- @voyantjs/hono@0.38.0

## 0.37.1

### Patch Changes

- @voyantjs/bookings@0.37.1
- @voyantjs/catalog@0.37.1
- @voyantjs/core@0.37.1
- @voyantjs/db@0.37.1
- @voyantjs/hono@0.37.1

## 0.37.0

### Patch Changes

- Updated dependencies [4c93561]
- Updated dependencies [dc29b79]
  - @voyantjs/bookings@0.37.0
  - @voyantjs/catalog@0.37.0
  - @voyantjs/core@0.37.0
  - @voyantjs/db@0.37.0
  - @voyantjs/hono@0.37.0

## 0.36.0

### Patch Changes

- Updated dependencies [15e6953]
  - @voyantjs/bookings@0.36.0
  - @voyantjs/catalog@0.36.0
  - @voyantjs/core@0.36.0
  - @voyantjs/db@0.36.0
  - @voyantjs/hono@0.36.0

## 0.35.0

### Patch Changes

- @voyantjs/bookings@0.35.0
- @voyantjs/catalog@0.35.0
- @voyantjs/core@0.35.0
- @voyantjs/db@0.35.0
- @voyantjs/hono@0.35.0

## 0.34.0

### Patch Changes

- f8312f5: Project a normalized `thumbnailUrl` field into catalog search documents so
  operator catalog cards can render real cover images across verticals.
  - @voyantjs/bookings@0.34.0
  - @voyantjs/catalog@0.34.0
  - @voyantjs/core@0.34.0
  - @voyantjs/db@0.34.0
  - @voyantjs/hono@0.34.0

## 0.33.1

### Patch Changes

- Updated dependencies [9bee9aa]
  - @voyantjs/bookings@0.33.1
  - @voyantjs/catalog@0.33.1
  - @voyantjs/core@0.33.1
  - @voyantjs/db@0.33.1
  - @voyantjs/hono@0.33.1

## 0.33.0

### Patch Changes

- @voyantjs/bookings@0.33.0
- @voyantjs/catalog@0.33.0
- @voyantjs/core@0.33.0
- @voyantjs/db@0.33.0
- @voyantjs/hono@0.33.0

## 0.32.3

### Patch Changes

- @voyantjs/bookings@0.32.3
- @voyantjs/catalog@0.32.3
- @voyantjs/core@0.32.3
- @voyantjs/db@0.32.3
- @voyantjs/hono@0.32.3

## 0.32.2

### Patch Changes

- @voyantjs/bookings@0.32.2
- @voyantjs/catalog@0.32.2
- @voyantjs/core@0.32.2
- @voyantjs/db@0.32.2
- @voyantjs/hono@0.32.2

## 0.32.1

### Patch Changes

- @voyantjs/bookings@0.32.1
- @voyantjs/catalog@0.32.1
- @voyantjs/core@0.32.1
- @voyantjs/db@0.32.1
- @voyantjs/hono@0.32.1

## 0.32.0

### Patch Changes

- Updated dependencies [6ea6ded]
  - @voyantjs/bookings@0.32.0
  - @voyantjs/catalog@0.32.0
  - @voyantjs/core@0.32.0
  - @voyantjs/db@0.32.0
  - @voyantjs/hono@0.32.0

## 0.31.4

### Patch Changes

- @voyantjs/bookings@0.31.4
- @voyantjs/catalog@0.31.4
- @voyantjs/core@0.31.4
- @voyantjs/db@0.31.4
- @voyantjs/hono@0.31.4

## 0.31.3

### Patch Changes

- Updated dependencies [5f974dd]
  - @voyantjs/bookings@0.31.3
  - @voyantjs/catalog@0.31.3
  - @voyantjs/core@0.31.3
  - @voyantjs/db@0.31.3
  - @voyantjs/hono@0.31.3

## 0.31.2

### Patch Changes

- Updated dependencies [54ddc93]
  - @voyantjs/bookings@0.31.2
  - @voyantjs/catalog@0.31.2
  - @voyantjs/core@0.31.2
  - @voyantjs/db@0.31.2
  - @voyantjs/hono@0.31.2

## 0.31.1

### Patch Changes

- @voyantjs/bookings@0.31.1
- @voyantjs/catalog@0.31.1
- @voyantjs/core@0.31.1
- @voyantjs/db@0.31.1
- @voyantjs/hono@0.31.1

## 0.31.0

### Patch Changes

- @voyantjs/bookings@0.31.0
- @voyantjs/catalog@0.31.0
- @voyantjs/core@0.31.0
- @voyantjs/db@0.31.0
- @voyantjs/hono@0.31.0

## 0.30.7

### Patch Changes

- @voyantjs/bookings@0.30.7
- @voyantjs/catalog@0.30.7
- @voyantjs/core@0.30.7
- @voyantjs/db@0.30.7
- @voyantjs/hono@0.30.7

## 0.30.6

### Patch Changes

- Updated dependencies [5a4c592]
  - @voyantjs/bookings@0.30.6
  - @voyantjs/catalog@0.30.6
  - @voyantjs/core@0.30.6
  - @voyantjs/db@0.30.6
  - @voyantjs/hono@0.30.6

## 0.30.5

### Patch Changes

- Updated dependencies [3f323e9]
  - @voyantjs/bookings@0.30.5
  - @voyantjs/catalog@0.30.5
  - @voyantjs/core@0.30.5
  - @voyantjs/db@0.30.5
  - @voyantjs/hono@0.30.5

## 0.30.4

### Patch Changes

- @voyantjs/bookings@0.30.4
- @voyantjs/catalog@0.30.4
- @voyantjs/core@0.30.4
- @voyantjs/db@0.30.4
- @voyantjs/hono@0.30.4

## 0.30.3

### Patch Changes

- Updated dependencies [05a1b19]
  - @voyantjs/bookings@0.30.3
  - @voyantjs/catalog@0.30.3
  - @voyantjs/core@0.30.3
  - @voyantjs/db@0.30.3
  - @voyantjs/hono@0.30.3

## 0.30.2

### Patch Changes

- @voyantjs/bookings@0.30.2
- @voyantjs/catalog@0.30.2
- @voyantjs/core@0.30.2
- @voyantjs/db@0.30.2
- @voyantjs/hono@0.30.2

## 0.30.1

### Patch Changes

- @voyantjs/bookings@0.30.1
- @voyantjs/catalog@0.30.1
- @voyantjs/core@0.30.1
- @voyantjs/db@0.30.1
- @voyantjs/hono@0.30.1

## 0.30.0

### Patch Changes

- @voyantjs/bookings@0.30.0
- @voyantjs/catalog@0.30.0
- @voyantjs/core@0.30.0
- @voyantjs/db@0.30.0
- @voyantjs/hono@0.30.0

## 0.29.0

### Patch Changes

- 2baf762: Fix #492: expose all workspace sub-paths in `publishConfig.exports` for vertical packages.

  `publishConfig.exports` (used at publish time) had drifted from the workspace `exports` map: catalog plane and content plane sub-paths shipped in `dist/` but were unreachable from the published package. Consumers installing from npm hit `ERR_PACKAGE_PATH_NOT_EXPORTED` / `TS2307` when importing them.

  Newly exposed sub-paths:

  - `@voyantjs/products`: `./catalog-policy`, `./service-catalog-plane`, `./content-shape`, `./service-content`, `./service-content-synthesizer`, `./routes-content`, `./draft-shape`
  - `@voyantjs/extras`: `./catalog-policy`, `./service-catalog-plane`, `./content-shape`, `./service-content`, `./service-content-synthesizer`, `./draft-shape`
  - `@voyantjs/cruises`: `./catalog-policy`, `./service-catalog-plane`, `./content-shape`, `./service-content-synthesizer`, `./routes-content`, `./draft-shape`
  - `@voyantjs/charters`: `./catalog-policy`, `./service-catalog-plane`, `./content-shape`, `./service-content`, `./service-content-synthesizer`, `./draft-shape`
  - `@voyantjs/hospitality`: `./catalog-policy`, `./service-catalog-plane`, `./content-shape`, `./service-content-synthesizer`, `./draft-shape`

- Updated dependencies [3420711]
- Updated dependencies [583326e]
- Updated dependencies [583326e]
- Updated dependencies [583326e]
- Updated dependencies [4a6523e]
- Updated dependencies [db51715]
  - @voyantjs/bookings@0.29.0
  - @voyantjs/catalog@0.29.0
  - @voyantjs/core@0.29.0
  - @voyantjs/db@0.29.0
  - @voyantjs/hono@0.29.0

## 0.28.3

### Patch Changes

- @voyantjs/bookings@0.28.3
- @voyantjs/catalog@0.28.3
- @voyantjs/core@0.28.3
- @voyantjs/db@0.28.3
- @voyantjs/hono@0.28.3

## 0.28.2

### Patch Changes

- @voyantjs/bookings@0.28.2
- @voyantjs/catalog@0.28.2
- @voyantjs/core@0.28.2
- @voyantjs/db@0.28.2
- @voyantjs/hono@0.28.2

## 0.28.1

### Patch Changes

- @voyantjs/bookings@0.28.1
- @voyantjs/catalog@0.28.1
- @voyantjs/core@0.28.1
- @voyantjs/db@0.28.1
- @voyantjs/hono@0.28.1

## 0.28.0

### Patch Changes

- @voyantjs/bookings@0.28.0
- @voyantjs/catalog@0.28.0
- @voyantjs/core@0.28.0
- @voyantjs/db@0.28.0
- @voyantjs/hono@0.28.0

## 0.27.0

### Patch Changes

- @voyantjs/bookings@0.27.0
- @voyantjs/catalog@0.27.0
- @voyantjs/core@0.27.0
- @voyantjs/db@0.27.0
- @voyantjs/hono@0.27.0

## 0.26.9

### Patch Changes

- @voyantjs/bookings@0.26.9
- @voyantjs/catalog@0.26.9
- @voyantjs/core@0.26.9
- @voyantjs/db@0.26.9
- @voyantjs/hono@0.26.9

## 0.26.8

### Patch Changes

- @voyantjs/bookings@0.26.8
- @voyantjs/catalog@0.26.8
- @voyantjs/core@0.26.8
- @voyantjs/db@0.26.8
- @voyantjs/hono@0.26.8

## 0.26.7

### Patch Changes

- @voyantjs/bookings@0.26.7
- @voyantjs/catalog@0.26.7
- @voyantjs/core@0.26.7
- @voyantjs/db@0.26.7
- @voyantjs/hono@0.26.7

## 0.26.6

### Patch Changes

- Updated dependencies [571e340]
  - @voyantjs/bookings@0.26.6
  - @voyantjs/catalog@0.26.6
  - @voyantjs/core@0.26.6
  - @voyantjs/db@0.26.6
  - @voyantjs/hono@0.26.6

## 0.26.5

### Patch Changes

- Updated dependencies [7a92aba]
  - @voyantjs/bookings@0.26.5
  - @voyantjs/catalog@0.26.5
  - @voyantjs/core@0.26.5
  - @voyantjs/db@0.26.5
  - @voyantjs/hono@0.26.5

## 0.26.4

### Patch Changes

- Updated dependencies [6493f62]
  - @voyantjs/bookings@0.26.4
  - @voyantjs/catalog@0.26.4
  - @voyantjs/core@0.26.4
  - @voyantjs/db@0.26.4
  - @voyantjs/hono@0.26.4

## 0.26.3

### Patch Changes

- Updated dependencies [372cad5]
  - @voyantjs/bookings@0.26.3
  - @voyantjs/catalog@0.26.3
  - @voyantjs/core@0.26.3
  - @voyantjs/db@0.26.3
  - @voyantjs/hono@0.26.3

## 0.26.2

### Patch Changes

- Updated dependencies [ffdb485]
  - @voyantjs/bookings@0.26.2
  - @voyantjs/catalog@0.26.2
  - @voyantjs/core@0.26.2
  - @voyantjs/db@0.26.2
  - @voyantjs/hono@0.26.2

## 0.26.1

### Patch Changes

- Updated dependencies [c0507a6]
  - @voyantjs/bookings@0.26.1
  - @voyantjs/catalog@0.26.1
  - @voyantjs/core@0.26.1
  - @voyantjs/db@0.26.1
  - @voyantjs/hono@0.26.1

## 0.26.0

### Patch Changes

- @voyantjs/bookings@0.26.0
- @voyantjs/catalog@0.26.0
- @voyantjs/core@0.26.0
- @voyantjs/db@0.26.0
- @voyantjs/hono@0.26.0

## 0.25.0

### Patch Changes

- @voyantjs/bookings@0.25.0
- @voyantjs/catalog@0.25.0
- @voyantjs/core@0.25.0
- @voyantjs/db@0.25.0
- @voyantjs/hono@0.25.0

## 0.24.3

### Patch Changes

- @voyantjs/bookings@0.24.3
- @voyantjs/catalog@0.24.3
- @voyantjs/core@0.24.3
- @voyantjs/db@0.24.3
- @voyantjs/hono@0.24.3

## 0.24.2

### Patch Changes

- Updated dependencies [bec0471]
  - @voyantjs/bookings@0.24.2
  - @voyantjs/catalog@0.24.2
  - @voyantjs/core@0.24.2
  - @voyantjs/db@0.24.2
  - @voyantjs/hono@0.24.2

## 0.24.1

### Patch Changes

- Updated dependencies [2d6297d]
  - @voyantjs/bookings@0.24.1
  - @voyantjs/catalog@0.24.1
  - @voyantjs/core@0.24.1
  - @voyantjs/db@0.24.1
  - @voyantjs/hono@0.24.1

## 0.24.0

### Patch Changes

- @voyantjs/bookings@0.24.0
- @voyantjs/catalog@0.24.0
- @voyantjs/core@0.24.0
- @voyantjs/db@0.24.0
- @voyantjs/hono@0.24.0

## 0.23.0

### Patch Changes

- @voyantjs/bookings@0.23.0
- @voyantjs/catalog@0.23.0
- @voyantjs/core@0.23.0
- @voyantjs/db@0.23.0
- @voyantjs/hono@0.23.0

## 0.22.0

### Patch Changes

- @voyantjs/bookings@0.22.0
- @voyantjs/catalog@0.22.0
- @voyantjs/core@0.22.0
- @voyantjs/db@0.22.0
- @voyantjs/hono@0.22.0

## 0.21.1

### Patch Changes

- @voyantjs/bookings@0.21.1
- @voyantjs/catalog@0.21.1
- @voyantjs/core@0.21.1
- @voyantjs/db@0.21.1
- @voyantjs/hono@0.21.1

## 0.21.0

### Patch Changes

- Updated dependencies [6427bad]
  - @voyantjs/bookings@0.21.0
  - @voyantjs/catalog@0.21.0
  - @voyantjs/core@0.21.0
  - @voyantjs/db@0.21.0
  - @voyantjs/hono@0.21.0

## 0.20.0

### Patch Changes

- @voyantjs/bookings@0.20.0
- @voyantjs/catalog@0.20.0
- @voyantjs/core@0.20.0
- @voyantjs/db@0.20.0
- @voyantjs/hono@0.20.0

## 0.19.0

### Patch Changes

- Updated dependencies [714c544]
  - @voyantjs/bookings@0.19.0
  - @voyantjs/core@0.19.0
  - @voyantjs/db@0.19.0
  - @voyantjs/hono@0.19.0

## 0.18.0

### Minor Changes

- 8932f60: Make schema discovery declarative and unblock downstream `drizzle-kit generate` against published packages.

  **Exports — `default` condition added everywhere (fixes #380)**

  Every `@voyantjs/*` package's `publishConfig.exports` previously declared only `types` and `import`. drizzle-kit (and any CJS-based resolver) walked the `require` branch, hit nothing, and threw `ERR_PACKAGE_PATH_NOT_EXPORTED` on subpaths like `@voyantjs/db/schema`. Each subpath now also declares a `default` condition pointing at the same `.js` file, so downstream consumers can resolve subpaths and run their own `drizzle-kit generate` against the canonical runtime schema.

  **Operator template baseline regenerated (fixes #378, #379)**

  `templates/operator/migrations/0000_striped_jubilee.sql` was missing `bookings.fx_rate_set_id` (causing `GET /v1/admin/bookings` to 500), and `@voyantjs/cruises`'s 14 tables had never made it into any baseline. Added `@voyantjs/cruises` to `templates/operator/drizzle.config.ts` and emitted `0004_steady_molten_man.sql` covering all drift (cruise tables/enums, the missing `fx_rate_set_id`, idempotency keys, vouchers, voucher redemptions, the `accessibility_needs` → encrypted-jsonb move, several check constraints, new enum values). Pruned 7 stale orphan migrations that were on disk but not in `_journal.json`. Schema baseline + runtime now match — `drizzle-kit generate` against a freshly migrated DB returns "No schema changes".

  **One `./schema` per module — sub-paths removed (BREAKING)**

  Each module now exposes exactly one schema entrypoint, `./schema`, that re-exports everything DB-related the module owns. Granular sub-paths are deleted from `exports` and `publishConfig.exports`:

  - `@voyantjs/bookings/schema/travel-details` → fold into `@voyantjs/bookings/schema`
  - `@voyantjs/legal/contracts/schema` and `@voyantjs/legal/policies/schema` → fold into the new `@voyantjs/legal/schema`
  - `@voyantjs/{products,crm,cruises,distribution,transactions,charters}/schema` now also re-export the pgTables declared inside `./booking-extension`. The runtime `./booking-extension` HonoExtension export is unchanged.

  Consumers importing from any of the removed sub-paths must switch to the consolidated `./schema` import.

  **Declarative dependency graph in `package.json`**

  Every module package gained a `voyant: { schema, requiresSchemas: [...] }` block declaring its schema entrypoint and the other modules' schemas it needs at the SQL level (e.g. `hospitality` requires `facilities` and `bookings`; `ground` requires `facilities` and `identity`; `suppliers` requires `facilities`; everyone implicitly requires `db`). The CLI reads this block to compute the dependency closure for a project.

  **`@voyantjs/cli` — `resolveSchemas` helper + `voyant db schemas` command**

  New `@voyantjs/cli/drizzle` entrypoint exporting `resolveSchemas(config, options?)` — walks `voyant.requiresSchemas` transitively from the modules listed in `voyant.config.ts`, dedupes, returns specifier strings (default) or absolute file paths (`style: "file"`). Throws on circular dependencies. New `voyant db schemas` debug command prints the resolved closure.

  ```ts
  // drizzle.config.ts
  import { defineConfig } from "drizzle-kit";
  import { resolveSchemas } from "@voyantjs/cli/drizzle";
  import voyantConfig from "./voyant.config";

  export default defineConfig({
    schema: resolveSchemas(voyantConfig),
    out: "./migrations",
    dialect: "postgresql",
    dbCredentials: { url: process.env.DATABASE_URL! },
  });
  ```

  Adding a new module to `voyant.config.ts` now picks up its schema (and transitive schema deps) automatically — no more manual schema lists, no forgotten modules.

  **Migration impact for existing operator deployments**

  Apply `0004_steady_molten_man.sql` (column + new tables, non-destructive aside from the deliberate `accessibility_needs` text → encrypted-jsonb move) and `0005_condemned_nomad.sql` (cruise booking-extension tables — only relevant when the cruises module is mounted).

### Patch Changes

- Updated dependencies [8932f60]
  - @voyantjs/bookings@0.18.0
  - @voyantjs/core@0.18.0
  - @voyantjs/db@0.18.0
  - @voyantjs/hono@0.18.0

## 0.17.0

### Patch Changes

- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
  - @voyantjs/bookings@0.17.0
  - @voyantjs/core@0.17.0
  - @voyantjs/db@0.17.0
  - @voyantjs/hono@0.17.0

## 0.16.0

### Patch Changes

- @voyantjs/bookings@0.16.0
- @voyantjs/core@0.16.0
- @voyantjs/db@0.16.0
- @voyantjs/hono@0.16.0

## 0.15.0

### Patch Changes

- @voyantjs/bookings@0.15.0
- @voyantjs/core@0.15.0
- @voyantjs/db@0.15.0
- @voyantjs/hono@0.15.0

## 0.14.0

### Patch Changes

- @voyantjs/bookings@0.14.0
- @voyantjs/core@0.14.0
- @voyantjs/db@0.14.0
- @voyantjs/hono@0.14.0

## 0.13.0

### Patch Changes

- Updated dependencies [7dfbc05]
- Updated dependencies [15dda79]
  - @voyantjs/bookings@0.13.0
  - @voyantjs/core@0.13.0
  - @voyantjs/db@0.13.0
  - @voyantjs/hono@0.13.0

## 0.12.0

### Minor Changes

- cc561ce: Adds the cruises module — a new opt-in vertical for cruise-selling travel agencies, designed natively against Voyant's existing module/extension/link conventions and reverse-engineered from the cross-line cruise-industry data shape (sailings, ships, decks, cabin categories, fare codes, occupancy grids, dated promo overlays, expedition enrichment programs).

  **`@voyantjs/cruises`** — full server module:

  - 13 tables: cruises, sailings, ships, decks, cabin categories, cabins, prices, price components, days, sailing-day overrides, media, inclusions, search index, enrichment programs.
  - Pricing: a (sailing × cabin category × occupancy × fare code) grid with per-row price components (gratuities, OBC, port charges, taxes, NCF, airfare). Soft-FKs to `@voyantjs/pricing` `priceCatalogs`/`priceSchedules` for promo overlays — no cruise-local promotions table.
  - Itinerary at two levels: `cruise_days` template + `cruise_sailing_days` per-sailing overrides (skipped ports, alternate times, ship swaps). `getEffectiveItinerary()` merges them.
  - River direction enum (`upstream | downstream | round_trip | one_way`) on sailings.
  - Expedition enrichment programs (naturalist / historian / photographer / lecturer / expert).
  - Money math (`composeQuote`) is a pure function performed in BigInt cents — supports occupancy variants, single-supplement %, second-guest pricing, and the addition/credit/inclusion price-component directions. 20 unit tests cover the math.
  - Booking integration: `booking_cruise_details` + `booking_group_cruise_details` extension tables, `cruisesBookingService.createCruiseBooking` (single cabin) and `createCruisePartyBooking` (multi-cabin via `bookingGroups` of new kind `cruise_party`). External-sailing bookings go through `createExternalCruiseBooking` which commits upstream first, then snapshots the connector booking ref.
  - **Provenance — local + external in one experience.** Cruises can be self-managed (operator owns the rows) or external (sourced through a registered `CruiseAdapter`). Admin routes use a unified-key parser that accepts both `cru_*` TypeIDs and `<provider>:<ref>` external keys; list endpoints interleave both sources via parallel `Promise.allSettled` adapter fan-out. External writes return 409. `POST /:key/refresh` re-fetches; `POST /:key/detach` does a one-way snapshot to local.
  - Adapter contract (`@voyantjs/cruises/adapters`): `CruiseAdapter` interface with `listEntries` / `searchProjection` / `fetchCruise` / `fetchSailing` / `fetchSailingPricing` / `fetchSailingItinerary` / `fetchShip` / `listSailingsForCruise` / `createBooking`. Process-local registry (`registerCruiseAdapter`/`resolveCruiseAdapter`/`listCruiseAdapters`), TTL+LRU memoize decorator, and `MockCruiseAdapter` for tests. The Voyant Connect adapter is intentionally not built in this release — the contract is ready for it.
  - Search index (`cruise_search_index`): opt-in storefront projection. Local cruises are projected automatically by mutation hooks in `cruisesService`; adapters call `PUT /v1/admin/cruises/search-index/bulk` to push externals. Storefront `GET /v1/public/cruises` reads exclusively from this index for paginated/filterable browse with provenance-aware detail dispatch.
  - ~88 unit tests covering pricing math, key parsing, route validation, adapter registry, mock adapter, memoize decorator, and direction/enrichment validation.

  **`@voyantjs/cruises-react`** — React Query hooks + Zod fetch client:

  - ~25 hooks: `useCruises` / `useCruise` / `useCruiseMutation`, `useSailings` / `useSailing` / `useSailingMutation`, `useShips` + ship-detail family, `usePrices` / `useQuote`, `useCruiseBookingMutation` (single + party), `useEnrichmentPrograms` / `useEnrichmentMutation`, `useExternalCruiseActions` (refresh / detach), `useSearchIndexMutation`, `useStorefrontCruises` / `useStorefrontCruise` / `useStorefrontSailing`.
  - Mirrors `@voyantjs/crm-react` and `@voyantjs/products-react` exactly: hierarchical query keys rooted at `["voyant", "cruises"]`, `queryOptions()` factories for SSR/router prefetch, envelope helpers, `VoyantCruisesProvider`, mutations that invalidate the parent resource and `setQueryData` on the detail.

  **`@voyantjs/bookings`**: extends `bookingGroupKindEnum` with `cruise_party` so multi-cabin party bookings have a first-class group kind alongside `shared_room` and `other`. Pure additive; existing groups unaffected.

  **`@voyantjs/db`**: registers TypeID prefixes for the cruise namespace (`cru`, `crsl`, `crsh`, `crdk`, `crcc`, `crcb`, `crpx`, `crpc`, `crdy`, `crsd`, `crme`, `crin`, `crsi`, `crep`).

  **`@voyantjs/ui`** (registry only — versionless): adds the `voyant-cruises-*` shadcn registry components — `external-badge`, `cruise-card`, `cruise-list`, `pricing-grid` (the load-bearing cabin × occupancy matrix), `quote-display`, `enrichment-program-list`. Install via `shadcn add voyant-cruises-cruise-card` etc.

  **Example app** (`examples/nextjs-booking-portal`): adds `/cruises` listing + `/cruises/[slug]` detail pages backed by `/v1/public/cruises`, with mock data showing the local-vs-external dual-source UI.

  **Design doc**: full rationale, schema, and architecture in `docs/architecture/cruises-module.md` (745 lines).

### Patch Changes

- Updated dependencies [944d244]
- Updated dependencies [cc561ce]
  - @voyantjs/bookings@0.12.0
  - @voyantjs/core@0.12.0
  - @voyantjs/db@0.12.0
  - @voyantjs/hono@0.12.0

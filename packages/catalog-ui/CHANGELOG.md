# @voyantjs/catalog-ui

## 0.102.0

### Patch Changes

- Updated dependencies [b6d0673]
  - @voyantjs/catalog-react@0.102.0
  - @voyantjs/i18n@0.102.0
  - @voyantjs/ui@0.102.0

## 0.101.2

### Patch Changes

- Updated dependencies [577eaf5]
- Updated dependencies [577eaf5]
  - @voyantjs/catalog-react@0.101.2
  - @voyantjs/i18n@0.101.2
  - @voyantjs/ui@0.101.2

## 0.101.1

### Patch Changes

- f736ba5: Improve product booking configuration for room-based travel products.

  - `@voyantjs/products-ui`: rename the product setup UI around booking options, room inventory, traveler prices, and departure room inventory; hide traveler-age controls for room inventory units; add setup guardrails so room-based products cannot mix the legacy one-option-per-room shape with the canonical single-option/multiple-room-units shape.
  - `@voyantjs/bookings` and `@voyantjs/bookings-react`: preserve selected room/category refs through booking creation and quote travelers against the selected room plus traveler pricing category instead of falling back to unrelated rates.
  - `@voyantjs/bookings-ui`: let agents select both the room and the traveler pricing category for each traveler when the selected room exposes category-specific prices, enforce room occupancy in the booking flow, and keep the booking summary aligned with the selected room.
  - `@voyantjs/availability-react`: expose the additional resource template fields needed by room inventory setup.
  - `@voyantjs/i18n`: add Romanian product-management labels for the renamed booking option and inventory concepts.
  - `@voyantjs/catalog-ui`: localize ship-spec labels used by the catalog detail sheet.

- 26c6908: Fix sourced cruises rendering blank in the catalog (#1466).

  - `@voyantjs/cruises`: the catalog source-adapter shim (`toCatalogProjection`) now emits the field-policy keys the indexer and catalog UI expect (`cruiseType`, `nights`, `status`, `heroImageUrl`/`thumbnailUrl`, `lowestPriceCached`, `lineSupplierId`/`defaultShipId`, `source.kind`/`source.ref`) instead of unrecognized snake*case keys that were silently dropped — so sourced cruises carry Type/Nights/Status/Supplier/Ship/Price/Source into the index. `CruiseSearchProjectionEntry` gains `lineExternalId`/`shipExternalId` (surfaced by `@voyantjs/connect-cruises` ≥0.3.1). The content route (`GET /:key/content`) and `parseUnifiedKey` now accept the catalog sourced entity-id form (`crus_sr*<base64>`) via the new `isEncodedSourceEntityId`helper, and dispatch sourced ids without the owned-key opt-in — previously they returned`400 invalid_key`, leaving the detail sheet empty. Adds `getCruiseSailingPricing`+ a`GET /:key/sailings/:sailingExternalId/pricing`content route serving live per-cabin pricing for sourced sailings (volatile-live, fetched fresh — never cached). The source-adapter shim now drops a sailing's`lowest_price_cents`/`currency` unless both are present (the content schema requires both-or-neither) so an adapter that surfaces a price without its currency can't fail content validation.
  - `@voyantjs/catalog-ui`: `createCatalogEnrichmentFetchers` routes the detail-content fetch per vertical via `contentBasePathByVertical`, and `CatalogPage` wires `onLoadDetail` on every vertical tab (not just products) so non-product detail sheets (cruises, etc.) actually fetch their enrichment from the correct content route. Adds `loadDeparturePricing` (lazy per-cabin pricing fetched on departure-row expand, matched to cabins by code → per-cabin price + availability). The detail sheet labels the cruise options tab "Cabins", renders the entity id as a compact copyable chip, falls back the Itinerary tab to the first sailing's stops, and sanitizes cabin names + descriptions (strips HTML tags and decodes entities like `&nbsp;`). Cabin cards are redesigned as a photo gallery (new `MediaGallery` — a carousel thumbnail that opens a full-screen lightbox carousel on click) alongside size (sqft), capacity, description, and de-duplicated amenity chips. The Overview drops the canonical-geography id columns (`country_iso`/`region_ids`/`port_ids`/`waterway_ids`) and empty array rows, and adds a media gallery (cruise cover + cabin photos) when imagery is available.
  - `@voyantjs/catalog-ui`: the cruise detail sheet gains a **Ship** tab showing the vessel the cruise sails on — gallery (carousel + lightbox), name/type, key specs (capacity, decks, year built) and description.
  - `@voyantjs/catalog-ui`: for the cruises vertical the detail sheet's **Departures** tab is relabeled **Sailings** (industry term), along with its empty-state and filtered no-results copy — other verticals keep "Departures".
  - `@voyantjs/cruises-contracts`: the cabin-category content shape gains `images` + `square_feet` so cabin photos and size flow end-to-end (the cruise shim maps them from the adapter's `images`/`floorplanImages`/`squareFeet`; the data was previously dropped). The ship content shape gains `ship_type` + `gallery` so the vessel's class and photos reach the Ship tab.

- Updated dependencies [f736ba5]
  - @voyantjs/catalog-react@0.101.1
  - @voyantjs/i18n@0.101.1
  - @voyantjs/ui@0.101.1

## 0.101.0

### Patch Changes

- @voyantjs/catalog-react@0.101.0
- @voyantjs/i18n@0.101.0
- @voyantjs/ui@0.101.0

## 0.100.0

### Patch Changes

- @voyantjs/catalog-react@0.100.0
- @voyantjs/i18n@0.100.0
- @voyantjs/ui@0.100.0

## 0.99.0

### Patch Changes

- @voyantjs/catalog-react@0.99.0
- @voyantjs/i18n@0.99.0
- @voyantjs/ui@0.99.0

## 0.98.0

### Patch Changes

- @voyantjs/catalog-react@0.98.0
- @voyantjs/i18n@0.98.0
- @voyantjs/ui@0.98.0

## 0.97.0

### Patch Changes

- @voyantjs/catalog-react@0.97.0
- @voyantjs/i18n@0.97.0
- @voyantjs/ui@0.97.0

## 0.96.0

### Patch Changes

- @voyantjs/catalog-react@0.96.0
- @voyantjs/i18n@0.96.0
- @voyantjs/ui@0.96.0

## 0.95.0

### Patch Changes

- @voyantjs/catalog-react@0.95.0
- @voyantjs/i18n@0.95.0
- @voyantjs/ui@0.95.0

## 0.94.0

### Patch Changes

- @voyantjs/catalog-react@0.94.0
- @voyantjs/i18n@0.94.0
- @voyantjs/ui@0.94.0

## 0.93.0

### Patch Changes

- @voyantjs/catalog-react@0.93.0
- @voyantjs/i18n@0.93.0
- @voyantjs/ui@0.93.0

## 0.92.0

### Patch Changes

- @voyantjs/catalog-react@0.92.0
- @voyantjs/i18n@0.92.0
- @voyantjs/ui@0.92.0

## 0.91.0

### Patch Changes

- @voyantjs/catalog-react@0.91.0
- @voyantjs/i18n@0.91.0
- @voyantjs/ui@0.91.0

## 0.90.0

### Patch Changes

- @voyantjs/catalog-react@0.90.0
- @voyantjs/i18n@0.90.0
- @voyantjs/ui@0.90.0

## 0.89.0

### Patch Changes

- @voyantjs/catalog-react@0.89.0
- @voyantjs/i18n@0.89.0
- @voyantjs/ui@0.89.0

## 0.88.0

### Patch Changes

- @voyantjs/catalog-react@0.88.0
- @voyantjs/i18n@0.88.0
- @voyantjs/ui@0.88.0

## 0.87.1

### Patch Changes

- @voyantjs/catalog-react@0.87.1
- @voyantjs/i18n@0.87.1
- @voyantjs/ui@0.87.1

## 0.87.0

### Patch Changes

- @voyantjs/catalog-react@0.87.0
- @voyantjs/i18n@0.87.0
- @voyantjs/ui@0.87.0

## 0.86.0

### Patch Changes

- Updated dependencies [ddf4a19]
  - @voyantjs/catalog-react@0.86.0
  - @voyantjs/i18n@0.86.0
  - @voyantjs/ui@0.86.0

## 0.85.4

### Patch Changes

- @voyantjs/catalog-react@0.85.4
- @voyantjs/i18n@0.85.4
- @voyantjs/ui@0.85.4

## 0.85.3

### Patch Changes

- 7f0970e: Expose cruise sourced-content sailing price summaries as `lowest_price_cents` integer minor units plus `currency`, and map cruise sailings directly into catalog UI departure prices.
  - @voyantjs/catalog-react@0.85.3
  - @voyantjs/i18n@0.85.3
  - @voyantjs/ui@0.85.3

## 0.85.2

### Patch Changes

- @voyantjs/catalog-react@0.85.2
- @voyantjs/i18n@0.85.2
- @voyantjs/ui@0.85.2

## 0.85.1

### Patch Changes

- @voyantjs/catalog-react@0.85.1
- @voyantjs/i18n@0.85.1
- @voyantjs/ui@0.85.1

## 0.85.0

### Patch Changes

- @voyantjs/catalog-react@0.85.0
- @voyantjs/i18n@0.85.0
- @voyantjs/ui@0.85.0

## 0.84.4

### Patch Changes

- @voyantjs/catalog-react@0.84.4
- @voyantjs/i18n@0.84.4
- @voyantjs/ui@0.84.4

## 0.84.3

### Patch Changes

- Updated dependencies [9eadf50]
  - @voyantjs/catalog-react@0.84.3
  - @voyantjs/i18n@0.84.3
  - @voyantjs/ui@0.84.3

## 0.84.2

### Patch Changes

- @voyantjs/catalog-react@0.84.2
- @voyantjs/i18n@0.84.2
- @voyantjs/ui@0.84.2

## 0.84.1

### Patch Changes

- @voyantjs/catalog-react@0.84.1
- @voyantjs/i18n@0.84.1
- @voyantjs/ui@0.84.1

## 0.84.0

### Patch Changes

- Updated dependencies [5462f07]
  - @voyantjs/catalog-react@0.84.0
  - @voyantjs/i18n@0.84.0
  - @voyantjs/ui@0.84.0

## 0.83.1

### Patch Changes

- @voyantjs/catalog-react@0.83.1
- @voyantjs/i18n@0.83.1
- @voyantjs/ui@0.83.1

## 0.83.0

### Patch Changes

- @voyantjs/catalog-react@0.83.0
- @voyantjs/i18n@0.83.0
- @voyantjs/ui@0.83.0

## 0.82.1

### Patch Changes

- @voyantjs/catalog-react@0.82.1
- @voyantjs/i18n@0.82.1
- @voyantjs/ui@0.82.1

## 0.82.0

### Patch Changes

- Updated dependencies [79ce168]
  - @voyantjs/catalog-react@0.82.0
  - @voyantjs/i18n@0.82.0
  - @voyantjs/ui@0.82.0

## 0.81.21

### Patch Changes

- @voyantjs/catalog-react@0.81.21
- @voyantjs/i18n@0.81.21
- @voyantjs/ui@0.81.21

## 0.81.20

### Patch Changes

- @voyantjs/catalog-react@0.81.20
- @voyantjs/i18n@0.81.20
- @voyantjs/ui@0.81.20

## 0.81.19

### Patch Changes

- @voyantjs/catalog-react@0.81.19
- @voyantjs/i18n@0.81.19
- @voyantjs/ui@0.81.19

## 0.81.18

### Patch Changes

- Updated dependencies [93874e4]
  - @voyantjs/catalog-react@0.81.18
  - @voyantjs/i18n@0.81.18
  - @voyantjs/ui@0.81.18

## 0.81.17

### Patch Changes

- Updated dependencies [e31a008]
  - @voyantjs/catalog-react@0.81.17
  - @voyantjs/i18n@0.81.17
  - @voyantjs/ui@0.81.17

## 0.81.16

### Patch Changes

- Updated dependencies [0a617cc]
  - @voyantjs/catalog-react@0.81.16
  - @voyantjs/i18n@0.81.16
  - @voyantjs/ui@0.81.16

## 0.81.15

### Patch Changes

- @voyantjs/catalog-react@0.81.15
- @voyantjs/i18n@0.81.15
- @voyantjs/ui@0.81.15

## 0.81.14

### Patch Changes

- @voyantjs/catalog-react@0.81.14
- @voyantjs/i18n@0.81.14
- @voyantjs/ui@0.81.14

## 0.81.13

### Patch Changes

- Updated dependencies [36421aa]
  - @voyantjs/catalog-react@0.81.13
  - @voyantjs/i18n@0.81.13
  - @voyantjs/ui@0.81.13

## 0.81.12

### Patch Changes

- @voyantjs/catalog-react@0.81.12
- @voyantjs/i18n@0.81.12
- @voyantjs/ui@0.81.12

## 0.81.11

### Patch Changes

- @voyantjs/catalog-react@0.81.11
- @voyantjs/i18n@0.81.11
- @voyantjs/ui@0.81.11

## 0.81.10

### Patch Changes

- @voyantjs/catalog-react@0.81.10
- @voyantjs/i18n@0.81.10
- @voyantjs/ui@0.81.10

## 0.81.9

### Patch Changes

- @voyantjs/catalog-react@0.81.9
- @voyantjs/i18n@0.81.9
- @voyantjs/ui@0.81.9

## 0.81.8

### Patch Changes

- @voyantjs/catalog-react@0.81.8
- @voyantjs/i18n@0.81.8
- @voyantjs/ui@0.81.8

## 0.81.7

### Patch Changes

- @voyantjs/catalog-react@0.81.7
- @voyantjs/i18n@0.81.7
- @voyantjs/ui@0.81.7

## 0.81.6

### Patch Changes

- @voyantjs/catalog-react@0.81.6
- @voyantjs/i18n@0.81.6
- @voyantjs/ui@0.81.6

## 0.81.5

### Patch Changes

- @voyantjs/catalog-react@0.81.5
- @voyantjs/i18n@0.81.5
- @voyantjs/ui@0.81.5

## 0.81.4

### Patch Changes

- @voyantjs/catalog-react@0.81.4
- @voyantjs/i18n@0.81.4
- @voyantjs/ui@0.81.4

## 0.81.3

### Patch Changes

- Updated dependencies [f157bcd]
  - @voyantjs/catalog-react@0.81.3
  - @voyantjs/i18n@0.81.3
  - @voyantjs/ui@0.81.3

## 0.81.2

### Patch Changes

- @voyantjs/catalog-react@0.81.2
- @voyantjs/i18n@0.81.2
- @voyantjs/ui@0.81.2

## 0.81.1

### Patch Changes

- @voyantjs/catalog-react@0.81.1
- @voyantjs/i18n@0.81.1
- @voyantjs/ui@0.81.1

## 0.81.0

### Patch Changes

- @voyantjs/catalog-react@0.81.0
- @voyantjs/i18n@0.81.0
- @voyantjs/ui@0.81.0

## 0.80.18

### Patch Changes

- @voyantjs/catalog-react@0.80.18
- @voyantjs/i18n@0.80.18
- @voyantjs/ui@0.80.18

## 0.80.17

### Patch Changes

- @voyantjs/catalog-react@0.80.17
- @voyantjs/i18n@0.80.17
- @voyantjs/ui@0.80.17

## 0.80.16

### Patch Changes

- Updated dependencies [dbcc0da]
  - @voyantjs/catalog-react@0.80.16
  - @voyantjs/i18n@0.80.16
  - @voyantjs/ui@0.80.16

## 0.80.15

### Patch Changes

- @voyantjs/catalog-react@0.80.15
- @voyantjs/i18n@0.80.15
- @voyantjs/ui@0.80.15

## 0.80.14

### Patch Changes

- @voyantjs/catalog-react@0.80.14
- @voyantjs/i18n@0.80.14
- @voyantjs/ui@0.80.14

## 0.80.13

### Patch Changes

- @voyantjs/catalog-react@0.80.13
- @voyantjs/i18n@0.80.13
- @voyantjs/ui@0.80.13

## 0.80.12

### Patch Changes

- Updated dependencies [5070731]
  - @voyantjs/catalog-react@0.80.12
  - @voyantjs/i18n@0.80.12
  - @voyantjs/ui@0.80.12

## 0.80.11

### Patch Changes

- @voyantjs/catalog-react@0.80.11
- @voyantjs/i18n@0.80.11
- @voyantjs/ui@0.80.11

## 0.80.10

### Patch Changes

- @voyantjs/catalog-react@0.80.10
- @voyantjs/i18n@0.80.10
- @voyantjs/ui@0.80.10

## 0.80.9

### Patch Changes

- @voyantjs/catalog-react@0.80.9
- @voyantjs/i18n@0.80.9
- @voyantjs/ui@0.80.9

## 0.80.8

### Patch Changes

- @voyantjs/catalog-react@0.80.8
- @voyantjs/i18n@0.80.8
- @voyantjs/ui@0.80.8

## 0.80.7

### Patch Changes

- @voyantjs/catalog-react@0.80.7
- @voyantjs/i18n@0.80.7
- @voyantjs/ui@0.80.7

## 0.80.6

### Patch Changes

- @voyantjs/catalog-react@0.80.6
- @voyantjs/i18n@0.80.6
- @voyantjs/ui@0.80.6

## 0.80.5

### Patch Changes

- @voyantjs/catalog-react@0.80.5
- @voyantjs/i18n@0.80.5
- @voyantjs/ui@0.80.5

## 0.80.4

### Patch Changes

- @voyantjs/catalog-react@0.80.4
- @voyantjs/i18n@0.80.4
- @voyantjs/ui@0.80.4

## 0.80.3

### Patch Changes

- @voyantjs/catalog-react@0.80.3
- @voyantjs/i18n@0.80.3
- @voyantjs/ui@0.80.3

## 0.80.2

### Patch Changes

- @voyantjs/catalog-react@0.80.2
- @voyantjs/i18n@0.80.2
- @voyantjs/ui@0.80.2

## 0.80.1

### Patch Changes

- @voyantjs/catalog-react@0.80.1
- @voyantjs/i18n@0.80.1
- @voyantjs/ui@0.80.1

## 0.80.0

### Patch Changes

- Updated dependencies [9473eb8]
  - @voyantjs/catalog-react@0.80.0
  - @voyantjs/i18n@0.80.0
  - @voyantjs/ui@0.80.0

## 0.79.0

### Patch Changes

- @voyantjs/catalog-react@0.79.0
- @voyantjs/i18n@0.79.0
- @voyantjs/ui@0.79.0

## 0.78.0

### Patch Changes

- @voyantjs/catalog-react@0.78.0
- @voyantjs/i18n@0.78.0
- @voyantjs/ui@0.78.0

## 0.77.13

### Patch Changes

- @voyantjs/catalog-react@0.77.13
- @voyantjs/i18n@0.77.13
- @voyantjs/ui@0.77.13

## 0.77.12

### Patch Changes

- Updated dependencies [bf74cd4]
  - @voyantjs/catalog-react@0.77.12
  - @voyantjs/i18n@0.77.12
  - @voyantjs/ui@0.77.12

## 0.77.11

### Patch Changes

- @voyantjs/catalog-react@0.77.11
- @voyantjs/i18n@0.77.11
- @voyantjs/ui@0.77.11

## 0.77.10

### Patch Changes

- @voyantjs/catalog-react@0.77.10
- @voyantjs/i18n@0.77.10
- @voyantjs/ui@0.77.10

## 0.77.9

### Patch Changes

- @voyantjs/catalog-react@0.77.9
- @voyantjs/i18n@0.77.9
- @voyantjs/ui@0.77.9

## 0.77.8

### Patch Changes

- @voyantjs/catalog-react@0.77.8
- @voyantjs/i18n@0.77.8
- @voyantjs/ui@0.77.8

## 0.77.7

### Patch Changes

- @voyantjs/catalog-react@0.77.7
- @voyantjs/i18n@0.77.7
- @voyantjs/ui@0.77.7

## 0.77.6

### Patch Changes

- @voyantjs/catalog-react@0.77.6
- @voyantjs/i18n@0.77.6
- @voyantjs/ui@0.77.6

## 0.77.5

### Patch Changes

- @voyantjs/catalog-react@0.77.5
- @voyantjs/i18n@0.77.5
- @voyantjs/ui@0.77.5

## 0.77.4

### Patch Changes

- @voyantjs/catalog-react@0.77.4
- @voyantjs/i18n@0.77.4
- @voyantjs/ui@0.77.4

## 0.77.3

### Patch Changes

- @voyantjs/catalog-react@0.77.3
- @voyantjs/i18n@0.77.3
- @voyantjs/ui@0.77.3

## 0.77.2

### Patch Changes

- @voyantjs/catalog-react@0.77.2
- @voyantjs/i18n@0.77.2
- @voyantjs/ui@0.77.2

## 0.77.1

### Patch Changes

- @voyantjs/catalog-react@0.77.1
- @voyantjs/i18n@0.77.1
- @voyantjs/ui@0.77.1

## 0.77.0

### Patch Changes

- @voyantjs/catalog-react@0.77.0
- @voyantjs/i18n@0.77.0
- @voyantjs/ui@0.77.0

## 0.76.0

### Patch Changes

- @voyantjs/catalog-react@0.76.0
- @voyantjs/i18n@0.76.0
- @voyantjs/ui@0.76.0

## 0.75.7

### Patch Changes

- @voyantjs/catalog-react@0.75.7
- @voyantjs/i18n@0.75.7
- @voyantjs/ui@0.75.7

## 0.75.6

### Patch Changes

- @voyantjs/catalog-react@0.75.6
- @voyantjs/i18n@0.75.6
- @voyantjs/ui@0.75.6

## 0.75.5

### Patch Changes

- @voyantjs/catalog-react@0.75.5
- @voyantjs/i18n@0.75.5
- @voyantjs/ui@0.75.5

## 0.75.4

### Patch Changes

- @voyantjs/catalog-react@0.75.4
- @voyantjs/i18n@0.75.4
- @voyantjs/ui@0.75.4

## 0.75.3

### Patch Changes

- Updated dependencies [38167cd]
  - @voyantjs/catalog-react@0.75.3
  - @voyantjs/i18n@0.75.3
  - @voyantjs/ui@0.75.3

## 0.75.2

### Patch Changes

- @voyantjs/catalog-react@0.75.2
- @voyantjs/i18n@0.75.2
- @voyantjs/ui@0.75.2

## 0.75.1

### Patch Changes

- @voyantjs/catalog-react@0.75.1
- @voyantjs/i18n@0.75.1
- @voyantjs/ui@0.75.1

## 0.75.0

### Patch Changes

- @voyantjs/catalog-react@0.75.0
- @voyantjs/i18n@0.75.0
- @voyantjs/ui@0.75.0

## 0.74.2

### Patch Changes

- @voyantjs/catalog-react@0.74.2
- @voyantjs/i18n@0.74.2
- @voyantjs/ui@0.74.2

## 0.74.1

### Patch Changes

- @voyantjs/catalog-react@0.74.1
- @voyantjs/i18n@0.74.1
- @voyantjs/ui@0.74.1

## 0.74.0

### Patch Changes

- @voyantjs/catalog-react@0.74.0
- @voyantjs/i18n@0.74.0
- @voyantjs/ui@0.74.0

## 0.73.1

### Patch Changes

- @voyantjs/catalog-react@0.73.1
- @voyantjs/i18n@0.73.1
- @voyantjs/ui@0.73.1

## 0.73.0

### Patch Changes

- @voyantjs/catalog-react@0.73.0
- @voyantjs/i18n@0.73.0
- @voyantjs/ui@0.73.0

## 0.72.0

### Patch Changes

- @voyantjs/catalog-react@0.72.0
- @voyantjs/i18n@0.72.0
- @voyantjs/ui@0.72.0

## 0.71.0

### Patch Changes

- @voyantjs/catalog-react@0.71.0
- @voyantjs/i18n@0.71.0
- @voyantjs/ui@0.71.0

## 0.70.0

### Patch Changes

- @voyantjs/catalog-react@0.70.0
- @voyantjs/i18n@0.70.0
- @voyantjs/ui@0.70.0

## 0.69.1

### Patch Changes

- @voyantjs/catalog-react@0.69.1
- @voyantjs/i18n@0.69.1
- @voyantjs/ui@0.69.1

## 0.69.0

### Patch Changes

- @voyantjs/catalog-react@0.69.0
- @voyantjs/i18n@0.69.0
- @voyantjs/ui@0.69.0

## 0.68.0

### Minor Changes

- 72c9ab0: Add `createCatalogEnrichmentFetchers({ baseUrl, formatSupplier?, locale?, market?, contentBasePath?, loadSlotAvailability? })` and a matching `CatalogPage` prop `enrichmentFetchers`. Lifts the `/v1/admin/products/:id/content` URL contract out of host-template glue code and into a first-class export, mirroring `createCatalogBookingFetchers`. Hosts that pass `enrichmentFetchers` no longer need to hand-roll `onLoadProductDetail`. On the first 404 response (the symptom when a host forgets to mount `createProductContentRoutes` from `@voyantjs/products/routes-content`), the fetcher emits a one-time `console.warn` that names the missing route — so the silent "empty detail sheet" failure mode called out in issue #1023 turns into a loud actionable hint.

### Patch Changes

- @voyantjs/catalog-react@0.68.0
- @voyantjs/i18n@0.68.0
- @voyantjs/ui@0.68.0

## 0.67.0

### Patch Changes

- @voyantjs/catalog-react@0.67.0
- @voyantjs/i18n@0.67.0
- @voyantjs/ui@0.67.0

## 0.66.6

### Patch Changes

- @voyantjs/catalog-react@0.66.6
- @voyantjs/i18n@0.66.6
- @voyantjs/ui@0.66.6

## 0.66.5

### Patch Changes

- @voyantjs/catalog-react@0.66.5
- @voyantjs/i18n@0.66.5
- @voyantjs/ui@0.66.5

## 0.66.4

### Patch Changes

- @voyantjs/catalog-react@0.66.4
- @voyantjs/i18n@0.66.4
- @voyantjs/ui@0.66.4

## 0.66.3

### Patch Changes

- @voyantjs/catalog-react@0.66.3
- @voyantjs/i18n@0.66.3
- @voyantjs/ui@0.66.3

## 0.66.2

### Patch Changes

- @voyantjs/catalog-react@0.66.2
- @voyantjs/i18n@0.66.2
- @voyantjs/ui@0.66.2

## 0.66.1

### Patch Changes

- @voyantjs/catalog-react@0.66.1
- @voyantjs/i18n@0.66.1
- @voyantjs/ui@0.66.1

## 0.66.0

### Patch Changes

- Updated dependencies [a74089c]
  - @voyantjs/catalog-react@0.66.0
  - @voyantjs/i18n@0.66.0
  - @voyantjs/ui@0.66.0

## 0.65.0

### Patch Changes

- @voyantjs/catalog-react@0.65.0
- @voyantjs/i18n@0.65.0
- @voyantjs/ui@0.65.0

## 0.64.1

### Patch Changes

- @voyantjs/catalog-react@0.64.1
- @voyantjs/i18n@0.64.1
- @voyantjs/ui@0.64.1

## 0.64.0

### Patch Changes

- @voyantjs/catalog-react@0.64.0
- @voyantjs/i18n@0.64.0
- @voyantjs/ui@0.64.0

## 0.63.1

### Patch Changes

- @voyantjs/catalog-react@0.63.1
- @voyantjs/i18n@0.63.1
- @voyantjs/ui@0.63.1

## 0.63.0

### Patch Changes

- @voyantjs/catalog-react@0.63.0
- @voyantjs/i18n@0.63.0
- @voyantjs/ui@0.63.0

## 0.62.3

### Patch Changes

- d0f1b36: Add catalog market/locale scope controls and React hooks for market product rules.
  - @voyantjs/catalog-react@0.62.3
  - @voyantjs/i18n@0.62.3
  - @voyantjs/ui@0.62.3

## 0.62.2

### Patch Changes

- @voyantjs/catalog-react@0.62.2
- @voyantjs/i18n@0.62.2
- @voyantjs/ui@0.62.2

## 0.62.1

### Patch Changes

- @voyantjs/catalog-react@0.62.1
- @voyantjs/i18n@0.62.1
- @voyantjs/ui@0.62.1

## 0.62.0

### Patch Changes

- @voyantjs/catalog-react@0.62.0
- @voyantjs/i18n@0.62.0
- @voyantjs/ui@0.62.0

## 0.61.0

### Patch Changes

- Updated dependencies [89f033e]
  - @voyantjs/catalog-react@0.61.0
  - @voyantjs/i18n@0.61.0
  - @voyantjs/ui@0.61.0

## 0.60.0

### Patch Changes

- @voyantjs/catalog-react@0.60.0
- @voyantjs/i18n@0.60.0
- @voyantjs/ui@0.60.0

## 0.59.0

### Patch Changes

- Updated dependencies [48927be]
  - @voyantjs/catalog-react@0.59.0
  - @voyantjs/i18n@0.59.0
  - @voyantjs/ui@0.59.0

## 0.58.0

### Patch Changes

- @voyantjs/catalog-react@0.58.0
- @voyantjs/i18n@0.58.0
- @voyantjs/ui@0.58.0

## 0.57.0

### Patch Changes

- @voyantjs/catalog-react@0.57.0
- @voyantjs/i18n@0.57.0
- @voyantjs/ui@0.57.0

## 0.56.0

### Patch Changes

- @voyantjs/catalog-react@0.56.0
- @voyantjs/i18n@0.56.0
- @voyantjs/ui@0.56.0

## 0.55.1

### Patch Changes

- Updated dependencies [819c847]
  - @voyantjs/catalog-react@0.55.1
  - @voyantjs/i18n@0.55.1
  - @voyantjs/ui@0.55.1

## 0.55.0

### Patch Changes

- @voyantjs/catalog-react@0.55.0
- @voyantjs/i18n@0.55.0
- @voyantjs/ui@0.55.0

## 0.54.0

### Patch Changes

- @voyantjs/catalog-react@0.54.0
- @voyantjs/i18n@0.54.0
- @voyantjs/ui@0.54.0

## 0.53.2

### Patch Changes

- @voyantjs/catalog-react@0.53.2
- @voyantjs/i18n@0.53.2
- @voyantjs/ui@0.53.2

## 0.53.1

### Patch Changes

- @voyantjs/catalog-react@0.53.1
- @voyantjs/i18n@0.53.1
- @voyantjs/ui@0.53.1

## 0.53.0

### Patch Changes

- @voyantjs/catalog-react@0.53.0
- @voyantjs/i18n@0.53.0
- @voyantjs/ui@0.53.0

## 0.52.4

### Patch Changes

- Updated dependencies [5d3c119]
  - @voyantjs/catalog-react@0.52.4
  - @voyantjs/i18n@0.52.4
  - @voyantjs/ui@0.52.4

## 0.52.3

### Patch Changes

- @voyantjs/catalog-react@0.52.3
- @voyantjs/i18n@0.52.3
- @voyantjs/ui@0.52.3

## 0.52.2

### Patch Changes

- 3e09123: Rebuild the catalog detail sheet and the underlying product content/policy plumbing.

  - `CatalogDetailSheet` is reorganized into stacked sections (header, gallery, itinerary, services, policies, sourced content) with proper loading and empty states; the search and grid pages share the new sheet.
  - New itinerary section on the product detail surface (in template + catalog) so day-by-day plans render the same way in catalog browsing and operator editing.
  - `@voyantjs/products`: introduce `catalog-policy` + `content-shape` modules to centralize how cancellation/booking policies and content blocks are resolved on the catalog plane. `service-catalog-plane` and `service-content-owned` now consume these instead of inlining policy logic per call site.
  - Catalog i18n strings added for itinerary, services, and policy sections (EN + RO).
  - Operator template: drop `product-sourced-content-section` (now provided by the catalog detail sheet) and update the product detail page to render the new sections.

- Updated dependencies [3e09123]
- Updated dependencies [6bdfcbc]
- Updated dependencies [3e09123]
  - @voyantjs/catalog-react@0.52.2
  - @voyantjs/i18n@0.52.2
  - @voyantjs/ui@0.52.2

## 0.52.1

### Patch Changes

- @voyantjs/catalog-react@0.52.1
- @voyantjs/i18n@0.52.1
- @voyantjs/ui@0.52.1

## 0.52.0

### Patch Changes

- @voyantjs/catalog-react@0.52.0
- @voyantjs/i18n@0.52.0
- @voyantjs/ui@0.52.0

## 0.51.1

### Patch Changes

- Updated dependencies [deaacb3]
  - @voyantjs/catalog-react@0.51.1
  - @voyantjs/i18n@0.51.1
  - @voyantjs/ui@0.51.1

## 0.51.0

### Patch Changes

- Updated dependencies [2316791]
  - @voyantjs/catalog-react@0.51.0
  - @voyantjs/i18n@0.51.0
  - @voyantjs/ui@0.51.0

## 0.50.8

### Patch Changes

- @voyantjs/catalog-react@0.50.8
- @voyantjs/i18n@0.50.8
- @voyantjs/ui@0.50.8

## 0.50.7

### Patch Changes

- @voyantjs/catalog-react@0.50.7
- @voyantjs/i18n@0.50.7
- @voyantjs/ui@0.50.7

## 0.50.6

### Patch Changes

- Updated dependencies [c14f0a8]
  - @voyantjs/catalog-react@0.50.6
  - @voyantjs/i18n@0.50.6
  - @voyantjs/ui@0.50.6

## 0.50.5

### Patch Changes

- @voyantjs/catalog-react@0.50.5
- @voyantjs/i18n@0.50.5
- @voyantjs/ui@0.50.5

## 0.50.4

### Patch Changes

- @voyantjs/catalog-react@0.50.4
- @voyantjs/i18n@0.50.4
- @voyantjs/ui@0.50.4

## 0.50.3

### Patch Changes

- @voyantjs/catalog-react@0.50.3
- @voyantjs/i18n@0.50.3
- @voyantjs/ui@0.50.3

## 0.50.2

### Patch Changes

- @voyantjs/catalog-react@0.50.2
- @voyantjs/i18n@0.50.2
- @voyantjs/ui@0.50.2

## 0.50.1

### Patch Changes

- @voyantjs/catalog-react@0.50.1
- @voyantjs/i18n@0.50.1
- @voyantjs/ui@0.50.1

## 0.50.0

### Patch Changes

- @voyantjs/catalog-react@0.50.0
- @voyantjs/i18n@0.50.0
- @voyantjs/ui@0.50.0

## 0.49.0

### Patch Changes

- @voyantjs/catalog-react@0.49.0
- @voyantjs/i18n@0.49.0
- @voyantjs/ui@0.49.0

## 0.48.0

### Patch Changes

- @voyantjs/catalog-react@0.48.0
- @voyantjs/i18n@0.48.0
- @voyantjs/ui@0.48.0

## 0.47.0

### Patch Changes

- @voyantjs/catalog-react@0.47.0
- @voyantjs/i18n@0.47.0
- @voyantjs/ui@0.47.0

## 0.46.0

### Patch Changes

- @voyantjs/catalog-react@0.46.0
- @voyantjs/i18n@0.46.0
- @voyantjs/ui@0.46.0

## 0.45.0

### Patch Changes

- @voyantjs/catalog-react@0.45.0
- @voyantjs/i18n@0.45.0
- @voyantjs/ui@0.45.0

## 0.44.0

### Patch Changes

- @voyantjs/catalog-react@0.44.0
- @voyantjs/i18n@0.44.0
- @voyantjs/ui@0.44.0

## 0.43.0

### Patch Changes

- @voyantjs/catalog-react@0.43.0
- @voyantjs/i18n@0.43.0
- @voyantjs/ui@0.43.0

## 0.42.0

### Patch Changes

- @voyantjs/catalog-react@0.42.0
- @voyantjs/i18n@0.42.0
- @voyantjs/ui@0.42.0

## 0.41.3

### Patch Changes

- @voyantjs/catalog-react@0.41.3
- @voyantjs/i18n@0.41.3
- @voyantjs/ui@0.41.3

## 0.41.2

### Patch Changes

- @voyantjs/catalog-react@0.41.2
- @voyantjs/i18n@0.41.2
- @voyantjs/ui@0.41.2

## 0.41.1

### Patch Changes

- @voyantjs/catalog-react@0.41.1
- @voyantjs/i18n@0.41.1
- @voyantjs/ui@0.41.1

## 0.41.0

### Patch Changes

- @voyantjs/catalog-react@0.41.0
- @voyantjs/i18n@0.41.0
- @voyantjs/ui@0.41.0

## 0.40.1

### Patch Changes

- @voyantjs/catalog-react@0.40.1
- @voyantjs/i18n@0.40.1
- @voyantjs/ui@0.40.1

## 0.40.0

### Patch Changes

- @voyantjs/catalog-react@0.40.0
- @voyantjs/i18n@0.40.0
- @voyantjs/ui@0.40.0

## 0.39.0

### Patch Changes

- Updated dependencies [f4235ea]
  - @voyantjs/catalog-react@0.39.0
  - @voyantjs/i18n@0.39.0
  - @voyantjs/ui@0.39.0

## 0.38.2

### Patch Changes

- @voyantjs/catalog-react@0.38.2
- @voyantjs/i18n@0.38.2
- @voyantjs/ui@0.38.2

## 0.38.1

### Patch Changes

- @voyantjs/catalog-react@0.38.1
- @voyantjs/i18n@0.38.1
- @voyantjs/ui@0.38.1

## 0.38.0

### Patch Changes

- @voyantjs/catalog-react@0.38.0
- @voyantjs/i18n@0.38.0
- @voyantjs/ui@0.38.0

## 0.37.1

### Patch Changes

- @voyantjs/catalog-react@0.37.1
- @voyantjs/i18n@0.37.1
- @voyantjs/ui@0.37.1

## 0.37.0

### Patch Changes

- 0c9b884: Route remaining reusable UI literals through package i18n providers and add the UI literal scan to the shared i18n CI check.
- e5ce6a0: Route remaining shared UI literals through package i18n providers.
- Updated dependencies [dc29b79]
- Updated dependencies [f014fd2]
- Updated dependencies [0c9b884]
  - @voyantjs/catalog-react@0.37.0
  - @voyantjs/i18n@0.37.0
  - @voyantjs/ui@0.37.0

## 0.36.0

### Patch Changes

- @voyantjs/catalog-react@0.36.0
- @voyantjs/i18n@0.36.0
- @voyantjs/ui@0.36.0

## 0.35.0

### Patch Changes

- Updated dependencies [baa6134]
  - @voyantjs/catalog-react@0.35.0
  - @voyantjs/i18n@0.35.0
  - @voyantjs/ui@0.35.0

## 0.34.0

### Minor Changes

- 9eda036: Widen `CatalogDetailSheet` by default and add detail extension slots for header actions, brochure content, custom media rendering, custom itinerary day rendering, and extra consumer sections.

### Patch Changes

- Updated dependencies [6ad175a]
- Updated dependencies [70ee277]
- Updated dependencies [f2d4802]
  - @voyantjs/catalog-react@0.34.0
  - @voyantjs/i18n@0.34.0
  - @voyantjs/ui@0.34.0

## 0.33.1

### Patch Changes

- @voyantjs/catalog-react@0.33.1
- @voyantjs/i18n@0.33.1
- @voyantjs/ui@0.33.1

## 0.33.0

### Patch Changes

- Updated dependencies [db46afc]
  - @voyantjs/catalog-react@0.33.0
  - @voyantjs/i18n@0.33.0
  - @voyantjs/ui@0.33.0

## 0.32.3

### Patch Changes

- Updated dependencies [7632a66]
  - @voyantjs/catalog-react@0.32.3
  - @voyantjs/i18n@0.32.3
  - @voyantjs/ui@0.32.3

## 0.32.2

### Patch Changes

- @voyantjs/catalog-react@0.32.2
- @voyantjs/i18n@0.32.2
- @voyantjs/ui@0.32.2

## 0.32.1

### Patch Changes

- @voyantjs/catalog-react@0.32.1
- @voyantjs/i18n@0.32.1
- @voyantjs/ui@0.32.1

## 0.32.0

### Patch Changes

- @voyantjs/catalog-react@0.32.0
- @voyantjs/i18n@0.32.0
- @voyantjs/ui@0.32.0

## 0.31.4

### Patch Changes

- @voyantjs/catalog-react@0.31.4
- @voyantjs/i18n@0.31.4
- @voyantjs/ui@0.31.4

## 0.31.3

### Patch Changes

- @voyantjs/catalog-react@0.31.3
- @voyantjs/i18n@0.31.3
- @voyantjs/ui@0.31.3

## 0.31.2

### Patch Changes

- Updated dependencies [54ddc93]
  - @voyantjs/catalog-react@0.31.2
  - @voyantjs/i18n@0.31.2
  - @voyantjs/ui@0.31.2

## 0.31.1

### Patch Changes

- Updated dependencies [00f7c4f]
  - @voyantjs/catalog-react@0.31.1
  - @voyantjs/i18n@0.31.1
  - @voyantjs/ui@0.31.1

## 0.31.0

### Minor Changes

- ee75afb: Publish catalog search and booking page compositions with explicit routing,
  fetcher, contact picker, and booking integration extension points.

### Patch Changes

- @voyantjs/catalog-react@0.31.0
- @voyantjs/i18n@0.31.0
- @voyantjs/ui@0.31.0

## 0.30.7

### Patch Changes

- @voyantjs/catalog-react@0.30.7
- @voyantjs/ui@0.30.7

## 0.30.6

### Patch Changes

- @voyantjs/catalog-react@0.30.6
- @voyantjs/ui@0.30.6

## 0.30.5

### Patch Changes

- @voyantjs/catalog-react@0.30.5
- @voyantjs/ui@0.30.5

## 0.30.4

### Patch Changes

- @voyantjs/catalog-react@0.30.4
- @voyantjs/ui@0.30.4

## 0.30.3

### Patch Changes

- @voyantjs/catalog-react@0.30.3
- @voyantjs/ui@0.30.3

## 0.30.2

### Patch Changes

- @voyantjs/catalog-react@0.30.2
- @voyantjs/ui@0.30.2

## 0.30.1

### Patch Changes

- @voyantjs/catalog-react@0.30.1
- @voyantjs/ui@0.30.1

## 0.30.0

### Patch Changes

- @voyantjs/catalog-react@0.30.0
- @voyantjs/ui@0.30.0

## 0.29.0

### Patch Changes

- Updated dependencies [583326e]
- Updated dependencies [4a6523e]
- Updated dependencies [4a6523e]
- Updated dependencies [4a6523e]
  - @voyantjs/catalog-react@0.29.0
  - @voyantjs/ui@0.29.0

## 0.28.3

### Patch Changes

- Updated dependencies [60ef432]
  - @voyantjs/catalog-react@0.28.3
  - @voyantjs/ui@0.28.3

## 0.28.2

### Patch Changes

- @voyantjs/catalog-react@0.28.2
- @voyantjs/ui@0.28.2

## 0.28.1

### Patch Changes

- Updated dependencies [9d88eae]
  - @voyantjs/catalog-react@0.28.1
  - @voyantjs/ui@0.28.1

## 0.28.0

### Patch Changes

- @voyantjs/catalog-react@0.28.0
- @voyantjs/ui@0.28.0

## 0.27.0

### Patch Changes

- @voyantjs/catalog-react@0.27.0
- @voyantjs/ui@0.27.0

## 0.26.9

### Patch Changes

- @voyantjs/catalog-react@0.26.9
- @voyantjs/ui@0.26.9

## 0.26.8

### Patch Changes

- abc9aa0: Fall back to `product.sellCurrency` when `price_catalogs.currencyCode` is null in the public pricing snapshot, and stop silently labelling currency-less amounts as EUR.

  - `@voyantjs/pricing`: `getProductPricingSnapshot` now resolves the snapshot's `catalog.currencyCode` from the catalog when set, otherwise from the product's `sellCurrency`. Catalogs with a non-null `currencyCode` behave exactly as before; catalogs with `currency_code = NULL` follow each product's native currency, so multi-currency operators can use a single retail catalog instead of one catalog per currency.
  - `@voyantjs/catalog-ui`: `formatPriceCents` in the catalog detail sheet now renders plain digits (no currency symbol) when no currency is supplied, instead of mis-labelling amounts as EUR.
  - `@voyantjs/bookings-ui`: `formatMoney` in the booking payments summary handles a missing currency the same way.
  - @voyantjs/catalog-react@0.26.8
  - @voyantjs/ui@0.26.8

## 0.26.7

### Patch Changes

- @voyantjs/catalog-react@0.26.7
- @voyantjs/ui@0.26.7

## 0.26.6

### Patch Changes

- @voyantjs/catalog-react@0.26.6
- @voyantjs/ui@0.26.6

## 0.26.5

### Patch Changes

- @voyantjs/catalog-react@0.26.5
- @voyantjs/ui@0.26.5

## 0.26.4

### Patch Changes

- @voyantjs/catalog-react@0.26.4
- @voyantjs/ui@0.26.4

## 0.26.3

### Patch Changes

- @voyantjs/catalog-react@0.26.3
- @voyantjs/ui@0.26.3

## 0.26.2

### Patch Changes

- @voyantjs/catalog-react@0.26.2
- @voyantjs/ui@0.26.2

## 0.26.1

### Patch Changes

- @voyantjs/catalog-react@0.26.1
- @voyantjs/ui@0.26.1

## 0.26.0

### Patch Changes

- @voyantjs/catalog-react@0.26.0
- @voyantjs/ui@0.26.0

## 0.25.0

### Patch Changes

- @voyantjs/catalog-react@0.25.0
- @voyantjs/ui@0.25.0

## 0.24.3

### Patch Changes

- @voyantjs/catalog-react@0.24.3
- @voyantjs/ui@0.24.3

## 0.24.2

### Patch Changes

- @voyantjs/catalog-react@0.24.2
- @voyantjs/ui@0.24.2

## 0.24.1

### Patch Changes

- Updated dependencies [ed635c7]
  - @voyantjs/catalog-react@0.24.1
  - @voyantjs/ui@0.24.1

## 0.24.0

### Patch Changes

- @voyantjs/catalog-react@0.24.0
- @voyantjs/ui@0.24.0

## 0.23.0

### Patch Changes

- @voyantjs/catalog-react@0.23.0
- @voyantjs/ui@0.23.0

## 0.22.0

### Patch Changes

- @voyantjs/catalog-react@0.22.0
- @voyantjs/ui@0.22.0

## 0.21.1

### Patch Changes

- @voyantjs/catalog-react@0.21.1
- @voyantjs/ui@0.21.1

## 0.21.0

### Patch Changes

- Updated dependencies [6427bad]
  - @voyantjs/catalog-react@0.21.0
  - @voyantjs/ui@0.21.0

## 0.20.0

### Patch Changes

- @voyantjs/catalog-react@0.20.0
- @voyantjs/ui@0.20.0

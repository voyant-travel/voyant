# @voyant-travel/plugin-voyant-connect

## 0.2.0

### Minor Changes

- e641712: Add `resolveVoyantConnectEnv` + `prepareVoyantConnectSources` so deployments resolve Connect sources from `VOYANT_CONNECT_*` env in one call (#1976).

  Both the live booking-engine registry and the discovery-sync CLI previously hand-rolled the same env mapping — API-key fallback order, operator id, market, sync limit, and the incomplete-config warning — and had already drifted (sync enumerated per-connection while the book path did not). The new helpers centralize that resolution: `prepareVoyantConnectSources(env, { enumerate })` returns the registrations directly (enumerating active connections when `enumerate` is set), so both registries share one configuration path. README documents the remaining book-path-vs-sync connection-scoping asymmetry and its async-warmed follow-up.

### Patch Changes

- e641712: Bump `@voyant-travel/connect-cruises` to `0.5.0` and drop the blanket `as CruiseAdapter` cast (#1976, connect-sdk#81).

  `connect-cruises@0.5.0` aligned the price-component `kind` union, so the cast is no longer needed to bridge it. Removing the cast surfaced a divergence it had been hiding: `fetchShip` carries deck plan art as `imageUrl` while the cruise vertical reads `planImageUrl`, so deck plans were silently dropping out of sourced cruise content. Replaced the cast with a typed `conformConnectCruiseAdapter` seam that maps the deck field, drops unnamed decks, and coerces nullable cabin-category fields — fixing the dropped deck plans. Remaining ship-shape alignment is tracked upstream in connect-sdk#81.

## 0.1.3

### Patch Changes

- Updated dependencies [7779772]
  - @voyant-travel/catalog@0.127.0
  - @voyant-travel/cruises@0.128.0

## 0.1.2

### Patch Changes

- @voyant-travel/catalog@0.126.0
- @voyant-travel/cruises@0.127.0

## 0.1.1

### Patch Changes

- @voyant-travel/cruises@0.126.0
- @voyant-travel/catalog@0.125.0

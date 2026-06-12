# @voyantjs/catalog-authoring

## 0.106.8

### Patch Changes

- @voyantjs/availability@0.108.0
- @voyantjs/extras@0.111.0
- @voyantjs/pricing@0.111.0
- @voyantjs/products@0.111.0

## 0.106.7

### Patch Changes

- Updated dependencies [eeb23df]
  - @voyantjs/core@0.106.0
  - @voyantjs/availability@0.107.0
  - @voyantjs/db@0.104.4
  - @voyantjs/extras@0.110.0
  - @voyantjs/hono@0.105.3
  - @voyantjs/pricing@0.110.0
  - @voyantjs/products@0.110.0

## 0.106.6

### Patch Changes

- Updated dependencies [344e7b6]
  - @voyantjs/core@0.105.1
  - @voyantjs/availability@0.106.0
  - @voyantjs/extras@0.109.0
  - @voyantjs/pricing@0.109.0
  - @voyantjs/products@0.109.0
  - @voyantjs/hono@0.105.2

## 0.106.5

### Patch Changes

- Updated dependencies [7122c2a]
  - @voyantjs/products@0.108.0
  - @voyantjs/extras@0.108.0
  - @voyantjs/availability@0.105.2
  - @voyantjs/pricing@0.108.0

## 0.106.4

### Patch Changes

- Updated dependencies [656b25d]
  - @voyantjs/hono@0.105.0
  - @voyantjs/availability@0.105.1
  - @voyantjs/extras@0.107.1
  - @voyantjs/pricing@0.107.1
  - @voyantjs/products@0.107.1

## 0.106.3

### Patch Changes

- Updated dependencies [c2aef18]
  - @voyantjs/core@0.105.0
  - @voyantjs/db@0.104.3
  - @voyantjs/availability@0.105.0
  - @voyantjs/extras@0.107.0
  - @voyantjs/hono@0.104.2
  - @voyantjs/pricing@0.107.0
  - @voyantjs/products@0.107.0

## 0.106.2

### Patch Changes

- @voyantjs/products@0.106.0
- @voyantjs/extras@0.106.0
- @voyantjs/availability@0.104.1
- @voyantjs/pricing@0.106.0

## 0.106.1

### Patch Changes

- Updated dependencies [921f4fc]
  - @voyantjs/products@0.105.0
  - @voyantjs/availability@0.104.1
  - @voyantjs/extras@0.105.0
  - @voyantjs/pricing@0.105.0

## 0.106.0

### Minor Changes

- dfa6811: Add `cloneProduct` + `POST /v1/admin/products/{id}/duplicate` to `@voyantjs/catalog-authoring` (#1493). The comprehensive deep-clone formerly local to the operator template (`duplicateProductAsDraft`) now lives in the package — copying the full product graph (options/units + translations, pricing categories + dependencies with correct id remapping, itineraries/days/services, media, extras, and all option/unit price rules + tiers) into a new draft. It is now parameterized for agent use: `name`/`status`/`visibility` overrides, a `copyDepartures` flag (default `true` to preserve the operator UI's full-copy behavior; the agent passes `false` so departures are dropped per #1493), an optional `product_versions` snapshot, and `Idempotency-Key` support. The operator template now registers this route via the extension instead of its own copy; the UI's no-body clone call is unchanged (`data.id` + full copy named `"{X} (Copy)"`), and the response additionally carries the cloned `options` ids.

## 0.105.0

### Minor Changes

- 5c7a075: New `@voyantjs/catalog-authoring` package: atomic product-graph **compose** for agent-driven catalog authoring (Max AI). Ships a `HonoExtension` that mounts `POST /v1/admin/products/compose` — build a new bookable product (options/units, option+unit price rules + tiers, pax tiers, itinerary/days/services) from a `ProductGraphSpec` in one transaction, resolving the operator's default price catalog. This covers the cold-start / never-authored-before case that cloning can't. A category-aware validator rejects wrong-shape specs (e.g. a multi-day excursion) with agent-recoverable errors `{code, field, message, fix}`, and the endpoint honors an `Idempotency-Key`. Composed products emit the same `product.content.changed` event and action-ledger entry as the granular routes.

  `@voyantjs/products` additionally exports `appendProductMutationLedgerEntry` (and `ProductLedgerMutationAction`) so the extension can record ledger entries.

### Patch Changes

- Updated dependencies [5c7a075]
  - @voyantjs/products@0.104.3

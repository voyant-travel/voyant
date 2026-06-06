# @voyantjs/catalog-authoring

## 0.105.0

### Minor Changes

- 5c7a075: New `@voyantjs/catalog-authoring` package: atomic product-graph **compose** for agent-driven catalog authoring (Max AI). Ships a `HonoExtension` that mounts `POST /v1/admin/products/compose` — build a new bookable product (options/units, option+unit price rules + tiers, pax tiers, itinerary/days/services) from a `ProductGraphSpec` in one transaction, resolving the operator's default price catalog. This covers the cold-start / never-authored-before case that cloning can't. A category-aware validator rejects wrong-shape specs (e.g. a multi-day excursion) with agent-recoverable errors `{code, field, message, fix}`, and the endpoint honors an `Idempotency-Key`. Composed products emit the same `product.content.changed` event and action-ledger entry as the granular routes.

  `@voyantjs/products` additionally exports `appendProductMutationLedgerEntry` (and `ProductLedgerMutationAction`) so the extension can record ledger entries.

### Patch Changes

- Updated dependencies [5c7a075]
  - @voyantjs/products@0.104.3

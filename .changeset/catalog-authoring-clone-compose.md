---
"@voyantjs/catalog-authoring": minor
"@voyantjs/products": patch
---

New `@voyantjs/catalog-authoring` package: atomic product-graph clone and compose for agent-driven catalog authoring (Max AI). Ships a `HonoExtension` that mounts `POST /v1/admin/products/{id}/duplicate` (deep-clone a product's options/units/pricing/itinerary in one transaction, reusing the source price catalog, skipping availability slots) and `POST /v1/admin/products/compose` (build a new graph from a `ProductGraphSpec`). A category-aware validator rejects wrong-shape specs (e.g. a multi-day excursion) with agent-recoverable errors, and both endpoints honor an `Idempotency-Key`. Cloned/composed products emit the same `product.content.changed` event and action-ledger entry as the granular routes.

`@voyantjs/products` additionally exports `appendProductMutationLedgerEntry` (and `ProductLedgerMutationAction`) so the extension can record ledger entries.

---
"@voyantjs/catalog-contracts": minor
"@voyantjs/flights-contracts": minor
---

Complete `flights-contracts` by moving the flight snapshot builder into it.

`@voyantjs/catalog-contracts` now exports `./snapshot` with `PricingBasis` and
`CaptureSnapshotInput` — pure shapes that were embedded in catalog runtime files
(`services/snapshot-service.ts`, `snapshot/schema.ts`). `@voyantjs/catalog`
re-exports them from their original paths, so every consumer
(accommodations/charters/cruises/extras/products, catalog-ui) is unchanged.

`@voyantjs/flights-contracts` now owns `snapshot.ts` (importing the snapshot
types from `@voyantjs/catalog-contracts/snapshot`), so the flight snapshot
builder no longer needs the catalog runtime. `@voyantjs/flights/snapshot`
re-exports it. Resolves #1449.

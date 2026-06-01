# @voyantjs/catalog-contracts

## 0.101.0

## 0.100.0

## 0.99.0

### Minor Changes

- c893886: Complete `flights-contracts` by moving the flight snapshot builder into it.

  `@voyantjs/catalog-contracts` now exports `./snapshot` with `PricingBasis` and
  `CaptureSnapshotInput` — pure shapes that were embedded in catalog runtime files
  (`services/snapshot-service.ts`, `snapshot/schema.ts`). `@voyantjs/catalog`
  re-exports them from their original paths, so every consumer
  (accommodations/charters/cruises/extras/products, catalog-ui) is unchanged.

  `@voyantjs/flights-contracts` now owns `snapshot.ts` (importing the snapshot
  types from `@voyantjs/catalog-contracts/snapshot`), so the flight snapshot
  builder no longer needs the catalog runtime. `@voyantjs/flights/snapshot`
  re-exports it. Resolves #1449.

## 0.98.0

## 0.97.0

### Minor Changes

- 2555264: Extract two more contract surfaces into lightweight packages, closing the
  remaining gaps in the `*-contracts` pattern (ADR-0002 / ADR-0003).

  `@voyantjs/flights-contracts` (new, zod-only) now owns the pure flight
  `SourceAdapter` contract, request/response schemas, post-book types, and the
  reference-data shapes (`contract/{types,adapter,schemas,post-book-types}`,
  `reference/{contract,static-bundle}`), so flight-provider adapter authors and
  external consumers can integrate without the flights runtime (Drizzle/DB).

  `@voyantjs/catalog-contracts` gains the pure booking-engine contracts —
  `booking-engine/contracts` (the `BookingDraft` + V1 engine schemas) and
  `booking-engine/promotions-contract` — which were previously trapped in the
  catalog runtime.

  The runtime `@voyantjs/flights` and `@voyantjs/catalog` packages re-export from
  the contract packages, so existing `@voyantjs/flights/contract/*`,
  `@voyantjs/flights/reference/*`, and `@voyantjs/catalog/booking-engine/*` import
  paths are unchanged.

  Note: `@voyantjs/flights`' `snapshot.ts` stays in the runtime for now — it
  depends on catalog's `CaptureSnapshotInput` / `PricingBasis`, which still live in
  catalog runtime files (`services/snapshot-service.ts`, `snapshot/schema.ts`).
  Carving those pure shapes into `catalog-contracts` (which would let the flight
  snapshot move too) is a tracked follow-up.

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

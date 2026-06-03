# @voyantjs/flights-contracts

## 0.104.0

### Patch Changes

- @voyantjs/catalog-contracts@0.104.0

## 0.103.0

### Patch Changes

- @voyantjs/catalog-contracts@0.103.0

## 0.102.0

### Patch Changes

- @voyantjs/catalog-contracts@0.102.0

## 0.101.2

### Patch Changes

- @voyantjs/catalog-contracts@0.101.2

## 0.101.1

### Patch Changes

- @voyantjs/catalog-contracts@0.101.1

## 0.101.0

### Patch Changes

- @voyantjs/catalog-contracts@0.101.0

## 0.100.0

### Patch Changes

- @voyantjs/catalog-contracts@0.100.0

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

### Patch Changes

- Updated dependencies [c893886]
  - @voyantjs/catalog-contracts@0.99.0

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

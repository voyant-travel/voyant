# @voyant-travel/extras-contracts

## 0.104.3

### Patch Changes

- 8d62a7c: Republish every affected TypeScript package without broken declaration maps so the corrected artifact
  policy reaches npm instead of applying only to future incidental package releases.

## 0.104.2

### Patch Changes

- 3cc83b6: Move extras runtime and React source behind Inventory and Bookings owner
  subpaths. The old runtime and React extras package names are removed from v1;
  first-party imports use the Inventory and Bookings owner paths.

## 0.104.1

## 0.104.0

## 0.103.0

## 0.102.0

## 0.101.2

## 0.101.1

## 0.101.0

## 0.100.0

## 0.99.0

## 0.98.0

## 0.97.0

## 0.96.0

### Minor Changes

- 465fb31: Extend the lightweight contract-package pattern to the remaining content
  verticals.

  `@voyant-travel/accommodations-contracts`, `@voyant-travel/products-contracts`,
  `@voyant-travel/extras-contracts`, and `@voyant-travel/charters-contracts` now own their
  respective `<vertical>/v1` rich content schema, version constant, types, and
  validator as zod-only packages, so external consumers (Voyant Connect, adapter
  authors, the Admin API SDK) can validate content payloads without installing the
  framework runtime.

  The runtime `@voyant-travel/accommodations`, `@voyant-travel/products`,
  `@voyant-travel/extras`, and `@voyant-travel/charters` packages re-export their content
  shape from the matching contract package, so existing
  `@voyant-travel/<vertical>/content-shape` import paths are unchanged. The
  `mergeOverlaysInto<Vertical>Content` overlay composition stays in the runtime
  package.

  See `docs/adr/0002-contract-packages.md` for the codified pattern.

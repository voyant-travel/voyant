# @voyantjs/extras-contracts

## 0.101.0

## 0.100.0

## 0.99.0

## 0.98.0

## 0.97.0

## 0.96.0

### Minor Changes

- 465fb31: Extend the lightweight contract-package pattern to the remaining content
  verticals.

  `@voyantjs/accommodations-contracts`, `@voyantjs/products-contracts`,
  `@voyantjs/extras-contracts`, and `@voyantjs/charters-contracts` now own their
  respective `<vertical>/v1` rich content schema, version constant, types, and
  validator as zod-only packages, so external consumers (Voyant Connect, adapter
  authors, the Admin API SDK) can validate content payloads without installing the
  framework runtime.

  The runtime `@voyantjs/accommodations`, `@voyantjs/products`,
  `@voyantjs/extras`, and `@voyantjs/charters` packages re-export their content
  shape from the matching contract package, so existing
  `@voyantjs/<vertical>/content-shape` import paths are unchanged. The
  `mergeOverlaysInto<Vertical>Content` overlay composition stays in the runtime
  package.

  See `docs/adr/0002-contract-packages.md` for the codified pattern.

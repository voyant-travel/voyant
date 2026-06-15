# @voyant-travel/legal-contracts

## 0.105.0

### Minor Changes

- c3f4fa0: Move Legal acceptance, contract, and term records to target refs with explicit legacy transaction compatibility fields.

### Patch Changes

- Updated dependencies [e80e3d3]
  - @voyant-travel/schema-kit@0.105.3

## 0.104.2

### Patch Changes

- Updated dependencies [d1ad572]
- Updated dependencies [d1ad572]
  - @voyant-travel/schema-kit@0.105.0

## 0.104.1

### Patch Changes

- @voyant-travel/schema-kit@0.104.1
- @voyant-travel/templating@0.104.1

## 0.104.0

### Patch Changes

- @voyant-travel/schema-kit@0.104.0
- @voyant-travel/templating@0.104.0

## 0.103.0

### Patch Changes

- @voyant-travel/schema-kit@0.103.0
- @voyant-travel/templating@0.103.0

## 0.102.0

### Patch Changes

- @voyant-travel/schema-kit@0.102.0
- @voyant-travel/templating@0.102.0

## 0.101.2

### Patch Changes

- 577eaf5: Republish finance and legal contract packages with the next release so exact internal package dependencies resolve from the public registry.
- Updated dependencies [577eaf5]
  - @voyant-travel/schema-kit@0.101.2
  - @voyant-travel/templating@0.101.2

## 0.101.1

### Patch Changes

- @voyant-travel/schema-kit@0.101.1
- @voyant-travel/templating@0.101.1

## 0.101.0

### Patch Changes

- @voyant-travel/schema-kit@0.101.0
- @voyant-travel/templating@0.101.0

## 0.100.0

### Patch Changes

- @voyant-travel/schema-kit@0.100.0
- @voyant-travel/templating@0.100.0

## 0.99.0

### Patch Changes

- @voyant-travel/schema-kit@0.99.0
- @voyant-travel/templating@0.99.0

## 0.98.0

### Minor Changes

- 485da95: Extract `@voyant-travel/templating` and purify `@voyant-travel/legal-contracts`.

  `@voyant-travel/templating` is a new lean package (`liquidjs` only) holding the
  Liquid/Mustache template renderer and syntax validator, moved out of
  `@voyant-travel/utils`. `@voyant-travel/utils/template-renderer` re-exports it, so existing
  import paths (finance, products, legal runtime) are unchanged.

  `@voyant-travel/legal-contracts` now depends on `@voyant-travel/templating` instead of
  `@voyant-travel/utils` for its contract-body Liquid-syntax validation — dropping the
  transitive Drizzle / `@voyant-travel/db` / pdf-lib dependency. Its tree is now just
  `zod` + `@voyant-travel/schema-kit` + `@voyant-travel/templating` (no data layer).

### Patch Changes

- Updated dependencies [485da95]
  - @voyant-travel/schema-kit@0.98.0
  - @voyant-travel/templating@0.98.0

## 0.97.0

### Minor Changes

- 7094c8e: Add `@voyant-travel/schema-kit` and extend the `*-contracts` pattern to the
  operational modules.

  `@voyant-travel/schema-kit` (pure: zod + typeid-js) is the new foundational home for
  schema primitives shared by the runtime and the contract packages — the TypeID
  system (prefix registry, id generation, zod validators), `booleanQueryParam`,
  and `kmsEnvelopeSchema`. These moved out of `@voyant-travel/db` (which now re-exports
  them from their original paths, so every call-site is unchanged) so they sit
  below the data layer and the contract packages can depend on them without
  pulling Drizzle.

  New zod-only contract packages own each module's validation surface (schemas +
  enums): `@voyant-travel/bookings-contracts`, `@voyant-travel/finance-contracts`,
  `@voyant-travel/crm-contracts`, `@voyant-travel/transactions-contracts`,
  `@voyant-travel/suppliers-contracts`, `@voyant-travel/identity-contracts`, and
  `@voyant-travel/legal-contracts`. Each runtime module re-exports from its contracts
  package, so existing `@voyant-travel/<module>/validation` import paths are unchanged.
  Shared primitives come from `@voyant-travel/schema-kit`, keeping the contract
  packages free of the data layer.

  (`legal-contracts` still transitively depends on `@voyant-travel/utils` for the
  template-syntax validator used by contract validation — a tracked follow-up
  would purify it.)

### Patch Changes

- Updated dependencies [7094c8e]
  - @voyant-travel/schema-kit@0.97.0
  - @voyant-travel/utils@0.97.0

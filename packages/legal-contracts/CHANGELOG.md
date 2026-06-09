# @voyantjs/legal-contracts

## 0.104.2

### Patch Changes

- Updated dependencies [d1ad572]
- Updated dependencies [d1ad572]
  - @voyantjs/schema-kit@0.105.0

## 0.104.1

### Patch Changes

- @voyantjs/schema-kit@0.104.1
- @voyantjs/templating@0.104.1

## 0.104.0

### Patch Changes

- @voyantjs/schema-kit@0.104.0
- @voyantjs/templating@0.104.0

## 0.103.0

### Patch Changes

- @voyantjs/schema-kit@0.103.0
- @voyantjs/templating@0.103.0

## 0.102.0

### Patch Changes

- @voyantjs/schema-kit@0.102.0
- @voyantjs/templating@0.102.0

## 0.101.2

### Patch Changes

- 577eaf5: Republish finance and legal contract packages with the next release so exact internal package dependencies resolve from the public registry.
- Updated dependencies [577eaf5]
  - @voyantjs/schema-kit@0.101.2
  - @voyantjs/templating@0.101.2

## 0.101.1

### Patch Changes

- @voyantjs/schema-kit@0.101.1
- @voyantjs/templating@0.101.1

## 0.101.0

### Patch Changes

- @voyantjs/schema-kit@0.101.0
- @voyantjs/templating@0.101.0

## 0.100.0

### Patch Changes

- @voyantjs/schema-kit@0.100.0
- @voyantjs/templating@0.100.0

## 0.99.0

### Patch Changes

- @voyantjs/schema-kit@0.99.0
- @voyantjs/templating@0.99.0

## 0.98.0

### Minor Changes

- 485da95: Extract `@voyantjs/templating` and purify `@voyantjs/legal-contracts`.

  `@voyantjs/templating` is a new lean package (`liquidjs` only) holding the
  Liquid/Mustache template renderer and syntax validator, moved out of
  `@voyantjs/utils`. `@voyantjs/utils/template-renderer` re-exports it, so existing
  import paths (finance, products, legal runtime) are unchanged.

  `@voyantjs/legal-contracts` now depends on `@voyantjs/templating` instead of
  `@voyantjs/utils` for its contract-body Liquid-syntax validation — dropping the
  transitive Drizzle / `@voyantjs/db` / pdf-lib dependency. Its tree is now just
  `zod` + `@voyantjs/schema-kit` + `@voyantjs/templating` (no data layer).

### Patch Changes

- Updated dependencies [485da95]
  - @voyantjs/schema-kit@0.98.0
  - @voyantjs/templating@0.98.0

## 0.97.0

### Minor Changes

- 7094c8e: Add `@voyantjs/schema-kit` and extend the `*-contracts` pattern to the
  operational modules.

  `@voyantjs/schema-kit` (pure: zod + typeid-js) is the new foundational home for
  schema primitives shared by the runtime and the contract packages — the TypeID
  system (prefix registry, id generation, zod validators), `booleanQueryParam`,
  and `kmsEnvelopeSchema`. These moved out of `@voyantjs/db` (which now re-exports
  them from their original paths, so every call-site is unchanged) so they sit
  below the data layer and the contract packages can depend on them without
  pulling Drizzle.

  New zod-only contract packages own each module's validation surface (schemas +
  enums): `@voyantjs/bookings-contracts`, `@voyantjs/finance-contracts`,
  `@voyantjs/crm-contracts`, `@voyantjs/transactions-contracts`,
  `@voyantjs/suppliers-contracts`, `@voyantjs/identity-contracts`, and
  `@voyantjs/legal-contracts`. Each runtime module re-exports from its contracts
  package, so existing `@voyantjs/<module>/validation` import paths are unchanged.
  Shared primitives come from `@voyantjs/schema-kit`, keeping the contract
  packages free of the data layer.

  (`legal-contracts` still transitively depends on `@voyantjs/utils` for the
  template-syntax validator used by contract validation — a tracked follow-up
  would purify it.)

### Patch Changes

- Updated dependencies [7094c8e]
  - @voyantjs/schema-kit@0.97.0
  - @voyantjs/utils@0.97.0

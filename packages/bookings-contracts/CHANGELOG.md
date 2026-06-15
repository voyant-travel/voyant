# @voyant-travel/bookings-contracts

## 0.105.0

### Minor Changes

- 2c9c4a4: Retire the runtime Transactions packages before v1. The default Bookings/OCTO
  bridge now reads booking origin/provenance records instead of the legacy
  booking-to-transaction detail table, and the public `@voyant-travel/transactions`
  and `@voyant-travel/transactions-react` workspaces have been removed. The
  legacy `@voyant-travel/transactions-contracts` workspace is removed as well;
  use the owning domain contract/runtime package for replacement validation
  schemas.

### Patch Changes

- Updated dependencies [e80e3d3]
  - @voyant-travel/schema-kit@0.105.3

## 0.104.3

### Patch Changes

- 658aa37: Refactor bookings backend validation, pricing assignment, route, service, and integration coverage modules into smaller compatibility-preserving entrypoints.

## 0.104.2

### Patch Changes

- Updated dependencies [d1ad572]
- Updated dependencies [d1ad572]
  - @voyant-travel/schema-kit@0.105.0

## 0.104.1

### Patch Changes

- @voyant-travel/schema-kit@0.104.1

## 0.104.0

### Patch Changes

- @voyant-travel/schema-kit@0.104.0

## 0.103.0

### Patch Changes

- @voyant-travel/schema-kit@0.103.0

## 0.102.0

### Patch Changes

- @voyant-travel/schema-kit@0.102.0

## 0.101.2

### Patch Changes

- Updated dependencies [577eaf5]
  - @voyant-travel/schema-kit@0.101.2

## 0.101.1

### Patch Changes

- @voyant-travel/schema-kit@0.101.1

## 0.101.0

### Patch Changes

- @voyant-travel/schema-kit@0.101.0

## 0.100.0

### Patch Changes

- @voyant-travel/schema-kit@0.100.0

## 0.99.0

### Patch Changes

- @voyant-travel/schema-kit@0.99.0

## 0.98.0

### Patch Changes

- @voyant-travel/schema-kit@0.98.0

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

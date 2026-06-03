# @voyantjs/transactions-contracts

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

# @voyant-travel/identity-contracts

Pure identity validation schemas (contact points, addresses, named contacts) and
enums, zod-only, for consumers (admin SDK, Voyant Connect) that validate identity
payloads without the identity runtime. `@voyant-travel/identity` re-exports these so
existing import paths are unchanged.

## Install

```bash
pnpm add @voyant-travel/identity-contracts zod
```

## Usage

```ts
import {
  contactPointKindSchema,
  addressLabelSchema,
  namedContactRoleSchema,
  insertContactPointSchema,
} from "@voyant-travel/identity-contracts"
```

Existing `@voyant-travel/identity/validation` imports remain available for
applications that already depend on the full runtime package.

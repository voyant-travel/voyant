# @voyantjs/identity-contracts

Pure identity validation schemas (contact points, addresses, named contacts) and
enums, zod-only, for consumers (admin SDK, Voyant Connect) that validate identity
payloads without the identity runtime. `@voyantjs/identity` re-exports these so
existing import paths are unchanged.

## Install

```bash
pnpm add @voyantjs/identity-contracts zod
```

## Usage

```ts
import {
  contactPointKindSchema,
  addressLabelSchema,
  namedContactRoleSchema,
  insertContactPointSchema,
} from "@voyantjs/identity-contracts"
```

Existing `@voyantjs/identity/validation` imports remain available for
applications that already depend on the full runtime package.

# @voyantjs/transactions-contracts

Pure transactions validation schemas (offers, orders, order terms) and enums,
zod-only, for consumers (admin SDK, Voyant Connect) that validate transaction
payloads without the transactions runtime. `@voyantjs/transactions` re-exports
these so existing import paths are unchanged.

## Install

```bash
pnpm add @voyantjs/transactions-contracts zod
```

## Usage

```ts
import {
  insertOfferSchema,
  insertOrderSchema,
  orderStatusSchema,
} from "@voyantjs/transactions-contracts"
```

Existing `@voyantjs/transactions/validation` imports remain available for
applications that already depend on the full runtime package.

# @voyantjs/transactions-contracts

Pure transactions validation schemas (offers, orders, order terms) and enums,
zod-only, for consumers (admin SDK, Voyant Connect) that validate transaction
payloads without the retired transactions runtime.

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

Migrate legacy `@voyantjs/transactions/validation` imports to this package. The
runtime `@voyantjs/transactions` package is retired before v1.

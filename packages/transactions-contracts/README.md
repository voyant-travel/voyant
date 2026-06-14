# @voyant-travel/transactions-contracts

Pure transactions validation schemas (offers, orders, order terms) and enums,
zod-only, for consumers (admin SDK, Voyant Connect) that validate transaction
payloads from pre-v1 integrations. Runtime transactions are retired in v1.

## Install

```bash
pnpm add @voyant-travel/transactions-contracts zod
```

## Usage

```ts
import {
  insertOfferSchema,
  insertOrderSchema,
  orderStatusSchema,
} from "@voyant-travel/transactions-contracts"
```

New runtime code should use Quotes, Bookings, Finance, and Legal records instead
of generic transaction Orders or Offers.

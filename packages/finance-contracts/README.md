# @voyant-travel/finance-contracts

Pure finance validation schemas (invoices, payments, tax, Travel Credits) and enums,
zod-only, for consumers (admin SDK, Voyant Connect) that validate finance
payloads without the finance runtime. `@voyant-travel/finance` re-exports these so
existing import paths are unchanged.

## Install

```bash
pnpm add @voyant-travel/finance-contracts zod
```

## Usage

```ts
import {
  invoiceStatusSchema,
  insertInvoiceSchema,
  paymentMethodSchema,
} from "@voyant-travel/finance-contracts"
```

Existing `@voyant-travel/finance/validation` and `@voyant-travel/finance` imports remain
available for applications that already depend on the full runtime package.

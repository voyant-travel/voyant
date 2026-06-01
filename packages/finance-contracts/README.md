# @voyantjs/finance-contracts

Pure finance validation schemas (invoices, payments, tax, vouchers) and enums,
zod-only, for consumers (admin SDK, Voyant Connect) that validate finance
payloads without the finance runtime. `@voyantjs/finance` re-exports these so
existing import paths are unchanged.

## Install

```bash
pnpm add @voyantjs/finance-contracts zod
```

## Usage

```ts
import {
  invoiceStatusSchema,
  insertInvoiceSchema,
  paymentMethodSchema,
} from "@voyantjs/finance-contracts"
```

Existing `@voyantjs/finance/validation` and `@voyantjs/finance` imports remain
available for applications that already depend on the full runtime package.

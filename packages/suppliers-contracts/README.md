# @voyantjs/suppliers-contracts

Pure suppliers validation schemas (suppliers, services, rates) and enums,
zod-only, for consumers (admin SDK, Voyant Connect) that validate supplier
payloads without the suppliers runtime. `@voyantjs/suppliers` re-exports these
so existing import paths are unchanged.

## Install

```bash
pnpm add @voyantjs/suppliers-contracts zod
```

## Usage

```ts
import {
  insertSupplierSchema,
  selectSupplierSchema,
  type InsertSupplier,
} from "@voyantjs/suppliers-contracts"
```

Existing `@voyantjs/suppliers/validation` imports remain available for
applications that already depend on the full runtime package.

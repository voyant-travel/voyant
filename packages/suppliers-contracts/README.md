# @voyant-travel/suppliers-contracts

Pure suppliers validation schemas (suppliers, services, rates) and enums,
zod-only, for consumers (admin SDK, Voyant Connect) that validate supplier
payloads without the Distribution runtime.

## Install

```bash
pnpm add @voyant-travel/suppliers-contracts zod
```

## Usage

```ts
import {
  insertSupplierSchema,
  selectSupplierSchema,
  type InsertSupplier,
} from "@voyant-travel/suppliers-contracts"
```

Runtime supplier and counterparty workflows live in `@voyant-travel/distribution`.

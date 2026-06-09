# @voyantjs/crm-contracts

Pure CRM validation schemas (people, organizations, Quotes, activities,
custom fields) and enums, zod-only, for consumers (admin SDK, Voyant Connect)
that validate CRM payloads without the crm runtime. `@voyantjs/crm` re-exports
these so existing import paths are unchanged.

## Install

```bash
pnpm add @voyantjs/crm-contracts zod
```

## Usage

```ts
import {
  entityTypeSchema,
  insertPersonSchema,
  quoteStatusSchema,
} from "@voyantjs/crm-contracts"
```

Existing `@voyantjs/crm/validation` and `@voyantjs/crm` import paths remain
available for applications that already depend on the full runtime package.

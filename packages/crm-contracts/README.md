# @voyantjs/crm-contracts

Pure validation schemas for people, organizations, quotes, activities, custom
fields, and enums, zod-only, for consumers (admin SDK, Voyant Connect) that
validate relationship or quote payloads without depending on a runtime package.

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

Runtime validation barrels are exposed from `@voyantjs/relationships/validation`
and `@voyantjs/quotes/validation`.

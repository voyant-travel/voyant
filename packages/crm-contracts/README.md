# @voyant-travel/crm-contracts

Pure validation schemas for people, organizations, quotes, activities, custom
fields, and enums, zod-only, for consumers (admin SDK, Voyant Connect) that
validate relationship or quote payloads without depending on a runtime package.

## Install

```bash
pnpm add @voyant-travel/crm-contracts zod
```

## Usage

```ts
import {
  entityTypeSchema,
  insertPersonSchema,
  quoteStatusSchema,
} from "@voyant-travel/crm-contracts"
```

Runtime validation barrels are exposed from `@voyant-travel/relationships/validation`
and `@voyant-travel/quotes/validation`.

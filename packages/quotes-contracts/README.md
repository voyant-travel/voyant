# @voyant-travel/quotes-contracts

Pure validation schemas for quotes, quote versions, quote lines, quote
participants, quote products, pipelines, stages, and quote-facing enums,
zod-only, for consumers that validate quote payloads without depending on the
runtime package.

## Install

```bash
pnpm add @voyant-travel/quotes-contracts zod
```

## Usage

```ts
import {
  entityTypeSchema,
  insertQuoteSchema,
  quoteStatusSchema,
} from "@voyant-travel/quotes-contracts"
```

Runtime validation barrels are exposed from `@voyant-travel/quotes/validation`.

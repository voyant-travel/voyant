# @voyantjs/charters-contracts

Pure charter content contracts for adapter implementers and external
consumers that need to validate `charters/v1` rich content payloads
without installing the full charters runtime package.

Use this package for `CHARTERS_CONTENT_SCHEMA_VERSION`,
`charterContentSchema`, `CharterContent`, nested content types, and
`validateCharterContent`. Use `@voyantjs/charters` when you also need
Drizzle schema, routes, services, booking integration, catalog projection, or
runtime content resolution (including the `mergeOverlaysIntoCharterContent`
overlay composition).

## Install

```bash
pnpm add @voyantjs/charters-contracts zod
```

## Usage

```ts
import {
  CHARTERS_CONTENT_SCHEMA_VERSION,
  charterContentSchema,
  type CharterContent,
} from "@voyantjs/charters-contracts"
```

Existing `@voyantjs/charters/content-shape` imports remain available for
applications that already depend on the full runtime package.

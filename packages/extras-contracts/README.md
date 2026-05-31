# @voyantjs/extras-contracts

Pure extras content contracts for adapter implementers and external consumers
that need to validate `extras/v1` rich content payloads without installing the
full extras runtime package.

Use this package for `EXTRAS_CONTENT_SCHEMA_VERSION`, `extraContentSchema`,
`ExtraContent`, nested content types, and `validateExtraContent`. Use
`@voyantjs/extras` when you also need Drizzle schema, routes, services, booking
integration, catalog projection, or runtime content resolution (including the
`mergeOverlaysIntoExtraContent` overlay composition).

## Install

```bash
pnpm add @voyantjs/extras-contracts zod
```

## Usage

```ts
import {
  EXTRAS_CONTENT_SCHEMA_VERSION,
  extraContentSchema,
  type ExtraContent,
} from "@voyantjs/extras-contracts"
```

Existing `@voyantjs/extras/content-shape` imports remain available for
applications that already depend on the full runtime package.

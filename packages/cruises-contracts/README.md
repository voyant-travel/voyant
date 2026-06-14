# @voyant-travel/cruises-contracts

Pure cruise content contracts for adapter implementers and external consumers
that need to validate `cruises/v1` rich content payloads without installing the
full cruises runtime package.

Use this package for `CRUISES_CONTENT_SCHEMA_VERSION`, `cruiseContentSchema`,
`CruiseContent`, nested content types, `validateCruiseContent`, and the cabin
facet vocabularies (`CABIN_BED_CONFIGURATIONS`, `CABIN_ACCESSIBILITY_FEATURES`,
`CABIN_VIEW_TYPES`, exported from `@voyant-travel/cruises-contracts/cabin-features`).
Use `@voyant-travel/cruises` when you also need Drizzle schema, routes, services,
booking integration, adapter registry helpers, or runtime content resolution.

## Install

```bash
pnpm add @voyant-travel/cruises-contracts zod
```

## Usage

```ts
import {
  CRUISES_CONTENT_SCHEMA_VERSION,
  cruiseContentSchema,
  type CruiseContent,
} from "@voyant-travel/cruises-contracts"
```

Existing `@voyant-travel/cruises/content-shape` imports remain available for
applications that already depend on the full runtime package.

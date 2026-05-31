# @voyantjs/accommodations-contracts

Pure accommodation content contracts for adapter implementers and external
consumers that need to validate `accommodations/v1` rich content payloads
without installing the full accommodations runtime package.

Use this package for `ACCOMMODATION_CONTENT_SCHEMA_VERSION`,
`accommodationContentSchema`, `AccommodationContent`, nested content types, and
`validateAccommodationContent`. Use `@voyantjs/accommodations` when you also need
Drizzle schema, routes, services, booking integration, catalog projection, or
runtime content resolution (including the `mergeOverlaysIntoAccommodationContent`
overlay composition).

## Install

```bash
pnpm add @voyantjs/accommodations-contracts zod
```

## Usage

```ts
import {
  ACCOMMODATION_CONTENT_SCHEMA_VERSION,
  accommodationContentSchema,
  type AccommodationContent,
} from "@voyantjs/accommodations-contracts"
```

Existing `@voyantjs/accommodations/content-shape` imports remain available for
applications that already depend on the full runtime package.

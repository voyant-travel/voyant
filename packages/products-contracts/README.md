# @voyantjs/products-contracts

Pure product content contracts for adapter implementers and external
consumers that need to validate `products/v1` rich content payloads
without installing the full products runtime package.

Use this package for `PRODUCTS_CONTENT_SCHEMA_VERSION`,
`productContentSchema`, `ProductContent`, nested content types, and
`validateProductContent`. Use `@voyantjs/products` when you also need
Drizzle schema, routes, services, booking integration, catalog projection, or
runtime content resolution (including the `mergeOverlaysIntoProductContent`
overlay composition).

## Install

```bash
pnpm add @voyantjs/products-contracts zod
```

## Usage

```ts
import {
  PRODUCTS_CONTENT_SCHEMA_VERSION,
  productContentSchema,
  type ProductContent,
} from "@voyantjs/products-contracts"
```

Existing `@voyantjs/products/content-shape` imports remain available for
applications that already depend on the full runtime package.

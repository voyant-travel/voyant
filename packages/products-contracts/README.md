# @voyant-travel/products-contracts

Pure product content contracts for adapter implementers and external
consumers that need to validate `products/v1` rich content payloads
without installing the full Inventory runtime package.

Use this package for `PRODUCTS_CONTENT_SCHEMA_VERSION`,
`productContentSchema`, `ProductContent`, nested content types, and
`validateProductContent`. Use `@voyant-travel/inventory` when you also need
Drizzle schema, routes, services, booking integration, catalog projection, or
runtime content resolution (including the `mergeOverlaysIntoProductContent`
overlay composition).

## Install

```bash
pnpm add @voyant-travel/products-contracts zod
```

## Usage

```ts
import {
  PRODUCTS_CONTENT_SCHEMA_VERSION,
  productContentSchema,
  type ProductContent,
} from "@voyant-travel/products-contracts"
```

Runtime product authoring and catalog projection live in `@voyant-travel/inventory`.

# @voyantjs/travel-components-contracts

Pure travel component content contracts for adapter implementers and external
consumers that need to validate package, product, cruise, charter, or
accommodation component payloads without installing runtime packages.

Use this package for `boardBasisSchema`, `travelComponentSchema`,
`TravelComponent`, component refs, commitment boundaries, and price
dispositions. Use the vertical runtime packages when you need Drizzle schemas,
routes, services, booking integration, pricing resolution, or content read
paths.

## Install

```bash
pnpm add @voyantjs/travel-components-contracts zod
```

## Usage

```ts
import {
  boardBasisSchema,
  travelComponentSchema,
  type TravelComponent,
} from "@voyantjs/travel-components-contracts"
```

# @voyantjs/catalog-contracts

Pure catalog-plane contracts for external source adapter implementers and
framework consumers that do not need the full catalog runtime package.

Use this package for adapter payload types, Zod schemas, field-policy contracts,
provenance, drift event payloads, and pure content locale/overlay helpers. Use
`@voyantjs/catalog` when you also need Drizzle schema, Hono routes, booking
engine routes, search services, or catalog runtime services.

## Install

```bash
pnpm add @voyantjs/catalog-contracts zod
```

## Common Imports

```ts
import type { SourceAdapter } from "@voyantjs/catalog-contracts/adapter/contract"
import { sourceAdapterSchema } from "@voyantjs/catalog-contracts/adapter/schemas"
import type { CatalogProjection } from "@voyantjs/catalog-contracts"
```

Existing `@voyantjs/catalog` contract import paths remain available for
applications that already depend on the full runtime package.

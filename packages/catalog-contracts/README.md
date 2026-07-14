# @voyant-travel/catalog-contracts

Pure catalog-plane contracts for external source adapter implementers and
framework consumers that do not need the full catalog runtime package.

Use this package for adapter payload types, Zod schemas, field-policy contracts,
provenance, drift event payloads, and pure content locale/overlay helpers. Use
`@voyant-travel/catalog` when you also need Drizzle schema, Hono routes, booking
engine routes, search services, or catalog runtime services.

## Install

```bash
pnpm add @voyant-travel/catalog-contracts zod
```

## Common Imports

```ts
import type { SourceAdapter } from "@voyant-travel/catalog-contracts/adapter/contract"
import { sourceAdapterSchema } from "@voyant-travel/catalog-contracts/adapter/schemas"
import type { CatalogProjection } from "@voyant-travel/catalog-contracts"
```

## Search Index Adapters

External search-engine packages implement the adapter and synchronous provider
factory from the contracts-only subpath:

```ts
import type {
  IndexerAdapter,
  IndexerProvider,
} from "@voyant-travel/catalog-contracts/indexer/contract"

export const searchProvider: IndexerProvider = {
  create({ registries, vectorDimensions }): IndexerAdapter {
    return createVendorIndexer({ registries, vectorDimensions })
  },
}
```

Run the published, test-framework-neutral conformance kit in the adapter's own
test suite:

```ts
import { assertIndexerAdapterConformance } from "@voyant-travel/catalog-contracts/indexer/conformance"

await assertIndexerAdapterConformance({
  createAdapter: () =>
    searchProvider.create({ registries: new Map(), vectorDimensions: null }),
})
```

Existing `@voyant-travel/catalog` contract import paths remain available for
applications that already depend on the full runtime package.

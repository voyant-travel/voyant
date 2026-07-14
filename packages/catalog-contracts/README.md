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

The runner creates isolated slices, mutates them, and removes them again. It
checks non-empty keyword matching, filters, canonical ordered sorting, replacement by
document id, hit round-tripping, facet and page limits, terminal cursors, slice
isolation, bulk reindexing, deletion, and optional admin operations. When an
adapter declares vector, hybrid, cross-audience federation, or admin
denormalization support, the runner also verifies that behavior. Semantic
fixtures require pure vector ranking even when the request contains conflicting
text. Hybrid fixtures require the union of keyword-only and vector-only
candidates and require `alpha` to change the winner of competing signals.
`SearchHit.score` is always normalized so larger values rank first, including
through federation. Vector-aware admin scans must return every fixture's exact
embedding and model id. The runner certifies these portable semantics, not a
provider's internal query topology or proprietary ranking quality;
provider-specific native behavior belongs in provider-owned tests. Hosted
providers can supply `settle` when writes are eventually consistent and
`namespace` when resource names need a stable prefix.

Facet requests return at most `MAX_FACET_BUCKETS` (250) buckets per field. An
omitted `FacetRequest.limit` uses that portable maximum, and values above it are
clamped. This is a bounded cross-provider contract, not an unlimited request.

`IndexerDocument.fields` use engine-neutral index field names. They preserve
field-policy paths except for a terminal list marker: policy path `tags[]` is
stored, filtered, faceted, and returned as index field `tags`. Providers should
apply `indexFieldNameForPolicyPath(...)` at their engine boundary rather than
maintaining a vendor-specific path convention.

Portable sort options are not vendor aliases. Adapters should use the published
resolver so field precedence and audience visibility stay consistent:

```ts
import { resolveSearchSort } from "@voyant-travel/catalog-contracts/indexer/contract"

const resolved = resolveSearchSort(request.sort, registry, slice)
// Translate resolved?.field and resolved?.direction to the engine query.
```

## Packaging A Search Provider

A reusable provider is a plugin package with separate runtime and import-cheap
manifest exports. It depends on `@voyant-travel/catalog-contracts` for the
adapter API and on `@voyant-travel/core` only for its deployment declaration.
It does not depend on `@voyant-travel/catalog` or import application runtime
code.

```jsonc
{
  "name": "@acme/voyant-search",
  "type": "module",
  "exports": {
    "./provider": "./dist/provider.js",
    "./voyant": "./dist/voyant.js"
  },
  "voyant": {
    "schemaVersion": "voyant.package.v1",
    "kind": "plugin",
    "manifest": "./voyant",
    "compatibleWith": {
      "framework": ">=0.44.0",
      "targets": ["node"],
      "modes": ["local", "managed-cloud", "self-hosted"]
    }
  },
  "peerDependencies": {
    "@voyant-travel/catalog-contracts": "^0.110.0",
    "@voyant-travel/core": "^0.122.0"
  }
}
```

The manifest declares every configuration value and secret consumed by the
factory, then contributes exactly one provider to `catalog.indexer`. Use
`value: "algolia"` for an Algolia package and `value: "custom"` for an
operator-specific engine.

```ts
// src/voyant.ts
import { definePlugin } from "@voyant-travel/core/project"

export default definePlugin({
  id: "@acme/voyant-search",
  packageName: "@acme/voyant-search",
  localId: "acme-search",
  config: [{ id: "@acme/voyant-search#config.endpoint", key: "endpoint", required: true }],
  secrets: [
    {
      id: "@acme/voyant-search#secret.api-key",
      key: "apiKey",
      required: true,
      rotation: "replace-only",
    },
  ],
  providers: [
    {
      id: "@acme/voyant-search#provider.custom",
      port: "catalog.indexer",
      selection: { role: "search", value: "custom" },
      uses: {
        config: ["@acme/voyant-search#config.endpoint"],
        secrets: ["@acme/voyant-search#secret.api-key"],
      },
      runtime: { entry: "@acme/voyant-search/provider", export: "createSearchProvider" },
    },
  ],
})
```

The runtime export returns an `IndexerProvider`; it may construct vendor clients
from the declared factory context, but `create()` remains synchronous:

```ts
// src/provider.ts
import type { IndexerProvider } from "@voyant-travel/catalog-contracts/indexer/contract"

export function createSearchProvider(context: {
  getConfig(id: string): unknown
  getSecret(id: string): unknown
}): IndexerProvider {
  const client = createVendorClient({
    endpoint: String(context.getConfig("@acme/voyant-search#config.endpoint")),
    apiKey: String(context.getSecret("@acme/voyant-search#secret.api-key")),
  })
  return {
    create: ({ registries, vectorDimensions }) =>
      createVendorIndexer({ client, registries, vectorDimensions }),
  }
}
```

Installing the dependency does not admit it. The application must list the
plugin and select the same provider value in `voyant.config.ts`:

```ts
import { defineConfig } from "@voyant-travel/framework/project"

export default defineConfig({
  plugins: [{ resolve: "@acme/voyant-search" }],
  deployment: {
    target: "node",
    mode: "self-hosted",
    providers: { search: "custom" },
  },
})
```

Graph admission checks package compatibility, manifest and runtime export
resolution, duplicate provider IDs, port conformance, and that the selected
`{ role: "search", value: "custom" }` provider exists. Configuration and secret
presence only satisfies that selected provider; it never selects one. A
deployment may instead inject an `IndexerProvider` directly for embedded hosts
or tests, but that is not reusable package admission.

Existing `@voyant-travel/catalog` contract import paths remain available for
applications that already depend on the full runtime package.

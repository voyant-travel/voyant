# @voyant-travel/plugin-sanity-cms

Sanity CMS sync adapter bundle for Voyant.

Architecturally, this package is primarily:

- a Sanity sync adapter
- a subscriber bundle that mirrors Voyant module records into Sanity
- an optional packaged bundle when an app wants one installable entrypoint

It subscribes to module events and mirrors documents into a Sanity dataset keyed
by a `voyantId` field.

## Install

```bash
pnpm add @voyant-travel/plugin-sanity-cms
```

## Usage

```typescript
import { sanityCmsPlugin } from "@voyant-travel/plugin-sanity-cms"
import { createApp } from "@voyant-travel/hono"

const sanitySync = sanityCmsPlugin({
  projectId: env.SANITY_PROJECT_ID,
  dataset: "production",
  token: env.SANITY_TOKEN,
  documentType: "product",
  // optional: apiVersion, voyantIdField, apiHost, events, mapEvent, logger
})

const app = createApp({
  plugins: [sanitySync],
})
```

Uses GROQ for reads and Sanity Mutations API for writes. `sanityCmsPlugin(...)`
is the packaged distribution helper; at runtime the package is primarily a
subscriber-driven Sanity sync adapter. Default `apiVersion` is `"2024-01-01"`.
By default it wires up 3 subscribers
(`product.created`, `product.updated`, `product.deleted`).

## Exports

| Entry | Description |
| --- | --- |
| `.` | Barrel re-exports |
| `./plugin` | `sanityCmsPlugin(options)` — packaged adapter/subscriber bundle |
| `./client` | `createSanityClient` — `upsertByVoyantId`, `deleteByVoyantId`, `findByVoyantId` |
| `./types` | Adapter and bundle option types |

## License

Apache-2.0

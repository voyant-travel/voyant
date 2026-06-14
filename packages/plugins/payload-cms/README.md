# @voyant-travel/plugin-payload-cms

Payload CMS sync adapter bundle for Voyant.

Architecturally, this package is primarily:

- a Payload sync adapter
- a subscriber bundle that mirrors Voyant module records into Payload
- an optional packaged bundle when an app wants one installable entrypoint

It subscribes to module events and mirrors documents into a Payload collection
keyed by a `voyantId` field.

## Install

```bash
pnpm add @voyant-travel/plugin-payload-cms
```

## Usage

```typescript
import { payloadCmsPlugin } from "@voyant-travel/plugin-payload-cms"
import { createApp } from "@voyant-travel/hono"

const payloadCmsSync = payloadCmsPlugin({
  apiUrl: "https://cms.example.com/api",
  apiKey: env.PAYLOAD_API_KEY,
  collection: "products",
  // optional: events, mapEvent, logger, apiKeyAuthScheme
})

const app = createApp({
  plugins: [payloadCmsSync],
})
```

`payloadCmsPlugin(...)` is the packaged distribution helper. The runtime role is
still a subscriber-driven Payload sync adapter. By default it wires up 3
subscribers (`product.created`, `product.updated`, `product.deleted`) that
upsert/delete documents keyed by `voyantId`. All error handling is
fire-and-forget per the EventBus contract.

## Exports

| Entry | Description |
| --- | --- |
| `.` | Barrel re-exports |
| `./plugin` | `payloadCmsPlugin(options)` — packaged adapter/subscriber bundle |
| `./client` | `createPayloadClient` — `upsertByVoyantId`, `deleteByVoyantId`, `findByVoyantId` |
| `./types` | Adapter and bundle option types |

## License

Apache-2.0

# @voyantjs/sellability

Compatibility shim for the Commerce-owned sellability surface.

The implementation now lives under `@voyantjs/commerce/sellability`. This
package keeps the old import name and schema-manifest entry working during the
v1 package transition.

Sellability resolves candidate offers across markets, pricing, availability,
pickups, and allotments, and persists commercial snapshots for downstream
booking and checkout flows.

## Install

```bash
pnpm add @voyantjs/sellability
```

## Usage

```typescript
import { sellabilityModule } from "@voyantjs/commerce/sellability"
import { createApp } from "@voyantjs/hono"

const app = createApp({
  modules: [sellabilityModule],
  // ...
})
```

## Exports

| Entry | Description |
| --- | --- |
| `.` | Re-export of `@voyantjs/commerce/sellability` |
| `./schema` | Drizzle tables |
| `./validation` | Zod schemas |
| `./routes` | Hono routes |

## License

Apache-2.0

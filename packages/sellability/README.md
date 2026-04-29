# @voyantjs/sellability

Sellability module for Voyant. Resolves candidate offers across markets, pricing, availability, pickups, and allotments, and persists snapshots that feed the transactions and bookings layers.

## Install

```bash
pnpm add @voyantjs/sellability
```

## Usage

```typescript
import { sellabilityModule } from "@voyantjs/sellability"
import { createApp } from "@voyantjs/hono"

const app = createApp({
  modules: [sellabilityModule],
  // ...
})
```

## Exports

| Entry | Description |
| --- | --- |
| `.` | Module export |
| `./schema` | Drizzle tables |
| `./validation` | Zod schemas |
| `./routes` | Hono routes |

## License

Apache-2.0

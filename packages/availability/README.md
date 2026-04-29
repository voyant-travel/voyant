# @voyantjs/availability

Availability module for Voyant. Dated availability, slots, closeouts, and pickup capacity — the primary signal sellability consumes when resolving candidate offers.

## Install

```bash
pnpm add @voyantjs/availability
```

## Usage

```typescript
import { availabilityModule } from "@voyantjs/availability"
import { createApp } from "@voyantjs/hono"

const app = createApp({
  modules: [availabilityModule],
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
| `./rrule` | RFC 5545 recurrence-rule helpers |

## License

Apache-2.0

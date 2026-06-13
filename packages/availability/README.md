# @voyantjs/availability

Compatibility facade for Operations availability.

New code should import `@voyantjs/operations/availability`. This package keeps
existing `@voyantjs/availability` imports and schema metadata working while the
v1 package move lands.

## Install

```bash
pnpm add @voyantjs/operations
```

## Usage

```typescript
import { availabilityModule } from "@voyantjs/operations/availability"
import { createApp } from "@voyantjs/hono"

const app = createApp({
  modules: [availabilityModule],
  // ...
})
```

## Exports

| Entry | Description |
| --- | --- |
| `.` | Compatibility re-export of `@voyantjs/operations/availability` |
| `./schema` | Drizzle tables |
| `./validation` | Zod schemas |
| `./routes` | Hono routes |
| `./rrule` | RFC 5545 recurrence-rule helpers |
| `./service-holds` | Availability hold helpers |

## License

Apache-2.0

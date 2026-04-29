# @voyantjs/extras

Extras module for Voyant. Product extras and booking add-ons (optional line items layered on top of a booked product).

## Install

```bash
pnpm add @voyantjs/extras
```

## Usage

```typescript
import { extrasModule } from "@voyantjs/extras"
import { createApp } from "@voyantjs/hono"

const app = createApp({
  modules: [extrasModule],
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

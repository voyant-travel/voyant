# @voyantjs/hospitality

Hospitality module for Voyant. Room types, meal plans, rate plans, stay rules, inventory, and stay-booking detail on top of the shared facility layer.

## Install

```bash
pnpm add @voyantjs/hospitality
```

## Usage

```typescript
import { hospitalityModule } from "@voyantjs/hospitality"
import { createApp } from "@voyantjs/hono"

const app = createApp({
  modules: [hospitalityModule],
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

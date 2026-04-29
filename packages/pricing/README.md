# @voyantjs/pricing

Pricing module for Voyant. Pricing categories, catalogs, schedules, and rules.

## Install

```bash
pnpm add @voyantjs/pricing
```

## Usage

```typescript
import { pricingModule } from "@voyantjs/pricing"
import { createApp } from "@voyantjs/hono"

const app = createApp({
  modules: [pricingModule],
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

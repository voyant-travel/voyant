# @voyantjs/quotes

Quotes owns pipelines, stages, quotes, quote versions, quote participants,
quote products, quote version lines, proposal lifecycle decisions, and the
accept-to-reserve booking quote details extension.

People and organizations are referenced by plain ids. This package does not
import Relationships schema tables or own relationship lifecycle state.

## Install

```bash
pnpm add @voyantjs/quotes
```

## Usage

```typescript
import { quotesModule } from "@voyantjs/quotes"
import { createApp } from "@voyantjs/hono"

const app = createApp({
  modules: [quotesModule],
})
```

## Exports

| Entry | Description |
| --- | --- |
| `.` | Module export, services, public types, linkables |
| `./schema` | Quotes-owned Drizzle tables |
| `./validation` | Quote lifecycle validation schemas |
| `./routes` | Hono routes for pipelines, stages, quotes, and quote versions |
| `./booking-extension` | Booking quote details extension |

## License

Apache-2.0

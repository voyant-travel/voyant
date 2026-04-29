# @voyantjs/transactions

Transactions module for Voyant — offer, order, and commercial transaction layer that sits between sellability and bookings.

## Install

```bash
pnpm add @voyantjs/transactions
```

## Usage

```typescript
import { transactionsModule } from "@voyantjs/transactions"
import { createApp } from "@voyantjs/hono"

const app = createApp({
  modules: [transactionsModule],
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

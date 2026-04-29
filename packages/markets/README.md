# @voyantjs/markets

Markets module for Voyant. Markets, locales, currencies, and FX snapshots — the geographic/monetary dimension that pricing and sellability resolve against.

## Install

```bash
pnpm add @voyantjs/markets
```

## Usage

```typescript
import { marketsModule } from "@voyantjs/markets"
import { createApp } from "@voyantjs/hono"

const app = createApp({
  modules: [marketsModule],
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

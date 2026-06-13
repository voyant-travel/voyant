# @voyantjs/markets

Compatibility shim for the Commerce-owned markets surface.

The implementation now lives under `@voyantjs/commerce/markets`. This package
keeps the old import name and schema-manifest entry working during the v1
package transition.

## Install

```bash
pnpm add @voyantjs/markets
```

## Usage

```typescript
import { marketsModule } from "@voyantjs/commerce/markets"
import { createApp } from "@voyantjs/hono"

const app = createApp({
  modules: [marketsModule],
  // ...
})
```

## Exports

| Entry | Description |
| --- | --- |
| `.` | Re-export of `@voyantjs/commerce/markets` |
| `./schema` | Drizzle tables |
| `./validation` | Zod schemas |
| `./routes` | Hono routes |

## License

Apache-2.0

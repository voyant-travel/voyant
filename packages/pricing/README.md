# @voyantjs/pricing

Compatibility shim for the Commerce-owned pricing surface.

The implementation now lives under `@voyantjs/commerce/pricing`. This package
keeps the old import name and schema-manifest entry working during the v1
package transition.

## Install

```bash
pnpm add @voyantjs/pricing
```

## Usage

```typescript
import { pricingModule } from "@voyantjs/commerce/pricing"
import { createApp } from "@voyantjs/hono"

const app = createApp({
  modules: [pricingModule],
  // ...
})
```

## Exports

| Entry | Description |
| --- | --- |
| `.` | Re-export of `@voyantjs/commerce/pricing` |
| `./schema` | Drizzle tables |
| `./validation` | Zod schemas |
| `./routes` | Hono routes |

## License

Apache-2.0

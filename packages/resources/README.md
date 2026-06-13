# @voyantjs/resources

Compatibility facade for Operations resources.

New code should import `@voyantjs/operations/resources`. This package keeps
existing `@voyantjs/resources` imports and schema metadata working while the v1
package move lands.

## Install

```bash
pnpm add @voyantjs/operations
```

## Usage

```typescript
import { resourcesModule } from "@voyantjs/operations/resources"
import { createApp } from "@voyantjs/hono"

const app = createApp({
  modules: [resourcesModule],
  // ...
})
```

## Exports

| Entry | Description |
| --- | --- |
| `.` | Compatibility re-export of `@voyantjs/operations/resources` |
| `./schema` | Drizzle tables |
| `./validation` | Zod schemas |
| `./routes` | Hono routes |

## License

Apache-2.0

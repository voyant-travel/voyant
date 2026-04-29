# @voyantjs/external-refs

External references module for Voyant. Cross-system external identity and mapping layer — correlates Voyant entities with IDs in third-party systems (channels, PMSs, OTAs).

## Install

```bash
pnpm add @voyantjs/external-refs
```

## Usage

```typescript
import { externalRefsModule } from "@voyantjs/external-refs"
import { createApp } from "@voyantjs/hono"

const app = createApp({
  modules: [externalRefsModule],
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

# @voyantjs/resources

Resources module for Voyant. Assignable resources, pools, requirements, and assignments — the scheduling substrate for drivers, guides, rooms, vehicles, and equipment.

## Install

```bash
pnpm add @voyantjs/resources
```

## Usage

```typescript
import { resourcesModule } from "@voyantjs/resources"
import { createApp } from "@voyantjs/hono"

const app = createApp({
  modules: [resourcesModule],
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

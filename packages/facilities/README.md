# @voyantjs/facilities

Facilities module for Voyant. Shared facility and property layer — the baseline hospitality, ground, and venue entities that feed specialized overlays.

## Install

```bash
pnpm add @voyantjs/facilities
```

## Usage

```typescript
import { facilitiesModule } from "@voyantjs/facilities"
import { createApp } from "@voyantjs/hono"

const app = createApp({
  modules: [facilitiesModule],
  // ...
})
```

## Entities

- **Facilities** (`fac`)
- **Facility features** (`ffea`)
- **Facility operations** (`fops`)
- **Properties** (`prop`) + **property groups** (`pgrp`, `pgpm`)

## Exports

| Entry | Description |
| --- | --- |
| `.` | Module export |
| `./schema` | Drizzle tables |
| `./validation` | Zod schemas |
| `./routes` | Hono routes |

## License

Apache-2.0

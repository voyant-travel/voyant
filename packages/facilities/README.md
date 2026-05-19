# @voyantjs/facilities

Facilities module for Voyant. Shared location and venue layer for DMC and
tour-operator workflows: hubs, attractions, restaurants, airports, meeting
points, accommodation locations, and other operational places.

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
- **Properties** (`prop`) + **property groups** (`pgrp`, `pgpm`) for
  accommodation/location metadata, not hotel PMS operations

## Exports

| Entry | Description |
| --- | --- |
| `.` | Module export |
| `./schema` | Drizzle tables |
| `./validation` | Zod schemas |
| `./routes` | Hono routes |

## License

Apache-2.0

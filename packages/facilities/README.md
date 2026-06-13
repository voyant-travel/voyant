# @voyantjs/facilities

Compatibility package for the shared places module.

New code should prefer `@voyantjs/places`. This package keeps existing
`@voyantjs/facilities` imports, routes, table names, and `facilityId` fields
working while the v1 package move lands.

The retained capability is a shared physical-place layer for DMC,
tour-operator, OTA, and MICE workflows: meeting points, pickup/dropoff places,
ports, stations, hubs, attractions, restaurants, airports, supplier bases,
venues, accommodation locations, and other operational places.

## Install

```bash
pnpm add @voyantjs/facilities
# preferred for new code
pnpm add @voyantjs/places
```

## Usage

```typescript
import { placesModule } from "@voyantjs/places"
import { createApp } from "@voyantjs/hono"

const app = createApp({
  modules: [placesModule],
  // ...
})
```

## Entities

- **Places** (`fac`, compatibility table name `facilities`)
- **Place features** (`ffea`, compatibility table name `facility_features`)
- **Place opening windows** (`fops`, compatibility table name
  `facility_operation_schedules`)
- **Properties** (`prop`) + **property groups** (`pgrp`, `pgpm`) are deprecated
  accommodation-resale compatibility records. They are not a first-party hotel,
  PMS, or property-operations surface and should move out before v1 if retained.

## Exports

| Entry | Description |
| --- | --- |
| `.` | Module export |
| `./schema` | Drizzle tables |
| `./validation` | Zod schemas |
| `./routes` | Hono routes |

## License

Apache-2.0

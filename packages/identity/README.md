# @voyant-travel/identity

Identity primitives for Voyant. Provides shared contact-point, address, and named-contact records used across CRM, suppliers, facilities, and distribution.

## Install

```bash
pnpm add @voyant-travel/identity
```

## Usage

CRM's person create/update syncs inline contact fields (email, phone, website, address, city, country) to this module, keeping identity primitives canonical across consumers.

```typescript
import { identityModule } from "@voyant-travel/identity"
import { createApp } from "@voyant-travel/hono"

const app = createApp({
  modules: [identityModule],
  // ...
})
```

## Exports

| Entry | Description |
| --- | --- |
| `.` | Module export |
| `./service` | Identity sync/hydration service |
| `./schema` | Drizzle tables (contact points, addresses, named contacts) |
| `./validation` | Zod schemas |
| `./tools` | Guarded MCP Tools for contact points, addresses, and named contacts |
| `./routes` | Hono routes |

The Tool surface is staff-only. Reads and writes are classified as sensitive because
the records contain personal contact and location data; every capability requires an
explicit `identity:read` or `identity:write` grant and action-ledger binding. Destructive
deletes remain available only through explicitly authorized administrative routes.

## License

Apache-2.0

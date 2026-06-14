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
| `./routes` | Hono routes |

## License

Apache-2.0

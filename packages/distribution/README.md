# @voyant-travel/distribution

Distribution module for Voyant. Distribution owns the broader commercial
network: channels, suppliers, source/operator links, external refs, mappings,
allotments, channel push, webhooks, and reconciliation for OTA,
tour-operator, and DMC deployments.

Distribution is cross-cutting channel support. It is not a separate
implementation scenario or user base.

## Install

```bash
pnpm add @voyant-travel/distribution
```

## Usage

```typescript
import { distributionModule } from "@voyant-travel/distribution"
import { createApp } from "@voyant-travel/hono"

const app = createApp({
  modules: [distributionModule],
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
| `./suppliers` | Supplier identity, services, rates, notes, routes, validation, and schema owner path |
| `./external-refs` | External reference routes, service, validation, and schema owner path |

## License

Apache-2.0

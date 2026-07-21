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
| `./channel-push-jobs` | Package-owned channel-push job handlers |
| `./channel-push-runtime` | Runtime port and host composition for channel push |
| `./channel-push-subscribers` | Domain-event subscribers that record channel-push intent |
| `./schema` | Drizzle tables |
| `./validation` | Zod schemas |
| `./routes` | Hono routes |
| `./suppliers` | Supplier identity, services, rates, notes, routes, validation, and schema owner path |
| `./external-refs` | External reference routes, service, validation, and schema owner path |
| `./tools` | Guarded supplier, channel, and external-reference Tool definitions |
| `./mcp-runtime` | Tool definitions plus the package-owned runtime context contributor |

The Tool surface provides staff-scoped list, detail, create, and update
capabilities for supplier profiles, distribution channels, and external
references. Destructive deletes remain outside the Tool surface until a
deployment selects an explicit destructive-action policy.

Selecting the package's channel-push extension selects its subscribers and
jobs. Their schedules come from the package manifest; applications do not
redeclare them through environment flags or project-local job definitions.

## License

Apache-2.0

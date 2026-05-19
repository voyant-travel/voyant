# @voyantjs/distribution

Distribution module for Voyant. Channels, contracts, commissions, mappings,
webhook events, and channel identity for OTA, tour-operator, and DMC
deployments.

Distribution is cross-cutting channel support. It is not a separate
implementation scenario or user base.

## Install

```bash
pnpm add @voyantjs/distribution
```

## Usage

```typescript
import { distributionModule } from "@voyantjs/distribution"
import { createApp } from "@voyantjs/hono"

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

## License

Apache-2.0

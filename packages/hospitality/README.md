# @voyantjs/hospitality

Legacy hospitality module for Voyant. This package currently mixes two
different concerns:

- accommodation resale contracts that OTAs, tour operators, and DMCs still need
  for catalog, storefront, and booking flows
- hotel/property operations surfaces that are being de-scoped from first-party
  Voyant starters

Do not add new first-party hotel-operations features here. New work should
follow
[`docs/architecture/accommodation-resale-boundary.md`](../../docs/architecture/accommodation-resale-boundary.md):
keep accommodation resale and trip composition, but remove or quarantine hotel
PMS-style operations.

## Install

Direct installation is transitional while the package is being split/de-scoped.
Prefer catalog, products, bookings, storefront, supplier, and source-adapter
surfaces for new accommodation resale work.

```bash
pnpm add @voyantjs/hospitality
```

## Usage

Existing deployments may still mount the module while migration work is in
progress. First-party starters should not present it as a hotel-operations
workspace.

```typescript
import { hospitalityModule } from "@voyantjs/hospitality"
import { createApp } from "@voyantjs/hono"

const app = createApp({
  modules: [hospitalityModule],
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

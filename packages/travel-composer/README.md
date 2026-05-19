# @voyantjs/travel-composer

Deterministic composition layer for customer-facing trips that group multiple
component bookings/orders into one itinerary, pricing, reserve, checkout, and
support experience.

This package is landing on the travel-composer integration branch. It currently
includes the durable schema, Zod contracts, deterministic trip service,
catalog component adapter, price aggregation, reserve workflow, checkout
handoff, component-level cancellation preview/cancel operations, Cruise
Extension representation helpers, Hono routes, and MCP tools. Checkout and
cancellation are dependency-injected so app/runtime packages keep owning
payment-provider, bank-transfer, storefront URL, supplier, and staff-remediation
policy. See
`docs/architecture/travel-composer-implementation-plan.md` for the full PR
sequence and remaining slices.

## Install

```bash
pnpm add @voyantjs/travel-composer
```

## Exports

| Entry | Description |
| --- | --- |
| `.` | Module export |
| `./schema` | Drizzle tables, added in the schema slice |
| `./validation` | Zod contracts |
| `./service` | Deterministic composer services |
| `./mcp-tools` | AI-safe trip planning, revision, price, and reserve tools |
| `./cruise-extension` | Cruise Extension link and selection helpers |
| `./routes` | Hono route factory/module routes |

## License

Apache-2.0

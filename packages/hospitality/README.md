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

## Status

This package is not a normal first-party adoption surface. Do not add it to new
starters, do not mount its Hono routes in starter APIs, and do not present it as
a workspace for hotels to manage their own properties.

Keep existing accommodation resale contracts here only until they move to a
narrowly named accommodation surface. Prefer catalog, products, bookings,
storefront, supplier, and source-adapter surfaces for new accommodation resale
work.

## Retained Scope

Retained work is limited to resale-facing contracts such as sourced lodging
content, room options, board/rate choices, cancellation policy, occupancy,
booking snapshots, and catalog policy needed by OTAs, tour operators, and DMCs.

Out-of-scope work includes hotel/property operator workflows: room-unit
management, inventory grids for direct hotel operations, maintenance blocks,
housekeeping, folios, in-stay operations, and PMS-style route or UI exposure.

## Exports

| Entry | Description |
| --- | --- |
| `.` | Module export |
| `./schema` | Drizzle tables |
| `./validation` | Zod schemas |
| `./routes` | Hono routes |

## License

Apache-2.0

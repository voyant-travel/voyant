# @voyant-travel/trips-react

React client utilities for `@voyant-travel/trips`.

This package exposes admin/public API clients, validation-aware operations,
TanStack Query keys/options, cache writers, provider wiring, and hooks for Trip
Envelope composition flows. It supports trip creation, component add, pricing,
reserve, checkout handoff, and support-facing component cancellation preview /
cancel operations. Draft is represented as a trip lifecycle status, not as the
customer/admin object name.

## Install

```bash
pnpm add @voyant-travel/trips-react @voyant-travel/trips
```

## Exports

| Entry | Description |
| --- | --- |
| `.` | Client, provider, hooks, operations, schemas, and query helpers |
| `./provider` | `VoyantTripsProvider` and context helpers |
| `./hooks` | React hooks for Trips, pricing, reserve, checkout, and components |
| `./client` | Fetcher and API error utilities |
| `./query-keys` | Stable TanStack Query keys |

## License

Apache-2.0

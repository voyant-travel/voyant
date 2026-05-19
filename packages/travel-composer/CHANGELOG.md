# @voyantjs/travel-composer

## 0.57.0

### Patch Changes

- @voyantjs/catalog@0.57.0
- @voyantjs/catalog-mcp@0.57.0
- @voyantjs/core@0.57.0
- @voyantjs/db@0.57.0
- @voyantjs/hono@0.57.0

## 0.56.0

### Patch Changes

- @voyantjs/catalog@0.56.0
- @voyantjs/catalog-mcp@0.56.0
- @voyantjs/core@0.56.0
- @voyantjs/db@0.56.0
- @voyantjs/hono@0.56.0

## 0.55.1

### Patch Changes

- 819c847: Add the Travel Composer foundation for customer-facing composed trips.

  `@voyantjs/travel-composer` introduces Trip Envelopes and Trip Components,
  durable schema, Zod contracts, deterministic draft/component operations,
  catalog-backed component adaptation, aggregate price and tax snapshots, reserve
  and checkout handoff workflows, component-level cancellation preview/cancel
  operations, Cruise Extension representation helpers, admin/public Hono routes,
  and AI-safe itinerary MCP tools.

  `@voyantjs/travel-composer-react` adds the matching React client layer:
  admin/public operation helpers, validation-aware fetches, cache writers, query
  keys/options, provider wiring, and hooks for draft, component, pricing,
  reserve, checkout, and cancellation flows.

- Updated dependencies [819c847]
  - @voyantjs/catalog@0.55.1
  - @voyantjs/catalog-mcp@0.55.1
  - @voyantjs/core@0.55.1
  - @voyantjs/db@0.55.1
  - @voyantjs/hono@0.55.1

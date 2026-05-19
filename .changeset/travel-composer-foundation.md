---
"@voyantjs/travel-composer": patch
"@voyantjs/travel-composer-react": patch
---

Add the Travel Composer foundation for customer-facing composed trips.

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

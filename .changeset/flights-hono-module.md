---
"@voyant-travel/flights": minor
---

The flights module now owns its admin HTTP routes. New exports from
`@voyant-travel/flights` (and `@voyant-travel/flights/hono`):
`createFlightsHonoModule(options)` / `createFlightAdminRoutes(options)`, plus
`FlightsHonoModuleOptions`, `FlightPaymentIntegration`, and
`FlightOrderPaymentSummary`. The deployment supplies the connector adapter
(`resolveAdapter`) and an optional payment integration; the route
implementations (search, ancillaries, seatmap, price, book, orders, reference)
no longer live in the deployment.

---
"@voyant-travel/finance": patch
---

Wire the booking-tax settings and preview route options through the runtime
container so the managed runtime's operator-settings resolvers always reach the
routes.

On the managed runtime every runtime export of a graph unit is invoked: the
`defineGraphRuntimeFactory` export receives the factory context and wires the
operator-settings port into options, while the plain api-facet export is called
with no args and therefore saw empty options. Because the api-facet previously
returned an eager `adminRoutes` set built from those empty options, `PATCH
/v1/admin/finance/tax-settings` failed with `Booking tax settings updates are
not configured`.

The booking-tax settings/preview extensions now mirror the booking-schedule
pattern: the graph factory registers the wired options into the shared app
container under a runtime key during `bootstrap`, and the (now lazy) routes
resolve those options from the container at request time, falling back to the
closure options for standard callers that pass real options directly.

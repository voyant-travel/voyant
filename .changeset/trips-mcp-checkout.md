---
"@voyant-travel/trips": minor
---

The trips module now owns the MCP tool routes and the trip-checkout service: new `@voyant-travel/trips/mcp` (`createTripMcpRoutes(options)`) and `@voyant-travel/trips/checkout` (`startTripCheckout` + billing helpers) surfaces. The payment-provider start, FX quoting, and checkout base URL are injected as options; adds `@voyant-travel/finance` as a dependency.

---
"@voyant-travel/trips": minor
---

Migrate the trips agent surface onto the framework tool contract
(`@voyant-travel/tools`). The `create_trip` / `revise_trip` / `price_trip` /
`reserve_trip` tools are now headless `defineTool`s returning typed pure data
(`@voyant-travel/trips/tools`), each with `requiredScopes`, a risk tier, and a
declarative risk policy.

**Breaking:** the bespoke MCP surface is removed — the `./mcp` and `./mcp-tools`
subpath exports (and `createTripMcpRoutes`, `createMcpToolRegistry`,
`McpTool*` types, `tripsMcpTools`, `TripsMcpServices`) no longer exist. Deployments
mount the trips tools through the in-deployment MCP server
(`@voyant-travel/mcp` `createMcpHonoApp`) instead; use `tripsTools` +
`TripsToolServices` from `@voyant-travel/trips/tools`.

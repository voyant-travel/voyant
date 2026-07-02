---
"@voyant-travel/hono": patch
---

Exempt the `/v1/admin/mcp` surface from the coarse `require-actor` method+path
permission guard (alongside `_meta`). The in-deployment MCP server authorizes at a
finer grain — each tool is gated by its own `requiredScopes` — so any authenticated
API key or staff session reaches the endpoint and simply sees a scope-filtered tool
list. This lets external MCP clients authenticate with a Bearer scoped key
(voyant#2801) without needing a wildcard grant.

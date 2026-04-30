# @voyantjs/voyant-catalog-mcp

Phase 2.x — MCP (Model Context Protocol) server scaffolding for the catalog
plane. Wraps the catalog plane's APIs as agent-callable tools so AI assistants
(Claude, ChatGPT plugins, custom agents) connect with tenant-scoped credentials
and call tools rather than crafting REST calls.

See [`docs/architecture/catalog-rag-architecture.md`](../../docs/architecture/catalog-rag-architecture.md)
§3 + §12 (Open question 1).

## Architectural commitment

> AI agents query the API, not the vector database directly.

The MCP tools wrap `getResolvedXById`, `executeSemanticSearch`,
`federateAudienceSearch`, and the source adapter live-resolve / quote paths —
**never the vector DB**. Visibility filtering, overlay resolution, audit, and
rate limiting all happen at the API layer where they normally do. The MCP
server is a thin transport.

## Install

```bash
pnpm add @voyantjs/voyant-catalog-mcp
```

## What's in the box

- **`./contract`** — `McpToolDefinition`, `McpToolHandler`, `McpToolContext`
  types. Transport-agnostic: define the tool surface here, wire it into your
  MCP transport of choice (the `@modelcontextprotocol/sdk`, your own HTTP
  layer, an SSE handler, etc.).
- **`./registry`** — `createMcpToolRegistry` + `dispatchTool` helpers.
  Templates register all tools at startup and the registry exposes a
  unified dispatch entry point for the transport layer.
- **`./tools/*`** — Five canonical tools per the architecture doc:
  - `search_catalog` — keyword / hybrid / semantic search across a vertical
  - `get_entity` — fetch a single resolved CatalogEntry view
  - `suggest_alternatives` — semantic similarity for "more like this"
  - `check_availability` — calls the source adapter's volatile-live path
  - `get_quote` — calls the source adapter to lock a price proposition

## Tool isolation guarantees

- All tools enforce visibility filtering through the catalog plane's resolver.
  A `customer`-actor agent never receives staff-only fields, regardless of
  how cleverly the agent crafts the search query.
- `search_catalog` uses `executeSemanticSearch` — the agent's audience pool
  is enforced server-side; cross-audience federation requires a `staff`-actor
  context.
- `check_availability` and `get_quote` route through the source adapter —
  volatile-live values are always live, never cached, never embedded.

## Wiring into an MCP transport

Templates wire the registry into their MCP SDK transport of choice:

```typescript
import { createMcpToolRegistry } from "@voyantjs/voyant-catalog-mcp/registry"
import { searchCatalogTool } from "@voyantjs/voyant-catalog-mcp/tools/search-catalog"
import { getEntityTool } from "@voyantjs/voyant-catalog-mcp/tools/get-entity"
// ... and so on

const registry = createMcpToolRegistry({
  context: {
    actor: "staff",
    tenantId: "operator_xyz",
    catalog: { /* injected services */ },
  },
})

registry.register(searchCatalogTool)
registry.register(getEntityTool)
// ... wire registry.dispatchTool into your MCP server's CallTool handler.
```

The `@modelcontextprotocol/sdk` is **not** a dependency of this package — the
catalog-mcp surface is the tool definitions; the transport is the operator's
choice (stdio for local dev, HTTP+SSE for hosted, custom for templates).

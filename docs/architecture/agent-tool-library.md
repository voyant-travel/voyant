# Agent Tool Library & MCP Server

Status: implemented foundation (voyant#2792).
Audience: anyone adding agent-callable capabilities to a Voyant domain, or wiring the
MCP server into a deployment.

Voyant exposes framework capabilities to agents through **one authored-once, headless,
scope-gated tool contract**. Exposure — the MCP server, remote agent clients, HTTP — is
a thin adapter over that contract. See [ADR-0011](../adr/0011-agent-tool-library-and-mcp.md)
for the decision record.

## Layers

```
@voyant-travel/tools      pure contract (zod only): defineTool, ToolContext,
        ▲                 ToolRegistry, stable identity, schemas, audience + risk
        │
   ┌────┴───────────────┐
domain packages           @voyant-travel/mcp        transport adapter:
(*/tools: tool arrays)    MCP SDK + @hono/mcp over the registry, scope-enforced
        ▲                        ▲
        └──────────┬─────────────┘
        selected graph runtime: loads package-declared tools and context contributors;
        the selected @voyant-travel/mcp module mounts /v1/admin/mcp
```

Dependency direction is strictly downward. `@voyant-travel/tools` imports nothing heavy
(no `hono`, no `catalog`, no domain package). A domain package depends on `tools`; the
MCP adapter depends on `tools`. No cycles.

## Authoring a domain tool

Add a `src/tools.ts` to the domain package and export it via a `./tools` subpath
(mirroring how the module exports its route bundle). A tool is a thin wrapper over the
**existing service layer** — no new domain logic:

```ts
export const listProductsTool = defineTool({
  name: "list_products",
  description: "List products with filters and pagination. Read-only.",
  inputSchema: productListQuerySchema,     // reuse the domain's zod schema
  outputSchema: z.custom<ProductListResult>(), // start loose; tighten over time
  requiredScopes: ["products:read"],        // resource:action, AND-enforced
  tier: "read",
  riskPolicy: READ_ONLY_RISK,
  async handler(query, ctx) {
    return requireService(ctx.inventory, "inventory").listProducts(query)
  },
})
export const inventoryTools = [listProductsTool, getProductTool] as const
```

Rules:

- **Return typed pure data**, validated by `outputSchema`. Never return MCP envelopes or
  presentation — the transport wraps data at its boundary.
- **Inject services by intersecting the context type** (`ToolContext & { inventory?: … }`)
  and resolve with `requireService`. The tool package never imports the domain's DB or
  service; the deployment binds services to the request `db`.
- **Declare risk as data** (`tier` + `riskPolicy`) so remote consumers can gate
  destructive tools (e.g. a `reserve`-style tool: `tier: "destructive"`,
  `riskPolicy.confirmationRequired`) without executing the handler.
- **Cross-module / composed tools** (spanning several domains) live in the composing
  layer — `trips` — not in a leaf domain package.
- Keep `inputSchema` serialization-friendly (avoid top-level `.transform()`/`.refine()`)
  so `z.toJSONSchema` emits a faithful manifest.
- Treat the package Tool id as the stable capability identity. `name` is the canonical
  MCP invocation label and `aliases` are temporary compatibility labels. Graph-driven
  registration supplies `capabilityId` and `owner`; standalone registries should declare
  them on the Tool. Capability versions default to `v1` only for legacy compatibility.
- Graph-driven registration checks duplicated invocation name, required scopes, and
  deployment risk against the loaded runtime definition. Drift fails registration
  instead of producing a misleading manifest.
- Prefer serializable output schemas. Runtime-only/permissive schemas remain callable,
  but the manifest labels their schema quality so coverage checks and clients do not
  treat them as strong contracts.

## Deployment wiring

Each package manifest declares its `tools` runtime references, required scopes, risk,
and context keys. Runtime lowering selects those declarations with the package graph;
`createGraphMcpHonoApp` loads only those tools and their package-owned context
contributors. The `@voyant-travel/mcp` manifest owns the admin route and requires the
`mcp.runtime` port. A deployment binds that port to its request context and resources;
it does not maintain a tool list or an Operator-local MCP module.

The generated graph runtime is also the executable eligibility source for action
bindings and outbound webhook plans. Separate `tools.json`, `actions.json`, and
`webhooks.json` eligibility catalogs are not emitted.

## Authorization

- **Scope (D2):** the MCP adapter checks each tool's `requiredScopes` against the caller's
  granted scopes with **AND** semantics (`hasApiKeyPermission`). Unauthorized tools are
  neither listed nor registered, so they cannot be called.
- **Coarse guard:** `/v1/admin/mcp` is exempt from the `require-actor` method+path guard
  (like `_meta`) because authorization is per-tool.
- **Audience (D3):** carried on the API-key grant metadata (`API_KEY_GRANT_PRESETS` bundle
  a scope subset + audience), resolved into the catalog `ResolverScope`. PII-sensitive
  resources (`bookings-pii`) are never satisfied by the `*` wildcard.
  A Tool may additionally narrow its `audience.allowed` set; both discovery and
  invocation fail closed for other grant audiences.

## Transport

`@modelcontextprotocol/sdk` `McpServer` over `@hono/mcp` `StreamableHTTPTransport`,
**stateless** (fresh server + transport per request, `sessionIdGenerator: undefined`,
`enableJsonResponse: true`). It runs inside the tenant's Node application; no
separate MCP service or Durable Object is required. `GET /v1/admin/mcp/manifest`
serves a contract-versioned discovery manifest for remote agents.

Standard `tools/list` is also a complete discovery surface. It includes input and
structured-output schemas, derived standard MCP annotations, and exact framework
metadata under `_meta["voyant.travel/tool"]`. Aliases are registered as callable MCP
names with `aliasFor` metadata, while the canonical manifest contains one entry per
capability. Consumers resolve capabilities by `capabilityId` plus an exact supported
`capabilityVersion`; an unknown version is unsupported rather than silently coerced.

## Migration status

Migrated: `trips` (composed/destructive) and `inventory`/products (read-only leaf).
Remaining domains follow the identical pattern and are tracked in voyant#2800: catalog
(read/search), availability, pricing, bookings (+PII), finance (refund/void),
notifications (send), quotes.

## Reconciliation

This supersedes the sibling `@voyant-travel/catalog-mcp` package idea in
[catalog-rag-architecture.md](./catalog-rag-architecture.md): the MCP server is
framework-level and in-deployment, not a per-catalog package. It is the concrete tool +
agent surface referenced by [ai-travel-experience-composition.md](./ai-travel-experience-composition.md)
and the agent control surface posture in [ADR-0009](../adr/0009-federated-operating-mode.md).

# @voyant-travel/mcp

The in-deployment MCP server for the Voyant framework (voyant#2792). It exposes
the framework tool registry as a real [Model Context Protocol](https://modelcontextprotocol.io)
server, mounted as a Hono route group inside the operator deployment at
`/v1/admin/mcp` — **not** a separate app/worker, and **no Durable Object**.

External MCP clients (Claude, ChatGPT, …) connect to that endpoint over the wire.

## API

`createMcpHonoApp({ registry, buildContext, serverInfo? })` → a Hono sub-app. Mount it
at `/v1/admin/mcp` (the `"operator/mcp"` composition entry):

- `POST /` — MCP JSON-RPC (`initialize` / `tools/list` / `tools/call`).
- `GET /manifest` — the contract-versioned tool discovery manifest for remote agents.

`buildContext(c)` maps the request's `c.var` (db lease / actor / audience / scope) into
a `@voyant-travel/tools` `ToolContext`.

## Authentication (external MCP clients)

External MCP clients (Claude Desktop, ChatGPT, …) authenticate with a **Bearer
scoped API key** — the operator's existing `voy_` key pipeline — sent as
`Authorization: <key>`. No separate OAuth/runner is introduced (voyant#2801): the
request auth middleware resolves the key into `scopes` + `audience` on `c.var`, and
this server gates every tool by its `requiredScopes`.

Because authorization is per-tool, the `/v1/admin/mcp` surface is exempt from the
coarse method+path permission guard (`require-actor`, like `_meta`): any
authenticated key reaches the endpoint, and a key with no relevant scopes simply
sees an empty `tools/list`. Mint keys with a grant preset (e.g. `agent-customer`)
to bundle a scope subset with an `audience`.

The reserved `apps/agent-runner` / `apps/agent-control-plane` stubs are intentionally
**not** built out — Voyant ships the tool primitives + this ready-to-use MCP, not an
agent.

## How it works

- **Transport:** `@hono/mcp`'s `StreamableHTTPTransport` (web-standard `Request`/
  `Response`) connected to `@modelcontextprotocol/sdk`'s `McpServer`. The SDK's own
  Node-`http` transport is **not** used.
- **Stateless, per request:** a fresh `McpServer` + transport per request with
  `{ sessionIdGenerator: undefined, enableJsonResponse: true }`, then
  `server.connect(transport)` → `transport.handleRequest(c)`. No session store, no
  Durable Object — fits the operator's single-worker `nodejs_compat` runtime and
  survives the lazy-route `c.var` re-hydration. Clients must send
  `Accept: application/json, text/event-stream`.
- **Authorization (D2):** each tool's `requiredScopes` are checked against the caller's
  granted scopes with **AND** semantics (`hasApiKeyPermission`). Unauthorized tools are
  neither listed nor registered on the per-request server, so they cannot be called.
- **Headless boundary:** the registry returns typed pure data; this adapter wraps it in
  the MCP `CallToolResult` envelope only at the transport edge.

# @voyant-travel/mcp

The in-deployment MCP server for the Voyant framework (voyant#2792). It exposes
the framework tool registry as a real [Model Context Protocol](https://modelcontextprotocol.io)
server, mounted as a Hono route group inside the operator deployment at
`/v1/admin/mcp` — **not** a separate app/worker, and **no Durable Object**.

External MCP clients (Claude, ChatGPT, …) connect to that endpoint over the wire.

## Spike findings (Sub-issue 0)

Validated wiring that the transport adapter (Sub-issue 3) is built on:

- **Transport:** `@hono/mcp`'s `StreamableHTTPTransport` (web-standard `Request`/
  `Response`) connected to `@modelcontextprotocol/sdk`'s `McpServer`. The SDK's own
  `StreamableHTTPServerTransport` is Node-`http`-oriented and is **not** used.
- **Stateless, per request:** create a fresh `McpServer` + transport per request,
  with `{ sessionIdGenerator: undefined, enableJsonResponse: true }`, then
  `await server.connect(transport); return transport.handleRequest(c)`. No session
  store, no Durable Object — fits the operator's single-worker `nodejs_compat`
  runtime, and survives the lazy-route `c.var` re-hydration at `/v1/admin/mcp`.
- **No init handshake required per request:** in stateless mode `tools/list` and
  `tools/call` are each handled independently (verified in `tests/spike.test.ts`).
- **Client `Accept` header** must include `application/json, text/event-stream`.

`src/spike.ts` is a throwaway proof — it is replaced by `createMcpHonoApp(...)` over
the `@voyant-travel/tools` registry once that lands.

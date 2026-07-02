/**
 * Sub-issue 0 spike (voyant#2792): prove `@modelcontextprotocol/sdk` `McpServer`
 * serves over `@hono/mcp`'s web-standard Streamable-HTTP transport as a plain
 * Hono route group — stateless, no Durable Object — so it drops into the
 * operator's `/v1/admin/mcp` composition seam under `nodejs_compat`.
 *
 * Stateless serverless pattern: a fresh `McpServer` + transport per request,
 * `enableJsonResponse` so the handler returns a JSON body (not an SSE stream),
 * `sessionIdGenerator: undefined` so no session state is retained across
 * requests. This is the wiring the real adapter (Sub-issue 3) is built on.
 *
 * THROWAWAY — replaced by `createMcpHonoApp` once the tool registry lands.
 */
import { StreamableHTTPTransport } from "@hono/mcp"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { Hono } from "hono"
import { z } from "zod"

function createSpikeServer(): McpServer {
  const server = new McpServer({ name: "voyant-mcp-spike", version: "0.0.0" })
  server.tool(
    "echo",
    "Echo the provided text back. Spike-only tool.",
    { text: z.string().describe("Text to echo back.") },
    async ({ text }) => ({
      content: [{ type: "text", text: `echo: ${text}` }],
    }),
  )
  return server
}

/** Build a Hono app exposing the spike MCP server at `POST /` (mount anywhere). */
export function createSpikeMcpApp(): Hono {
  const app = new Hono()
  app.all("/", async (c) => {
    const server = createSpikeServer()
    const transport = new StreamableHTTPTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    })
    await server.connect(transport)
    return transport.handleRequest(c)
  })
  return app
}

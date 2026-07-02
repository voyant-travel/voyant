import { describe, expect, it } from "vitest"

import { createSpikeMcpApp } from "../src/spike.js"

const MCP_HEADERS = {
  "content-type": "application/json",
  // The Streamable-HTTP transport requires the client to accept both.
  accept: "application/json, text/event-stream",
}

function rpc(method: string, params: unknown, id: number | string = 1) {
  return {
    method: "POST",
    headers: MCP_HEADERS,
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  }
}

/** The SDK returns Streamable-HTTP JSON bodies; parse either JSON or a single SSE `data:` frame. */
async function readRpc(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text()
  const contentType = res.headers.get("content-type") ?? ""
  if (contentType.includes("text/event-stream")) {
    const line = text.split("\n").find((l) => l.startsWith("data:"))
    return JSON.parse(line?.slice("data:".length).trim() ?? "{}")
  }
  return JSON.parse(text)
}

const INITIALIZE_PARAMS = {
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: { name: "spike-test", version: "0.0.0" },
}

describe("MCP spike — stateless @hono/mcp transport over Hono", () => {
  it("responds to initialize with server info and capabilities", async () => {
    const app = createSpikeMcpApp()
    const res = await app.request("/", rpc("initialize", INITIALIZE_PARAMS))
    expect(res.status).toBe(200)
    const body = await readRpc(res)
    expect(body.jsonrpc).toBe("2.0")
    const result = body.result as Record<string, unknown> | undefined
    expect(result?.serverInfo).toMatchObject({ name: "voyant-mcp-spike" })
    expect(result?.capabilities).toBeDefined()
  })

  it("lists the echo tool", async () => {
    const app = createSpikeMcpApp()
    const res = await app.request("/", rpc("tools/list", {}))
    expect(res.status).toBe(200)
    const body = await readRpc(res)
    const tools = (body.result as { tools?: Array<{ name: string }> } | undefined)?.tools ?? []
    expect(tools.map((t) => t.name)).toContain("echo")
  })

  it("calls the echo tool and returns text content", async () => {
    const app = createSpikeMcpApp()
    const res = await app.request(
      "/",
      rpc("tools/call", { name: "echo", arguments: { text: "hi" } }),
    )
    expect(res.status).toBe(200)
    const body = await readRpc(res)
    const content = (body.result as { content?: Array<{ type: string; text: string }> } | undefined)
      ?.content
    expect(content?.[0]).toMatchObject({ type: "text", text: "echo: hi" })
  })
})

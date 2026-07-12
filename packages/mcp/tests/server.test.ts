import { readFile } from "node:fs/promises"
import {
  createToolRegistry,
  defineTool,
  READ_ONLY_RISK,
  type ToolContext,
} from "@voyant-travel/tools"
import { Hono } from "hono"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import { createMcpHonoApp } from "../src/index.js"
import { mcpVoyantModule } from "../src/voyant.js"

const accessCatalog = {
  resources: [
    {
      id: "catalog",
      unitId: "@voyant-travel/catalog",
      resource: "catalog",
      label: "Catalog",
      description: "Catalog",
      wildcard: "allow" as const,
      actions: [{ action: "read", label: "Read", description: "Read" }],
    },
    {
      id: "notifications",
      unitId: "@voyant-travel/notifications",
      resource: "notifications",
      label: "Notifications",
      description: "Notifications",
      wildcard: "allow" as const,
      actions: [
        {
          action: "send",
          label: "Send",
          description: "Send",
          wildcard: "explicit" as const,
        },
      ],
    },
  ],
  presets: [],
}

const MCP_HEADERS = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
}

function rpc(method: string, params: unknown, id: number | string = 1) {
  return {
    method: "POST",
    headers: MCP_HEADERS,
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  }
}

async function readRpc(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text()
  if ((res.headers.get("content-type") ?? "").includes("text/event-stream")) {
    const line = text.split("\n").find((l) => l.startsWith("data:"))
    return JSON.parse(line?.slice("data:".length).trim() ?? "{}")
  }
  return JSON.parse(text)
}

const echoTool = defineTool({
  name: "echo",
  description: "Echo the text back.",
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ text: z.string() }),
  requiredScopes: ["catalog:read"],
  tier: "read",
  riskPolicy: READ_ONLY_RISK,
  async handler({ text }) {
    return { text: `echo: ${text}` }
  },
})

const sendNotificationTool = defineTool({
  name: "send_notification",
  description: "Send a templated notification.",
  inputSchema: z.object({ templateSlug: z.string(), to: z.string() }),
  outputSchema: z.object({ ok: z.boolean() }),
  requiredScopes: ["notifications:send"],
  tier: "destructive",
  riskPolicy: {
    destructive: true,
    reversible: false,
    dryRunSupported: false,
    confirmationRequired: true,
    sideEffects: ["email"],
  },
  async handler() {
    return { ok: true }
  },
})

function buildContext(): ToolContext {
  return {
    db: {},
    actor: "staff",
    audience: "staff",
    tenantId: "t1",
    resolverScope: { locale: "en-GB", audience: "staff", market: "default", actor: "staff" },
  }
}

/** Mount the MCP app behind a middleware that seeds the caller's granted scopes. */
function appWithScopes(scopes: string[]): Hono {
  const registry = createToolRegistry()
  registry.register(echoTool)
  registry.register(sendNotificationTool)
  const mcp = createMcpHonoApp({ accessCatalog, registry, buildContext })

  const outer = new Hono()
  outer.use("*", async (c, next) => {
    c.set("scopes", scopes)
    await next()
  })
  outer.route("/", mcp)
  return outer
}

describe("createMcpHonoApp", () => {
  it("owns its concrete HTTP operations and OpenAPI document", async () => {
    expect(mcpVoyantModule.api).toEqual([
      expect.objectContaining({
        id: "@voyant-travel/mcp#api.admin",
        surface: "admin",
        mount: "mcp",
        methods: ["GET", "POST"],
        openapi: { document: "mcp" },
      }),
    ])

    const document = JSON.parse(
      await readFile(new URL("../openapi/admin/mcp.json", import.meta.url), "utf8"),
    ) as { paths: Record<string, Record<string, Record<string, unknown>>> }
    const claims = Object.entries(document.paths)
      .flatMap(([path, pathItem]) =>
        Object.entries(pathItem).map(([method, operation]) => [
          method.toUpperCase(),
          path,
          operation["x-voyant-api-id"],
        ]),
      )
      .sort((left, right) => left.join(":").localeCompare(right.join(":")))

    expect(claims).toEqual([
      ["GET", "/v1/admin/mcp/manifest", "@voyant-travel/mcp#api.admin"],
      ["POST", "/v1/admin/mcp", "@voyant-travel/mcp#api.admin"],
    ])
  })

  it("lists and calls a tool when the caller holds its required scopes", async () => {
    const app = appWithScopes(["catalog:read"])

    const listed = await readRpc(await app.request("/", rpc("tools/list", {})))
    const tools = (listed.result as { tools?: Array<{ name: string }> } | undefined)?.tools ?? []
    expect(tools.map((t) => t.name)).toContain("echo")

    const called = await readRpc(
      await app.request("/", rpc("tools/call", { name: "echo", arguments: { text: "hi" } })),
    )
    const content = (called.result as { content?: Array<{ text: string }> } | undefined)?.content
    expect(content?.[0]?.text).toContain("echo: hi")
    const structured = (called.result as { structuredContent?: { text?: string } } | undefined)
      ?.structuredContent
    expect(structured?.text).toBe("echo: hi")
  })

  it("hides and refuses a tool when the caller lacks its scopes", async () => {
    const app = appWithScopes(["products:read"])

    const listed = await readRpc(await app.request("/", rpc("tools/list", {})))
    const tools = (listed.result as { tools?: Array<{ name: string }> } | undefined)?.tools ?? []
    expect(tools.map((t) => t.name)).not.toContain("echo")

    const called = await readRpc(
      await app.request("/", rpc("tools/call", { name: "echo", arguments: { text: "hi" } })),
    )
    // Unauthorized tool is unregistered → the call does not succeed with the echo payload.
    const content = (called.result as { content?: Array<{ text: string }> } | undefined)?.content
    const echoed = content?.some((part) => part.text?.includes("echo: hi")) ?? false
    expect(echoed).toBe(false)
    expect(called.error ?? (called.result as { isError?: boolean })?.isError).toBeTruthy()
  })

  it("serves the contract-versioned manifest filtered by authorization", async () => {
    const authorized = await appWithScopes(["catalog:read"]).request("/manifest")
    const body = (await authorized.json()) as {
      version: string
      tools: Array<{ name: string; requiredScopes: string[] }>
    }
    expect(body.version).toBeTruthy()
    expect(body.tools.map((t) => t.name)).toContain("echo")

    const denied = await appWithScopes([]).request("/manifest")
    const deniedBody = (await denied.json()) as { tools: Array<{ name: string }> }
    expect(deniedBody.tools.map((t) => t.name)).not.toContain("echo")
  })

  it("requires an exact notifications:send grant for destructive notification tools", async () => {
    for (const scopes of [["*"], ["notifications:*"], ["*:send"]]) {
      const listed = await readRpc(await appWithScopes(scopes).request("/", rpc("tools/list", {})))
      const tools = (listed.result as { tools?: Array<{ name: string }> } | undefined)?.tools ?? []
      expect(tools.map((t) => t.name)).not.toContain("send_notification")
    }

    const authorized = await readRpc(
      await appWithScopes(["notifications:send"]).request("/", rpc("tools/list", {})),
    )
    const tools =
      (authorized.result as { tools?: Array<{ name: string }> } | undefined)?.tools ?? []
    expect(tools.map((t) => t.name)).toContain("send_notification")
  })
})

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

import { createGraphMcpHonoApp, createMcpHonoApp } from "../src/index.js"
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
  capabilityId: "@voyant-travel/test#tool.echo",
  owner: "@voyant-travel/test",
  capabilityVersion: "v2",
  name: "echo",
  description: "Echo the text back.",
  aliases: ["echo_text"],
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ text: z.string() }),
  requiredScopes: ["catalog:read"],
  audience: { source: "grant", allowed: ["staff"] },
  tier: "read",
  riskPolicy: READ_ONLY_RISK,
  annotations: { idempotentHint: true },
  async handler({ text }) {
    return { text: `echo: ${text}` }
  },
})

const sendNotificationTool = defineTool({
  name: "send_notification",
  description: "Send a templated notification.",
  inputSchema: z.object({ templateSlug: z.string(), to: z.string() }),
  outputSchema: z.custom<{ ok: boolean }>(),
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

function buildContext(audience: ToolContext["audience"] = "staff"): ToolContext {
  return {
    db: {},
    actor: "staff",
    audience,
    tenantId: "t1",
    resolverScope: { locale: "en-GB", audience: "staff", market: "default", actor: "staff" },
  }
}

/** Mount the MCP app behind a middleware that seeds the caller's granted scopes. */
function appWithScopes(scopes: string[], audience: ToolContext["audience"] = "staff"): Hono {
  const registry = createToolRegistry()
  registry.register(echoTool)
  registry.register(sendNotificationTool)
  const mcp = createMcpHonoApp({
    accessCatalog,
    registry,
    buildContext: () => buildContext(audience),
  })

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
    const claims = operationClaims(document.paths)
    const app = createMcpHonoApp({ accessCatalog, registry: createToolRegistry(), buildContext })
    const liveDocument = app.getOpenAPI31Document({
      openapi: "3.1.0",
      info: { title: "test", version: "1.0.0" },
    })
    const livePaths = Object.fromEntries(
      Object.entries(liveDocument.paths ?? {}).map(([path, item]) => [
        `/v1/admin/mcp${path === "/" ? "" : path}`,
        item,
      ]),
    ) as Record<string, Record<string, Record<string, unknown>>>

    expect(operationClaims(livePaths)).toEqual(claims)
    expect(claims).toEqual([
      ["GET", "/v1/admin/mcp/manifest", "@voyant-travel/mcp#api.admin"],
      ["POST", "/v1/admin/mcp", "@voyant-travel/mcp#api.admin"],
    ])
  })

  function operationClaims(paths: Record<string, Record<string, Record<string, unknown>>>) {
    return Object.entries(paths)
      .flatMap(([path, pathItem]) =>
        Object.entries(pathItem).map(([method, operation]) => [
          method.toUpperCase(),
          path,
          operation["x-voyant-api-id"],
        ]),
      )
      .sort((left, right) => left.join(":").localeCompare(right.join(":")))
  }

  it("lists and calls a tool when the caller holds its required scopes", async () => {
    const app = appWithScopes(["catalog:read"])

    const listed = await readRpc(await app.request("/", rpc("tools/list", {})))
    const tools =
      (
        listed.result as
          | {
              tools?: Array<{
                name: string
                outputSchema?: Record<string, unknown>
                annotations?: Record<string, unknown>
                _meta?: Record<string, unknown>
              }>
            }
          | undefined
      )?.tools ?? []
    expect(tools.map((t) => t.name)).toContain("echo")
    expect(tools.map((t) => t.name)).toContain("echo_text")
    expect(tools.find((t) => t.name === "echo")).toMatchObject({
      outputSchema: {
        type: "object",
        properties: { text: { type: "string" } },
        required: ["text"],
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        "voyant.travel/tool": {
          capabilityId: "@voyant-travel/test#tool.echo",
          owner: "@voyant-travel/test",
          capabilityVersion: "v2",
          requiredScopes: ["catalog:read"],
          audience: { source: "grant", allowed: ["staff"] },
          tier: "read",
          riskPolicy: READ_ONLY_RISK,
        },
      },
    })
    expect(tools.find((t) => t.name === "echo_text")).toMatchObject({
      _meta: { "voyant.travel/tool": { aliasFor: "echo" } },
    })

    const called = await readRpc(
      await app.request("/", rpc("tools/call", { name: "echo", arguments: { text: "hi" } })),
    )
    const content = (called.result as { content?: Array<{ text: string }> } | undefined)?.content
    expect(content?.[0]?.text).toContain("echo: hi")
    const structured = (called.result as { structuredContent?: { text?: string } } | undefined)
      ?.structuredContent
    expect(structured?.text).toBe("echo: hi")

    const aliasCalled = await readRpc(
      await app.request("/", rpc("tools/call", { name: "echo_text", arguments: { text: "hi" } })),
    )
    expect(
      (aliasCalled.result as { structuredContent?: { text?: string } })?.structuredContent?.text,
    ).toBe("echo: hi")
  })

  it("binds stable graph identity and rejects graph/runtime metadata drift", async () => {
    const graphEchoTool = { ...echoTool, capabilityId: undefined, owner: undefined }
    const runtimeTool = {
      id: "@voyant-travel/catalog#tool.echo",
      unitId: "@voyant-travel/catalog",
      name: "echo",
      requiredScopes: ["catalog:read"],
      risk: "low" as const,
      referenceId: "catalog-echo-runtime",
      async load<T>() {
        return graphEchoTool as T
      },
    }
    const references = [
      {
        id: "catalog-echo-runtime",
        importEntry: "@voyant-travel/catalog/tools",
        async loadModule<T extends Record<string, unknown>>() {
          return {} as T
        },
      },
    ]
    const graphApp = await createGraphMcpHonoApp({
      runtime: { accessCatalog, tools: [runtimeTool], references },
      buildContext: () => buildContext(),
    })
    const outer = new Hono()
    outer.use("*", async (c, next) => {
      c.set("scopes", ["catalog:read"])
      await next()
    })
    outer.route("/", graphApp)
    const manifest = (await (await outer.request("/manifest")).json()) as {
      tools: Array<{ capabilityId: string; owner: string; deploymentRisk: string }>
    }
    expect(manifest.tools[0]).toMatchObject({
      capabilityId: "@voyant-travel/catalog#tool.echo",
      owner: "@voyant-travel/catalog",
      deploymentRisk: "low",
    })

    await expect(
      createGraphMcpHonoApp({
        runtime: {
          accessCatalog,
          tools: [{ ...runtimeTool, name: "drifted_echo" }],
          references,
        },
        buildContext: () => buildContext(),
      }),
    ).rejects.toThrow(/name "echo" does not match graph binding "drifted_echo"/)
  })

  it("hides a tool from grant audiences outside its declared audience policy", async () => {
    const app = appWithScopes(["catalog:read"], "customer")
    const listed = await readRpc(await app.request("/", rpc("tools/list", {})))
    const tools = (listed.result as { tools?: Array<{ name: string }> } | undefined)?.tools ?? []
    expect(tools.map((tool) => tool.name)).not.toContain("echo")

    const manifest = (await (await app.request("/manifest")).json()) as {
      tools: Array<{ name: string }>
    }
    expect(manifest.tools.map((tool) => tool.name)).not.toContain("echo")
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
      tools: Array<{
        name: string
        capabilityId: string
        outputSchema: Record<string, unknown>
        requiredScopes: string[]
      }>
    }
    expect(body.version).toBeTruthy()
    expect(body.tools.map((t) => t.name)).toContain("echo")
    expect(body.tools.find((t) => t.name === "echo")).toMatchObject({
      capabilityId: "@voyant-travel/test#tool.echo",
      outputSchema: { type: "object" },
    })

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
      (
        authorized.result as
          | {
              tools?: Array<{ name: string; outputSchema?: Record<string, unknown> }>
            }
          | undefined
      )?.tools ?? []
    expect(tools.map((t) => t.name)).toContain("send_notification")
    expect(tools.find((tool) => tool.name === "send_notification")?.outputSchema).toMatchObject({
      type: "object",
      additionalProperties: {},
    })
  })
})

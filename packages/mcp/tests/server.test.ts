import { readFile } from "node:fs/promises"
import { requireAuth } from "@voyant-travel/hono/middleware/auth"
import {
  createToolRegistry,
  defineTool,
  READ_ONLY_RISK,
  type ToolContext,
} from "@voyant-travel/tools"
import { Hono } from "hono"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import { createGraphMcpApiRoutes, createMcpApiRoutes } from "../src/index.js"
import { createMcpVoyantRuntime } from "../src/runtime.js"
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
    {
      id: "records",
      unitId: "@voyant-travel/test",
      resource: "records",
      label: "Records",
      description: "Test records",
      wildcard: "allow" as const,
      actions: [
        { action: "read", label: "Read", description: "Read records" },
        { action: "write", label: "Write", description: "Write records" },
      ],
    },
    {
      id: "secrets",
      unitId: "@voyant-travel/test",
      resource: "secrets",
      label: "Secrets",
      description: "Sensitive test records",
      wildcard: "explicit-resource" as const,
      actions: [
        {
          action: "read",
          label: "Read",
          description: "Read sensitive records",
          sensitive: true,
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

function testExecutionContext(): ExecutionContext {
  return {
    waitUntil() {},
    passThroughOnException() {},
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

const updateRecordTool = defineTool({
  name: "update_record",
  description: "Update a record through a composed input contract.",
  inputSchema: z
    .object({ id: z.string().min(1) })
    .and(z.object({ name: z.string().min(1) }))
    .optional()
    .transform((input) => input),
  outputSchema: z.object({ id: z.string(), name: z.string() }).nullable(),
  requiredScopes: ["records:write"],
  audience: { source: "grant", allowed: ["staff"] },
  tier: "write",
  riskPolicy: {
    destructive: false,
    reversible: true,
    dryRunSupported: false,
    sideEffects: ["data-write"],
  },
  async handler(input) {
    return !input || input.name === "missing" ? null : input
  },
})

const getSensitiveRecordTool = defineTool({
  name: "get_sensitive_record",
  description: "Read a sensitive record.",
  inputSchema: z.object({ id: z.string().min(1) }),
  outputSchema: z.object({ id: z.string(), classification: z.literal("sensitive") }),
  requiredScopes: ["secrets:read"],
  audience: { source: "grant", allowed: ["staff"] },
  tier: "sensitive",
  riskPolicy: READ_ONLY_RISK,
  async handler({ id }) {
    return { id, classification: "sensitive" as const }
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
  registry.register(updateRecordTool)
  registry.register(getSensitiveRecordTool)
  const mcp = createMcpApiRoutes({
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

async function selectedRuntimeRoutes() {
  const runtimeTool = {
    id: "@voyant-travel/test#tool.echo",
    unitId: "@voyant-travel/test",
    name: "echo",
    requiredScopes: ["catalog:read"],
    risk: "low" as const,
    referenceId: "test-tools",
    async load<T>() {
      return echoTool as T
    },
  }
  const module = await createMcpVoyantRuntime({
    graph: {
      accessCatalog,
      providerSelections: {},
      tools: [runtimeTool],
      references: [
        {
          id: "test-tools",
          importEntry: "@voyant-travel/test/tools",
          async loadModule<T extends Record<string, unknown>>() {
            return {} as T
          },
        },
      ],
    },
    runtimePorts: {},
  } as never)
  const routes = await module.lazyAdminRoutes?.()
  if (!routes) throw new Error("MCP selected runtime did not expose admin routes")
  return routes
}

describe("createMcpApiRoutes", () => {
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
    const app = createMcpApiRoutes({ accessCatalog, registry: createToolRegistry(), buildContext })
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
    const actions = [
      {
        id: "@voyant-travel/catalog#action.echo",
        version: "v1",
        kind: "read" as const,
        targetType: "echo",
        risk: "low" as const,
        ledger: "optional" as const,
        approval: "never" as const,
        from: { tools: ["@voyant-travel/catalog#tool.echo"] },
      },
    ]
    const graphApp = await createGraphMcpApiRoutes({
      runtime: {
        accessCatalog,
        tools: [runtimeTool],
        actions,
        references,
      },
      buildContext: () => buildContext(),
      providedContext: ["toolActionPolicy"],
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
      createGraphMcpApiRoutes({
        runtime: { accessCatalog, tools: [runtimeTool], actions, references },
        buildContext: () => buildContext(),
      }),
    ).rejects.toThrow(/toolActionPolicy/)

    await expect(
      createGraphMcpApiRoutes({
        runtime: {
          accessCatalog,
          tools: [{ ...runtimeTool, name: "drifted_echo" }],
          actions: [
            {
              id: "@voyant-travel/catalog#action.echo",
              version: "v1",
              kind: "read",
              targetType: "echo",
              risk: "low",
              ledger: "optional",
              from: { tools: ["@voyant-travel/catalog#tool.echo"] },
            },
          ],
          references,
        },
        buildContext: () => buildContext(),
      }),
    ).rejects.toThrow(/name "echo" does not match graph binding "drifted_echo"/)

    await expect(
      createGraphMcpApiRoutes({
        runtime: {
          accessCatalog,
          tools: [{ ...runtimeTool, risk: "high" }],
          actions: [],
          references,
        },
        buildContext: () => buildContext(),
      }),
    ).rejects.toThrow(/no selected graph action policy/)
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
      properties: { result: {} },
      required: ["result"],
    })

    const called = await readRpc(
      await appWithScopes(["notifications:send"]).request(
        "/",
        rpc("tools/call", {
          name: "send_notification",
          arguments: { templateSlug: "booking-confirmed", to: "customer@example.test" },
        }),
      ),
    )
    expect(called.result).toMatchObject({ structuredContent: { result: { ok: true } } })
  })

  it("preserves composed object inputs and applies the same nullable output envelope to schema and data", async () => {
    const app = appWithScopes(["records:write"])
    const listed = await readRpc(await app.request("/", rpc("tools/list", {})))
    const tool = (
      listed.result as {
        tools?: Array<{
          name: string
          inputSchema?: Record<string, unknown>
          outputSchema?: Record<string, unknown>
          _meta?: Record<string, unknown>
        }>
      }
    ).tools?.find(({ name }) => name === "update_record")

    expect(tool?._meta).toMatchObject({ "voyant.travel/tool": { tier: "write" } })
    const serializedInput = JSON.stringify(tool?.inputSchema)
    expect(serializedInput).toContain('"id"')
    expect(serializedInput).toContain('"name"')
    expect(serializedInput).toContain('"required"')
    expect(tool?.outputSchema).toMatchObject({
      type: "object",
      properties: { result: {} },
      required: ["result"],
    })

    const updated = await readRpc(
      await app.request(
        "/",
        rpc("tools/call", {
          name: "update_record",
          arguments: { id: "record_1", name: "Updated" },
        }),
      ),
    )
    expect(updated.result).toMatchObject({
      structuredContent: { result: { id: "record_1", name: "Updated" } },
    })

    const missing = await readRpc(
      await app.request(
        "/",
        rpc("tools/call", {
          name: "update_record",
          arguments: { id: "record_404", name: "missing" },
        }),
      ),
    )
    expect(missing.result).toMatchObject({ structuredContent: { result: null } })
  })

  it("discovers and invokes a sensitive Tool only with its explicit grant", async () => {
    const denied = await readRpc(
      await appWithScopes(["catalog:read"]).request("/", rpc("tools/list", {})),
    )
    expect(
      (denied.result as { tools?: Array<{ name: string }> } | undefined)?.tools?.map(
        ({ name }) => name,
      ),
    ).not.toContain("get_sensitive_record")

    const app = appWithScopes(["secrets:read"])
    const listed = await readRpc(await app.request("/", rpc("tools/list", {})))
    expect(
      (listed.result as { tools?: Array<{ name: string }> }).tools?.find(
        ({ name }) => name === "get_sensitive_record",
      ),
    ).toMatchObject({
      _meta: { "voyant.travel/tool": { tier: "sensitive" } },
    })

    const called = await readRpc(
      await app.request(
        "/",
        rpc("tools/call", {
          name: "get_sensitive_record",
          arguments: { id: "secret_1" },
        }),
      ),
    )
    expect(called.result).toMatchObject({
      structuredContent: { id: "secret_1", classification: "sensitive" },
    })
  })

  it("serves tools/list and tools/call through the selected graph runtime", async () => {
    const routes = await selectedRuntimeRoutes()
    const app = new Hono()
    app.use("*", async (c, next) => {
      c.set("scopes", ["catalog:read"])
      c.set("actor", "staff")
      c.set("audience", "staff")
      await next()
    })
    app.route("/", routes)

    const listed = await readRpc(await app.request("/", rpc("tools/list", {})))
    expect(
      (listed.result as { tools?: Array<{ name: string }> } | undefined)?.tools?.map(
        ({ name }) => name,
      ),
    ).toContain("echo")

    const called = await readRpc(
      await app.request("/", rpc("tools/call", { name: "echo", arguments: { text: "graph" } })),
    )
    expect(called.result).toMatchObject({ structuredContent: { text: "echo: graph" } })
  })

  it.each([
    ["missing actor and audience", {}],
    ["missing audience", { actor: "staff" }],
    ["missing actor", { audience: "staff" }],
    ["invalid actor", { actor: "unknown", audience: "staff" }],
    ["invalid audience", { actor: "staff", audience: "unknown" }],
  ])("fails closed for %s claims in the selected graph runtime", async (_case, claims) => {
    const routes = await selectedRuntimeRoutes()
    const app = new Hono()
    app.use("*", async (c, next) => {
      c.set("scopes", ["catalog:read"])
      for (const [claim, value] of Object.entries(claims)) c.set(claim as never, value as never)
      await next()
    })
    app.route("/", routes)

    expect((await app.request("/manifest")).status).toBe(500)
  })

  it("lets an internal API key reach selected MCP routes with actor-derived audience", async () => {
    const routes = await selectedRuntimeRoutes()
    const app = new Hono()
    app.use(
      "*",
      requireAuth(() => ({}) as never),
    )
    app.route("/", routes)

    const response = await app.fetch(
      new Request("http://example.test/manifest", {
        headers: { Authorization: "Bearer internal-test-key" },
      }),
      {
        DATABASE_URL: "postgres://test",
        INTERNAL_API_KEY: "internal-test-key",
        INTERNAL_API_KEY_SCOPES: "catalog:read",
      },
      testExecutionContext(),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      tools: [expect.objectContaining({ name: "echo" })],
    })
  })

  it("exposes selected action invocation metadata and gates before domain dispatch", async () => {
    const registry = createToolRegistry()
    let handlerCalls = 0
    registry.register(
      defineTool({
        name: "guarded_send",
        description: "Guarded write",
        inputSchema: z.object({ message: z.string() }),
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
          handlerCalls += 1
          return { ok: true }
        },
      }),
      {
        capabilityId: "@voyant-travel/notifications#tool.guarded-send",
        owner: "@voyant-travel/notifications",
        capabilityVersion: "v1",
        deploymentRisk: "critical",
        actionPolicy: {
          id: "@voyant-travel/notifications#action.guarded-send",
          capabilityId: "@voyant-travel/notifications#action.guarded-send",
          version: "v1",
          kind: "execute",
          targetType: "notification",
          risk: "critical",
          ledger: "required",
          approval: "required",
        },
      },
    )
    const gateCalls: unknown[] = []
    const mcp = createMcpApiRoutes({
      accessCatalog,
      registry,
      requireActionPolicies: true,
      buildContext: () => ({
        ...buildContext(),
        toolActionPolicy: {
          async execute(input, dispatch) {
            gateCalls.push(input)
            return dispatch()
          },
        },
      }),
    })
    const outer = new Hono()
    outer.use("*", async (c, next) => {
      c.set("scopes", ["notifications:send"])
      await next()
    })
    outer.route("/", mcp)

    const listed = await readRpc(await outer.request("/", rpc("tools/list", {})))
    const listedTool = (
      listed.result as {
        tools: Array<{
          name: string
          inputSchema: Record<string, unknown>
          _meta: Record<string, unknown>
        }>
      }
    ).tools.find(({ name }) => name === "guarded_send")
    expect(listedTool).toMatchObject({
      inputSchema: { properties: { _voyant: { type: "object" } } },
      _meta: {
        "voyant.travel/tool": {
          actionPolicy: {
            id: "@voyant-travel/notifications#action.guarded-send",
            enforcement: "generic",
            invocation: {
              controlField: "_voyant",
              requiredFields: [
                "confirmed",
                "targetId",
                "idempotencyKey",
                "approvalId",
                "idempotencyFingerprint",
              ],
            },
          },
        },
      },
    })

    const called = await readRpc(
      await outer.request(
        "/",
        rpc("tools/call", {
          name: "guarded_send",
          arguments: {
            message: "hello",
            _voyant: {
              confirmed: true,
              targetId: "notification_1",
              idempotencyKey: "send-1",
              approvalId: "approval_1",
              idempotencyFingerprint: "sha256:exact",
            },
          },
        }),
      ),
    )
    expect((called.result as { structuredContent: unknown }).structuredContent).toEqual({
      ok: true,
    })
    expect(handlerCalls).toBe(1)
    expect(gateCalls).toEqual([
      expect.objectContaining({
        commandInput: { message: "hello" },
        invocation: expect.objectContaining({ approvalId: "approval_1" }),
      }),
    ])
  })

  it("fails closed when a graph-bound generic Tool has no action-policy gate", async () => {
    const registry = createToolRegistry()
    let dispatched = false
    registry.register(
      defineTool({
        name: "guarded_read",
        description: "Guarded read",
        inputSchema: z.object({}),
        outputSchema: z.object({ ok: z.boolean() }),
        requiredScopes: ["catalog:read"],
        tier: "read",
        riskPolicy: READ_ONLY_RISK,
        async handler() {
          dispatched = true
          return { ok: true }
        },
      }),
      {
        capabilityId: "@voyant-travel/catalog#tool.guarded-read",
        owner: "@voyant-travel/catalog",
        capabilityVersion: "v1",
        actionPolicy: {
          id: "@voyant-travel/catalog#action.guarded-read",
          capabilityId: "@voyant-travel/catalog#action.guarded-read",
          version: "v1",
          kind: "read",
          targetType: "catalog",
          risk: "low",
          ledger: "optional",
          approval: "never",
        },
      },
    )
    const mcp = createMcpApiRoutes({
      accessCatalog,
      registry,
      requireActionPolicies: true,
      buildContext,
    })
    const outer = new Hono()
    outer.use("*", async (c, next) => {
      c.set("scopes", ["catalog:read"])
      await next()
    })
    outer.route("/", mcp)
    const called = await readRpc(
      await outer.request("/", rpc("tools/call", { name: "guarded_read", arguments: {} })),
    )
    expect((called.result as { isError?: boolean }).isError).toBe(true)
    expect(JSON.stringify(called)).toContain("ACTION_POLICY_REQUIRED")
    expect(dispatched).toBe(false)
  })
})

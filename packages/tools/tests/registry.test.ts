import { describe, expect, it } from "vitest"
import { z } from "zod"

import {
  createToolRegistry,
  defineTool,
  READ_ONLY_RISK,
  type ToolContext,
  ToolError,
} from "../src/index.js"

const ctx: ToolContext = {
  db: {},
  actor: "staff",
  audience: "staff",
  tenantId: "t1",
  resolverScope: { locale: "en-GB", audience: "staff", market: "default", actor: "staff" },
}

const echoTool = defineTool({
  name: "echo",
  description: "Echo the input text back.",
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ text: z.string() }),
  requiredScopes: ["catalog:read"],
  tier: "read",
  riskPolicy: READ_ONLY_RISK,
  async handler({ text }) {
    return { text: `echo: ${text}` }
  },
})

describe("createToolRegistry", () => {
  it("registers and dispatches a tool, validating input and output", async () => {
    const registry = createToolRegistry()
    registry.register(echoTool)

    const result = await registry.dispatch<{ text: string }>("echo", { text: "hi" }, ctx)
    expect(result).toEqual({ text: "echo: hi" })
    expect(registry.names()).toEqual(["echo"])
  })

  it("throws NOT_FOUND for an unregistered tool", async () => {
    const registry = createToolRegistry()
    await expect(registry.dispatch("missing", {}, ctx)).rejects.toMatchObject({
      code: "NOT_FOUND",
    })
  })

  it("throws INVALID_INPUT when args fail the input schema", async () => {
    const registry = createToolRegistry()
    registry.register(echoTool)
    await expect(registry.dispatch("echo", { text: 42 }, ctx)).rejects.toBeInstanceOf(ToolError)
    await expect(registry.dispatch("echo", { text: 42 }, ctx)).rejects.toMatchObject({
      code: "INVALID_INPUT",
    })
  })

  it("throws INVALID_OUTPUT when a handler returns data failing the output schema", async () => {
    const registry = createToolRegistry()
    registry.register(
      defineTool({
        name: "bad",
        description: "Returns the wrong shape.",
        inputSchema: z.object({}),
        outputSchema: z.object({ n: z.number() }),
        requiredScopes: ["catalog:read"],
        tier: "read",
        riskPolicy: READ_ONLY_RISK,
        // @ts-expect-error -- intentionally wrong return shape to exercise output validation
        async handler() {
          return { n: "not-a-number" }
        },
      }),
    )
    await expect(registry.dispatch("bad", {}, ctx)).rejects.toMatchObject({
      code: "INVALID_OUTPUT",
    })
  })

  it("throws on duplicate registration", () => {
    const registry = createToolRegistry()
    registry.register(echoTool)
    expect(() => registry.register(echoTool)).toThrow(/already registered/)
  })

  it("emits a discovery manifest with real JSON Schema, scopes, tier, and risk", () => {
    const registry = createToolRegistry()
    registry.register(echoTool)
    const [entry] = registry.list()
    expect(entry?.name).toBe("echo")
    expect(entry?.requiredScopes).toEqual(["catalog:read"])
    expect(entry?.tier).toBe("read")
    expect(entry?.riskPolicy).toEqual(READ_ONLY_RISK)
    // zod v4 native JSON Schema serialization.
    expect(entry?.inputSchema).toMatchObject({
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    })
  })

  it("surfaces a ToolError thrown by a handler unchanged", async () => {
    const registry = createToolRegistry()
    registry.register(
      defineTool({
        name: "denies",
        description: "Always denies.",
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        requiredScopes: ["catalog:read"],
        tier: "read",
        riskPolicy: READ_ONLY_RISK,
        async handler() {
          throw new ToolError("nope", "AUTHORIZATION_DENIED")
        },
      }),
    )
    await expect(registry.dispatch("denies", {}, ctx)).rejects.toMatchObject({
      code: "AUTHORIZATION_DENIED",
    })
  })
})

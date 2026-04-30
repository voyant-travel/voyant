import { describe, expect, it } from "vitest"
import { z } from "zod"

import type { McpToolContext, McpToolDefinition, McpToolResult } from "./contract.js"
import { McpToolError } from "./contract.js"
import { createMcpToolRegistry, enforceAudienceAuthorization, requireService } from "./registry.js"

const baseContext: McpToolContext = {
  actor: "staff",
  tenantId: "op_test",
  defaultScope: {
    locale: "en-GB",
    audience: "staff",
    market: "default",
    actor: "staff",
  },
  catalog: {},
}

const echoTool: McpToolDefinition<{ message: string }, McpToolResult> = {
  name: "echo",
  description: "Echo a message back.",
  inputSchema: z.object({ message: z.string() }),
  async handler(args) {
    return { content: [{ type: "text", text: args.message }] }
  },
}

describe("createMcpToolRegistry", () => {
  it("registers and dispatches a tool", async () => {
    const registry = createMcpToolRegistry({ context: baseContext })
    registry.register(echoTool)
    const result = await registry.dispatchTool("echo", { message: "hello" })
    expect(result.content[0]).toEqual({ type: "text", text: "hello" })
  })

  it("throws on duplicate registration", () => {
    const registry = createMcpToolRegistry({ context: baseContext })
    registry.register(echoTool)
    expect(() => registry.register(echoTool)).toThrow(/already registered/)
  })

  it("returns NOT_FOUND for unknown tool names", async () => {
    const registry = createMcpToolRegistry({ context: baseContext })
    const result = await registry.dispatchTool("phantom", {})
    expect(result.isError).toBe(true)
    expect(result.structuredContent?.error).toMatchObject({ code: "NOT_FOUND" })
  })

  it("returns INVALID_INPUT when args fail schema validation", async () => {
    const registry = createMcpToolRegistry({ context: baseContext })
    registry.register(echoTool)
    const result = await registry.dispatchTool("echo", { message: 123 })
    expect(result.isError).toBe(true)
    expect(result.structuredContent?.error).toMatchObject({ code: "INVALID_INPUT" })
  })

  it("translates McpToolError thrown by the handler to its code", async () => {
    const failingTool: McpToolDefinition<unknown, McpToolResult> = {
      name: "fail",
      description: "Always fails.",
      inputSchema: z.object({}),
      async handler() {
        throw new McpToolError("nope", "AUTHORIZATION_DENIED", { reason: "test" })
      },
    }
    const registry = createMcpToolRegistry({ context: baseContext })
    registry.register(failingTool)
    const result = await registry.dispatchTool("fail", {})
    expect(result.isError).toBe(true)
    expect(result.structuredContent?.error).toMatchObject({
      code: "AUTHORIZATION_DENIED",
      message: "nope",
      reason: "test",
    })
  })

  it("translates other thrown errors to PROVIDER_ERROR", async () => {
    const failingTool: McpToolDefinition<unknown, McpToolResult> = {
      name: "boom",
      description: "Throws plain Error.",
      inputSchema: z.object({}),
      async handler() {
        throw new Error("network down")
      },
    }
    const registry = createMcpToolRegistry({ context: baseContext })
    registry.register(failingTool)
    const result = await registry.dispatchTool("boom", {})
    expect(result.isError).toBe(true)
    expect(result.structuredContent?.error).toMatchObject({ code: "PROVIDER_ERROR" })
  })

  it("list() exposes registered tool metadata", () => {
    const registry = createMcpToolRegistry({ context: baseContext })
    registry.register(echoTool)
    const list = registry.list()
    expect(list).toHaveLength(1)
    expect(list[0]?.name).toBe("echo")
    expect(list[0]?.description).toBe("Echo a message back.")
  })

  it("get() returns the registered tool by name", () => {
    const registry = createMcpToolRegistry({ context: baseContext })
    registry.register(echoTool)
    expect(registry.get("echo")?.name).toBe("echo")
    expect(registry.get("phantom")).toBeUndefined()
  })
})

describe("requireService", () => {
  it("returns the service when present", () => {
    const indexer = { mock: true }
    expect(requireService(indexer, "indexer")).toBe(indexer)
  })

  it("throws MISSING_SERVICE when undefined", () => {
    expect(() => requireService(undefined, "indexer")).toThrow(McpToolError)
    try {
      requireService(undefined, "indexer")
    } catch (err) {
      expect((err as McpToolError).code).toBe("MISSING_SERVICE")
    }
  })
})

describe("enforceAudienceAuthorization", () => {
  it("staff actors may query any audience", () => {
    expect(() => enforceAudienceAuthorization("staff", ["customer", "partner"])).not.toThrow()
  })

  it("non-staff actors may query only their own audience", () => {
    expect(() => enforceAudienceAuthorization("customer", ["customer"])).not.toThrow()
  })

  it("non-staff actors trying to query another audience throws", () => {
    expect(() => enforceAudienceAuthorization("customer", ["partner"])).toThrow(/not authorized/)
  })

  it("non-staff actors trying to federate throws", () => {
    expect(() => enforceAudienceAuthorization("customer", ["customer", "partner"])).toThrow(
      /not authorized/,
    )
  })

  it("empty audience list short-circuits without checks", () => {
    expect(() => enforceAudienceAuthorization("customer", [])).not.toThrow()
    expect(() => enforceAudienceAuthorization("customer", undefined)).not.toThrow()
  })
})

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
  capabilityId: "@voyant-travel/test#tool.echo",
  owner: "@voyant-travel/test",
  capabilityVersion: "v2",
  name: "echo",
  description: "Echo the input text back.",
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

describe("createToolRegistry", () => {
  it("registers and dispatches a tool, validating input and output", async () => {
    const registry = createToolRegistry()
    registry.register(echoTool)

    const result = await registry.dispatch<{ text: string }>("echo", { text: "hi" }, ctx)
    expect(result).toEqual({ text: "echo: hi" })
    expect(registry.names()).toEqual(["echo"])
    await expect(registry.dispatch("echo_text", { text: "hi" }, ctx)).resolves.toEqual({
      text: "echo: hi",
    })
    expect(registry.getByCapabilityId("@voyant-travel/test#tool.echo", "v2")).toBe(echoTool)
    expect(registry.getByCapabilityId("@voyant-travel/test#tool.echo", "v3")).toBeUndefined()
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

  it("emits stable identity, compatibility, schemas, audience, annotations, and risk", () => {
    const registry = createToolRegistry()
    registry.register(echoTool)
    const [entry] = registry.list()
    expect(entry?.name).toBe("echo")
    expect(entry).toMatchObject({
      capabilityId: "@voyant-travel/test#tool.echo",
      owner: "@voyant-travel/test",
      capabilityVersion: "v2",
      aliases: ["echo_text"],
      audience: { source: "grant", allowed: ["staff"] },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    })
    expect(entry?.requiredScopes).toEqual(["catalog:read"])
    expect(entry?.tier).toBe("read")
    expect(entry?.riskPolicy).toEqual(READ_ONLY_RISK)
    // zod v4 native JSON Schema serialization.
    expect(entry?.inputSchema).toMatchObject({
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    })
    expect(entry?.outputSchema).toMatchObject({
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    })
  })

  it("uses a graph binding as canonical identity and rejects duplicated metadata drift", () => {
    const legacy = defineTool({
      name: "legacy",
      description: "Legacy definition with graph-owned identity.",
      inputSchema: z.object({}),
      outputSchema: z.custom<unknown>(),
      requiredScopes: ["catalog:read"],
      tier: "read",
      riskPolicy: READ_ONLY_RISK,
      async handler() {
        return {}
      },
    })
    const registry = createToolRegistry()
    registry.register(legacy, {
      capabilityId: "@voyant-travel/catalog#tool.legacy",
      owner: "@voyant-travel/catalog",
      capabilityVersion: "v1",
    })
    expect(registry.list()[0]).toMatchObject({
      capabilityId: "@voyant-travel/catalog#tool.legacy",
      owner: "@voyant-travel/catalog",
      capabilityVersion: "v1",
      deploymentRisk: "low",
      outputSchema: { "x-voyant-schema-quality": "runtime-only" },
    })

    const drifted = { ...echoTool, capabilityVersion: "v3" }
    expect(() => createToolRegistry().register(drifted, { capabilityVersion: "v2" })).toThrow(
      /does not match graph binding/,
    )
    expect(() =>
      createToolRegistry().register(legacy, { requiredScopes: ["catalog:write"] }),
    ).toThrow(/requiredScopes.*do not match graph binding/)
    expect(() => createToolRegistry().register(legacy, { deploymentRisk: "critical" })).toThrow(
      /tier "read" is incompatible with graph risk "critical"/,
    )
  })

  it("requires handler-owned durable command metadata for actions that create their target", () => {
    const createTool = defineTool({
      name: "create_record",
      description: "Create a record with a handler-owned durable command claim.",
      inputSchema: z.object({ name: z.string() }),
      outputSchema: z.object({ id: z.string() }),
      requiredScopes: ["records:write"],
      tier: "write",
      riskPolicy: {
        destructive: false,
        reversible: true,
        dryRunSupported: false,
        sideEffects: ["data-write"],
      },
      async handler() {
        return { id: "record-1" }
      },
    })
    const createdAction = {
      id: "action.create-record",
      capabilityId: "@voyant-travel/test#action.create-record",
      version: "v1",
      kind: "execute" as const,
      targetType: "record",
      targetLifecycle: "created" as const,
      risk: "medium" as const,
      ledger: "required" as const,
      approval: "never" as const,
    }

    expect(() =>
      createToolRegistry().register(
        { ...createTool, actionPolicyEnforcement: "handler" },
        { actionPolicy: createdAction },
      ),
    ).toThrow(/missing createdTarget command metadata/)

    expect(() =>
      createToolRegistry().register(createTool, {
        actionPolicy: {
          ...createdAction,
          createdTarget: {
            commandTargetType: "create-record-command",
            resultReferenceType: "record",
            durability: "handler-command-claim-v1",
          },
        },
      }),
    ).toThrow(/requires actionPolicyEnforcement "handler"/)

    expect(() =>
      createToolRegistry().register(
        { ...createTool, actionPolicyEnforcement: "handler" },
        {
          actionPolicy: {
            ...createdAction,
            targetLifecycle: "existing",
            createdTarget: {
              commandTargetType: "create-record-command",
              resultReferenceType: "record",
              durability: "handler-command-claim-v1",
            },
          },
        },
      ),
    ).toThrow(/declares createdTarget without targetLifecycle "created"/)
  })

  it("emits created-target policy metadata without requiring a caller targetId", () => {
    const registry = createToolRegistry()
    registry.register(
      defineTool({
        name: "create_record",
        description: "Create a record with a handler-owned durable command claim.",
        inputSchema: z.object({ name: z.string() }),
        outputSchema: z.object({ id: z.string() }),
        requiredScopes: ["records:write"],
        tier: "write",
        riskPolicy: {
          destructive: false,
          reversible: true,
          dryRunSupported: false,
          sideEffects: ["data-write"],
        },
        actionPolicyEnforcement: "handler",
        async handler() {
          return { id: "record-1" }
        },
      }),
      {
        actionPolicy: {
          id: "action.create-record",
          capabilityId: "@voyant-travel/test#action.create-record",
          version: "v1",
          kind: "execute",
          targetType: "record",
          targetLifecycle: "created",
          createdTarget: {
            commandTargetType: "create-record-command",
            resultReferenceType: "record",
            durability: "handler-command-claim-v1",
          },
          risk: "medium",
          ledger: "required",
          approval: "required",
        },
      },
    )

    expect(registry.list()[0]?.actionPolicy).toMatchObject({
      targetLifecycle: "created",
      createdTarget: {
        commandTargetType: "create-record-command",
        resultReferenceType: "record",
        durability: "handler-command-claim-v1",
      },
      enforcement: "handler",
      invocation: {
        requiredFields: [],
      },
    })
    expect(registry.list()[0]?.actionPolicy?.invocation.requiredFields).not.toContain("targetId")
  })

  it("preserves generic targetId requirements when target lifecycle is omitted", () => {
    const registry = createToolRegistry()
    registry.register(echoTool, {
      actionPolicy: {
        id: "action.read-record",
        capabilityId: "@voyant-travel/test#action.read-record",
        version: "v1",
        kind: "read",
        targetType: "record",
        risk: "low",
        ledger: "required",
        approval: "never",
      },
    })

    expect(registry.list()[0]?.actionPolicy).toMatchObject({
      enforcement: "generic",
      invocation: {
        requiredFields: ["targetId"],
      },
    })
  })

  it("rejects canonical and alias collisions", () => {
    const registry = createToolRegistry()
    registry.register(echoTool)
    expect(() =>
      registry.register({ ...echoTool, capabilityId: "second", name: "echo_text", aliases: [] }),
    ).toThrow(/invocation name/)
    expect(() =>
      createToolRegistry().register({ ...echoTool, aliases: ["invalid alias"] }),
    ).toThrow(/must use 1-128/)
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

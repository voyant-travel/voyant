import { createToolRegistry, defineTool, type ToolContext } from "@voyant-travel/tools"
import { Hono } from "hono"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import { createMcpApiRoutes } from "../src/index.js"

const accessCatalog = {
  resources: [
    {
      id: "notifications",
      unitId: "@voyant-travel/notifications",
      resource: "notifications",
      label: "Notifications",
      description: "Notifications",
      wildcard: "allow" as const,
      actions: [{ action: "send", label: "Send", description: "Send" }],
    },
  ],
  presets: [],
}

describe("handler-owned MCP action policy", () => {
  it("does not double-gate a Tool that declares package-owned enforcement", async () => {
    const registry = createToolRegistry()
    let handlerCalls = 0
    registry.register(
      defineTool({
        name: "handler_guarded_write",
        description: "Handler-guarded write",
        inputSchema: z.object({ approvalId: z.string() }),
        outputSchema: z.object({ ok: z.boolean() }),
        requiredScopes: ["notifications:send"],
        tier: "destructive",
        riskPolicy: {
          destructive: true,
          reversible: false,
          dryRunSupported: false,
          confirmationRequired: true,
        },
        actionPolicyEnforcement: "handler",
        async handler() {
          handlerCalls += 1
          return { ok: true }
        },
      }),
      {
        capabilityId: "@voyant-travel/notifications#tool.handler-guarded-write",
        owner: "@voyant-travel/notifications",
        capabilityVersion: "v1",
        deploymentRisk: "critical",
        actionPolicy: {
          id: "@voyant-travel/notifications#action.handler-guarded-write",
          capabilityId: "@voyant-travel/notifications#action.handler-guarded-write",
          version: "v1",
          kind: "execute",
          targetType: "notification",
          risk: "critical",
          ledger: "required",
          approval: "required",
        },
      },
    )
    const mcp = createMcpApiRoutes({
      accessCatalog,
      registry,
      requireActionPolicies: true,
      buildContext: () => buildContext(),
    })
    const outer = new Hono()
    outer.use("*", async (c, next) => {
      c.set("scopes", ["notifications:send"])
      await next()
    })
    outer.route("/", mcp)

    const unconfirmed = await readRpc(
      await outer.request(
        "/",
        rpc("tools/call", {
          name: "handler_guarded_write",
          arguments: { approvalId: "approval_1" },
        }),
      ),
    )
    expect((unconfirmed.result as { isError?: boolean }).isError).toBe(true)
    expect(JSON.stringify(unconfirmed)).toContain("CONFIRMATION_REQUIRED")
    expect(handlerCalls).toBe(0)

    const called = await readRpc(
      await outer.request(
        "/",
        rpc("tools/call", {
          name: "handler_guarded_write",
          arguments: { approvalId: "approval_1", _voyant: { confirmed: true } },
        }),
      ),
    )
    expect((called.result as { structuredContent: unknown }).structuredContent).toEqual({
      ok: true,
    })
    expect(handlerCalls).toBe(1)
    const manifest = (await (await outer.request("/manifest")).json()) as {
      tools: Array<{ actionPolicy?: { enforcement: string } }>
    }
    expect(manifest.tools[0]?.actionPolicy).toMatchObject({
      enforcement: "handler",
      invocation: { requiredFields: ["confirmed"] },
    })
  })
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

function rpc(method: string, params: unknown) {
  return {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  }
}

async function readRpc(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text()
  if ((res.headers.get("content-type") ?? "").includes("text/event-stream")) {
    const line = text.split("\n").find((value) => value.startsWith("data:"))
    return JSON.parse(line?.slice("data:".length).trim() ?? "{}")
  }
  return JSON.parse(text)
}

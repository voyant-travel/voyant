import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"
import type { HonoModule } from "@voyant-travel/hono/module"
import type { ToolContext, Visibility } from "@voyant-travel/tools"
import type { Context } from "hono"
import { createGraphMcpHonoApp } from "./server.js"

/** Compose the package-selected MCP route from the selected graph runtime. */
export const createMcpVoyantRuntime = defineGraphRuntimeFactory(
  async ({ graph, runtimePorts }): Promise<HonoModule> => ({
    module: { name: "mcp" },
    lazyAdminRoutes: () =>
      createGraphMcpHonoApp({
        runtime: graph,
        buildContext: buildMcpBaseContext,
        buildResources: () => runtimePorts,
      }),
  }),
)

function buildMcpBaseContext(c: Context): ToolContext {
  const request = c.var as {
    actor?: unknown
    audience?: unknown
    db?: unknown
  }
  const env = c.env as Record<string, unknown>
  const actor = visibility(request.actor, "staff")
  const audience = visibility(request.audience, actor)
  return {
    db: request.db,
    actor,
    audience,
    tenantId: stringValue(env.TENANT_ID) ?? "default",
    resolverScope: {
      locale: stringValue(env.DEFAULT_LOCALE) ?? "en-GB",
      audience,
      market: stringValue(env.DEFAULT_MARKET) ?? "default",
      actor,
    },
  }
}

function visibility(value: unknown, fallback: Visibility): Visibility {
  return value === "staff" || value === "customer" || value === "partner" || value === "supplier"
    ? value
    : fallback
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined
}

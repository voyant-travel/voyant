import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"
import type { HonoModule } from "@voyant-travel/hono/module"
import {
  TOOL_GRAPH_ACTIONS_RESOURCE,
  TOOL_GRAPH_SETUP_STEPS_RESOURCE,
  TOOL_PROVIDER_SELECTIONS_RESOURCE,
  TOOL_UNIT_PROJECT_CONFIG_RESOURCE,
  type ToolContext,
  ToolError,
  type Visibility,
} from "@voyant-travel/tools"
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
        buildResources: () => ({
          ...runtimePorts,
          [TOOL_GRAPH_ACTIONS_RESOURCE]: graph.actions ?? [],
          [TOOL_PROVIDER_SELECTIONS_RESOURCE]: graph.providerSelections,
          [TOOL_GRAPH_SETUP_STEPS_RESOURCE]: graph.setupSteps,
        }),
        buildUnitResources: (unitId) => ({
          [TOOL_UNIT_PROJECT_CONFIG_RESOURCE]: selectedUnitProjectConfig(graph, unitId),
        }),
      }),
  }),
)

function selectedUnitProjectConfig(
  graph: {
    modules: readonly { id: string; projectConfig: Readonly<Record<string, unknown>> }[]
    extensions: readonly { id: string; projectConfig: Readonly<Record<string, unknown>> }[]
    plugins: readonly { id: string; projectConfig: Readonly<Record<string, unknown>> }[]
  },
  unitId: string,
): Readonly<Record<string, unknown>> {
  return [...graph.modules, ...graph.extensions, ...graph.plugins].find(({ id }) => id === unitId)
    ?.projectConfig ?? {}
}

function buildMcpBaseContext(c: Context): ToolContext {
  const request = c.var as {
    actor?: unknown
    audience?: unknown
    db?: unknown
  }
  const env = (c.env ?? {}) as Record<string, unknown>
  const actor = requireVisibility(request.actor, "actor")
  const audience = requireVisibility(request.audience, "audience")
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

function requireVisibility(value: unknown, claim: "actor" | "audience"): Visibility {
  if (value === "staff" || value === "customer" || value === "partner" || value === "supplier") {
    return value
  }
  throw new ToolError(
    `MCP requests require an authenticated ${claim} grant claim.`,
    "AUTHORIZATION_DENIED",
    { claim },
  )
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined
}

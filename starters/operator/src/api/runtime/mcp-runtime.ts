/** Generic Node host for the graph-selected in-deployment MCP surface. */
import type { VoyantGraphRuntime } from "@voyant-travel/framework/deployment-artifacts"
import { createGraphMcpHonoApp } from "@voyant-travel/mcp"
import type { Hono } from "hono"
import { createGeneratedGraphRuntime } from "../../../.voyant/runtime/graph-runtime.generated"
import {
  buildOperatorMcpBaseContext,
  buildOperatorMcpResources,
} from "./mcp-deployment-resources"

export function buildMcpAdminRoutes(
  graphRuntime: VoyantGraphRuntime = createGeneratedGraphRuntime(),
): Promise<Hono> {
  return createGraphMcpHonoApp({
    runtime: graphRuntime,
    buildContext: buildOperatorMcpBaseContext,
    buildResources: buildOperatorMcpResources,
  })
}

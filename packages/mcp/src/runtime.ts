import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"
import type { HonoModule } from "@voyant-travel/hono/module"
import { mcpRuntimePort } from "./runtime-port.js"
import { createGraphMcpHonoApp } from "./server.js"

/** Compose the package-selected MCP route from the selected graph runtime. */
export const createMcpVoyantRuntime = defineGraphRuntimeFactory(
  async ({ getPort }): Promise<HonoModule> => {
    const runtime = await getPort(mcpRuntimePort)
    return {
      module: { name: "mcp" },
      lazyAdminRoutes: () => createGraphMcpHonoApp(runtime),
    }
  },
)

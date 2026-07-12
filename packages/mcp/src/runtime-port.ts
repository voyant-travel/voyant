import { definePort } from "@voyant-travel/core/project"
import type { GraphMcpHonoAppOptions } from "./server.js"

export type McpRuntimeProvider = GraphMcpHonoAppOptions

/** Deployment-owned request context and resources for the selected MCP surface. */
export const mcpRuntimePort = definePort<McpRuntimeProvider>({
  id: "mcp.runtime",
  test(provider) {
    if (!provider.runtime || typeof provider.buildContext !== "function") {
      throw new Error("mcp.runtime must provide the selected graph runtime and context builder.")
    }
  },
})

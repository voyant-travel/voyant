import { defineModule, requirePort } from "@voyant-travel/core/project"
import { mcpRuntimePort } from "./runtime-port.js"

/** Package-owned declaration for the in-deployment MCP transport. */
export const mcpVoyantModule = defineModule({
  id: "@voyant-travel/mcp",
  packageName: "@voyant-travel/mcp",
  localId: "mcp",
  runtimePorts: [requirePort(mcpRuntimePort)],
  api: [
    {
      id: "@voyant-travel/mcp#api.admin",
      surface: "admin",
      mount: "mcp",
      methods: ["GET", "POST"],
      runtime: {
        entry: "@voyant-travel/mcp/runtime",
        export: "createMcpVoyantRuntime",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export default mcpVoyantModule

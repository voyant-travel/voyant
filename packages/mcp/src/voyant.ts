import { defineModule } from "@voyant-travel/core/project"

/** Package-owned declaration for the in-deployment MCP transport. */
export const mcpVoyantModule = defineModule({
  id: "@voyant-travel/mcp",
  packageName: "@voyant-travel/mcp",
  localId: "mcp",
  api: [
    {
      id: "@voyant-travel/mcp#api.admin",
      surface: "admin",
      mount: "mcp",
      methods: ["GET", "POST"],
      openapi: { document: "mcp" },
      runtime: {
        entry: "@voyant-travel/mcp/runtime",
        export: "createMcpVoyantRuntime",
      },
    },
  ],
  access: {
    resources: [
      {
        id: "@voyant-travel/mcp#access.mcp",
        resource: "mcp",
        label: "MCP",
        description: "Connect to and invoke the selected deployment's MCP tool surface.",
        actions: [
          {
            action: "read",
            label: "Connect to MCP",
            description: "Open and inspect an MCP transport session.",
          },
          {
            action: "write",
            label: "Invoke MCP tools",
            description: "Send MCP requests and invoke tools admitted by the selected graph.",
          },
        ],
      },
    ],
  },
  meta: {
    ownership: "package",
  },
})

export default mcpVoyantModule

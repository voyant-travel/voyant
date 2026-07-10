import { defineModule } from "@voyant-travel/framework/project"

export const mcpVoyantModule = defineModule({
  id: "@voyant-travel/operator#mcp",
  packageName: "@voyant-travel/operator",
  localId: "operator.mcp",
  api: [
    {
      id: "@voyant-travel/operator#mcp.api.admin",
      surface: "admin",
      mount: "operator/mcp",
    },
  ],
  meta: { source: "operator-local" },
})

export default mcpVoyantModule

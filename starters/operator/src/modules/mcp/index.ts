import { defineDeploymentModule } from "@voyant-travel/framework"

export const mcpModule = defineDeploymentModule({
  module: { name: "mcp" },
  lazyAdminRoutes: () =>
    import("../../api/runtime/mcp-runtime").then((module) => module.buildMcpAdminRoutes()),
})

export default mcpModule

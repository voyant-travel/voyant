import { defineDeploymentModule } from "@voyant-travel/framework"

export const teamModule = defineDeploymentModule({
  module: { name: "team" },
  lazyAdminRoutes: () =>
    import("../../api/routes/team").then((module) => module.createTeamAdminRoutes()),
})

export default teamModule

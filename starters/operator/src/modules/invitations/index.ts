import { defineDeploymentModule } from "@voyant-travel/framework"

export const invitationsModule = defineDeploymentModule({
  module: { name: "invitations" },
  lazyAdminRoutes: () =>
    import("../../api/routes/invitations").then((module) => module.createInvitationsAdminRoutes()),
  lazyPublicRoutes: () =>
    import("../../api/routes/invitations").then((module) => module.createInvitationsPublicRoutes()),
  anonymous: true,
})

export default invitationsModule

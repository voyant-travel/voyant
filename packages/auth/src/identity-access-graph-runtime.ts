import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"

import { identityAccessRuntimePort } from "./identity-access-runtime-port.js"
import {
  createInvitationsAdminRoutes,
  createInvitationsPublicRoutes,
} from "./invitations-routes.js"
import { createTeamAdminRoutes } from "./team-routes.js"

export const createInvitationsVoyantRuntime = defineGraphRuntimeFactory(async ({ getPort }) => {
  const runtime = await getPort(identityAccessRuntimePort)
  return {
    module: { name: "invitations" },
    adminRoutes: createInvitationsAdminRoutes(runtime),
    publicRoutes: createInvitationsPublicRoutes(),
  }
})

export const createTeamVoyantRuntime = defineGraphRuntimeFactory(async ({ getPort }) => ({
  module: { name: "team" },
  adminRoutes: createTeamAdminRoutes(await getPort(identityAccessRuntimePort)),
}))

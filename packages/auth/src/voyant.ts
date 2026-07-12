import { defineModule, requirePort } from "@voyant-travel/core/project"

import { identityAccessRuntimePort } from "./identity-access-runtime-port.js"

export const authInvitationsVoyantModule = defineModule({
  id: "@voyant-travel/auth#invitations",
  packageName: "@voyant-travel/auth",
  localId: "auth.invitations",
  runtimePorts: [requirePort(identityAccessRuntimePort)],
  api: [
    {
      id: "@voyant-travel/auth#invitations.api.admin",
      surface: "admin",
      mount: "invitations",
      transactional: true,
      runtime: {
        entry: "@voyant-travel/auth/identity-access-graph-runtime",
        export: "createInvitationsVoyantRuntime",
      },
    },
    {
      id: "@voyant-travel/auth#invitations.api.public",
      surface: "public",
      mount: "invitations",
      anonymous: true,
      transactional: true,
      runtime: {
        entry: "@voyant-travel/auth/identity-access-graph-runtime",
        export: "createInvitationsVoyantRuntime",
      },
    },
  ],
  meta: { ownership: "package" },
})

export const authTeamVoyantModule = defineModule({
  id: "@voyant-travel/auth#team",
  packageName: "@voyant-travel/auth",
  localId: "auth.team",
  runtimePorts: [requirePort(identityAccessRuntimePort)],
  api: [
    {
      id: "@voyant-travel/auth#team.api.admin",
      surface: "admin",
      mount: "team",
      runtime: {
        entry: "@voyant-travel/auth/identity-access-graph-runtime",
        export: "createTeamVoyantRuntime",
      },
    },
  ],
  access: {
    resources: [
      {
        id: "@voyant-travel/auth#access.team",
        resource: "team",
        actions: ["read", "write", "delete"],
      },
    ],
  },
  meta: { ownership: "package" },
})

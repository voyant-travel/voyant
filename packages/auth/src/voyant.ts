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
      resource: "team",
      openapi: { document: "invitations" },
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
      openapi: { document: "invitations" },
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
      openapi: { document: "team" },
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
        label: "Team",
        description: "Manage staff team members and their access.",
        actions: [
          {
            action: "read",
            label: "View team",
            description: "View staff team members.",
          },
          {
            action: "write",
            label: "Manage team",
            description: "Create and update staff team members.",
          },
          {
            action: "delete",
            label: "Delete team members",
            description: "Delete staff team members.",
            sensitive: true,
          },
        ],
      },
    ],
  },
  meta: { ownership: "package" },
})

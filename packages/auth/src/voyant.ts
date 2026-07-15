import { defineModule, providePort, requirePort } from "@voyant-travel/core/project"

import { identityAccessRuntimePort } from "./identity-access-runtime-port.js"
import { teamManagementRuntimePort } from "./team-management-runtime-port.js"

export const authInvitationsVoyantModule = defineModule({
  id: "@voyant-travel/auth#invitations",
  packageName: "@voyant-travel/auth",
  localId: "auth.invitations",
  provides: { ports: [providePort(identityAccessRuntimePort)] },
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
  presentations: [
    {
      id: "@voyant-travel/auth#presentation.local-auth",
      runtime: {
        entry: "@voyant-travel/auth-react/local-auth-routes",
        export: "createLocalAuthRouteContribution",
      },
    },
  ],
  meta: { ownership: "package" },
})

export const authTeamVoyantModule = defineModule({
  id: "@voyant-travel/auth#team",
  packageName: "@voyant-travel/auth",
  localId: "auth.team",
  provides: { ports: [providePort(teamManagementRuntimePort)] },
  runtimePorts: [requirePort(teamManagementRuntimePort)],
  api: [
    {
      id: "@voyant-travel/auth#team.api.admin",
      surface: "admin",
      mount: "team",
      resource: "team",
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
  admin: {
    compositionOrder: 5,
    setupSteps: [{ id: "@voyant-travel/auth#setup.team", skippable: true }],
    runtime: {
      entry: "@voyant-travel/auth-react/admin",
      export: "createSelectedAuthTeamAdminExtension",
    },
    copy: [
      {
        id: "@voyant-travel/auth#team.admin.copy",
        namespace: "auth.admin.team",
        fallbackLocale: "en",
        runtime: {
          entry: "@voyant-travel/auth-react/i18n",
          export: "authUiMessageDefinitions",
        },
      },
    ],
    routes: [
      {
        id: "@voyant-travel/auth#team.admin.route",
        path: "/settings/team",
        requiredScopes: ["team:read"],
        runtime: {
          entry: "@voyant-travel/auth-react/admin",
          export: "createSelectedAuthTeamAdminExtension",
        },
      },
    ],
  },
  meta: { ownership: "package" },
})

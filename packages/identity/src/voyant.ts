import { defineModule } from "@voyant-travel/core/project"

/** Import-cheap deployment declaration owned by the identity package. */
export const identityVoyantModule = defineModule({
  id: "@voyant-travel/identity",
  packageName: "@voyant-travel/identity",
  localId: "identity",
  api: [
    {
      id: "@voyant-travel/identity#api.admin",
      surface: "admin",
      mount: "identity",
      resource: "identity",
      openapi: { document: "identity" },
      runtime: {
        entry: "@voyant-travel/identity",
        export: "identityHonoModule",
      },
    },
  ],
  schema: [
    {
      id: "@voyant-travel/identity#schema",
      source: "@voyant-travel/identity/schema",
    },
  ],
  migrations: [
    {
      id: "@voyant-travel/identity#migrations",
      source: "./migrations",
    },
  ],
  access: {
    resources: [
      {
        id: "@voyant-travel/identity#access.identity",
        resource: "identity",
        label: "Identity",
        description: "Manage reusable contact points, addresses, and named contacts.",
        actions: [
          {
            action: "read",
            label: "View identity records",
            description: "View contact points, addresses, and named contacts.",
          },
          {
            action: "write",
            label: "Manage identity records",
            description: "Create and update contact points, addresses, and named contacts.",
          },
          {
            action: "delete",
            label: "Delete identity records",
            description: "Delete contact points, addresses, and named contacts.",
            sensitive: true,
          },
        ],
      },
    ],
  },
  lifecycle: {
    uninstall: { default: "retain-data", purge: "not-supported" },
  },
  meta: {
    ownership: "package",
    agentTools: {
      posture: "planned",
      rationale:
        "Identity contact, address, and named-contact capabilities need module-owned Tools.",
      issue: "#3370",
    },
  },
})

export default identityVoyantModule

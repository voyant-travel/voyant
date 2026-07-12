import { defineModule } from "@voyant-travel/core/project"

/** Import-cheap deployment declaration owned by the availability package. */
export const availabilityVoyantModule = defineModule({
  id: "@voyant-travel/availability",
  packageName: "@voyant-travel/availability",
  localId: "availability",
  schema: [
    {
      id: "@voyant-travel/availability#schema",
      source: "@voyant-travel/availability/schema",
    },
  ],
  migrations: [
    {
      id: "@voyant-travel/availability#migrations",
      source: "./migrations",
    },
  ],
  access: {
    resources: [
      {
        id: "@voyant-travel/availability#access.availability",
        resource: "availability",
        actions: ["read", "write"],
      },
    ],
  },
  lifecycle: {
    uninstall: { default: "retain-data", purge: "not-supported" },
  },
  meta: {
    ownership: "package",
  },
})

export default availabilityVoyantModule

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
  lifecycle: {
    uninstall: { default: "retain-data", purge: "not-supported" },
  },
  meta: {
    ownership: "package",
    agentTools: {
      posture: "planned",
      rationale:
        "Availability and departure queries and guarded mutations need module-owned Tools.",
      issue: "#3370",
    },
  },
})

export default availabilityVoyantModule

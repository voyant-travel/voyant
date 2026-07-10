import { defineModule } from "@voyant-travel/core/project"

/** Import-cheap deployment declaration owned by the workflow-runs package. */
export const workflowRunsVoyantModule = defineModule({
  id: "@voyant-travel/workflow-runs",
  packageName: "@voyant-travel/workflow-runs",
  localId: "workflow-runs",
  schema: [
    {
      id: "@voyant-travel/workflow-runs#schema",
      source: "@voyant-travel/workflow-runs/schema",
    },
  ],
  migrations: [
    {
      id: "@voyant-travel/workflow-runs#migrations",
      source: "./migrations",
    },
  ],
  meta: {
    ownership: "package",
  },
})

export default workflowRunsVoyantModule

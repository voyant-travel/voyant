import { defineModule } from "@voyant-travel/core/project"

/** Import-cheap deployment declaration owned by the workflow-runs package. */
export const workflowRunsVoyantModule = defineModule({
  id: "@voyant-travel/workflow-runs",
  packageName: "@voyant-travel/workflow-runs",
  localId: "workflow-runs",
  api: [
    {
      id: "@voyant-travel/workflow-runs#api.admin",
      surface: "admin",
      mount: "workflow-runs",
      runtime: {
        entry: "@voyant-travel/workflow-runs/hono-module",
        export: "createWorkflowRunsHonoModule",
      },
    },
  ],
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
  config: [
    {
      id: "@voyant-travel/workflow-runs#config.admin-surface",
      key: "VOYANT_WORKFLOW_ADMIN_SURFACE",
      default: "tenant",
    },
  ],
  resources: [
    {
      id: "@voyant-travel/workflow-runs#resource.database",
      kind: "database",
      required: true,
      config: { engine: "postgres" },
    },
  ],
  access: {
    resources: [
      {
        id: "@voyant-travel/workflow-runs#access.workflows",
        resource: "workflows",
        actions: ["trigger"],
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

export default workflowRunsVoyantModule

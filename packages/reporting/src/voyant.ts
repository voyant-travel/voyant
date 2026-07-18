import { defineModule, requirePort } from "@voyant-travel/core/project"
import { reportingContributionRuntimePort } from "@voyant-travel/reporting-contracts/runtime-port"

export const reportingVoyantModule = defineModule({
  id: "@voyant-travel/reporting",
  packageName: "@voyant-travel/reporting",
  localId: "reporting",
  runtimePorts: [
    requirePort(reportingContributionRuntimePort, { optional: true, cardinality: "many" }),
  ],
  api: [
    {
      id: "@voyant-travel/reporting#api.admin",
      surface: "admin",
      mount: "reporting",
      resource: "reports",
      authorization: "route",
      openapi: { document: "reporting" },
      runtime: {
        entry: "@voyant-travel/reporting/api-runtime",
        export: "createReportingApiModule",
      },
    },
  ],
  schema: [{ id: "@voyant-travel/reporting#schema", source: "@voyant-travel/reporting/schema" }],
  migrations: [{ id: "@voyant-travel/reporting#migrations", source: "./migrations" }],
  resources: [
    {
      id: "@voyant-travel/reporting#resource.database",
      kind: "database",
      required: true,
      config: { engine: "postgres" },
    },
  ],
  access: {
    resources: [
      {
        id: "@voyant-travel/reporting#access.reports",
        resource: "reports",
        label: "Reports",
        description: "Build, view, publish, and export reports.",
        actions: [
          {
            action: "read",
            label: "View reports",
            description: "View reports and preview queries.",
          },
          {
            action: "write",
            label: "Manage reports",
            description: "Create, edit, remove, and publish reports.",
          },
          {
            action: "export",
            label: "Run and export reports",
            description: "Execute immutable report versions and access their output.",
            sensitive: true,
          },
        ],
      },
    ],
  },
  lifecycle: { uninstall: { default: "retain-data", purge: "not-supported" } },
  meta: { ownership: "package" },
})

export default reportingVoyantModule

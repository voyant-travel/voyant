import { defineModule, requirePort } from "@voyant-travel/core/project"
import { reportingContributionRuntimePort } from "@voyant-travel/reporting-contracts/runtime-port"

export const reportingVoyantModule = defineModule({
  id: "@voyant-travel/reporting",
  packageName: "@voyant-travel/reporting",
  localId: "reporting",
  runtimePorts: [
    requirePort(reportingContributionRuntimePort, { optional: true, cardinality: "many" }),
  ],
  reporting: {
    templates: [
      {
        id: "reporting.template.operator-overview",
        version: 1,
        label: "Operator overview",
        description:
          "A cross-module overview of booking activity and final-invoice receivables.",
        requirements: [
          { kind: "widget", id: "bookings.widget.total" },
          { kind: "widget", id: "bookings.widget.monthly-trend" },
          { kind: "widget", id: "finance.outstanding-by-currency" },
          { kind: "widget", id: "finance.net-issued-trend" },
          { kind: "widget", id: "finance.invoice-status-breakdown" },
        ],
        widgets: [
          {
            id: "total-bookings",
            widgetId: "bookings.widget.total",
            layout: { x: 0, y: 0, width: 3, height: 2 },
          },
          {
            id: "outstanding-receivables",
            widgetId: "finance.outstanding-by-currency",
            layout: { x: 3, y: 0, width: 4, height: 3 },
          },
          {
            id: "invoice-status",
            widgetId: "finance.invoice-status-breakdown",
            layout: { x: 7, y: 0, width: 5, height: 3 },
          },
          {
            id: "monthly-bookings",
            widgetId: "bookings.widget.monthly-trend",
            layout: { x: 0, y: 3, width: 6, height: 4 },
          },
          {
            id: "net-issued",
            widgetId: "finance.net-issued-trend",
            layout: { x: 6, y: 3, width: 6, height: 4 },
          },
        ],
      },
    ],
  },
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

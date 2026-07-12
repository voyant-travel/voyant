import { defineExtension, defineModule, requirePort } from "@voyant-travel/core/project"
import { actionLedgerHealthRuntimePort } from "./runtime-port.js"

/** Import-cheap deployment declaration owned by the action-ledger package. */
export const actionLedgerVoyantModule = defineModule({
  id: "@voyant-travel/action-ledger",
  packageName: "@voyant-travel/action-ledger",
  localId: "action-ledger",
  api: [
    {
      id: "@voyant-travel/action-ledger#api.admin",
      surface: "admin",
      mount: "action-ledger",
      openapi: { document: "action-ledger" },
      runtime: {
        entry: "@voyant-travel/action-ledger",
        export: "actionLedgerHonoModule",
      },
    },
  ],
  schema: [
    {
      id: "@voyant-travel/action-ledger#schema",
      source: "@voyant-travel/action-ledger/schema",
    },
  ],
  migrations: [
    {
      id: "@voyant-travel/action-ledger#migrations",
      source: "./migrations",
    },
  ],
  admin: {
    compositionOrder: 120,
    runtime: {
      entry: "@voyant-travel/action-ledger-react/admin",
      export: "createSelectedActionLedgerAdminExtension",
    },
    routes: [
      {
        id: "@voyant-travel/action-ledger#admin.route.index",
        path: "/action-ledger",
        runtime: {
          entry: "@voyant-travel/action-ledger-react/admin",
          export: "createSelectedActionLedgerAdminExtension",
        },
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

export const actionLedgerHealthVoyantPlugin = defineExtension({
  id: "@voyant-travel/action-ledger#health-extension",
  packageName: "@voyant-travel/action-ledger",
  localId: "action-ledger.health-extension",
  runtimePorts: [requirePort(actionLedgerHealthRuntimePort)],
  api: [
    {
      id: "@voyant-travel/action-ledger#health-extension.api",
      surface: "admin",
      mount: "action-ledger",
      runtime: {
        entry: "@voyant-travel/action-ledger/graph-runtime",
        export: "createActionLedgerHealthVoyantRuntime",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export default actionLedgerVoyantModule

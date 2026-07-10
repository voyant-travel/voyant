import { defineModule, definePlugin } from "@voyant-travel/core/project"

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
  lifecycle: {
    uninstall: { default: "retain-data", purge: "not-supported" },
  },
  meta: {
    ownership: "package",
  },
})

export const actionLedgerHealthVoyantPlugin = definePlugin({
  id: "@voyant-travel/action-ledger#health-extension",
  packageName: "@voyant-travel/action-ledger",
  localId: "action-ledger.health-extension",
  api: [
    {
      id: "@voyant-travel/action-ledger#health-extension.api",
      surface: "admin",
      mount: "action-ledger",
      runtime: {
        entry: "@voyant-travel/action-ledger/health",
        export: "createActionLedgerHealthHonoExtension",
      },
    },
  ],
  meta: {
    ownership: "package",
  },
})

export default actionLedgerVoyantModule

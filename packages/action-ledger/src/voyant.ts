import { defineExtension, defineModule, requirePort } from "@voyant-travel/core/project"
import {
  actionLedgerBookingDriftRuntimePort,
  actionLedgerFinanceDriftRuntimePort,
  actionLedgerInventoryDriftRuntimePort,
} from "./runtime-port.js"

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
      resource: "action-ledger",
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
  access: {
    resources: [
      {
        id: "@voyant-travel/action-ledger#access.action-ledger",
        resource: "action-ledger",
        label: "Action ledger",
        description: "Read action audit records and manage approval or reversal state.",
        actions: [
          {
            action: "read",
            label: "Read action ledger",
            description: "Read action records, approval state, delegations, and relay status.",
          },
          {
            action: "write",
            label: "Manage action ledger",
            description: "Record reversals and request or decide privileged action approvals.",
            sensitive: true,
          },
        ],
      },
    ],
  },
  admin: {
    compositionOrder: 120,
    runtime: {
      entry: "@voyant-travel/action-ledger-react/admin",
      export: "createSelectedActionLedgerAdminExtension",
    },
    copy: [
      {
        id: "@voyant-travel/action-ledger#admin.copy.navigation",
        namespace: "operator.admin.navigation",
        fallbackLocale: "en",
        runtime: {
          entry: "@voyant-travel/i18n",
          export: "operatorAdminNavMessages",
        },
      },
    ],
    routes: [
      {
        id: "@voyant-travel/action-ledger#admin.route.index",
        path: "/action-ledger",
        requiredScopes: ["action-ledger:read"],
        runtime: {
          entry: "@voyant-travel/action-ledger-react/admin",
          export: "createSelectedActionLedgerAdminExtension",
        },
      },
    ],
    nav: [
      {
        id: "@voyant-travel/action-ledger#admin.nav.index",
        routeId: "@voyant-travel/action-ledger#admin.route.index",
        label: {
          namespace: "operator.admin.navigation",
          key: "nav.actionLedger",
        },
        order: 60,
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
        "Agents need guarded timeline, approval, reversal, and audit inspection capabilities.",
      issue: "#3370",
    },
  },
})

export const actionLedgerHealthVoyantPlugin = defineExtension({
  id: "@voyant-travel/action-ledger#health-extension",
  packageName: "@voyant-travel/action-ledger",
  localId: "action-ledger.health-extension",
  runtimePorts: [
    requirePort(actionLedgerBookingDriftRuntimePort),
    requirePort(actionLedgerFinanceDriftRuntimePort),
    requirePort(actionLedgerInventoryDriftRuntimePort),
  ],
  requires: {
    ports: [
      requirePort(actionLedgerBookingDriftRuntimePort),
      requirePort(actionLedgerFinanceDriftRuntimePort),
      requirePort(actionLedgerInventoryDriftRuntimePort),
    ],
  },
  api: [
    {
      id: "@voyant-travel/action-ledger#health-extension.api",
      surface: "admin",
      mount: "action-ledger",
      openapi: { document: "action-ledger-health" },
      resource: "action-ledger",
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

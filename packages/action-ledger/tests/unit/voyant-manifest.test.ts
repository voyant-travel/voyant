import { isGraphRuntimeFactory } from "@voyant-travel/core/project"
import { describe, expect, it } from "vitest"
import { createActionLedgerHealthVoyantRuntime } from "../../src/graph-runtime.js"
import { actionLedgerHealthVoyantPlugin, actionLedgerVoyantModule } from "../../src/voyant.js"

describe("action-ledger deployment manifest", () => {
  it("owns the package deployment surfaces", () => {
    expect(actionLedgerVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/action-ledger",
      packageName: "@voyant-travel/action-ledger",
      api: [
        {
          id: "@voyant-travel/action-ledger#api.admin",
          surface: "admin",
          openapi: { document: "action-ledger" },
          runtime: {
            entry: "@voyant-travel/action-ledger",
            export: "actionLedgerHonoModule",
          },
        },
      ],
      schema: [{ id: "@voyant-travel/action-ledger#schema" }],
      migrations: [{ id: "@voyant-travel/action-ledger#migrations" }],
      admin: {
        runtime: {
          entry: "@voyant-travel/action-ledger-react/admin",
          export: "createSelectedActionLedgerAdminExtension",
        },
        routes: [
          {
            id: "@voyant-travel/action-ledger#admin.route.index",
            path: "/action-ledger",
          },
        ],
      },
    })
  })

  it("owns the health extension bridge", () => {
    expect(actionLedgerHealthVoyantPlugin).toMatchObject({
      schemaVersion: "voyant.extension.v1",
      id: "@voyant-travel/action-ledger#health-extension",
      packageName: "@voyant-travel/action-ledger",
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
      runtimePorts: [
        { id: "action-ledger.booking-drift-runtime" },
        { id: "action-ledger.finance-drift-runtime" },
        { id: "action-ledger.inventory-drift-runtime" },
      ],
    })
    expect(isGraphRuntimeFactory(createActionLedgerHealthVoyantRuntime)).toBe(true)
  })
})

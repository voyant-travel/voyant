import { describe, expect, it } from "vitest"
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
          runtime: {
            entry: "@voyant-travel/action-ledger",
            export: "actionLedgerHonoModule",
          },
        },
      ],
      schema: [{ id: "@voyant-travel/action-ledger#schema" }],
      migrations: [{ id: "@voyant-travel/action-ledger#migrations" }],
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
            entry: "@voyant-travel/action-ledger/health",
            export: "createActionLedgerHealthHonoExtension",
          },
        },
      ],
    })
  })
})

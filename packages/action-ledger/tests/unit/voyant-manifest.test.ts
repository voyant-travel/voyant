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
          resource: "action-ledger",
          openapi: { document: "action-ledger" },
          runtime: {
            entry: "@voyant-travel/action-ledger",
            export: "actionLedgerHonoModule",
          },
        },
      ],
      schema: [{ id: "@voyant-travel/action-ledger#schema" }],
      migrations: [{ id: "@voyant-travel/action-ledger#migrations" }],
      access: {
        resources: [expect.objectContaining({ resource: "action-ledger" })],
      },
      admin: {
        runtime: {
          entry: "@voyant-travel/action-ledger-react/admin",
          export: "createSelectedActionLedgerAdminExtension",
        },
        routes: [
          {
            id: "@voyant-travel/action-ledger#admin.route.index",
            path: "/action-ledger",
            requiredScopes: ["action-ledger:read"],
          },
        ],
        nav: [
          {
            id: "@voyant-travel/action-ledger#admin.nav.index",
            routeId: "@voyant-travel/action-ledger#admin.route.index",
            label: { namespace: "operator.admin.navigation", key: "nav.actionLedger" },
            order: 60,
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
          resource: "action-ledger",
          openapi: { document: "action-ledger-health" },
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
      requires: {
        ports: [
          { id: "action-ledger.booking-drift-runtime" },
          { id: "action-ledger.finance-drift-runtime" },
          { id: "action-ledger.inventory-drift-runtime" },
        ],
      },
    })
    expect(isGraphRuntimeFactory(createActionLedgerHealthVoyantRuntime)).toBe(true)
  })

  it("binds every sensitive Tool to staff-only graph actions", () => {
    expect(actionLedgerVoyantModule.tools?.map(({ name }) => name).sort()).toEqual([
      "approve_action_approval",
      "deny_action_approval",
      "get_action_approval",
      "get_action_delegation",
      "get_action_ledger_entry",
      "get_action_target_timeline",
      "list_action_approvals",
      "list_action_delegations",
      "list_action_ledger_entries",
      "list_action_relay_outbox",
      "request_action_approval",
    ])
    expect(actionLedgerVoyantModule.meta?.agentTools).toBeUndefined()

    const boundTools = new Set(
      actionLedgerVoyantModule.actions?.flatMap(({ from }) => from?.tools ?? []) ?? [],
    )
    expect(boundTools).toEqual(new Set(actionLedgerVoyantModule.tools?.map(({ id }) => id) ?? []))
    expect(
      actionLedgerVoyantModule.actions?.every(
        ({ ledger, approval, allowedActorTypes }) =>
          ledger === "required" && approval === "never" && allowedActorTypes?.join() === "staff",
      ),
    ).toBe(true)
    expect(actionLedgerVoyantModule.access?.resources[0]).toMatchObject({
      wildcard: "explicit-resource",
    })
  })
})

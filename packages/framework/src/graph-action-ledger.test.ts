import { evaluateActionLedgerCapabilityRisk } from "@voyant-travel/action-ledger/capability"
import { describe, expect, it } from "vitest"

import { lowerVoyantGraphActionsToActionLedgerRegistry } from "./graph-action-ledger.js"
import { createVoyantGraphRuntime, type VoyantGraphRuntimeSelectedIds } from "./runtime-lowering.js"

const selectedIds: VoyantGraphRuntimeSelectedIds = {
  routes: ["loyalty.api"],
  tools: ["loyalty.tool"],
  workflows: ["loyalty.workflow"],
  events: ["loyalty.event"],
  webhooks: ["loyalty.webhook"],
}

function actionRuntime(
  overrides: { accessScopes?: readonly string[]; selectedIds?: VoyantGraphRuntimeSelectedIds } = {},
) {
  return createVoyantGraphRuntime({
    graphHash: "sha256:actions",
    entries: {},
    modules: [
      {
        id: "@acme/loyalty",
        kind: "module",
        packageName: "@acme/loyalty",
        order: 0,
        accessScopes: overrides.accessScopes ?? ["loyalty:write"],
        actions: [
          {
            id: "loyalty.points.adjust",
            unitId: "@acme/loyalty",
            version: "v1",
            kind: "execute",
            targetType: "loyalty_account",
            requiredScopes: ["loyalty:write"],
            risk: "medium",
            ledger: "required",
            approval: "conditional",
            reversible: true,
            from: {
              routes: ["loyalty.api"],
              tools: ["loyalty.tool"],
              workflows: ["loyalty.workflow"],
              events: ["loyalty.event"],
              webhooks: ["loyalty.webhook"],
            },
          },
        ],
        selectedIds: overrides.selectedIds ?? selectedIds,
        routes: [],
      },
    ],
    plugins: [],
  })
}

describe("graph action-ledger lowering", () => {
  it("lowers selected actions into deterministic capability definitions", () => {
    const evaluateRisk = ({ amount }: { amount: number }) =>
      amount > 1_000 ? ("high" as const) : ("medium" as const)
    const registry = lowerVoyantGraphActionsToActionLedgerRegistry(actionRuntime(), {
      riskEvaluators: { "loyalty.points.adjust@v1": evaluateRisk },
    })

    expect(registry.definitions).toEqual([
      {
        id: "loyalty.points.adjust",
        version: "v1",
        resource: "loyalty_account",
        action: "adjust",
        risk: "medium",
        ledgerPolicy: "required",
        approvalPolicy: "conditional",
        reversible: true,
        requiredGrants: [{ resource: "loyalty", action: "write" }],
        evaluateRisk,
      },
    ])
    expect(evaluateActionLedgerCapabilityRisk(registry.definitions[0]!, { amount: 2_000 })).toBe(
      "high",
    )
  })

  it("rejects action scopes outside the selected graph", () => {
    expect(() =>
      lowerVoyantGraphActionsToActionLedgerRegistry(actionRuntime({ accessScopes: [] })),
    ).toThrow(/requires undeclared selected-graph scope "loyalty:write"/)
  })

  it.each([
    "routes",
    "tools",
    "workflows",
    "events",
    "webhooks",
  ] as const)("rejects unknown selected-graph %s bindings", (binding) => {
    const withoutBinding = { ...selectedIds, [binding]: [] }

    expect(() =>
      lowerVoyantGraphActionsToActionLedgerRegistry(actionRuntime({ selectedIds: withoutBinding })),
    ).toThrow(new RegExp(`binds unknown selected-graph ${binding} id`))
  })
})

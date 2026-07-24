import { evaluateActionLedgerCapabilityRisk } from "@voyant-travel/action-ledger/capability"
import { describe, expect, it } from "vitest"

import { lowerVoyantGraphActionsToActionLedgerRegistry } from "./graph-action-ledger.js"
import { createVoyantGraphRuntime, type VoyantGraphRuntimeSelectedIds } from "./runtime-lowering.js"

const selectedIds: VoyantGraphRuntimeSelectedIds = {
  routes: ["loyalty.api"],
  tools: ["loyalty.tool"],
  events: ["loyalty.event"],
  webhooks: ["loyalty.webhook"],
}

function actionRuntime(
  overrides: {
    accessScopes?: readonly string[]
    selectedIds?: VoyantGraphRuntimeSelectedIds
    unavailable?: boolean
  } = {},
) {
  const accessScopes = overrides.accessScopes ?? ["loyalty:write"]
  return createVoyantGraphRuntime({
    graphHash: "sha256:actions",
    accessCatalog: {
      resources: accessScopes.includes("loyalty:write")
        ? [
            {
              id: "loyalty",
              unitId: "@acme/loyalty",
              resource: "loyalty",
              label: "Loyalty",
              description: "Loyalty",
              wildcard: "allow",
              actions: [{ action: "write", label: "Write", description: "Write" }],
            },
          ]
        : [],
      presets: [],
    },
    entries: {},
    modules: [
      {
        id: "@acme/loyalty",
        kind: "module",
        packageName: "@acme/loyalty",
        order: 0,
        accessScopes,
        actions: [
          {
            id: "loyalty.points.adjust",
            capabilityId: "loyalty:points:adjust",
            unitId: "@acme/loyalty",
            version: "v1",
            kind: "execute",
            targetType: "loyalty_account",
            ...(overrides.unavailable
              ? {
                  availability: {
                    status: "unavailable" as const,
                    reasonCode: "unsafe-nontransactional-effect",
                  },
                }
              : {}),
            resource: "loyalty_balance",
            action: "adjust_points",
            requiredScopes: ["loyalty:write"],
            risk: "medium",
            ledger: "required",
            approval: "conditional",
            reversible: true,
            allowedActorTypes: ["staff", "system"],
            from: {
              routes: ["loyalty.api"],
              tools: ["loyalty.tool"],
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
      riskEvaluators: { "loyalty:points:adjust@v1": evaluateRisk },
    })

    expect(registry.definitions).toEqual([
      {
        id: "loyalty:points:adjust",
        version: "v1",
        resource: "loyalty_balance",
        action: "adjust_points",
        risk: "medium",
        ledgerPolicy: "required",
        approvalPolicy: "conditional",
        reversible: true,
        allowedActorTypes: ["staff", "system"],
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
    ).toThrow(/requires undeclared access scope "loyalty:write"/)
  })

  it("does not lower unavailable actions into the action-ledger capability registry", () => {
    const runtime = actionRuntime({
      unavailable: true,
      selectedIds: { ...selectedIds, tools: [] },
    })

    expect(lowerVoyantGraphActionsToActionLedgerRegistry(runtime).definitions).toEqual([])
  })

  it.each([
    "routes",
    "tools",
    "events",
    "webhooks",
  ] as const)("rejects unknown selected-graph %s bindings", (binding) => {
    const withoutBinding = { ...selectedIds, [binding]: [] }

    expect(() =>
      lowerVoyantGraphActionsToActionLedgerRegistry(actionRuntime({ selectedIds: withoutBinding })),
    ).toThrow(new RegExp(`selects undeclared ${binding} reference`))
  })
})

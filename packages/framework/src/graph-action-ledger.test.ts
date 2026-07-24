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
    conditionalEnabled?: boolean
    unavailable?: boolean
  } = {},
) {
  const accessScopes = overrides.accessScopes ?? ["loyalty:write"]
  const conditionalPortId = "notifications.durable-send"
  return createVoyantGraphRuntime({
    graphHash: "sha256:actions",
    providerSelections: overrides.conditionalEnabled ? { notifications: "durable" } : {},
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
    entries: overrides.conditionalEnabled
      ? {
          "@acme/loyalty/provider": async () => ({ createProvider: () => ({}) }),
          "@acme/loyalty/durable-port": async () => ({
            durableNotificationPort: { id: conditionalPortId, test: () => undefined },
          }),
          "@acme/loyalty/tool": async () => ({}),
        }
      : {},
    modules: [
      {
        id: "@acme/loyalty",
        kind: "module",
        packageName: "@acme/loyalty",
        order: 0,
        accessScopes,
        ...(overrides.conditionalEnabled
          ? {
              references: [
                {
                  id: "notification-provider",
                  unitId: "@acme/loyalty",
                  facet: "providers.runtime" as const,
                  entityId: "@acme/loyalty#provider.durable",
                  runtime: { entry: "./provider", export: "createProvider" },
                  importEntry: "@acme/loyalty/provider",
                },
                {
                  id: "notification-port-conformance",
                  unitId: "@acme/loyalty",
                  facet: "runtimePorts.conformance" as const,
                  entityId: conditionalPortId,
                  runtime: {
                    entry: "./durable-port",
                    export: "durableNotificationPort",
                  },
                  importEntry: "@acme/loyalty/durable-port",
                },
              ],
              provisionalReferences: [
                {
                  id: "loyalty-tool-reference",
                  unitId: "@acme/loyalty",
                  facet: "tools.runtime" as const,
                  entityId: "loyalty.tool",
                  runtime: { entry: "./tool", export: "loyaltyTool" },
                  importEntry: "@acme/loyalty/tool",
                },
              ],
              provisionalTools: [
                {
                  id: "loyalty.tool",
                  unitId: "@acme/loyalty",
                  name: "loyalty_tool",
                  referenceId: "loyalty-tool-reference",
                  requiredScopes: ["loyalty:write"],
                },
              ],
              providers: [
                {
                  unitId: "@acme/loyalty",
                  declaration: {
                    id: "@acme/loyalty#provider.durable",
                    port: conditionalPortId,
                    selection: { role: "notifications", value: "durable" },
                    runtime: { entry: "./provider", export: "createProvider" },
                  },
                  referenceId: "notification-provider",
                },
              ],
              requiredPorts: [conditionalPortId],
              runtimePorts: [conditionalPortId],
              runtimePortConformance: [
                {
                  portId: conditionalPortId,
                  referenceId: "notification-port-conformance",
                },
              ],
            }
          : {}),
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
              : overrides.conditionalEnabled
                ? {
                    availability: {
                      status: "unavailable" as const,
                      reasonCode: "provider-not-durable",
                      enableWhen: {
                        selectedProviderPorts: {
                          mode: "all" as const,
                          ports: [conditionalPortId],
                        },
                      },
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
        selectedIds:
          overrides.selectedIds ??
          (overrides.conditionalEnabled ? { ...selectedIds, tools: [] } : selectedIds),
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

  it("rejects a selected conditional action before framework activation", () => {
    const runtime = actionRuntime({ conditionalEnabled: true })

    expect(() => lowerVoyantGraphActionsToActionLedgerRegistry(runtime)).toThrow(/NOT_ACTIVATED/)
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

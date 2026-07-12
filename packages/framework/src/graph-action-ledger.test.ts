import { evaluateActionLedgerCapabilityRisk } from "@voyant-travel/action-ledger/capability"
import { bookingActionLedgerCapabilityRegistry } from "@voyant-travel/bookings/action-ledger-capabilities"
import { bookingsVoyantModule } from "@voyant-travel/bookings/voyant"
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
    ).toThrow(new RegExp(`selects undeclared ${binding} reference`))
  })

  it("keeps the bookings manifest in parity with its canonical request registry", () => {
    const actions = bookingsVoyantModule.actions ?? []
    expect(actions.map(({ id, capabilityId }) => ({ id, capabilityId }))).toEqual([
      { id: "booking.pii.read", capabilityId: "bookings-pii:read" },
      { id: "booking.status.confirm", capabilityId: "bookings:status:confirm" },
      { id: "booking.status.expire", capabilityId: "bookings:status:expire" },
      { id: "booking.status.cancel", capabilityId: "bookings:status:cancel" },
      { id: "booking.status.start", capabilityId: "bookings:status:start" },
      { id: "booking.status.complete", capabilityId: "bookings:status:complete" },
      { id: "booking.status.override", capabilityId: "bookings:status:override" },
    ])
    const accessScopes = (bookingsVoyantModule.access?.resources ?? []).flatMap((resource) =>
      resource.actions.map(
        (action) => `${resource.resource}:${typeof action === "string" ? action : action.action}`,
      ),
    )
    const runtime = createVoyantGraphRuntime({
      graphHash: "sha256:bookings-action-parity",
      accessCatalog: {
        resources: (bookingsVoyantModule.access?.resources ?? []).map((resource) => ({
          id: resource.id,
          unitId: bookingsVoyantModule.id,
          resource: resource.resource,
          label: resource.label ?? resource.resource,
          description: resource.description ?? resource.label ?? resource.resource,
          wildcard: resource.wildcard ?? "allow",
          actions: resource.actions.map((action) =>
            typeof action === "string"
              ? { action, label: action, description: action }
              : {
                  action: action.action,
                  label: action.label ?? action.action,
                  description: action.description ?? action.label ?? action.action,
                  ...(action.wildcard ? { wildcard: action.wildcard } : {}),
                },
          ),
          legacyActions: resource.legacyActions,
        })),
        presets: [],
      },
      entries: {},
      modules: [
        {
          id: bookingsVoyantModule.id,
          kind: "module",
          packageName: bookingsVoyantModule.packageName!,
          order: 0,
          accessScopes,
          actions: actions.map((action) => ({
            ...action,
            unitId: bookingsVoyantModule.id,
            requiredScopes: [...(action.requiredScopes ?? [])],
            from: {
              routes: [...(action.from?.routes ?? [])],
              tools: [...(action.from?.tools ?? [])],
              workflows: [...(action.from?.workflows ?? [])],
              events: [...(action.from?.events ?? [])],
              webhooks: [...(action.from?.webhooks ?? [])],
            },
          })),
          selectedIds: {
            routes: (bookingsVoyantModule.api ?? []).map(({ id }) => id),
            tools: (bookingsVoyantModule.tools ?? []).map(({ id }) => id),
            workflows: (bookingsVoyantModule.workflows ?? []).map(({ id }) => id),
            events: (bookingsVoyantModule.events ?? []).map(({ id }) => id),
            webhooks: (bookingsVoyantModule.webhooks ?? []).map(({ id }) => id),
          },
          routes: [],
        },
      ],
      plugins: [],
    })

    const lowered = lowerVoyantGraphActionsToActionLedgerRegistry(runtime).definitions
    const canonical = [...bookingActionLedgerCapabilityRegistry.definitions].sort(
      (left, right) => left.id.localeCompare(right.id) || left.version.localeCompare(right.version),
    )

    expect(lowered).toEqual(canonical)
  })
})

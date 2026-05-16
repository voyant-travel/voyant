import { describe, expect, test } from "vitest"

import {
  type ActionLedgerCapabilityDefinition,
  ActionLedgerCapabilityRegistryError,
  createActionLedgerCapabilityRegistry,
  evaluateActionLedgerCapabilityRisk,
  getActionLedgerCapability,
} from "../../src/capability.js"

describe("action ledger capability registry", () => {
  const capability = {
    id: "bookings:status:cancel",
    version: "v1",
    resource: "booking",
    action: "cancel",
    risk: "high",
    ledgerPolicy: "required",
  } as const satisfies ActionLedgerCapabilityDefinition

  test("indexes capabilities by id and version", () => {
    const registry = createActionLedgerCapabilityRegistry([capability])

    expect(getActionLedgerCapability(registry, "bookings:status:cancel", "v1")).toBe(capability)
    expect(getActionLedgerCapability(registry, "bookings:status:cancel", "v2")).toBeNull()
  })

  test("rejects duplicate id and version pairs", () => {
    expect(() => createActionLedgerCapabilityRegistry([capability, capability])).toThrow(
      ActionLedgerCapabilityRegistryError,
    )
  })

  test("uses static risk as a floor for evaluated risk", () => {
    expect(
      evaluateActionLedgerCapabilityRisk(
        {
          ...capability,
          evaluateRisk: () => "medium",
        },
        {},
      ),
    ).toBe("high")
    expect(
      evaluateActionLedgerCapabilityRisk(
        {
          ...capability,
          evaluateRisk: () => "critical",
        },
        {},
      ),
    ).toBe("critical")
  })
})

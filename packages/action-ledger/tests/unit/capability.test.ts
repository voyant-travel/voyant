import { describe, expect, test } from "vitest"

import {
  type ActionLedgerCapabilityDefinition,
  ActionLedgerCapabilityRegistryError,
  createActionLedgerCapabilityRegistry,
  evaluateActionLedgerCapabilityAccess,
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

  test("allows internal requests without actor or grant checks", () => {
    expect(
      evaluateActionLedgerCapabilityAccess({
        definition: {
          ...capability,
          allowedActorTypes: ["staff"],
        },
        isInternalRequest: true,
      }),
    ).toMatchObject({
      allowed: true,
      reason: "internal_request",
      authorizationSource: "internal_request",
      capabilityId: "bookings:status:cancel",
      capabilityVersion: "v1",
      evaluatedRisk: "high",
      ledgerPolicy: "required",
      approvalPolicy: "none",
    })
  })

  test("allows session actors listed by the capability", () => {
    expect(
      evaluateActionLedgerCapabilityAccess({
        definition: {
          ...capability,
          allowedActorTypes: ["staff"],
        },
        actor: "staff",
        callerType: "session",
      }),
    ).toMatchObject({
      allowed: true,
      reason: "actor_allowed",
      authorizationSource: "actor_context",
      grant: null,
    })

    expect(
      evaluateActionLedgerCapabilityAccess({
        definition: {
          ...capability,
          allowedActorTypes: ["staff"],
        },
        actor: "customer",
        callerType: "session",
      }),
    ).toMatchObject({
      allowed: false,
      reason: "actor_not_allowed",
    })
  })

  test("allows API keys with matching permission grants", () => {
    expect(
      evaluateActionLedgerCapabilityAccess({
        definition: {
          ...capability,
          requiredGrants: [{ resource: "bookings", action: "write" }],
        },
        callerType: "api_key",
        permissions: {
          bookings: ["write"],
        },
      }),
    ).toMatchObject({
      allowed: true,
      reason: "permission_grant",
      authorizationSource: "api_token_permission",
      grant: { resource: "bookings", action: "write" },
    })
  })

  test("allows flattened scope grants and wildcard scopes", () => {
    expect(
      evaluateActionLedgerCapabilityAccess({
        definition: {
          ...capability,
          requiredGrants: [{ resource: "bookings-pii", action: "read" }],
        },
        callerType: "api_key",
        scopes: ["bookings-pii:read"],
      }),
    ).toMatchObject({
      allowed: true,
      reason: "scope_grant",
      authorizationSource: "scope",
    })

    expect(
      evaluateActionLedgerCapabilityAccess({
        definition: {
          ...capability,
          requiredGrants: [{ resource: "bookings", action: "write" }],
        },
        callerType: "api_key",
        scopes: ["*:*"],
      }),
    ).toMatchObject({
      allowed: true,
      reason: "scope_grant",
    })
  })

  test("denies API keys without a matching grant", () => {
    expect(
      evaluateActionLedgerCapabilityAccess({
        definition: {
          ...capability,
          requiredGrants: [{ resource: "bookings", action: "write" }],
        },
        callerType: "api_key",
        scopes: ["bookings:read"],
      }),
    ).toMatchObject({
      allowed: false,
      reason: "grant_missing",
      authorizationSource: "api_token_permission",
    })
  })

  test("does not invoke dynamic risk evaluation without risk context", () => {
    expect(
      evaluateActionLedgerCapabilityAccess({
        definition: {
          ...capability,
          evaluateRisk: (context: { paid: boolean }) => (context.paid ? "critical" : "high"),
        },
        actor: "staff",
      }),
    ).toMatchObject({
      allowed: true,
      evaluatedRisk: "high",
    })
  })
})

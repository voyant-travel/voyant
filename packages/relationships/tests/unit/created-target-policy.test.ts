import { describe, expect, it } from "vitest"

import {
  RELATIONSHIPS_ORGANIZATION_CREATED_TARGET_POLICY,
  RELATIONSHIPS_ORGANIZATION_HANDLER_ACTION_POLICY,
} from "../../src/created-target-policy.js"

describe("Relationships created-target policy", () => {
  it("binds organization creation to one handler-owned immutable reference contract", () => {
    expect(RELATIONSHIPS_ORGANIZATION_HANDLER_ACTION_POLICY).toMatchObject({
      capabilityId: RELATIONSHIPS_ORGANIZATION_CREATED_TARGET_POLICY.toolCapabilityId,
      canonicalName: "create_organization",
      actionPolicy: {
        id: RELATIONSHIPS_ORGANIZATION_CREATED_TARGET_POLICY.actionName,
        targetType: "organization",
        targetLifecycle: "created",
        createdTarget: {
          commandTargetType: "organization_create_command",
          resultReferenceType: "organization",
          durability: "handler-command-claim-v1",
        },
        risk: "medium",
        ledger: "required",
        approval: "never",
        reversible: false,
        allowedActorTypes: ["staff"],
      },
    })
  })
})

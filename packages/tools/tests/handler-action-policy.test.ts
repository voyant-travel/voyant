import { describe, expect, it } from "vitest"

import {
  admitHandlerActionPolicy,
  type HandlerActionPolicyExpectation,
  type ToolContext,
  type ToolError,
} from "../src/index.js"

const expected = {
  capabilityId: "@voyant-travel/legal#tool.issue-document",
  capabilityVersion: "v1",
  canonicalName: "legal_issue_document",
  actionPolicy: {
    id: "@voyant-travel/legal#action.issue-document",
    capabilityId: "@voyant-travel/legal#action.issue-document",
    version: "v1",
    kind: "execute",
    targetType: "legal-document-command",
    targetLifecycle: "created",
    createdTarget: {
      commandTargetType: "legal-document-command",
      resultReferenceType: "legal-document",
      durability: "handler-command-claim-v1",
      parentAnchor: { targetType: "contract", targetIdField: "contractId" },
    },
    risk: "high",
    ledger: "required",
    approval: "required",
    allowedActorTypes: ["staff"],
  },
} satisfies HandlerActionPolicyExpectation

describe("admitHandlerActionPolicy", () => {
  it("admits the exact package contract and canonical Tool identity", () => {
    const admitted = admitHandlerActionPolicy(context(), expected)

    expect(admitted.canonicalName).toBe("legal_issue_document")
    expect(admitted.actionPolicy.allowedActorTypes).toEqual(["staff"])
  })

  it("rejects stale or mismatched policy context before mutation", () => {
    let mutations = 0
    const handler = (ctx: ToolContext) => {
      admitHandlerActionPolicy(ctx, expected)
      mutations += 1
    }
    const fresh = context()
    const stalePolicy = fresh.handlerActionPolicy
    if (!stalePolicy) throw new Error("Test context is missing its handler policy")
    const stale: ToolContext = {
      ...fresh,
      handlerActionPolicy: {
        ...stalePolicy,
        canonicalName: "legal_issue_document_alias",
      },
    }

    expect(() => handler(stale)).toThrowError(
      expect.objectContaining<Partial<ToolError>>({ code: "ACTION_POLICY_REQUIRED" }),
    )
    expect(mutations).toBe(0)
  })

  it("rejects a stale generated-child parent anchor before mutation", () => {
    let mutations = 0
    const stale = context()
    if (!stale.handlerActionPolicy) throw new Error("Test context is missing its handler policy")
    stale.handlerActionPolicy.actionPolicy.createdTarget = {
      ...stale.handlerActionPolicy.actionPolicy.createdTarget!,
      parentAnchor: { targetType: "contract", targetIdField: "documentId" },
    }

    expect(() => {
      admitHandlerActionPolicy(stale, expected)
      mutations += 1
    }).toThrowError(expect.objectContaining<Partial<ToolError>>({ code: "ACTION_POLICY_REQUIRED" }))
    expect(mutations).toBe(0)
  })

  it("rejects stale existing-target durable result metadata before mutation", () => {
    const existingExpected = {
      ...expected,
      actionPolicy: {
        ...expected.actionPolicy,
        targetType: "booking",
        commandTargetField: "bookingId",
        targetLifecycle: "existing" as const,
        existingTarget: { durability: "handler-command-result-v1" as const },
        createdTarget: undefined,
      },
    } satisfies HandlerActionPolicyExpectation
    const stale = context()
    if (!stale.handlerActionPolicy) throw new Error("Test context is missing its handler policy")
    stale.handlerActionPolicy.actionPolicy = {
      ...existingExpected.actionPolicy,
      existingTarget: undefined,
      enforcement: "handler",
      invocation: stale.handlerActionPolicy.actionPolicy.invocation,
    }

    expect(() => admitHandlerActionPolicy(stale, existingExpected)).toThrowError(
      expect.objectContaining<Partial<ToolError>>({ code: "ACTION_POLICY_REQUIRED" }),
    )
  })

  it("rejects an actor excluded by the selected action before mutation", () => {
    let mutations = 0
    const handler = (ctx: ToolContext) => {
      admitHandlerActionPolicy(ctx, expected)
      mutations += 1
    }

    expect(() => handler(context("customer"))).toThrowError(
      expect.objectContaining<Partial<ToolError>>({ code: "AUTHORIZATION_DENIED" }),
    )
    expect(mutations).toBe(0)
  })
})

function context(actor: ToolContext["actor"] = "staff"): ToolContext {
  return {
    db: {},
    actor,
    audience: actor,
    tenantId: "tenant_1",
    resolverScope: { locale: "en-GB", audience: actor, market: "default", actor },
    handlerActionPolicy: {
      capabilityId: expected.capabilityId,
      capabilityVersion: expected.capabilityVersion,
      canonicalName: expected.canonicalName,
      actionPolicy: {
        ...expected.actionPolicy,
        enforcement: "handler",
        invocation: {
          controlField: "_voyant",
          requiredFields: ["confirmed", "idempotencyKey", "approvalId", "idempotencyFingerprint"],
          optionalFields: ["reasonCode"],
          fingerprintAlgorithm: "action-ledger-command-v1",
        },
      },
      invocation: {
        confirmed: true,
        idempotencyKey: "command_1",
        approvalId: "approval_1",
        idempotencyFingerprint: "sha256:command-1",
      },
    },
  }
}

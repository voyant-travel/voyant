import {
  type BuildCreatedTargetCommandFingerprintInput,
  buildCreatedTargetCommandFingerprint,
} from "@voyant-travel/action-ledger"
import type { HandlerActionPolicyExpectation } from "@voyant-travel/tools"

interface ChartersCreatedTargetPolicy {
  actionName: string
  actionVersion: "v1"
  toolName: string
  toolCapabilityId: string
  capabilityId: string
  capabilityVersion: "v1"
  commandTargetType: string
  canonicalTargetType: string
  resultReferenceType: string
  evaluatedRisk: "medium"
  approvalPolicy: "none"
  approvalReasonCode: null
}

export const CHARTERS_CREATED_TARGET_POLICIES = {
  product: {
    actionName: "@voyant-travel/charters#action.create-charter-product",
    actionVersion: "v1",
    toolName: "create_charter_product",
    toolCapabilityId: "@voyant-travel/charters#tool.create-charter-product",
    capabilityId: "@voyant-travel/charters#action.create-charter-product",
    capabilityVersion: "v1",
    commandTargetType: "charter_product_create_command",
    canonicalTargetType: "charter-product",
    resultReferenceType: "charter-product",
    evaluatedRisk: "medium",
    approvalPolicy: "none",
    approvalReasonCode: null,
  },
  yacht: {
    actionName: "@voyant-travel/charters#action.create-charter-yacht",
    actionVersion: "v1",
    toolName: "create_charter_yacht",
    toolCapabilityId: "@voyant-travel/charters#tool.create-charter-yacht",
    capabilityId: "@voyant-travel/charters#action.create-charter-yacht",
    capabilityVersion: "v1",
    commandTargetType: "charter_yacht_create_command",
    canonicalTargetType: "charter-yacht",
    resultReferenceType: "charter-yacht",
    evaluatedRisk: "medium",
    approvalPolicy: "none",
    approvalReasonCode: null,
  },
} as const satisfies Record<string, ChartersCreatedTargetPolicy>

export function buildChartersCreatedTargetFingerprint(
  policy: ChartersCreatedTargetPolicy,
  commandTargetId: string,
  commandInput: unknown,
): Promise<string> {
  const input: BuildCreatedTargetCommandFingerprintInput = {
    actionName: policy.actionName,
    actionVersion: policy.actionVersion,
    commandTarget: { type: policy.commandTargetType, id: commandTargetId },
    canonicalTargetType: policy.canonicalTargetType,
    resultReferenceType: policy.resultReferenceType,
    commandInput,
    capabilityId: policy.capabilityId,
    capabilityVersion: policy.capabilityVersion,
    evaluatedRisk: policy.evaluatedRisk,
    approvalPolicy: policy.approvalPolicy,
    approvalReasonCode: policy.approvalReasonCode,
  }
  return buildCreatedTargetCommandFingerprint(input)
}

export function chartersHandlerActionPolicyExpectation(
  policy: ChartersCreatedTargetPolicy,
): HandlerActionPolicyExpectation {
  return {
    capabilityId: policy.toolCapabilityId,
    capabilityVersion: policy.capabilityVersion,
    canonicalName: policy.toolName,
    actionPolicy: {
      id: policy.actionName,
      capabilityId: policy.capabilityId,
      version: policy.actionVersion,
      kind: "execute",
      targetType: policy.canonicalTargetType,
      targetLifecycle: "created",
      createdTarget: {
        commandTargetType: policy.commandTargetType,
        resultReferenceType: policy.resultReferenceType,
        durability: "handler-command-claim-v1",
      },
      risk: policy.evaluatedRisk,
      ledger: "required",
      approval: "never",
      reversible: false,
      allowedActorTypes: ["staff"],
    },
  }
}

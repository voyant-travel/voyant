import {
  type BuildCreatedTargetCommandFingerprintInput,
  buildCreatedTargetCommandFingerprint,
} from "@voyant-travel/action-ledger"
import type { HandlerActionPolicyExpectation } from "@voyant-travel/tools"

interface DistributionCreatedTargetPolicy {
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

export const DISTRIBUTION_CREATED_TARGET_POLICIES = {
  supplier: {
    actionName: "@voyant-travel/distribution#action.create-supplier",
    actionVersion: "v1",
    toolName: "create_supplier",
    toolCapabilityId: "@voyant-travel/distribution#tool.create-supplier",
    capabilityId: "@voyant-travel/distribution#action.create-supplier",
    capabilityVersion: "v1",
    commandTargetType: "supplier_create_command",
    canonicalTargetType: "supplier",
    resultReferenceType: "supplier",
    evaluatedRisk: "medium",
    approvalPolicy: "none",
    approvalReasonCode: null,
  },
  channel: {
    actionName: "@voyant-travel/distribution#action.create-channel",
    actionVersion: "v1",
    toolName: "create_distribution_channel",
    toolCapabilityId: "@voyant-travel/distribution#tool.create-channel",
    capabilityId: "@voyant-travel/distribution#action.create-channel",
    capabilityVersion: "v1",
    commandTargetType: "distribution_channel_create_command",
    canonicalTargetType: "distribution-channel",
    resultReferenceType: "distribution-channel",
    evaluatedRisk: "medium",
    approvalPolicy: "none",
    approvalReasonCode: null,
  },
} as const satisfies Record<string, DistributionCreatedTargetPolicy>

export const DISTRIBUTION_CREATED_TARGET_HANDLER_EXPECTATIONS = {
  supplier: handlerExpectation(DISTRIBUTION_CREATED_TARGET_POLICIES.supplier),
  channel: handlerExpectation(DISTRIBUTION_CREATED_TARGET_POLICIES.channel),
} as const

export function buildDistributionCreatedTargetFingerprint(
  policy: DistributionCreatedTargetPolicy,
  admittedAction: { capabilityId: string; version: string },
  commandTargetId: string,
  commandInput: unknown,
): Promise<string> {
  const input: BuildCreatedTargetCommandFingerprintInput = {
    actionName: admittedAction.capabilityId,
    actionVersion: admittedAction.version,
    commandTarget: { type: policy.commandTargetType, id: commandTargetId },
    canonicalTargetType: policy.canonicalTargetType,
    resultReferenceType: policy.resultReferenceType,
    commandInput,
    capabilityId: admittedAction.capabilityId,
    capabilityVersion: admittedAction.version,
    evaluatedRisk: policy.evaluatedRisk,
    approvalPolicy: policy.approvalPolicy,
    approvalReasonCode: policy.approvalReasonCode,
  }
  return buildCreatedTargetCommandFingerprint(input)
}

function handlerExpectation(
  policy: DistributionCreatedTargetPolicy,
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
    },
  }
}

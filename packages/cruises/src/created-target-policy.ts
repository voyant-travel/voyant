import {
  type BuildCreatedTargetCommandFingerprintInput,
  buildCreatedTargetCommandFingerprint,
} from "@voyant-travel/action-ledger"
import type { HandlerActionPolicyExpectation } from "@voyant-travel/tools"

export const CRUISE_SHIP_CREATED_TARGET_POLICY = {
  actionName: "@voyant-travel/cruises#action.create-cruise-ship",
  actionVersion: "v1",
  toolName: "create_cruise_ship",
  toolCapabilityId: "@voyant-travel/cruises#tool.create-cruise-ship",
  capabilityId: "@voyant-travel/cruises#action.create-cruise-ship",
  capabilityVersion: "v1",
  commandTargetType: "cruise_ship_create_command",
  canonicalTargetType: "cruise-ship",
  resultReferenceType: "cruise-ship",
  evaluatedRisk: "medium",
  approvalPolicy: "none",
  approvalReasonCode: null,
} as const

export function buildCruiseShipCreatedTargetFingerprint(
  commandTargetId: string,
  commandInput: unknown,
): Promise<string> {
  const policy = CRUISE_SHIP_CREATED_TARGET_POLICY
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

export const CRUISE_SHIP_HANDLER_ACTION_POLICY = {
  capabilityId: CRUISE_SHIP_CREATED_TARGET_POLICY.toolCapabilityId,
  capabilityVersion: CRUISE_SHIP_CREATED_TARGET_POLICY.capabilityVersion,
  canonicalName: CRUISE_SHIP_CREATED_TARGET_POLICY.toolName,
  actionPolicy: {
    id: CRUISE_SHIP_CREATED_TARGET_POLICY.actionName,
    capabilityId: CRUISE_SHIP_CREATED_TARGET_POLICY.capabilityId,
    version: CRUISE_SHIP_CREATED_TARGET_POLICY.actionVersion,
    kind: "execute",
    targetType: CRUISE_SHIP_CREATED_TARGET_POLICY.canonicalTargetType,
    targetLifecycle: "created",
    createdTarget: {
      commandTargetType: CRUISE_SHIP_CREATED_TARGET_POLICY.commandTargetType,
      resultReferenceType: CRUISE_SHIP_CREATED_TARGET_POLICY.resultReferenceType,
      durability: "handler-command-claim-v1",
    },
    risk: CRUISE_SHIP_CREATED_TARGET_POLICY.evaluatedRisk,
    ledger: "required",
    approval: "never",
    reversible: false,
    allowedActorTypes: ["staff"],
  },
} as const satisfies HandlerActionPolicyExpectation

import type { ToolActionPolicyBinding, ToolActionPolicyManifest } from "./binding.js"
import type { ToolContext, ToolHandlerActionPolicyContext } from "./context.js"
import { ToolError } from "./errors.js"

export interface HandlerActionPolicyExpectation {
  capabilityId: string
  capabilityVersion: string
  canonicalName: string
  actionPolicy: ToolActionPolicyBinding
}

/**
 * Admit one handler-owned Tool call against package-known identity metadata.
 *
 * MCP also applies this at its handler dispatch boundary. Package handlers can
 * call it again with their static action contract before claiming or mutating,
 * without trusting transport context or duplicating actor-policy checks.
 */
export function admitHandlerActionPolicy(
  context: ToolContext,
  expected: HandlerActionPolicyExpectation,
): ToolHandlerActionPolicyContext {
  const admitted = context.handlerActionPolicy
  if (admitted?.actionPolicy.enforcement !== "handler") {
    throw new ToolError(
      "Handler-owned action policy context is required for this Tool.",
      "ACTION_POLICY_REQUIRED",
      { capabilityId: expected.capabilityId },
    )
  }

  const mismatch = firstIdentityMismatch(admitted, expected)
  if (mismatch) {
    throw new ToolError(
      "Handler-owned action policy context does not match this Tool contract.",
      "ACTION_POLICY_REQUIRED",
      { capabilityId: expected.capabilityId, mismatch },
    )
  }

  const allowedActorTypes = admitted.actionPolicy.allowedActorTypes
  if (allowedActorTypes?.length && !allowedActorTypes.includes(context.actor)) {
    throw new ToolError(
      "The authenticated actor is not allowed by the selected handler action.",
      "AUTHORIZATION_DENIED",
      {
        actionId: admitted.actionPolicy.id,
        actor: context.actor,
      },
    )
  }
  return admitted
}

function firstIdentityMismatch(
  admitted: ToolHandlerActionPolicyContext,
  expected: HandlerActionPolicyExpectation,
): string | null {
  if (admitted.capabilityId !== expected.capabilityId) return "capabilityId"
  if (admitted.capabilityVersion !== expected.capabilityVersion) return "capabilityVersion"
  if (admitted.canonicalName !== expected.canonicalName) return "canonicalName"

  const actual = admitted.actionPolicy
  for (const field of [
    "id",
    "capabilityId",
    "version",
    "kind",
    "targetType",
    "targetLifecycle",
  ] as const) {
    if (actual[field] !== expected.actionPolicy[field]) return `actionPolicy.${field}`
  }
  if (!sameCreatedTarget(actual, expected.actionPolicy)) return "actionPolicy.createdTarget"
  for (const field of ["risk", "ledger", "approval", "policy", "reversible"] as const) {
    if (actual[field] !== expected.actionPolicy[field]) return `actionPolicy.${field}`
  }
  if (!sameStrings(actual.allowedActorTypes, expected.actionPolicy.allowedActorTypes)) {
    return "actionPolicy.allowedActorTypes"
  }
  return null
}

function sameCreatedTarget(
  actual: ToolActionPolicyManifest,
  expected: HandlerActionPolicyExpectation["actionPolicy"],
): boolean {
  const actualCreated = actual.createdTarget
  const expectedCreated = expected.createdTarget
  if (!actualCreated || !expectedCreated) return actualCreated === expectedCreated
  return (
    actualCreated.commandTargetType === expectedCreated.commandTargetType &&
    actualCreated.resultReferenceType === expectedCreated.resultReferenceType &&
    actualCreated.durability === expectedCreated.durability
  )
}

function sameStrings(
  actual: readonly string[] | undefined,
  expected: readonly string[] | undefined,
): boolean {
  if (!actual || !expected) return actual === expected
  if (actual.length !== expected.length) return false
  const actualValues = new Set(actual)
  const expectedValues = new Set(expected)
  if (actualValues.size !== expectedValues.size) return false
  return [...actualValues].every((value) => expectedValues.has(value))
}

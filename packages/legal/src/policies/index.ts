import type { LinkableDefinition } from "@voyant-travel/core"

export type { PoliciesAdminRoutes, PoliciesPublicRoutes } from "./routes.js"

export const policyLinkable: LinkableDefinition = {
  module: "legal",
  entity: "policy",
  table: "policies",
  idPrefix: "pol",
}

export const policyVersionLinkable: LinkableDefinition = {
  module: "legal",
  entity: "policyVersion",
  table: "policy_versions",
  idPrefix: "plvr",
}

export const policyAcceptanceLinkable: LinkableDefinition = {
  module: "legal",
  entity: "policyAcceptance",
  table: "policy_acceptances",
  idPrefix: "plac",
}

export const policiesLinkable = {
  policy: policyLinkable,
  policyVersion: policyVersionLinkable,
  policyAcceptance: policyAcceptanceLinkable,
}

export type {
  NewPolicy,
  NewPolicyAcceptance,
  NewPolicyAssignment,
  NewPolicyRule,
  NewPolicyVersion,
  Policy,
  PolicyAcceptance,
  PolicyAssignment,
  PolicyRule,
  PolicyVersion,
} from "./schema.js"
export {
  policies,
  policyAcceptances,
  policyAssignments,
  policyRules,
  policyVersions,
} from "./schema.js"
export type {
  CancellationResult,
  CancellationRule,
  CancellationSegment,
  SegmentedCancellationInput,
  SegmentedCancellationResult,
} from "./service.js"
export {
  evaluateCancellationPolicy,
  evaluateSegmentedCancellation,
  policiesService,
} from "./service.js"
export {
  evaluateCancellationInputSchema,
  insertPolicyAcceptanceSchema,
  insertPolicyAssignmentSchema,
  insertPolicyRuleSchema,
  insertPolicySchema,
  insertPolicyVersionSchema,
  policyAcceptanceListQuerySchema,
  policyAcceptanceMethodSchema,
  policyAssignmentListQuerySchema,
  policyAssignmentScopeSchema,
  policyKindSchema,
  policyListQuerySchema,
  policyRefundTypeSchema,
  policyRuleTypeSchema,
  policyVersionStatusSchema,
  resolvePolicyInputSchema,
  updatePolicyAssignmentSchema,
  updatePolicyRuleSchema,
  updatePolicySchema,
  updatePolicyVersionSchema,
} from "./validation.js"

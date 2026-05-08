import {
  getLegalPolicyAcceptancesQueryOptions as getLegalPolicyAcceptancesQueryOptionsFromPackage,
  getLegalPolicyAssignmentsQueryOptions as getLegalPolicyAssignmentsQueryOptionsFromPackage,
  getLegalPolicyQueryOptions as getLegalPolicyQueryOptionsFromPackage,
  getLegalPolicyVersionsQueryOptions as getLegalPolicyVersionsQueryOptionsFromPackage,
  type LegalPolicyAcceptanceRecord,
  type LegalPolicyRecord,
  type LegalPolicyVersionRecord,
} from "@voyantjs/legal-react"
import { legalQueryClient } from "./legal-query-client"

export type Policy = LegalPolicyRecord
export type PolicyVersion = LegalPolicyVersionRecord
export type Acceptance = LegalPolicyAcceptanceRecord

export function getLegalPolicyQueryOptions(id: string) {
  return getLegalPolicyQueryOptionsBase(id)
}

export function getLegalPolicyVersionsQueryOptions(id: string) {
  return getLegalPolicyVersionsQueryOptionsBase(id)
}

export function getLegalPolicyAssignmentsQueryOptions(id: string) {
  return getLegalPolicyAssignmentsQueryOptionsBase(id)
}

export function getLegalPolicyAcceptancesQueryOptions() {
  return getLegalPolicyAcceptancesQueryOptionsBase()
}

function getLegalPolicyQueryOptionsBase(id: string) {
  return getLegalPolicyQueryOptionsFromPackage(legalQueryClient, id)
}

function getLegalPolicyVersionsQueryOptionsBase(id: string) {
  return getLegalPolicyVersionsQueryOptionsFromPackage(legalQueryClient, { policyId: id })
}

function getLegalPolicyAssignmentsQueryOptionsBase(id: string) {
  return getLegalPolicyAssignmentsQueryOptionsFromPackage(legalQueryClient, { policyId: id })
}

function getLegalPolicyAcceptancesQueryOptionsBase() {
  return getLegalPolicyAcceptancesQueryOptionsFromPackage(legalQueryClient, {
    limit: 50,
    offset: 0,
  })
}

export const versionStatusVariant: Record<string, "default" | "secondary" | "outline"> = {
  draft: "outline",
  published: "default",
  retired: "secondary",
}

import type { Context } from "hono"

import { ForbiddenApiError } from "../validation.js"
import { requireCustomerIdentityContext } from "./require-customer-identity.js"

interface CustomerBuyerContextBase {
  userId: string
  buyerAccountId: string
}

export interface PersonalCustomerBuyerContext extends CustomerBuyerContextBase {
  kind: "personal"
  authOrganizationId: null
  relationshipOrganizationId: null
  relationshipPersonId: string | null
  membershipId: null
  membershipRole: null
}

export interface BusinessCustomerBuyerContext extends CustomerBuyerContextBase {
  kind: "business"
  authOrganizationId: string
  relationshipOrganizationId: string
  relationshipPersonId: null
  membershipId: string
  membershipRole: string
}

export type CustomerBuyerContext = PersonalCustomerBuyerContext | BusinessCustomerBuyerContext

/** Requires the provider-neutral, request-revalidated storefront buyer context. */
export function requireCustomerBuyerContext(c: Context): CustomerBuyerContext {
  const identity = requireCustomerIdentityContext(c)
  const userId = identity.userId
  const buyerAccountId = c.get("buyerAccountId")
  const kind = c.get("buyerAccountKind")
  if (!buyerAccountId || (kind !== "personal" && kind !== "business")) {
    throw new ForbiddenApiError("A customer buyer account must be selected")
  }

  if (kind === "personal") {
    return {
      userId,
      buyerAccountId,
      kind,
      authOrganizationId: null,
      relationshipOrganizationId: null,
      relationshipPersonId: identity.relationshipPersonId,
      membershipId: null,
      membershipRole: null,
    }
  }

  const authOrganizationId = c.get("authOrganizationId")
  const relationshipOrganizationId = c.get("relationshipOrganizationId")
  const membershipId = c.get("buyerMembershipId")
  const membershipRole = c.get("buyerMembershipRole")
  if (!authOrganizationId || !relationshipOrganizationId || !membershipId || !membershipRole) {
    throw new ForbiddenApiError("The business buyer membership is no longer available")
  }

  return {
    userId,
    buyerAccountId,
    kind,
    authOrganizationId,
    relationshipOrganizationId,
    relationshipPersonId: null,
    membershipId,
    membershipRole,
  }
}

export function requirePersonalCustomerBuyerContext(c: Context): PersonalCustomerBuyerContext {
  const buyer = requireCustomerBuyerContext(c)
  if (buyer.kind !== "personal") {
    throw new ForbiddenApiError("A personal buyer account is required")
  }
  return buyer
}

export function requireBusinessCustomerBuyerContext(c: Context): BusinessCustomerBuyerContext {
  const buyer = requireCustomerBuyerContext(c)
  if (buyer.kind !== "business") {
    throw new ForbiddenApiError("A business buyer account is required")
  }
  return buyer
}

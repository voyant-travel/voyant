import { describe, expect, it } from "vitest"

import {
  requireBusinessCustomerBuyerContext,
  requireCustomerBuyerContext,
  requirePersonalCustomerBuyerContext,
} from "../../src/auth/require-customer-buyer.js"
import { requireCustomerIdentityContext } from "../../src/auth/require-customer-identity.js"
import { ForbiddenApiError } from "../../src/validation.js"

function context(values: Record<string, unknown>) {
  return {
    get(key: string) {
      return values[key]
    },
  } as never
}

describe("customer buyer context guards", () => {
  it("allows customer identity surfaces without a selected buyer", () => {
    const c = context({
      realm: "customer",
      actor: "customer",
      userId: "b2b_only_user",
      sessionId: "session_1",
      email: "buyer@example.com",
      relationshipPersonId: null,
    })
    expect(requireCustomerIdentityContext(c)).toEqual({
      userId: "b2b_only_user",
      sessionId: "session_1",
      email: "buyer@example.com",
      relationshipPersonId: null,
    })
    expect(() => requireCustomerBuyerContext(c)).toThrow(ForbiddenApiError)
  })

  it("returns a discriminated personal context", () => {
    expect(
      requirePersonalCustomerBuyerContext(
        context({
          realm: "customer",
          actor: "customer",
          userId: "user_1",
          buyerAccountId: "personal:user_1",
          buyerAccountKind: "personal",
          relationshipPersonId: "person_1",
        }),
      ),
    ).toEqual({
      userId: "user_1",
      buyerAccountId: "personal:user_1",
      kind: "personal",
      authOrganizationId: null,
      relationshipOrganizationId: null,
      relationshipPersonId: "person_1",
      membershipId: null,
      membershipRole: null,
    })
  })

  it("fails closed when a business mapping or membership is incomplete", () => {
    expect(() =>
      requireCustomerBuyerContext(
        context({
          realm: "customer",
          actor: "customer",
          userId: "user_1",
          buyerAccountId: "business:auth_org_1",
          buyerAccountKind: "business",
          authOrganizationId: "auth_org_1",
        }),
      ),
    ).toThrow(ForbiddenApiError)
  })

  it("rejects a valid personal context on a business-only route", () => {
    expect(() =>
      requireBusinessCustomerBuyerContext(
        context({
          realm: "customer",
          actor: "customer",
          userId: "user_1",
          buyerAccountId: "personal:user_1",
          buyerAccountKind: "personal",
        }),
      ),
    ).toThrow(ForbiddenApiError)
  })
})

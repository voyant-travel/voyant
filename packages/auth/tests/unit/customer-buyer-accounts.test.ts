import { describe, expect, it } from "vitest"

import {
  businessBuyerAccountId,
  type CustomerBusinessMembership,
  type CustomerBuyerAccountStore,
  listCustomerBuyerAccounts,
  normalizeCustomerBuyerAccountPolicy,
  personalBuyerAccountId,
  resolveActiveCustomerBuyerContext,
  selectCustomerBuyerAccount,
} from "../../src/customer-buyer-accounts.js"

function memoryStore(input?: {
  personalUsers?: string[]
  memberships?: Record<string, CustomerBusinessMembership[]>
}): CustomerBuyerAccountStore {
  const personalUsers = new Set(input?.personalUsers ?? [])
  const memberships = input?.memberships ?? {}
  return {
    async hasActivePersonalAccount(userId) {
      return personalUsers.has(userId)
    },
    async getRelationshipPersonId() {
      return null
    },
    async listBusinessMemberships(userId) {
      return memberships[userId] ?? []
    },
  }
}

const identity = { userId: "user_1", name: "Mina", email: "mina@example.com" }
const businessMembership = {
  id: "member_1",
  authOrganizationId: "auth_org_1",
  relationshipOrganizationId: "org_1",
  name: "Acme Travel",
  role: "owner",
} satisfies CustomerBusinessMembership

describe("customer buyer accounts", () => {
  it("preserves the B2C default for identities with a durable personal entitlement", async () => {
    const result = await listCustomerBuyerAccounts({
      identity,
      activeAuthOrganizationId: null,
      store: memoryStore({ personalUsers: [identity.userId] }),
    })

    expect(result.policy).toEqual({
      allowedKinds: ["personal"],
      personalSignup: "open",
      businessOnboarding: "disabled",
    })
    expect(result.activeAccount).toMatchObject({
      id: personalBuyerAccountId(identity.userId),
      kind: "personal",
    })
  })

  it("does not give a B2B invite identity an implicit personal buyer context", async () => {
    const store = memoryStore({
      memberships: { [identity.userId]: [businessMembership] },
    })
    const policy = {
      allowedKinds: ["business"] as const,
      personalSignup: "disabled" as const,
      businessOnboarding: "invite-only" as const,
    }

    await expect(
      resolveActiveCustomerBuyerContext({
        identity,
        activeAuthOrganizationId: null,
        policy,
        store,
      }),
    ).resolves.toBeNull()

    await expect(
      resolveActiveCustomerBuyerContext({
        identity,
        activeAuthOrganizationId: businessMembership.authOrganizationId,
        policy,
        store,
      }),
    ).resolves.toMatchObject({
      kind: "business",
      relationshipOrganizationId: "org_1",
      membershipId: "member_1",
    })
  })

  it("supports explicit switching between personal and business contexts in hybrid mode", async () => {
    const store = memoryStore({
      personalUsers: [identity.userId],
      memberships: { [identity.userId]: [businessMembership] },
    })
    const policy = {
      allowedKinds: ["personal", "business"] as const,
      personalSignup: "open" as const,
      businessOnboarding: "open" as const,
    }

    await expect(
      selectCustomerBuyerAccount({
        accountId: businessBuyerAccountId(businessMembership.authOrganizationId),
        identity,
        activeAuthOrganizationId: null,
        policy,
        store,
      }),
    ).resolves.toMatchObject({ kind: "business", authOrganizationId: "auth_org_1" })
    await expect(
      selectCustomerBuyerAccount({
        accountId: personalBuyerAccountId(identity.userId),
        identity,
        activeAuthOrganizationId: businessMembership.authOrganizationId,
        policy,
        store,
      }),
    ).resolves.toMatchObject({ kind: "personal", authOrganizationId: null })
  })

  it("fails closed for revoked membership instead of falling back to personal", async () => {
    const store = memoryStore({ personalUsers: [identity.userId] })
    await expect(
      resolveActiveCustomerBuyerContext({
        identity,
        activeAuthOrganizationId: businessMembership.authOrganizationId,
        policy: {
          allowedKinds: ["personal", "business"],
          personalSignup: "open",
          businessOnboarding: "invite-only",
        },
        store,
      }),
    ).resolves.toBeNull()
  })

  it("does not expose another customer's business membership", async () => {
    const store = memoryStore({ memberships: { user_2: [businessMembership] } })
    await expect(
      selectCustomerBuyerAccount({
        accountId: businessBuyerAccountId(businessMembership.authOrganizationId),
        identity,
        activeAuthOrganizationId: null,
        policy: {
          allowedKinds: ["business"],
          personalSignup: "disabled",
          businessOnboarding: "invite-only",
        },
        store,
      }),
    ).resolves.toBeNull()
  })

  it("rejects memberships without a canonical Relationships Organization mapping", async () => {
    const store = memoryStore({
      memberships: {
        [identity.userId]: [{ ...businessMembership, relationshipOrganizationId: null }],
      },
    })
    const result = await listCustomerBuyerAccounts({
      identity,
      activeAuthOrganizationId: businessMembership.authOrganizationId,
      policy: {
        allowedKinds: ["business"],
        personalSignup: "disabled",
        businessOnboarding: "invite-only",
      },
      store,
    })
    expect(result).toMatchObject({ accounts: [], activeAccount: null, requiresSelection: true })
  })

  it("canonicalizes order but rejects invalid security capabilities", () => {
    expect(
      normalizeCustomerBuyerAccountPolicy({
        allowedKinds: ["business", "personal"],
        personalSignup: "open",
        businessOnboarding: "invite-only",
      }),
    ).toEqual({
      allowedKinds: ["personal", "business"],
      personalSignup: "open",
      businessOnboarding: "invite-only",
    })
    expect(() =>
      normalizeCustomerBuyerAccountPolicy({
        allowedKinds: ["business", "personal", "business"],
        personalSignup: "open",
        businessOnboarding: "disabled",
      }),
    ).toThrow()
    expect(() =>
      normalizeCustomerBuyerAccountPolicy({
        allowedKinds: [],
        personalSignup: "disabled",
        businessOnboarding: "disabled",
      }),
    ).toThrow()
    expect(() =>
      normalizeCustomerBuyerAccountPolicy({
        allowedKinds: ["business"],
        personalSignup: "disabled",
        businessOnboarding: "disabled",
      }),
    ).toThrow()
  })
})

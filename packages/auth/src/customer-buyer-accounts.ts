import {
  customerAuthMember,
  customerAuthOrganization,
  customerAuthPersonalBuyerAccount,
  customerAuthUser,
} from "@voyant-travel/db/schema/iam"
import type { VoyantDb } from "@voyant-travel/hono"
import { asc, eq } from "drizzle-orm"
import { z } from "zod"

export const customerBuyerAccountKinds = ["personal", "business"] as const
export type CustomerBuyerAccountKind = (typeof customerBuyerAccountKinds)[number]
export type CustomerPersonalSignup = "open" | "disabled"
export type CustomerBusinessOnboarding = "disabled" | "open" | "request" | "invite-only"

export interface CustomerBuyerAccountPolicy {
  allowedKinds: readonly CustomerBuyerAccountKind[]
  personalSignup: CustomerPersonalSignup
  businessOnboarding: CustomerBusinessOnboarding
}

export const defaultCustomerBuyerAccountPolicy = {
  allowedKinds: ["personal"],
  personalSignup: "open",
  businessOnboarding: "disabled",
} as const satisfies CustomerBuyerAccountPolicy

export const customerBuyerAccountPolicySchema = z
  .object({
    allowedKinds: z.array(z.enum(customerBuyerAccountKinds)).min(1).max(2),
    personalSignup: z.enum(["open", "disabled"]),
    businessOnboarding: z.enum(["disabled", "open", "request", "invite-only"]),
  })
  .strict()
  .superRefine((policy, ctx) => {
    if (new Set(policy.allowedKinds).size !== policy.allowedKinds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["allowedKinds"],
        message: "allowedKinds must be unique",
      })
    }
    if (!policy.allowedKinds.includes("personal") && policy.personalSignup !== "disabled") {
      ctx.addIssue({
        code: "custom",
        path: ["personalSignup"],
        message: "personalSignup must be disabled when personal accounts are not allowed",
      })
    }
    if (policy.allowedKinds.includes("business") === (policy.businessOnboarding === "disabled")) {
      ctx.addIssue({
        code: "custom",
        path: ["businessOnboarding"],
        message:
          "businessOnboarding must be disabled exactly when business accounts are not allowed",
      })
    }
  })

export function normalizeCustomerBuyerAccountPolicy(input?: unknown): CustomerBuyerAccountPolicy {
  if (input === undefined || input === null) {
    return { ...defaultCustomerBuyerAccountPolicy }
  }
  const parsed = customerBuyerAccountPolicySchema.parse(input)
  return {
    ...parsed,
    allowedKinds: customerBuyerAccountKinds.filter((kind) => parsed.allowedKinds.includes(kind)),
  }
}

export function personalBuyerAccountId(userId: string): string {
  return `personal:${userId}`
}

export function businessBuyerAccountId(authOrganizationId: string): string {
  return `business:${authOrganizationId}`
}

export interface CustomerIdentitySummary {
  userId: string
  name: string | null
  email: string | null
}

export interface CustomerBusinessMembership {
  id: string
  authOrganizationId: string
  relationshipOrganizationId: string | null
  name: string
  role: string
}

export interface CustomerBuyerAccountStore {
  hasActivePersonalAccount(userId: string): Promise<boolean>
  getRelationshipPersonId(userId: string): Promise<string | null>
  listBusinessMemberships(userId: string): Promise<CustomerBusinessMembership[]>
}

interface CustomerBuyerAccountBase {
  id: string
  name: string
}

export interface PersonalCustomerBuyerAccount extends CustomerBuyerAccountBase {
  kind: "personal"
  authOrganizationId: null
  relationshipOrganizationId: null
  relationshipPersonId: string | null
  membershipId: null
  membershipRole: null
}

export interface BusinessCustomerBuyerAccount extends CustomerBuyerAccountBase {
  kind: "business"
  authOrganizationId: string
  relationshipOrganizationId: string
  relationshipPersonId: null
  membershipId: string
  membershipRole: string
}

export type CustomerBuyerAccount = PersonalCustomerBuyerAccount | BusinessCustomerBuyerAccount

export type ActiveCustomerBuyerContext = CustomerBuyerAccount & { userId: string }

export interface CustomerBuyerAccountList {
  accounts: CustomerBuyerAccount[]
  activeAccount: CustomerBuyerAccount | null
  policy: CustomerBuyerAccountPolicy
  requiresSelection: boolean
}

function personalAccount(
  identity: CustomerIdentitySummary,
  relationshipPersonId: string | null,
): PersonalCustomerBuyerAccount {
  return {
    id: personalBuyerAccountId(identity.userId),
    kind: "personal",
    name: identity.name?.trim() || identity.email?.trim() || "Personal account",
    authOrganizationId: null,
    relationshipOrganizationId: null,
    relationshipPersonId,
    membershipId: null,
    membershipRole: null,
  }
}

function businessAccount(
  membership: CustomerBusinessMembership & { relationshipOrganizationId: string },
): BusinessCustomerBuyerAccount {
  return {
    id: businessBuyerAccountId(membership.authOrganizationId),
    kind: "business",
    name: membership.name,
    authOrganizationId: membership.authOrganizationId,
    relationshipOrganizationId: membership.relationshipOrganizationId,
    relationshipPersonId: null,
    membershipId: membership.id,
    membershipRole: membership.role,
  }
}

function businessAccountsEnabled(policy: CustomerBuyerAccountPolicy): boolean {
  return policy.allowedKinds.includes("business")
}

function hasRelationshipOrganization(
  membership: CustomerBusinessMembership,
): membership is CustomerBusinessMembership & { relationshipOrganizationId: string } {
  return Boolean(membership.relationshipOrganizationId)
}

/**
 * Lists only usable buyer contexts. An unmapped Better Auth organization is
 * intentionally omitted because it is not a canonical business buyer.
 */
export async function listCustomerBuyerAccounts(input: {
  identity: CustomerIdentitySummary
  activeAuthOrganizationId: string | null
  policy?: Partial<CustomerBuyerAccountPolicy> | null
  store: CustomerBuyerAccountStore
}): Promise<CustomerBuyerAccountList> {
  const policy = normalizeCustomerBuyerAccountPolicy(input.policy)
  const accounts: CustomerBuyerAccount[] = []

  if (policy.allowedKinds.includes("personal")) {
    if (await input.store.hasActivePersonalAccount(input.identity.userId)) {
      accounts.push(
        personalAccount(
          input.identity,
          await input.store.getRelationshipPersonId(input.identity.userId),
        ),
      )
    }
  }

  if (businessAccountsEnabled(policy)) {
    const memberships = await input.store.listBusinessMemberships(input.identity.userId)
    accounts.push(...memberships.filter(hasRelationshipOrganization).map(businessAccount))
  }

  const activeAccount = input.activeAuthOrganizationId
    ? (accounts.find((account) => account.authOrganizationId === input.activeAuthOrganizationId) ??
      null)
    : (accounts.find((account) => account.kind === "personal") ?? null)

  return {
    accounts,
    activeAccount,
    policy,
    requiresSelection: activeAccount === null,
  }
}

/** Revalidates the active Better Auth organization against live membership. */
export async function resolveActiveCustomerBuyerContext(input: {
  identity: CustomerIdentitySummary
  activeAuthOrganizationId: string | null
  policy?: Partial<CustomerBuyerAccountPolicy> | null
  store: CustomerBuyerAccountStore
}): Promise<ActiveCustomerBuyerContext | null> {
  const listed = await listCustomerBuyerAccounts(input)
  return listed.activeAccount ? { ...listed.activeAccount, userId: input.identity.userId } : null
}

/** Validates a requested account without trusting a client-supplied organization id. */
export async function selectCustomerBuyerAccount(input: {
  accountId: string
  identity: CustomerIdentitySummary
  activeAuthOrganizationId: string | null
  policy?: Partial<CustomerBuyerAccountPolicy> | null
  store: CustomerBuyerAccountStore
}): Promise<CustomerBuyerAccount | null> {
  const listed = await listCustomerBuyerAccounts(input)
  return listed.accounts.find((account) => account.id === input.accountId) ?? null
}

export function createDrizzleCustomerBuyerAccountStore(db: VoyantDb): CustomerBuyerAccountStore {
  return {
    async hasActivePersonalAccount(userId) {
      const [row] = await db
        .select({ revokedAt: customerAuthPersonalBuyerAccount.revokedAt })
        .from(customerAuthPersonalBuyerAccount)
        .where(eq(customerAuthPersonalBuyerAccount.userId, userId))
        .limit(1)
      return row?.revokedAt === null
    },
    async getRelationshipPersonId(userId) {
      const [row] = await db
        .select({ relationshipPersonId: customerAuthUser.relationshipPersonId })
        .from(customerAuthUser)
        .where(eq(customerAuthUser.id, userId))
        .limit(1)
      return row?.relationshipPersonId ?? null
    },
    async listBusinessMemberships(userId) {
      return db
        .select({
          id: customerAuthMember.id,
          authOrganizationId: customerAuthMember.organizationId,
          relationshipOrganizationId: customerAuthOrganization.relationshipOrganizationId,
          name: customerAuthOrganization.name,
          role: customerAuthMember.role,
        })
        .from(customerAuthMember)
        .innerJoin(
          customerAuthOrganization,
          eq(customerAuthOrganization.id, customerAuthMember.organizationId),
        )
        .where(eq(customerAuthMember.userId, userId))
        .orderBy(asc(customerAuthOrganization.name), asc(customerAuthMember.createdAt))
    },
  }
}

/**
 * Lazily and idempotently materializes the entitlement from the immutable
 * eligibility stamp. Current policy changes cannot grant an entitlement
 * retroactively, and revoked rows are never revived.
 */
export async function repairCustomerPersonalBuyerAccountEntitlement(
  db: VoyantDb,
  userId: string,
): Promise<boolean> {
  const [candidate] = await db
    .select({
      eligible: customerAuthUser.personalBuyerEntitlementEligible,
      entitlementUserId: customerAuthPersonalBuyerAccount.userId,
    })
    .from(customerAuthUser)
    .leftJoin(
      customerAuthPersonalBuyerAccount,
      eq(customerAuthPersonalBuyerAccount.userId, customerAuthUser.id),
    )
    .where(eq(customerAuthUser.id, userId))
    .limit(1)

  if (!candidate?.eligible || candidate.entitlementUserId) return false

  await db.insert(customerAuthPersonalBuyerAccount).values({ userId }).onConflictDoNothing()
  return true
}

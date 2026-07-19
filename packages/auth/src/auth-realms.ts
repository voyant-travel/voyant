/** Provider-neutral identities crossing the auth/runtime boundary. */
export type AuthRealm = "admin" | "customer"

interface PrincipalBase {
  realm: AuthRealm
  userId: string
  sessionId: string
  email: string | null
}

export interface AdminPrincipal extends PrincipalBase {
  realm: "admin"
  actor: "staff"
  scopes: readonly string[]
}

interface CustomerPrincipalBase extends PrincipalBase {
  realm: "customer"
  actor: "customer"
  buyerAccountId: string
}

export interface CustomerIdentityPrincipal extends PrincipalBase {
  realm: "customer"
  actor: "customer"
  buyerAccountId: null
  buyerAccountKind: null
  authOrganizationId: null
  relationshipOrganizationId: null
  relationshipPersonId: string | null
  membershipId: null
  membershipRole: null
}

export interface PersonalCustomerPrincipal extends CustomerPrincipalBase {
  buyerAccountKind: "personal"
  authOrganizationId: null
  relationshipOrganizationId: null
  relationshipPersonId: string | null
  membershipId: null
  membershipRole: null
}

export interface BusinessCustomerPrincipal extends CustomerPrincipalBase {
  buyerAccountKind: "business"
  authOrganizationId: string
  relationshipOrganizationId: string
  /** Identity Person remains independent from the selected business buyer. */
  relationshipPersonId: string | null
  membershipId: string
  membershipRole: string
}

export type CustomerPrincipal =
  | CustomerIdentityPrincipal
  | PersonalCustomerPrincipal
  | BusinessCustomerPrincipal

export type AuthPrincipal = AdminPrincipal | CustomerPrincipal

/** Complete session replacement seam for advanced self-host integrations. */
export interface AuthRealmSessionPort<Context = unknown> {
  readonly realm: AuthRealm
  resolve(request: Request, context: Context): Promise<AuthPrincipal | null>
  signOut(request: Request, context: Context): Promise<Response>
  revokeUserSessions(userId: string, context: Context): Promise<void>
}

export interface ExternalIdentity {
  providerId: string
  providerAccountId: string
  email: string | null
  emailVerified: boolean
  name: string | null
  image: string | null
}

/**
 * Preferred external-IdP seam. Auth0, Clerk, WorkOS, or generic OIDC adapters
 * verify their assertion here; Better Auth remains the local session issuer.
 */
export interface ExternalIdentityAdapter<Input, Context = unknown> {
  readonly id: string
  resolve(input: Input, context: Context): Promise<ExternalIdentity>
  revalidate?(identity: ExternalIdentity, context: Context): Promise<boolean>
}

export interface BetterAuthIdentityBridge<Context = unknown> {
  createSession(identity: ExternalIdentity, context: Context): Promise<Response>
}

export function createExternalIdentitySessionAdapter<Input, Context = unknown>(
  identityAdapter: ExternalIdentityAdapter<Input, Context>,
  betterAuthBridge: BetterAuthIdentityBridge<Context>,
) {
  return {
    id: identityAdapter.id,
    async authenticate(input: Input, context: Context): Promise<Response> {
      const identity = await identityAdapter.resolve(input, context)
      if (identityAdapter.revalidate && !(await identityAdapter.revalidate(identity, context))) {
        return Response.json({ error: "External identity access was revoked" }, { status: 403 })
      }
      return betterAuthBridge.createSession(identity, context)
    },
  }
}

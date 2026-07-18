export type VoyantCallerType = "session" | "api_key" | "internal" | "app"

/**
 * Who the request represents. Routes under `/v1/admin/*` expect `"staff"`;
 * `/v1/public/*` expects customer/partner/supplier actors.
 *
 * When unset, middleware treats the request as `"staff"` to preserve
 * backwards compatibility with internal-only deployments.
 */
export type Actor = "staff" | "customer" | "partner" | "supplier"

/** Immutable host context carried by an online token minted for an app extension. */
export interface VoyantAppContextConstraint {
  entity: { type: string; id: string } | null
  slot: string | null
}

export interface VoyantAuthContext {
  userId?: string
  sessionId?: string
  organizationId?: string | null
  callerType?: VoyantCallerType
  actor?: Actor
  /**
   * The audience this grant represents (`staff`/`customer`/`partner`/`supplier`).
   * Carried on the api-key grant / token claims, not inferred from scopes, and
   * resolved into the catalog `ResolverScope` at request time. When unset,
   * middleware falls back to `actor`.
   */
  audience?: Actor
  scopes?: string[] | null
  isInternalRequest?: boolean
  apiTokenId?: string
  apiKeyId?: string
  appId?: string
  appInstallationId?: string
  appReleaseId?: string
  appCredentialGeneration?: number
  /** Stable managed workload-environment identity resolved from app credential state. */
  appWorkloadEnvironmentId?: string
  /** Host contract generation bound to the resolved app credential. */
  appContractGeneration?: number
  appTokenMode?: "offline" | "online"
  appViewerId?: string
  appContextConstraint?: VoyantAppContextConstraint
  email?: string | null
}

export interface VoyantPermission {
  resource: string
  action: string
}

export type VoyantVariables = VoyantAuthContext & {
  db: unknown
}

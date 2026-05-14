export type VoyantCallerType = "session" | "api_key" | "internal"

/**
 * Who the request represents. Routes under `/v1/admin/*` expect `"staff"`;
 * `/v1/public/*` expects customer/partner/supplier actors.
 *
 * When unset, middleware treats the request as `"staff"` to preserve
 * backwards compatibility with internal-only deployments.
 */
export type Actor = "staff" | "customer" | "partner" | "supplier"

export interface VoyantAuthContext {
  userId?: string
  sessionId?: string
  organizationId?: string | null
  callerType?: VoyantCallerType
  actor?: Actor
  scopes?: string[] | null
  isInternalRequest?: boolean
  apiTokenId?: string
  apiKeyId?: string
  email?: string | null
}

export interface VoyantPermission {
  resource: string
  action: string
}

export type VoyantVariables = VoyantAuthContext & {
  db: unknown
}

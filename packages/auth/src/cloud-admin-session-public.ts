import type { getDb } from "@voyant-travel/db"
import type { BetterAuthPlugin } from "better-auth/types"

import type {
  CloudAdminAssertion,
  CloudAdminAuthExchangeConfig,
  CloudAdminAuthRevalidateConfig,
} from "./cloud-broker.js"

export type CloudAdminProvisionedUser = {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image?: string | null
  createdAt: Date
  updatedAt: Date
}

export type CloudAdminUserProvisioningInput = {
  db: ReturnType<typeof getDb>
  assertion: CloudAdminAssertion
  user: CloudAdminProvisionedUser
  isNewUser: boolean
  provider: {
    providerId: "voyant-cloud"
    providerAccountId: string
  }
}

export type CloudAdminUserProvisioningHandler = (
  input: CloudAdminUserProvisioningInput,
) => Promise<void> | void

export interface VoyantCloudAdminAuthPluginOptions {
  db: ReturnType<typeof getDb>
  cookieSecret: string
  /** Whether the externally visible callback is HTTPS, even behind an HTTP proxy hop. */
  secureStateCookie?: boolean
  exchange: CloudAdminAuthExchangeConfig
  fetch?: typeof fetch
  revalidateAfterSeconds?: number
  onUserProvisioning?: CloudAdminUserProvisioningHandler
}

export declare function createVoyantCloudAdminAuthPlugin(
  options: VoyantCloudAdminAuthPluginOptions,
): BetterAuthPlugin

export type VoyantCloudAdminSessionRevalidationInput = {
  db: ReturnType<typeof getDb>
  sessionId: string
  config: CloudAdminAuthRevalidateConfig
  fetch?: typeof fetch
  now?: Date
  revalidateAfterSeconds?: number
}

export type VoyantCloudAdminSessionRevalidationResult =
  | {
      ok: true
      status: "active" | "cached"
    }
  | {
      ok: false
      status: "revoked"
      reason?: string
    }

export declare function revalidateVoyantCloudAdminAuthSession(
  input: VoyantCloudAdminSessionRevalidationInput,
): Promise<VoyantCloudAdminSessionRevalidationResult>

export type VoyantCloudAdminUserRevalidationInput = {
  db: ReturnType<typeof getDb>
  userId: string
  config: CloudAdminAuthRevalidateConfig
  fetch?: typeof fetch
  now?: Date
  revalidateAfterSeconds?: number
}

export type VoyantCloudAdminUserRevalidationResult =
  | {
      ok: true
      status: "active" | "cached"
    }
  | {
      ok: false
      status: "revoked"
      reason?: string
    }

export declare function revalidateVoyantCloudAdminAuthUser(
  input: VoyantCloudAdminUserRevalidationInput,
): Promise<VoyantCloudAdminUserRevalidationResult>

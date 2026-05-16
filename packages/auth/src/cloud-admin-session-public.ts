import type { getDb } from "@voyantjs/db"
import type { BetterAuthPlugin } from "better-auth/types"

import type { CloudAdminAssertion, CloudAdminAuthExchangeConfig } from "./cloud-broker.js"

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
  exchange: CloudAdminAuthExchangeConfig
  fetch?: typeof fetch
  revalidateAfterSeconds?: number
  onUserProvisioning?: CloudAdminUserProvisioningHandler
}

export declare function createVoyantCloudAdminAuthPlugin(
  options: VoyantCloudAdminAuthPluginOptions,
): BetterAuthPlugin

import type { getDb } from "@voyantjs/db"
import type { BetterAuthPlugin } from "better-auth/types"

import type { CloudAdminAuthExchangeConfig } from "./cloud-broker.js"

export interface VoyantCloudAdminAuthPluginOptions {
  db: ReturnType<typeof getDb>
  cookieSecret: string
  exchange: CloudAdminAuthExchangeConfig
  fetch?: typeof fetch
  revalidateAfterSeconds?: number
}

export declare function createVoyantCloudAdminAuthPlugin(
  options: VoyantCloudAdminAuthPluginOptions,
): BetterAuthPlugin

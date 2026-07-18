export type VoyantDeploymentMode = "managed-cloud" | "self-hosted" | "local"

export type VoyantDeploymentProviderRole =
  | "database"
  | "storage"
  | "cache"
  | "sharedState"
  | "rateLimit"
  | "search"
  | "email"
  | "sms"
  | "adminAuth"
  | "customerAuth"
  | "realtime"
  | "scheduledJobs"
  | "workflows"
  | "outboundWebhooks"
  | "payments"

export interface VoyantDeploymentProviders {
  database: "postgres"
  storage: "s3-compatible" | "memory" | "custom"
  cache: "redis" | "postgres" | "platform" | "memory"
  sharedState: "redis" | "postgres" | "platform" | "memory"
  rateLimit: "redis" | "postgres" | "platform" | "memory"
  search: "typesense" | "algolia" | "custom" | "none"
  email: "voyant-cloud" | "resend" | "sendgrid" | "smtp" | "none"
  sms: "voyant-cloud" | "twilio" | "none"
  adminAuth: "voyant-cloud" | "better-auth"
  customerAuth: "better-auth" | "disabled"
  /** @deprecated Compatibility alias for adminAuth. */
  auth?: "voyant-cloud" | "better-auth"
  realtime: "voyant-cloud" | "local" | "custom" | "none"
  scheduledJobs: "cloud-scheduler" | "node-cron" | "none"
  workflows: "voyant-cloud" | "self-hosted" | "none"
  outboundWebhooks: "postgres" | "host" | "none"
  payments: "voyant-payments" | "netopia" | "custom" | "none"
}

export type VoyantDeploymentEnvValueFormat = "postgres-url" | "redis-url" | "http-url"

export interface VoyantDeploymentEnvRequirement {
  name: string
  aliases?: readonly string[]
  format?: VoyantDeploymentEnvValueFormat
  kind: "secret" | "variable" | "binding"
  required: boolean
  description: string
}

export interface VoyantDeploymentResourceRequirement {
  resourceKey: string
  roles: readonly VoyantDeploymentProviderRole[]
  provider: string
  required: boolean
  env: readonly VoyantDeploymentEnvRequirement[]
  notes?: string
}

export const DEFAULT_MANAGED_CLOUD_PROVIDERS = {
  database: "postgres",
  storage: "s3-compatible",
  cache: "redis",
  sharedState: "redis",
  rateLimit: "redis",
  search: "typesense",
  email: "voyant-cloud",
  sms: "voyant-cloud",
  adminAuth: "voyant-cloud",
  customerAuth: "better-auth",
  auth: "voyant-cloud",
  realtime: "voyant-cloud",
  scheduledJobs: "cloud-scheduler",
  workflows: "voyant-cloud",
  outboundWebhooks: "postgres",
  payments: "none",
} as const satisfies VoyantDeploymentProviders

export const DEPLOYMENT_PROVIDER_CONTRACTS = {
  database: ["postgres"],
  storage: ["s3-compatible", "memory", "custom"],
  cache: ["redis", "postgres", "platform", "memory"],
  sharedState: ["redis", "postgres", "platform", "memory"],
  rateLimit: ["redis", "postgres", "platform", "memory"],
  search: ["typesense", "algolia", "custom", "none"],
  email: ["voyant-cloud", "resend", "sendgrid", "smtp", "none"],
  sms: ["voyant-cloud", "twilio", "none"],
  adminAuth: ["voyant-cloud", "better-auth"],
  customerAuth: ["better-auth", "disabled"],
  realtime: ["voyant-cloud", "local", "custom", "none"],
  scheduledJobs: ["cloud-scheduler", "node-cron", "none"],
  workflows: ["voyant-cloud", "self-hosted", "none"],
  outboundWebhooks: ["postgres", "host", "none"],
  payments: ["voyant-payments", "netopia", "custom", "none"],
} as const satisfies Record<VoyantDeploymentProviderRole, readonly string[]>

export const DEPLOYMENT_PROVIDER_ROLES = Object.keys(
  DEPLOYMENT_PROVIDER_CONTRACTS,
) as VoyantDeploymentProviderRole[]

/**
 * Resolve the auth realms from a deployment graph. `auth` is the v1
 * compatibility alias for `adminAuth`; customer auth remained local in that
 * model, so an aliased graph defaults its customer realm to Better Auth.
 */
export function resolveDeploymentAuthProviders(
  providers: Readonly<Record<string, string | undefined>>,
): { adminAuth: string | undefined; customerAuth: string | undefined } {
  return {
    adminAuth: providers.adminAuth ?? providers.auth,
    customerAuth: providers.customerAuth ?? (providers.auth ? "better-auth" : undefined),
  }
}

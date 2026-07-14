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
  | "auth"
  | "scheduledJobs"
  | "workflows"
  | "outboundWebhooks"

export interface VoyantDeploymentProviders {
  database: "postgres"
  storage: "s3-compatible" | "memory" | "custom"
  cache: "redis" | "postgres" | "platform" | "memory"
  sharedState: "redis" | "postgres" | "platform" | "memory"
  rateLimit: "redis" | "postgres" | "platform" | "memory"
  search: "typesense" | "algolia" | "custom" | "none"
  email: "voyant-cloud" | "resend" | "sendgrid" | "smtp" | "none"
  sms: "voyant-cloud" | "twilio" | "none"
  auth: "voyant-cloud" | "better-auth"
  scheduledJobs: "cloud-scheduler" | "node-cron" | "none"
  workflows: "voyant-cloud" | "self-hosted" | "none"
  outboundWebhooks: "postgres" | "host" | "none"
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
  auth: "voyant-cloud",
  scheduledJobs: "cloud-scheduler",
  workflows: "voyant-cloud",
  outboundWebhooks: "postgres",
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
  auth: ["voyant-cloud", "better-auth"],
  scheduledJobs: ["cloud-scheduler", "node-cron", "none"],
  workflows: ["voyant-cloud", "self-hosted", "none"],
  outboundWebhooks: ["postgres", "host", "none"],
} as const satisfies Record<VoyantDeploymentProviderRole, readonly string[]>

export const DEPLOYMENT_PROVIDER_ROLES = Object.keys(
  DEPLOYMENT_PROVIDER_CONTRACTS,
) as VoyantDeploymentProviderRole[]

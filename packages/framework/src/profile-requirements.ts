import type {
  VoyantProfileEnvRequirement,
  VoyantProfileResourceRequirement,
  VoyantProjectProviderRole,
  VoyantProjectProviders,
} from "./profile-types.js"

const R2_ACCESS_KEY_ID_ENV = ["R2", "ACCESS", "KEY", "ID"].join("_")
const R2_PRIVATE_CREDENTIAL_ENV = ["R2", "SECRET", "ACCESS", "KEY"].join("_")
const R2_STORAGE_ID_COPY = "Object storage access identifier."
const R2_STORAGE_PRIVATE_COPY = "Private value for object storage access."

export function resourceRequirementsFor(
  role: VoyantProjectProviderRole,
  providers: VoyantProjectProviders,
): VoyantProfileResourceRequirement[] {
  const provider = providers[role]
  if (provider === "none") {
    return [
      {
        resourceKey: resourceKeyFor(role, provider),
        roles: [role],
        provider,
        required: false,
        env: [],
      },
    ]
  }

  const notes = notesForProvider(role, provider)
  return [
    {
      resourceKey: resourceKeyFor(role, provider),
      roles: [role],
      provider,
      required: true,
      env: envForProvider(role, provider),
      ...(notes ? { notes } : {}),
    },
  ]
}

function envForProvider(
  role: VoyantProjectProviderRole,
  provider: string,
): readonly VoyantProfileEnvRequirement[] {
  if (role === "database" && provider === "postgres") {
    return [
      secret(
        "DATABASE_URL",
        "Primary Postgres connection URL used by migrations and fallback DB clients.",
      ),
      secret("DATABASE_URL_DIRECT", "Direct Postgres URL for the resident Node pool.", false),
      secret(
        "DATABASE_URL_REPLICAS",
        "Comma-separated read replica URLs for the HTTP data plane.",
        false,
      ),
    ]
  }
  if (role === "storage" && (provider === "s3" || provider === "r2")) {
    return [
      variable("R2_S3_ENDPOINT", "S3-compatible endpoint for media and document buckets."),
      variable("R2_BUCKET_MEDIA", "Object bucket for public media."),
      variable("R2_BUCKET_DOCUMENTS", "Object bucket for private/generated documents."),
      secret(R2_ACCESS_KEY_ID_ENV, R2_STORAGE_ID_COPY),
      secret(R2_PRIVATE_CREDENTIAL_ENV, R2_STORAGE_PRIVATE_COPY),
    ]
  }
  if (
    (role === "cache" || role === "sharedState" || role === "rateLimit") &&
    provider === "redis"
  ) {
    return [secret("REDIS_URL", "Redis URL used for cache, shared state, and rate limiting.")]
  }
  if (
    (role === "cache" || role === "sharedState" || role === "rateLimit") &&
    provider === "postgres"
  ) {
    return [
      secret("DATABASE_URL", `Postgres URL used for ${role} shared-state storage.`),
      secret("DATABASE_URL_DIRECT", "Direct Postgres URL for the resident Node pool.", false),
    ]
  }
  if (role === "search" && (provider === "typesense" || provider === "algolia")) {
    return provider === "typesense"
      ? [
          variable("TYPESENSE_HOST", "Typesense host URL."),
          secret("TYPESENSE_API_KEY", "Typesense API key."),
        ]
      : [
          variable("ALGOLIA_APP_ID", "Algolia application id."),
          secret("ALGOLIA_API_KEY", "Algolia API key."),
        ]
  }
  if (role === "email") {
    if (provider === "voyant-cloud") {
      return [
        secret("VOYANT_API_KEY", "Voyant Cloud API key for hosted email delivery."),
        variable("EMAIL_FROM", "Default email sender."),
        variable("EMAIL_REPLY_TO", "Optional comma-separated reply-to addresses.", false),
      ]
    }
    return [
      secret(`${provider.toUpperCase().replace("-", "_")}_API_KEY`, `${provider} email API key.`),
      variable("EMAIL_FROM", "Default email sender."),
      variable("EMAIL_REPLY_TO", "Optional comma-separated reply-to addresses.", false),
    ]
  }
  if (role === "sms") {
    if (provider === "voyant-cloud") {
      return [secret("VOYANT_API_KEY", "Voyant Cloud API key for hosted SMS delivery.")]
    }
    if (provider === "twilio") {
      return [
        secret("TWILIO_ACCOUNT_SID", "Twilio account SID."),
        secret("TWILIO_AUTH_TOKEN", "Twilio auth token."),
        variable("TWILIO_FROM", "Twilio sender phone number."),
      ]
    }
  }
  if (role === "auth" && provider === "voyant-cloud") {
    return [
      variable("VOYANT_ADMIN_AUTH_MODE", 'Set to "voyant-cloud".'),
      variable("VOYANT_CLOUD_DEPLOYMENT_ID", "Voyant Cloud deployment id."),
      variable("VOYANT_CLOUD_ADMIN_AUTH_START_URL", "Cloud admin auth start URL."),
      variable("VOYANT_CLOUD_ADMIN_AUTH_EXCHANGE_URL", "Cloud admin auth token exchange URL."),
      variable("VOYANT_CLOUD_ADMIN_AUTH_JWKS_URL", "Cloud admin auth JWKS URL."),
      variable("VOYANT_CLOUD_ADMIN_AUTH_REVALIDATE_URL", "Cloud admin auth revalidation URL."),
      secret("VOYANT_CLOUD_ADMIN_AUTH_CLIENT_TOKEN", "Cloud admin auth client token."),
      secret("SESSION_CLAIMS_SECRET", "Session claim signing secret."),
      secret("BETTER_AUTH_SECRET", "Better Auth secret."),
    ]
  }
  if (role === "scheduledJobs" && provider === "cloud-scheduler") {
    return [
      secret(
        "ORIGIN_TRUST_SECRET",
        "Shared x-voyant-origin-trust secret for scheduled HTTP calls.",
      ),
    ]
  }
  if (role === "workflows" && provider === "voyant-cloud") {
    return [
      variable("VOYANT_CLOUD_WORKFLOWS_URL", "Voyant Cloud workflow runtime URL."),
      secret("VOYANT_CLOUD_WORKFLOW_TRIGGER_TOKEN", "Workflow trigger token."),
      variable("VOYANT_CLOUD_APP_SLUG", "Cloud app slug."),
      variable("VOYANT_CLOUD_ENVIRONMENT", "Cloud environment name.", false),
    ]
  }
  return []
}

function notesForProvider(role: VoyantProjectProviderRole, provider: string): string | undefined {
  if (role === "scheduledJobs" && provider === "cloud-scheduler") {
    return "Cloud Scheduler should POST /__voyant/scheduled?cron=<expr> with x-voyant-origin-trust."
  }
  if (role === "workflows" && provider === "voyant-cloud") {
    return "App code forwards workflow trigger/event calls to the hosted Voyant Cloud workflow runtime."
  }
  return undefined
}

function resourceKeyFor(role: VoyantProjectProviderRole, provider: string): string {
  if (provider === "redis") return "redis"
  if (
    provider === "postgres" &&
    (role === "cache" || role === "sharedState" || role === "rateLimit")
  ) {
    return "postgres-shared-state"
  }
  if (role === "storage" && (provider === "s3" || provider === "r2")) return "object-storage"
  return `${role}:${provider}`
}

function secret(name: string, description: string, required = true): VoyantProfileEnvRequirement {
  return { name, kind: "secret", required, description }
}

function variable(name: string, description: string, required = true): VoyantProfileEnvRequirement {
  return { name, kind: "variable", required, description }
}

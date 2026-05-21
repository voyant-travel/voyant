interface CloudflareBindings {
  // Hyperdrive (prod only; dev uses DATABASE_URL directly)
  HYPERDRIVE?: Hyperdrive

  // R2 (public media storage, optional — when configured, /v1/uploads + /v1/media/* are served)
  MEDIA_BUCKET?: R2Bucket
  // R2 (private document storage, optional)
  DOCUMENTS_BUCKET?: R2Bucket

  // Secrets (from .dev.vars)
  DATABASE_URL: string
  INTERNAL_API_KEY: string
  SESSION_CLAIMS_SECRET: string
  BETTER_AUTH_SECRET: string

  // Voyant Cloud (canonical email/sms/verify/vault provider)
  VOYANT_CLOUD_API_KEY: string
  VOYANT_CLOUD_API_URL?: string
  VOYANT_CLOUD_VAULT_SLUG?: string
  EMAIL_FROM: string
  EMAIL_REPLY_TO?: string

  // App URLs
  APP_URL: string
  CORS_ALLOWLIST?: string
  DASH_BASE_URL: string

  // KMS provider selection
  KMS_PROVIDER: "gcp" | "aws" | "env" | "local" | "voyant-cloud"
  KMS_ENV_KEY?: string
  KMS_LOCAL_KEY?: string
  AWS_REGION?: string
  AWS_ACCESS_KEY_ID?: string
  AWS_SECRET_ACCESS_KEY?: string
  AWS_SESSION_TOKEN?: string
  AWS_KMS_ENDPOINT?: string
  AWS_KMS_PEOPLE_KEY_ID?: string
  AWS_KMS_INTEGRATIONS_KEY_ID?: string
  GCP_PROJECT_ID?: string
  GCP_KMS_KEYRING?: string
  GCP_KMS_LOCATION?: string
  GCP_KMS_PEOPLE_KEY_NAME?: string
  GCP_KMS_INTEGRATIONS_KEY_NAME?: string
  GCP_SERVICE_ACCOUNT_EMAIL?: string
  GCP_PRIVATE_KEY?: string
}

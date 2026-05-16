interface CloudflareBindings {
  // KV namespaces
  RATE_LIMIT: KVNamespace
  CACHE: KVNamespace

  // R2 (public media storage, optional — when configured, /v1/uploads + /v1/media/* are served)
  MEDIA_BUCKET?: R2Bucket
  // R2 (private document storage, optional)
  DOCUMENTS_BUCKET?: R2Bucket

  // Secrets
  INTERNAL_API_KEY: string
  SESSION_CLAIMS_SECRET: string
  BETTER_AUTH_SECRET: string
  DATABASE_URL: string

  // Admin auth mode. Localhost/self-hosted deployments use local Better Auth
  // flows. Voyant Cloud deployments use Cloud as the exclusive identity broker.
  VOYANT_ADMIN_AUTH_MODE?: "local" | "voyant-cloud"
  VOYANT_CLOUD_ADMIN_AUTH_AUDIENCE?: string
  VOYANT_CLOUD_ADMIN_AUTH_CLIENT_TOKEN?: string
  VOYANT_CLOUD_ADMIN_AUTH_EXCHANGE_URL?: string
  VOYANT_CLOUD_ADMIN_AUTH_JWKS_URL?: string
  VOYANT_CLOUD_ADMIN_AUTH_REVALIDATE_URL?: string
  VOYANT_CLOUD_ADMIN_AUTH_START_URL?: string
  VOYANT_CLOUD_APP_ID?: string
  VOYANT_CLOUD_DEPLOYMENT_ID?: string
  VOYANT_CLOUD_ENVIRONMENT?: string

  // Voyant Cloud (canonical email/sms/verify/vault provider)
  VOYANT_CLOUD_API_KEY: string
  VOYANT_CLOUD_API_URL?: string
  EMAIL_FROM: string

  // KMS provider selection
  KMS_PROVIDER: "gcp" | "aws" | "env" | "local"
  KMS_ENV_KEY?: string
  KMS_LOCAL_KEY?: string

  // AWS KMS (required when KMS_PROVIDER=aws)
  AWS_REGION?: string
  AWS_ACCESS_KEY_ID?: string
  AWS_SECRET_ACCESS_KEY?: string
  AWS_SESSION_TOKEN?: string
  AWS_KMS_ENDPOINT?: string
  AWS_KMS_PEOPLE_KEY_ID?: string
  AWS_KMS_INTEGRATIONS_KEY_ID?: string

  // GCP KMS (required when KMS_PROVIDER=gcp)
  GCP_PROJECT_ID?: string
  GCP_KMS_KEYRING?: string
  GCP_KMS_LOCATION?: string
  GCP_KMS_PEOPLE_KEY_NAME?: string
  GCP_KMS_INTEGRATIONS_KEY_NAME?: string
  GCP_SERVICE_ACCOUNT_EMAIL?: string
  GCP_PRIVATE_KEY?: string

  // App URLs
  APP_URL: string
  API_BASE_URL: string
  CORS_ALLOWLIST: string
  DASH_BASE_URL: string
}

interface CloudflareBindings {
  METRICS?: AnalyticsEngineDataset
  RATE_LIMIT?: KVNamespace
  CACHE?: KVNamespace

  INTERNAL_API_KEY: string
  SESSION_CLAIMS_SECRET: string
  BETTER_AUTH_SECRET: string
  DATABASE_URL: string
  DATABASE_URL_REPLICAS?: string
  DB_FORCE_TRANSACTIONAL?: string

  VOYANT_ADMIN_AUTH_MODE?: "local"
  VOYANT_AUTH_LOG_SECRET_FALLBACKS?: string

  APP_URL?: string
  API_BASE_URL?: string
  CORS_ALLOWLIST?: string
  DASH_BASE_URL?: string

  KMS_PROVIDER?: "gcp" | "aws" | "env" | "local" | "voyant-cloud"
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

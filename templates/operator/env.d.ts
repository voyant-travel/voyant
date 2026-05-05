interface CloudflareBindings {
  // KV namespaces
  RATE_LIMIT: KVNamespace
  CACHE: KVNamespace

  // R2 (public media storage)
  MEDIA_BUCKET: R2Bucket
  // R2 (private document storage)
  DOCUMENTS_BUCKET: R2Bucket

  // Hyperdrive (connection pooling)
  HYPERDRIVE: Hyperdrive

  // Secrets
  INTERNAL_API_KEY: string
  SESSION_CLAIMS_SECRET: string
  BETTER_AUTH_SECRET: string
  DATABASE_URL: string

  // Voyant Cloud (canonical email/sms/verify/vault provider)
  VOYANT_CLOUD_API_KEY: string
  VOYANT_CLOUD_API_URL?: string
  EMAIL_FROM: string
  EMAIL_REPLY_TO?: string

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
  /**
   * Public base URL Cloudflare Browser Rendering uses to fetch any
   * external resources referenced from contract / invoice / document
   * templates (logos, signatures, fonts, etc.). Must be reachable from
   * the public internet — `localhost` or private hostnames will break
   * PDF generation because CF's headless browser can't resolve them.
   *
   * Production: set to a public URL (e.g. `https://api-1.example.io`)
   * pointing at this operator deployment. Variables resolver injects
   * it as `documents.base_url` for Liquid templates.
   *
   * Dev: leave unset. Templates that reference public assets (real
   * logos hosted on a CDN, etc.) will work; templates that try to
   * pull from `${documents.base_url}/...` will render with broken
   * resources, but the PDF still generates from the inline HTML so
   * local development isn't blocked.
   */
  DOCUMENTS_BASE_URL?: string

  // Netopia (pay-by-link card processor). `NETOPIA_MODE` selects sandbox
  // vs live (defaults to sandbox); `NETOPIA_URL` is an optional override
  // for staging proxies / test mocks. `NETOPIA_NOTIFY_URL` must be
  // publicly reachable so the processor can deliver callbacks.
  NETOPIA_MODE?: "sandbox" | "live"
  NETOPIA_URL?: string
  NETOPIA_API_KEY?: string
  NETOPIA_POS_SIGNATURE?: string
  /**
   * Server-to-server webhook receiver. Genuinely deploy-wide — Netopia
   * POSTs payment results here, so it must be a single publicly reachable
   * HTTPS endpoint. Should resolve to
   * `${API_BASE_URL}/v1/admin/finance/providers/netopia/callback`.
   */
  NETOPIA_NOTIFY_URL?: string
  /**
   * Default browser redirect after the customer completes (or cancels)
   * payment on Netopia's hosted page. Per-session overrides are passed via
   * `useCollectPayment({ returnUrl, cancelUrl })`; storefront flows
   * typically override per call, while operator-initiated send-link flows
   * leave the default pointing at the public `/pay/:sessionId` landing.
   */
  NETOPIA_REDIRECT_URL?: string
  /**
   * Deploy-wide fallback for the Netopia hosted-page language. The actual
   * language for each session is set per-call via `startProvider.payload.
   * language` (see `useCollectPayment`'s `payerLanguage` option), so this
   * env var only matters when the caller doesn't supply one.
   */
  NETOPIA_LANGUAGE?: string

  // SmartBill (Romanian e-invoicing). When configured, invoice.issued and
  // invoice.proforma.issued events sync to SmartBill and store an external ref.
  SMARTBILL_USERNAME?: string
  /** Preferred token name. SMARTBILL_TOKEN is also supported for Protravel compatibility. */
  SMARTBILL_API_TOKEN?: string
  SMARTBILL_TOKEN?: string
  SMARTBILL_COMPANY_VAT_CODE?: string
  /** Default series for both invoices and proformas unless overridden below. */
  SMARTBILL_SERIES_NAME?: string
  SMARTBILL_INVOICE_SERIES_NAME?: string
  SMARTBILL_PROFORMA_SERIES_NAME?: string
  SMARTBILL_API_URL?: string
  SMARTBILL_LANGUAGE?: string
  SMARTBILL_ART_311_SPECIAL_REGIME?: string

  /**
   * Base URL of the standalone `flights-demo-api` service (e.g.
   * `http://localhost:3320`). Required when using
   * `@voyantjs/plugin-flights-demo` — the plugin is a thin HTTP client and
   * the service owns its own database. Swap to a real GDS connector by
   * replacing the adapter in `src/api/flights.ts`.
   */
  FLIGHTS_DEMO_API_URL?: string

  // Manual bank-transfer block rendered on the public payment landing page.
  // Leave BENEFICIARY + IBAN empty to hide the bank-transfer tab. Currency
  // is intentionally omitted — it always tracks the booking's invoice
  // currency (set on the invoice at collection time). NOTES is deploy-wide
  // boilerplate; per-call notes from `initiateCheckoutCollection({ notes })`
  // override it.
  BANK_TRANSFER_BENEFICIARY?: string
  BANK_TRANSFER_IBAN?: string
  BANK_TRANSFER_BANK_NAME?: string
  BANK_TRANSFER_NOTES?: string
}

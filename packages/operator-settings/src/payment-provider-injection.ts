/**
 * Managed payment registry injection seam.
 *
 * The Settings → Payments routes own the API surface and default to the
 * self-host registry (env-var configured, read-only). A managed deployment
 * (voyant-cloud) injects a different `PaymentProviderRegistry` — one that
 * brokers to the payments control plane — by setting a resolver on the request
 * context. The routes never learn where the managed registry lives; they only
 * resolve whichever registry the deployment provided, else the default.
 *
 * This keeps a single route surface owned by this package while the deployment
 * supplies the implementation (the Option A seam from voyant
 * `docs/adr/0015-payment-adapter-transports-and-managed-connect.md`).
 */

import type { PaymentProviderRegistry } from "@voyant-travel/payments"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

/** Per-request context a resolver may use to build a registry. */
export interface PaymentProviderRegistryContext {
  db: PostgresJsDatabase
  env: Readonly<Record<string, unknown>>
  /** The raw request — a managed resolver uses it to resolve the acting user. */
  request: Request
}

/** Deployment-provided factory producing a request-scoped registry. */
export type PaymentProviderRegistryResolver = (
  context: PaymentProviderRegistryContext,
) => PaymentProviderRegistry | Promise<PaymentProviderRegistry>

/**
 * Hono context variable key a deployment sets to inject the managed registry.
 * Set it in middleware ahead of the operator-settings routes; absent it, the
 * routes use the default self-host registry.
 */
export const PAYMENT_PROVIDER_REGISTRY_RESOLVER_VAR = "paymentProviderRegistryResolver" as const

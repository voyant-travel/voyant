/**
 * Payment provider catalog + connect contract.
 *
 * These types describe the processors an operator can browse and connect from
 * Settings → Payments, and the runtime port that backs that surface. The
 * `PaymentAdapter` in `./index.js` remains the checkout contract; this module
 * adds the *selection + connection* layer on top of it.
 *
 * Kept dependency-free (pure TypeScript, no zod) to preserve this package's
 * minimal footprint — request/response validation lives in the routes layer
 * (`@voyant-travel/operator-settings`), which already depends on zod.
 *
 * See `docs/adr/0015-payment-adapter-transports-and-managed-connect.md`.
 */

import type { PaymentAdapterCapabilities, PaymentAdapterMode } from "./index.js"

/** Kinds of connect-form fields a provider can declare. */
export type PaymentCredentialFieldKind = "text" | "secret" | "boolean" | "select"

/** A selectable option for a `select` credential field. */
export interface PaymentCredentialFieldOption {
  value: string
  /** i18n key or human label; the UI localizes/render decides. */
  label: string
}

/**
 * One declarative field the connect form renders for a provider. Secret fields
 * are masked in the UI and never round-tripped back to the client.
 */
export interface PaymentCredentialField {
  key: string
  label: string
  kind: PaymentCredentialFieldKind
  required: boolean
  placeholder?: string
  helpText?: string
  /** Present for `select` fields. */
  options?: readonly PaymentCredentialFieldOption[]
  /** Simple, declarative validation only. */
  minLength?: number
  maxLength?: number
  /** Serialized RegExp source (no flags); the routes layer compiles it. */
  pattern?: string
}

/** The ordered field list that drives a provider's connect form. */
export type PaymentCredentialFieldSchema = readonly PaymentCredentialField[]

/** Whether a catalog entry can be connected now or is announced but not ready. */
export type PaymentProviderAvailability = "available" | "coming_soon"

/**
 * A catalog entry: everything the admin UI needs to list a processor and render
 * its connect form. `capabilities` mirror the `PaymentAdapter` capabilities the
 * connected adapter will declare, so the UI can badge them before connecting.
 */
export interface PaymentProviderDescriptor {
  id: string
  displayName: string
  description: string
  /** Opaque logo reference (asset key / registry id); resolved by the UI. */
  logoRef?: string
  capabilities: PaymentAdapterCapabilities
  credentialFieldSchema: PaymentCredentialFieldSchema
  regions?: readonly string[]
  currencies?: readonly string[]
  availability: PaymentProviderAvailability
  modes: readonly PaymentAdapterMode[]
}

/** Connection lifecycle for the single active provider per org. */
export type PaymentConnectionState = "disconnected" | "connected" | "error"

/**
 * The current connection, independent of which transport backs it. `mode` is
 * `null` until a provider is connected. In self-host/pinned deployments this is
 * derived read-only from the environment-configured adapter.
 */
export interface PaymentConnectionStatus {
  activeProviderId: string | null
  status: PaymentConnectionState
  mode: PaymentAdapterMode | null
  /** ISO-8601. Last successful `health()` check, if any. */
  lastHealthAt?: string | null
  lastError?: string | null
  /**
   * True when the deployment pins its processor via environment variables
   * (self-host). The UI then renders read-only "configured via environment"
   * and hides the connect form.
   */
  readOnly?: boolean
}

/** Input to connect (or re-connect) a provider. */
export interface PaymentConnectInput {
  providerId: string
  mode: PaymentAdapterMode
  /** Raw processor credentials; never persisted inside the Operator boundary. */
  credentials: Record<string, unknown>
}

/** Result of a connect attempt. */
export interface PaymentConnectResult {
  ok: boolean
  status: PaymentConnectionStatus
  error?: string
}

/**
 * The runtime port backing Settings → Payments. A managed deployment resolves
 * this against the voyant-cloud control plane + provider registry; a self-host
 * deployment resolves a read-only, environment-derived implementation.
 */
export interface PaymentProviderRegistry {
  listProviders(): Promise<readonly PaymentProviderDescriptor[]>
  getConnection(): Promise<PaymentConnectionStatus>
  connect(input: PaymentConnectInput): Promise<PaymentConnectResult>
  disconnect(): Promise<void>
}

/** A single credential validation problem. */
export interface PaymentCredentialFieldError {
  key: string
  message: string
}

/**
 * Pure, dependency-free validation of submitted credentials against a
 * provider's declared field schema. Returns an empty array when valid. The
 * routes layer can additionally enforce zod-level shape; this keeps the rules
 * co-located with the schema that declares them.
 */
export function validatePaymentCredentials(
  schema: PaymentCredentialFieldSchema,
  values: Record<string, unknown>,
): PaymentCredentialFieldError[] {
  const errors: PaymentCredentialFieldError[] = []
  for (const field of schema) {
    const value = values[field.key]
    const missing =
      value === undefined || value === null || (typeof value === "string" && value.trim() === "")

    if (field.required && missing) {
      errors.push({ key: field.key, message: `${field.label} is required.` })
      continue
    }
    if (missing) continue

    if (field.kind === "boolean") {
      if (typeof value !== "boolean") {
        errors.push({ key: field.key, message: `${field.label} must be a boolean.` })
      }
      continue
    }

    if (field.kind === "select") {
      const allowed = (field.options ?? []).map((option) => option.value)
      if (typeof value !== "string" || !allowed.includes(value)) {
        errors.push({ key: field.key, message: `${field.label} is not a valid option.` })
      }
      continue
    }

    if (typeof value !== "string") {
      errors.push({ key: field.key, message: `${field.label} must be a string.` })
      continue
    }
    if (field.minLength !== undefined && value.length < field.minLength) {
      errors.push({ key: field.key, message: `${field.label} is too short.` })
    }
    if (field.maxLength !== undefined && value.length > field.maxLength) {
      errors.push({ key: field.key, message: `${field.label} is too long.` })
    }
    if (field.pattern !== undefined && !new RegExp(field.pattern).test(value)) {
      errors.push({ key: field.key, message: `${field.label} has an invalid format.` })
    }
  }
  return errors
}

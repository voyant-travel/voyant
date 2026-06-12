import type { NotificationProvider } from "@voyantjs/notifications"
import type { CircuitBreaker } from "@voyantjs/utils/resilience"

export type NetopiaFetch = (
  input: string,
  init: {
    method: string
    headers: Record<string, string>
    body?: string
  },
) => Promise<{
  ok: boolean
  status: number
  json: () => Promise<unknown>
  text: () => Promise<string>
}>

export interface NetopiaBillingAddress {
  email: string
  phone: string
  firstName: string
  lastName: string
  city: string
  country: number
  state: string
  postalCode: string
  details: string
}

export interface NetopiaProductLine {
  name?: string
  code?: string
  category?: string
  price?: number
  vat?: number
}

export interface NetopiaInstallments {
  selected: number
  available: number[]
}

export interface NetopiaPaymentOptions {
  installments: number
  bonus?: number
}

export interface NetopiaPaymentInstrument {
  type: string
  account: string
  expMonth: number
  expYear: number
  secretCode: string
  token?: string
}

export interface NetopiaBrowserData {
  [key: string]: string | undefined
}

export interface NetopiaStartPaymentRequest {
  config: {
    emailTemplate: string
    notifyUrl: string
    redirectUrl: string
    language: string
  }
  payment: {
    options: NetopiaPaymentOptions
    instrument?: NetopiaPaymentInstrument
    data?: NetopiaBrowserData
  }
  order: {
    ntpID?: string
    posSignature: string
    dateTime: string
    description: string
    orderID: string
    amount: number
    currency: string
    billing: NetopiaBillingAddress
    shipping: NetopiaBillingAddress
    products: NetopiaProductLine[]
    installments: NetopiaInstallments
    data?: Record<string, string>
  }
}

export interface NetopiaStartPaymentResponse {
  code?: string
  message?: string
  error?: {
    code?: string | number
    message?: string
  }
  payment?: {
    paymentURL?: string
    ntpID?: string
    status?: number
    amount?: number
    currency?: string
  }
}

export interface NetopiaWebhookPayload {
  order: {
    orderID: string
  }
  payment: {
    amount: number
    currency: string
    ntpID: string
    status: number
    code?: string
    message?: string
    data?: {
      AuthCode?: string
      RRN?: string
      [key: string]: unknown
    }
    instrument?: {
      country?: number
      panMasked?: string
      [key: string]: unknown
    }
    [key: string]: unknown
  }
  [key: string]: unknown
}

export interface NetopiaStartPaymentInput {
  description?: string
  notifyUrl?: string
  returnUrl?: string
  cancelUrl?: string
  callbackUrl?: string
  emailTemplate?: string
  language?: string
  options?: NetopiaPaymentOptions
  instrument?: NetopiaPaymentInstrument
  browserData?: NetopiaBrowserData
  billing: NetopiaBillingAddress
  shipping?: NetopiaBillingAddress
  products?: NetopiaProductLine[]
  installments?: NetopiaInstallments
  orderData?: Record<string, string>
  metadata?: Record<string, unknown>
  notes?: string | null
}

export type NetopiaMode = "sandbox" | "live"

/**
 * Outbound-HTTP resilience knobs for the Netopia client. Payment initiation
 * is money movement, so it is NEVER auto-retried — these only tune the
 * per-attempt timeout and the circuit breaker that fails fast when Netopia
 * is down instead of burning the request's CPU/subrequest budget.
 */
export interface NetopiaResilienceOptions {
  /**
   * Per-attempt timeout. Defaults to 15s — payment initiation gets a longer
   * ceiling than the 10s used for non-payment upstreams.
   */
  timeoutMs?: number
  /**
   * Override/share the circuit breaker. Defaults to one module-level
   * breaker per Netopia base URL (clients are created per request, so the
   * breaker must outlive them).
   */
  breaker?: CircuitBreaker
}

export interface NetopiaRuntimeOptions {
  /**
   * Selects the Netopia environment. Resolves to a known base URL via
   * `NETOPIA_API_BASES`. Pass `apiUrl` to override (e.g. for tests or a
   * private staging proxy). Defaults to `"sandbox"` when neither `mode`
   * nor `apiUrl` is set, so a misconfigured production deploy fails into
   * the safer mode rather than charging real cards.
   */
  mode?: NetopiaMode
  apiUrl?: string
  apiKey?: string
  posSignature?: string
  notifyUrl?: string
  redirectUrl?: string
  emailTemplate?: string
  language?: string
  successStatuses?: number[]
  processingStatuses?: number[]
  fetch?: NetopiaFetch
  /** Timeout/circuit-breaker tuning. See {@link NetopiaResilienceOptions}. */
  resilience?: NetopiaResilienceOptions
  resolveNotificationProviders?: (
    bindings: Record<string, unknown>,
  ) => ReadonlyArray<NotificationProvider>
}

export interface ResolvedNetopiaRuntimeOptions {
  apiUrl: string
  apiKey: string
  posSignature: string
  notifyUrl: string
  redirectUrl: string
  emailTemplate: string
  language: string
  successStatuses: number[]
  processingStatuses: number[]
  fetch?: NetopiaFetch
  /** Timeout/circuit-breaker tuning. See {@link NetopiaResilienceOptions}. */
  resilience?: NetopiaResilienceOptions
}

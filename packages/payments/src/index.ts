import { definePort } from "@voyant-travel/core/project"

export const PAYMENT_ADAPTER_CONTRACT_VERSION = "voyant.payment-adapter.v1" as const
export const PAYMENT_ADAPTER_RUNTIME_PORT_ID = "payments.adapter.runtime" as const

export type PaymentAdapterMode = "sandbox" | "test" | "live"
export type PaymentCaptureMode = "automatic" | "manual"
export type PaymentOperationStatus = "accepted" | "declined" | "pending" | "failed"
export type PaymentSessionState =
  | "pending"
  | "requires_redirect"
  | "processing"
  | "authorized"
  | "paid"
  | "failed"
  | "cancelled"
  | "expired"

export interface PaymentMoney {
  amountMinor: number
  currency: string
}

export interface PaymentProcessorIdentity {
  providerId: string
  connectionId: string
}

export interface PaymentAdapterCapabilities {
  hostedCheckout: boolean
  redirectCheckout: boolean
  authorize: boolean
  capture: boolean
  void: boolean
  refund: boolean
  status: boolean
  callbackSignatureVerification: boolean
  idempotencyKeys: boolean
  retrySafeInitiation: boolean
}

export interface PaymentHostedCheckout {
  kind: "hosted_checkout" | "redirect"
  url: string
  expiresAt?: string | null
}

export interface PaymentAdapterDiagnostics {
  status: "ok" | "degraded" | "down"
  checkedAt: string
  message?: string
  details?: Record<string, unknown>
}

export interface PaymentInitiationInput {
  paymentSessionId: string
  money: PaymentMoney
  description?: string
  returnUrl?: string
  captureMode?: PaymentCaptureMode
  idempotencyKey: string
  customer?: {
    email?: string | null
    phone?: string | null
    firstName?: string | null
    lastName?: string | null
  }
  metadata?: Record<string, unknown>
}

export interface PaymentInitiationResult {
  processorSessionId?: string | null
  processorPaymentId?: string | null
  processorIdentity?: PaymentProcessorIdentity
  checkout?: PaymentHostedCheckout | null
  nextState: PaymentSessionState
  idempotencyKey: string
  raw?: unknown
}

export interface PaymentOperationInput {
  paymentSessionId: string
  processorSessionId?: string | null
  processorPaymentId?: string | null
  processorIdentity?: PaymentProcessorIdentity
  money?: PaymentMoney
  reason?: string
  idempotencyKey: string
}

export interface PaymentOperationResult {
  status: PaymentOperationStatus
  nextState?: PaymentSessionState
  processorReference?: string | null
  retryAfterSeconds?: number
  raw?: unknown
}

export interface PaymentStatusInput {
  paymentSessionId: string
  processorSessionId?: string | null
  processorPaymentId?: string | null
  processorIdentity?: PaymentProcessorIdentity
}

export interface PaymentStatusResult {
  nextState: PaymentSessionState
  processorSessionId?: string | null
  processorPaymentId?: string | null
  money?: PaymentMoney
  raw?: unknown
}

export interface PaymentCallbackRequest {
  headers: Readonly<Record<string, string | string[] | undefined>>
  rawBody: string | Uint8Array
  parsedBody?: unknown
  receivedAt: string
  connectionId?: string | null
}

export interface PaymentCallbackEvent {
  eventId: string
  paymentSessionId: string
  nextState: PaymentSessionState
  occurredAt: string
  processorSessionId?: string | null
  processorPaymentId?: string | null
  processorIdentity?: PaymentProcessorIdentity
  money?: PaymentMoney
  idempotencyKey: string
  raw?: unknown
}

export type PaymentCallbackVerificationResult =
  | { verified: true; event: PaymentCallbackEvent }
  | { verified: false; reason: "missing_signature" | "invalid_signature" | "malformed" | "replay" }

export interface PaymentAdapterRuntimeContext {
  env: Readonly<Record<string, unknown>>
  now?: () => Date
}

export interface PaymentAdapter {
  readonly id: string
  readonly label: string
  readonly contractVersion: typeof PAYMENT_ADAPTER_CONTRACT_VERSION
  readonly mode: PaymentAdapterMode
  readonly capabilities: PaymentAdapterCapabilities
  initiate(
    context: PaymentAdapterRuntimeContext,
    input: PaymentInitiationInput,
  ): Promise<PaymentInitiationResult>
  verifyCallback(
    context: PaymentAdapterRuntimeContext,
    request: PaymentCallbackRequest,
  ): Promise<PaymentCallbackVerificationResult>
  health(context: PaymentAdapterRuntimeContext): Promise<PaymentAdapterDiagnostics>
  authorize?(
    context: PaymentAdapterRuntimeContext,
    input: PaymentOperationInput,
  ): Promise<PaymentOperationResult>
  capture?(
    context: PaymentAdapterRuntimeContext,
    input: PaymentOperationInput,
  ): Promise<PaymentOperationResult>
  void?(
    context: PaymentAdapterRuntimeContext,
    input: PaymentOperationInput,
  ): Promise<PaymentOperationResult>
  refund?(
    context: PaymentAdapterRuntimeContext,
    input: PaymentOperationInput,
  ): Promise<PaymentOperationResult>
  status?(
    context: PaymentAdapterRuntimeContext,
    input: PaymentStatusInput,
  ): Promise<PaymentStatusResult>
}

function requireCapabilityMethod(
  adapter: PaymentAdapter,
  capability: keyof Pick<
    PaymentAdapterCapabilities,
    "authorize" | "capture" | "void" | "refund" | "status"
  >,
) {
  if (adapter.capabilities[capability] && typeof adapter[capability] !== "function") {
    throw new Error(
      `Payment adapter ${adapter.id} declares ${capability} but does not implement it.`,
    )
  }
}

export const paymentAdapterRuntimePort = definePort<PaymentAdapter>({
  id: PAYMENT_ADAPTER_RUNTIME_PORT_ID,
  test(adapter) {
    if (!adapter || typeof adapter !== "object") {
      throw new Error("Payment adapter provider must be an object.")
    }
    if (adapter.contractVersion !== PAYMENT_ADAPTER_CONTRACT_VERSION) {
      throw new Error(`Payment adapter must implement ${PAYMENT_ADAPTER_CONTRACT_VERSION}.`)
    }
    if (!adapter.id || adapter.id.trim() !== adapter.id) {
      throw new Error("Payment adapter must declare a stable non-empty id.")
    }
    if (typeof adapter.initiate !== "function") {
      throw new Error("Payment adapter must implement initiate().")
    }
    if (typeof adapter.verifyCallback !== "function") {
      throw new Error("Payment adapter must implement verifyCallback().")
    }
    if (typeof adapter.health !== "function") {
      throw new Error("Payment adapter must implement health().")
    }
    for (const capability of ["authorize", "capture", "void", "refund", "status"] as const) {
      requireCapabilityMethod(adapter, capability)
    }
    if (!adapter.capabilities.callbackSignatureVerification) {
      throw new Error("Payment adapter callbacks must be signature-verified.")
    }
  },
})

export type {
  PaymentAdapterConformanceHarness,
  PaymentAdapterConformanceResult,
} from "./conformance.js"
export { runPaymentAdapterConformance } from "./conformance.js"
export {
  defaultPaymentProviderCatalog,
  findPaymentProviderDescriptor,
} from "./default-catalog.js"
export type {
  PaymentConnectInput,
  PaymentConnectionState,
  PaymentConnectionStatus,
  PaymentConnectResult,
  PaymentCredentialField,
  PaymentCredentialFieldError,
  PaymentCredentialFieldKind,
  PaymentCredentialFieldOption,
  PaymentCredentialFieldSchema,
  PaymentProviderAvailability,
  PaymentProviderDescriptor,
  PaymentProviderRegistry,
} from "./provider-catalog.js"
export { validatePaymentCredentials } from "./provider-catalog.js"
export type {
  RemotePaymentAdapterOptions,
  RemotePaymentCall,
  RemotePaymentMethod,
  RemotePaymentTransport,
} from "./remote-adapter.js"
export { createRemotePaymentAdapter, PAYMENT_REMOTE_NOT_IMPLEMENTED } from "./remote-adapter.js"
export {
  type ControlPlaneRemotePaymentTransportConfig,
  createControlPlaneRemotePaymentTransport,
} from "./remote-transport.js"

export {
  PAYMENT_PROVIDER_REGISTRY_RUNTIME_PORT_ID,
  type PaymentProviderRegistryContext,
  type PaymentProviderRegistryResolver,
  paymentProviderRegistryRuntimePort,
} from "./runtime-port.js"

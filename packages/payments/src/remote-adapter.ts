/**
 * Remote payment adapter transport (managed mode).
 *
 * `createRemotePaymentAdapter` returns a `PaymentAdapter` that satisfies the
 * runtime port but delegates every operation to a first-party, Voyant-operated
 * processor worker over a signed RPC (`RemotePaymentTransport`). The Operator
 * bundle links only this shim — never any per-processor SDK — so the catalog
 * can grow to many processors without growing the Operator build.
 *
 * Phase 1 ships the conforming shape and the wire contract. The concrete
 * transport (signing + fetch to the voyant-cloud worker) is Phase 2; when no
 * transport is injected the operations throw `PAYMENT_REMOTE_NOT_IMPLEMENTED`
 * rather than silently succeeding.
 *
 * See `docs/adr/0015-payment-adapter-transports-and-managed-connect.md`.
 */

import {
  PAYMENT_ADAPTER_CONTRACT_VERSION,
  type PaymentAdapter,
  type PaymentAdapterCapabilities,
  type PaymentAdapterDiagnostics,
  type PaymentAdapterMode,
  type PaymentAdapterRuntimeContext,
  type PaymentCallbackRequest,
  type PaymentCallbackVerificationResult,
  type PaymentInitiationInput,
  type PaymentInitiationResult,
  type PaymentOperationInput,
  type PaymentOperationResult,
  type PaymentStatusInput,
  type PaymentStatusResult,
} from "./index.js"

export const PAYMENT_REMOTE_NOT_IMPLEMENTED = "PAYMENT_REMOTE_NOT_IMPLEMENTED" as const

/** The remote adapter methods that map to processor-worker RPC operations. */
export type RemotePaymentMethod =
  | "initiate"
  | "verifyCallback"
  | "health"
  | "authorize"
  | "capture"
  | "void"
  | "refund"
  | "status"

/**
 * One signed RPC to a processor worker. The envelope carries the opaque
 * connection reference (never raw secrets — the worker resolves credentials
 * from the managed secret store) plus the adapter runtime context and the
 * operation payload.
 */
export interface RemotePaymentCall<TPayload = unknown> {
  method: RemotePaymentMethod
  connectionRef: string
  context: { env: Readonly<Record<string, unknown>> }
  payload: TPayload
}

/**
 * The signed transport to a processor worker. Phase 2 provides an
 * implementation (request signing + fetch + response verification); Phase 1
 * leaves it undefined so operations fail closed.
 */
export interface RemotePaymentTransport {
  call<TResult>(call: RemotePaymentCall): Promise<TResult>
}

export interface RemotePaymentAdapterOptions {
  /** Stable adapter id, e.g. the provider id (`"netopia"`). */
  id: string
  label: string
  mode: PaymentAdapterMode
  capabilities: PaymentAdapterCapabilities
  /** Opaque managed-connection reference the worker resolves credentials from. */
  connectionRef: string
  /** Phase 2 signed transport. When absent, operations throw. */
  transport?: RemotePaymentTransport
}

class RemotePaymentNotImplementedError extends Error {
  readonly code = PAYMENT_REMOTE_NOT_IMPLEMENTED
  constructor(method: RemotePaymentMethod) {
    super(
      `Remote payment transport is not configured; cannot perform "${method}". ` +
        `The managed processor-worker transport is wired in Phase 2.`,
    )
    this.name = "RemotePaymentNotImplementedError"
  }
}

/**
 * Build a `PaymentAdapter` backed by a remote processor worker. The returned
 * object conforms to `paymentAdapterRuntimePort` (contract version, non-empty
 * id, required methods, signature-verified callbacks) so it registers and
 * passes conformance exactly like an in-process adapter.
 */
export function createRemotePaymentAdapter(options: RemotePaymentAdapterOptions): PaymentAdapter {
  const id = options.id.trim()
  if (!id) {
    throw new Error("Remote payment adapter requires a stable non-empty id.")
  }
  if (!options.capabilities.callbackSignatureVerification) {
    throw new Error("Remote payment adapter callbacks must be signature-verified.")
  }

  const invoke = async <TResult>(
    method: RemotePaymentMethod,
    context: PaymentAdapterRuntimeContext,
    payload: unknown,
  ): Promise<TResult> => {
    if (!options.transport) {
      throw new RemotePaymentNotImplementedError(method)
    }
    return options.transport.call<TResult>({
      method,
      connectionRef: options.connectionRef,
      context: { env: context.env },
      payload,
    })
  }

  return {
    id,
    label: options.label,
    contractVersion: PAYMENT_ADAPTER_CONTRACT_VERSION,
    mode: options.mode,
    capabilities: options.capabilities,
    initiate(context: PaymentAdapterRuntimeContext, input: PaymentInitiationInput) {
      return invoke<PaymentInitiationResult>("initiate", context, input)
    },
    verifyCallback(context: PaymentAdapterRuntimeContext, request: PaymentCallbackRequest) {
      return invoke<PaymentCallbackVerificationResult>("verifyCallback", context, request)
    },
    health(context: PaymentAdapterRuntimeContext) {
      return invoke<PaymentAdapterDiagnostics>("health", context, {})
    },
    authorize(context: PaymentAdapterRuntimeContext, input: PaymentOperationInput) {
      return invoke<PaymentOperationResult>("authorize", context, input)
    },
    capture(context: PaymentAdapterRuntimeContext, input: PaymentOperationInput) {
      return invoke<PaymentOperationResult>("capture", context, input)
    },
    void(context: PaymentAdapterRuntimeContext, input: PaymentOperationInput) {
      return invoke<PaymentOperationResult>("void", context, input)
    },
    refund(context: PaymentAdapterRuntimeContext, input: PaymentOperationInput) {
      return invoke<PaymentOperationResult>("refund", context, input)
    },
    status(context: PaymentAdapterRuntimeContext, input: PaymentStatusInput) {
      return invoke<PaymentStatusResult>("status", context, input)
    },
  }
}

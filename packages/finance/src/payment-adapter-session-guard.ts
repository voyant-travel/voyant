import type { PaymentProcessorIdentity, PaymentSessionState } from "@voyant-travel/payments"
import type { PaymentSession } from "./schema/payment-sessions.js"
import { PaymentValidationError } from "./service-shared.js"

const CALLBACK_STATE_RANK: Record<PaymentSessionState, number> = {
  pending: 0,
  requires_redirect: 1,
  processing: 2,
  failed: 3,
  cancelled: 3,
  expired: 3,
  authorized: 4,
  paid: 5,
}

export const PAYMENT_ADAPTER_STATUS_LEASE_TOKEN_KEY = "paymentAdapterStatusLeaseToken"

export function canApplyPaymentAdapterStateTransition(
  currentState: PaymentSessionState,
  nextState: PaymentSessionState,
) {
  if (currentState === nextState) return true
  return CALLBACK_STATE_RANK[nextState] > CALLBACK_STATE_RANK[currentState]
}

export function assertPaymentAdapterProcessorIdentityForLockedSession(
  session: PaymentSession,
  processorIdentity: PaymentProcessorIdentity | undefined,
) {
  if (session.providerConnectionId && !processorIdentity) {
    throw new PaymentValidationError(
      "Payment callback processor identity is required for a pinned payment session connection",
      {
        paymentSessionId: session.id,
        expectedConnectionId: session.providerConnectionId,
      },
      { status: 409, code: "payment_processor_identity_required" },
    )
  }

  if (!processorIdentity) return { provider: undefined, providerConnectionId: undefined }

  const { providerId, connectionId } = processorIdentity
  if (session.providerConnectionId && session.providerConnectionId !== connectionId) {
    throw new PaymentValidationError(
      "Payment callback processor identity does not match the stored payment session connection",
      {
        paymentSessionId: session.id,
        expectedConnectionId: session.providerConnectionId,
        receivedConnectionId: connectionId,
      },
      { status: 409, code: "payment_processor_identity_mismatch" },
    )
  }

  if (session.provider && session.provider !== providerId) {
    const mayAdoptLegacyManagedProvider = session.provider === "managed" && providerId !== "managed"
    if (!mayAdoptLegacyManagedProvider) {
      throw new PaymentValidationError(
        "Payment callback processor identity does not match the stored payment session provider",
        {
          paymentSessionId: session.id,
          expectedProvider: session.provider,
          receivedProvider: providerId,
        },
        { status: 409, code: "payment_processor_identity_mismatch" },
      )
    }
  }

  return { provider: providerId, providerConnectionId: connectionId }
}

export function assertPaymentAdapterProcessorReferencesForLockedSession(
  session: PaymentSession,
  references: {
    processorSessionId?: string | null
    processorPaymentId?: string | null
  },
) {
  const pinReference = (
    field: "providerSessionId" | "providerPaymentId",
    incoming: string | null | undefined,
  ) => {
    const stored = session[field]
    if (stored !== null && incoming != null && stored !== incoming) {
      throw new PaymentValidationError(
        "Payment adapter processor reference does not match the stored payment session reference",
        {
          paymentSessionId: session.id,
          field,
          expectedReference: stored,
          receivedReference: incoming,
        },
        { status: 409, code: "payment_processor_reference_mismatch" },
      )
    }
    return stored ?? incoming ?? undefined
  }

  return {
    providerSessionId: pinReference("providerSessionId", references.processorSessionId),
    providerPaymentId: pinReference("providerPaymentId", references.processorPaymentId),
  }
}

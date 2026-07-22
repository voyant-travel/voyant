import type { PaymentCallbackEvent } from "@voyant-travel/payments"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { financePaymentSessionCompletionService } from "./service-payment-session-completion.js"
import { financePaymentSessionService } from "./service-payment-sessions.js"
import { type FinanceServiceRuntime, PaymentValidationError } from "./service-shared.js"

async function assertProcessorIdentityMatchesSession(
  db: PostgresJsDatabase,
  event: PaymentCallbackEvent,
) {
  if (!event.processorIdentity) return

  const session = await financePaymentSessionService.getPaymentSessionById(
    db,
    event.paymentSessionId,
  )
  if (!session) return

  const { providerId, connectionId } = event.processorIdentity
  if (session.provider && session.provider !== providerId) {
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
}

export async function applyPaymentAdapterCallbackEvent(
  db: PostgresJsDatabase,
  event: PaymentCallbackEvent,
  runtime: FinanceServiceRuntime = {},
) {
  await assertProcessorIdentityMatchesSession(db, event)

  const providerData = {
    provider: event.processorIdentity?.providerId,
    providerConnectionId: event.processorIdentity?.connectionId,
    providerSessionId: event.processorSessionId ?? undefined,
    providerPaymentId: event.processorPaymentId ?? undefined,
    providerPayload: event.raw === undefined ? undefined : { callback: event.raw },
    metadata: { paymentAdapterEventId: event.eventId, paymentAdapterOccurredAt: event.occurredAt },
  }

  if (event.nextState === "paid" || event.nextState === "authorized") {
    return financePaymentSessionCompletionService.completePaymentSession(
      db,
      event.paymentSessionId,
      {
        status: event.nextState,
        captureMode: "automatic",
        ...providerData,
      },
      runtime,
    )
  }

  if (event.nextState === "failed") {
    return financePaymentSessionService.failPaymentSession(
      db,
      event.paymentSessionId,
      {
        ...providerData,
        failureCode: "payment_adapter_callback",
        failureMessage: "Payment adapter callback mapped this session to failed.",
      },
      runtime,
    )
  }

  if (event.nextState === "cancelled") {
    return financePaymentSessionService.cancelPaymentSession(
      db,
      event.paymentSessionId,
      providerData,
      runtime,
    )
  }

  if (event.nextState === "expired") {
    return financePaymentSessionService.expirePaymentSession(
      db,
      event.paymentSessionId,
      providerData,
      runtime,
    )
  }

  return financePaymentSessionService.updatePaymentSession(
    db,
    event.paymentSessionId,
    {
      status: event.nextState,
      ...providerData,
    },
    runtime,
  )
}

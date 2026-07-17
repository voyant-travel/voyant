import type { PaymentCallbackEvent } from "@voyant-travel/payments"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { financePaymentSessionCompletionService } from "./service-payment-session-completion.js"
import { financePaymentSessionService } from "./service-payment-sessions.js"
import type { FinanceServiceRuntime } from "./service-shared.js"

export async function applyPaymentAdapterCallbackEvent(
  db: PostgresJsDatabase,
  event: PaymentCallbackEvent,
  runtime: FinanceServiceRuntime = {},
) {
  const providerData = {
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

import type { PaymentCallbackEvent, PaymentSessionState } from "@voyant-travel/payments"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import {
  assertPaymentAdapterProcessorIdentityForLockedSession,
  canApplyPaymentAdapterStateTransition,
} from "./payment-adapter-session-guard.js"
import { paymentSessions } from "./schema/payment-sessions.js"
import { financePaymentSessionCompletionService } from "./service-payment-session-completion.js"
import {
  type FinanceServiceRuntime,
  sql,
  toTimestamp,
  touchLinkedBookingUpdatedAt,
} from "./service-shared.js"

function mergeJsonbColumn(
  column: typeof paymentSessions.providerPayload | typeof paymentSessions.metadata,
  value: Record<string, unknown> | null | undefined,
) {
  if (value === undefined) return undefined
  if (value === null) return null
  return sql`coalesce(${column}, '{}'::jsonb) || ${JSON.stringify(value)}::jsonb`
}

async function applyLockedNonCompletionCallbackEvent(
  db: PostgresJsDatabase,
  event: PaymentCallbackEvent,
  providerData: {
    provider: string | undefined
    providerConnectionId: string | undefined
    providerSessionId: string | undefined
    providerPaymentId: string | undefined
    providerPayload: Record<string, unknown> | undefined
    metadata: Record<string, unknown>
  },
) {
  return db.transaction(async (tx) => {
    const [session] = await tx
      .select()
      .from(paymentSessions)
      .where(eq(paymentSessions.id, event.paymentSessionId))
      .for("update")
      .limit(1)
    if (!session) return null

    const adoptedIdentity = assertPaymentAdapterProcessorIdentityForLockedSession(
      session,
      event.processorIdentity,
    )
    const provider = adoptedIdentity.provider ?? providerData.provider
    const providerConnectionId =
      adoptedIdentity.providerConnectionId ?? providerData.providerConnectionId

    const nextState = event.nextState as PaymentSessionState
    const shouldTransition = canApplyPaymentAdapterStateTransition(
      session.status as PaymentSessionState,
      nextState,
    )
    const failedAt = shouldTransition && nextState === "failed" ? new Date() : undefined
    const cancelledAt = shouldTransition && nextState === "cancelled" ? new Date() : undefined
    const expiredAt = shouldTransition && nextState === "expired" ? new Date() : undefined

    const [updated] = await tx
      .update(paymentSessions)
      .set({
        status: shouldTransition ? nextState : undefined,
        provider,
        providerConnectionId,
        providerSessionId: providerData.providerSessionId,
        providerPaymentId: providerData.providerPaymentId,
        providerPayload: mergeJsonbColumn(
          paymentSessions.providerPayload,
          providerData.providerPayload,
        ),
        metadata: mergeJsonbColumn(paymentSessions.metadata, providerData.metadata),
        failedAt,
        cancelledAt,
        expiredAt,
        failureCode:
          shouldTransition && nextState === "failed" ? "payment_adapter_callback" : undefined,
        failureMessage:
          shouldTransition && nextState === "failed"
            ? "Payment adapter callback mapped this session to failed."
            : undefined,
        completedAt: shouldTransition && nextState === "paid" ? new Date() : undefined,
        expiresAt:
          shouldTransition && nextState === "expired" ? toTimestamp(event.occurredAt) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(paymentSessions.id, event.paymentSessionId))
      .returning()

    await touchLinkedBookingUpdatedAt(tx, updated?.bookingId)
    return updated ?? null
  })
}

export async function applyPaymentAdapterCallbackEvent(
  db: PostgresJsDatabase,
  event: PaymentCallbackEvent,
  runtime: FinanceServiceRuntime = {},
) {
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
      { requireProcessorIdentityWhenConnectionPinned: true },
    )
  }

  return applyLockedNonCompletionCallbackEvent(db, event, providerData)
}

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

function safeJsonValue(value: unknown): unknown {
  if (value === undefined) return undefined
  try {
    const serialized = JSON.stringify(value)
    return serialized === undefined ? undefined : JSON.parse(serialized)
  } catch {
    return { unserializable: true }
  }
}

export interface PaymentAdapterReportedState {
  paymentSessionId: string
  nextState: PaymentSessionState
  occurredAt: string
  processorIdentity?: PaymentCallbackEvent["processorIdentity"]
  processorSessionId?: string | null
  processorPaymentId?: string | null
  providerPayload?: Record<string, unknown>
  metadata: Record<string, unknown>
}

async function applyLockedNonCompletionAdapterState(
  db: PostgresJsDatabase,
  event: PaymentAdapterReportedState,
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
  return applyPaymentAdapterReportedState(
    db,
    {
      paymentSessionId: event.paymentSessionId,
      nextState: event.nextState as PaymentSessionState,
      occurredAt: event.occurredAt,
      processorIdentity: event.processorIdentity,
      processorSessionId: event.processorSessionId,
      processorPaymentId: event.processorPaymentId,
      providerPayload: event.raw === undefined ? undefined : { callback: safeJsonValue(event.raw) },
      metadata: {
        paymentAdapterEventId: event.eventId,
        paymentAdapterOccurredAt: event.occurredAt,
      },
    },
    runtime,
  )
}

export async function applyPaymentAdapterReportedState(
  db: PostgresJsDatabase,
  event: PaymentAdapterReportedState,
  runtime: FinanceServiceRuntime = {},
) {
  const providerData = {
    provider: event.processorIdentity?.providerId,
    providerConnectionId: event.processorIdentity?.connectionId,
    providerSessionId: event.processorSessionId ?? undefined,
    providerPaymentId: event.processorPaymentId ?? undefined,
    providerPayload: event.providerPayload,
    metadata: event.metadata,
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

  return applyLockedNonCompletionAdapterState(db, event, providerData)
}

export function paymentAdapterRawPayload(value: unknown) {
  return safeJsonValue(value)
}

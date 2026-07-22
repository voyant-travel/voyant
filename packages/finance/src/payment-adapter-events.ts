import type {
  PaymentCallbackEvent,
  PaymentProcessorIdentity,
  PaymentSessionState,
  PaymentStatusResult,
} from "@voyant-travel/payments"
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

type PaymentAdapterStateUpdate = {
  source: "callback" | "status"
  paymentSessionId: string
  nextState: PaymentSessionState
  occurredAt: string
  processorIdentity?: PaymentProcessorIdentity
  processorSessionId?: string | null
  processorPaymentId?: string | null
}

type PaymentAdapterProviderData = {
  provider: string | undefined
  providerConnectionId: string | undefined
  providerSessionId: string | undefined
  providerPaymentId: string | undefined
  providerPayload: Record<string, unknown> | undefined
  metadata: Record<string, unknown>
}

async function applyLockedNonCompletionStateUpdate(
  db: PostgresJsDatabase,
  update: PaymentAdapterStateUpdate,
  providerData: PaymentAdapterProviderData,
) {
  return db.transaction(async (tx) => {
    const [session] = await tx
      .select()
      .from(paymentSessions)
      .where(eq(paymentSessions.id, update.paymentSessionId))
      .for("update")
      .limit(1)
    if (!session) return null

    const adoptedIdentity = assertPaymentAdapterProcessorIdentityForLockedSession(
      session,
      update.processorIdentity,
    )
    const provider = adoptedIdentity.provider ?? providerData.provider
    const providerConnectionId =
      adoptedIdentity.providerConnectionId ?? providerData.providerConnectionId

    const nextState = update.nextState
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
          shouldTransition && nextState === "failed"
            ? `payment_adapter_${update.source}`
            : undefined,
        failureMessage:
          shouldTransition && nextState === "failed"
            ? `Payment adapter ${update.source} mapped this session to failed.`
            : undefined,
        completedAt: shouldTransition && nextState === "paid" ? new Date() : undefined,
        expiresAt:
          shouldTransition && nextState === "expired" ? toTimestamp(update.occurredAt) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(paymentSessions.id, update.paymentSessionId))
      .returning()

    await touchLinkedBookingUpdatedAt(tx, updated?.bookingId)
    return updated ?? null
  })
}

async function applyPaymentAdapterStateUpdate(
  db: PostgresJsDatabase,
  update: PaymentAdapterStateUpdate,
  providerData: PaymentAdapterProviderData,
  runtime: FinanceServiceRuntime,
) {
  if (update.nextState === "paid" || update.nextState === "authorized") {
    return financePaymentSessionCompletionService.completePaymentSession(
      db,
      update.paymentSessionId,
      {
        status: update.nextState,
        captureMode: "automatic",
        ...providerData,
      },
      runtime,
      { requireProcessorIdentityWhenConnectionPinned: true },
    )
  }

  return applyLockedNonCompletionStateUpdate(db, update, providerData)
}

export async function applyPaymentAdapterCallbackEvent(
  db: PostgresJsDatabase,
  event: PaymentCallbackEvent,
  runtime: FinanceServiceRuntime = {},
) {
  const update: PaymentAdapterStateUpdate = { ...event, source: "callback" }
  const providerData = {
    provider: event.processorIdentity?.providerId,
    providerConnectionId: event.processorIdentity?.connectionId,
    providerSessionId: event.processorSessionId ?? undefined,
    providerPaymentId: event.processorPaymentId ?? undefined,
    providerPayload: event.raw === undefined ? undefined : { callback: event.raw },
    metadata: { paymentAdapterEventId: event.eventId, paymentAdapterOccurredAt: event.occurredAt },
  }

  return applyPaymentAdapterStateUpdate(db, update, providerData, runtime)
}

export async function applyPaymentAdapterStatusResult(
  db: PostgresJsDatabase,
  paymentSessionId: string,
  result: PaymentStatusResult,
  runtime: FinanceServiceRuntime = {},
  checkedAt = new Date(),
) {
  const occurredAt = checkedAt.toISOString()
  return applyPaymentAdapterStateUpdate(
    db,
    {
      source: "status",
      paymentSessionId,
      nextState: result.nextState,
      occurredAt,
      processorIdentity: result.processorIdentity,
      processorSessionId: result.processorSessionId,
      processorPaymentId: result.processorPaymentId,
    },
    {
      provider: result.processorIdentity?.providerId,
      providerConnectionId: result.processorIdentity?.connectionId,
      providerSessionId: result.processorSessionId ?? undefined,
      providerPaymentId: result.processorPaymentId ?? undefined,
      providerPayload: result.raw === undefined ? undefined : { status: result.raw },
      metadata: { paymentAdapterStatusCheckedAt: occurredAt },
    },
    runtime,
  )
}

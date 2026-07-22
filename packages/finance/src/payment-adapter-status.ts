import type {
  PaymentAdapter,
  PaymentAdapterRuntimeContext,
  PaymentStatusResult,
} from "@voyant-travel/payments"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import {
  assertPaymentAdapterProcessorIdentityForLockedSession,
  canApplyPaymentAdapterStateTransition,
} from "./payment-adapter-session-guard.js"
import { type PaymentSession, paymentSessions } from "./schema/payment-sessions.js"
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

function processorIdentityForStoredSession(session: PaymentSession) {
  if (!session.provider || !session.providerConnectionId) {
    return undefined
  }

  return {
    providerId: session.provider,
    connectionId: session.providerConnectionId,
  }
}

async function applyLockedNonCompletionStatusResult(
  db: PostgresJsDatabase,
  sessionId: string,
  result: PaymentStatusResult,
  checkedAt: string,
) {
  return db.transaction(async (tx) => {
    const [session] = await tx
      .select()
      .from(paymentSessions)
      .where(eq(paymentSessions.id, sessionId))
      .for("update")
      .limit(1)
    if (!session) return null

    const adoptedIdentity = assertPaymentAdapterProcessorIdentityForLockedSession(
      session,
      result.processorIdentity,
    )
    const provider = adoptedIdentity.provider ?? session.provider ?? undefined
    const providerConnectionId =
      adoptedIdentity.providerConnectionId ?? session.providerConnectionId ?? undefined
    const nextState = result.nextState
    const shouldTransition = canApplyPaymentAdapterStateTransition(session.status, nextState)
    const failedAt = shouldTransition && nextState === "failed" ? new Date(checkedAt) : undefined
    const cancelledAt =
      shouldTransition && nextState === "cancelled" ? new Date(checkedAt) : undefined
    const expiredAt = shouldTransition && nextState === "expired" ? new Date(checkedAt) : undefined

    const [updated] = await tx
      .update(paymentSessions)
      .set({
        status: shouldTransition ? nextState : undefined,
        provider,
        providerConnectionId,
        providerSessionId: result.processorSessionId ?? session.providerSessionId ?? undefined,
        providerPaymentId: result.processorPaymentId ?? session.providerPaymentId ?? undefined,
        providerPayload: mergeJsonbColumn(
          paymentSessions.providerPayload,
          result.raw === undefined ? undefined : { status: result.raw },
        ),
        metadata: mergeJsonbColumn(paymentSessions.metadata, {
          paymentAdapterStatusCheckedAt: checkedAt,
        }),
        failedAt,
        cancelledAt,
        expiredAt,
        failureCode:
          shouldTransition && nextState === "failed" ? "payment_adapter_status" : undefined,
        failureMessage:
          shouldTransition && nextState === "failed"
            ? "Payment adapter status refresh mapped this session to failed."
            : undefined,
        completedAt: shouldTransition && nextState === "paid" ? new Date(checkedAt) : undefined,
        expiresAt: shouldTransition && nextState === "expired" ? toTimestamp(checkedAt) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(paymentSessions.id, sessionId))
      .returning()

    await touchLinkedBookingUpdatedAt(tx, updated?.bookingId)
    return updated ?? null
  })
}

async function applyPaymentAdapterStatusResult(
  db: PostgresJsDatabase,
  sessionId: string,
  result: PaymentStatusResult,
  checkedAt: string,
  runtime: FinanceServiceRuntime = {},
) {
  const providerData = {
    provider: result.processorIdentity?.providerId,
    providerConnectionId: result.processorIdentity?.connectionId,
    providerSessionId: result.processorSessionId ?? undefined,
    providerPaymentId: result.processorPaymentId ?? undefined,
    providerPayload: result.raw === undefined ? undefined : { status: result.raw },
    metadata: { paymentAdapterStatusCheckedAt: checkedAt },
  }

  if (result.nextState === "paid" || result.nextState === "authorized") {
    return financePaymentSessionCompletionService.completePaymentSession(
      db,
      sessionId,
      {
        status: result.nextState,
        captureMode: "automatic",
        ...providerData,
      },
      runtime,
      { requireProcessorIdentityWhenConnectionPinned: true },
    )
  }

  return applyLockedNonCompletionStatusResult(db, sessionId, result, checkedAt)
}

export interface PaymentAdapterStatusRefreshOptions {
  adapter: PaymentAdapter
  context: PaymentAdapterRuntimeContext
  runtime?: FinanceServiceRuntime
  now?: () => Date
}

export async function refreshPaymentSessionStatusWithAdapter(
  db: PostgresJsDatabase,
  sessionId: string,
  options: PaymentAdapterStatusRefreshOptions,
) {
  if (!options.adapter.capabilities.status || typeof options.adapter.status !== "function") {
    return null
  }

  const [session] = await db
    .select()
    .from(paymentSessions)
    .where(eq(paymentSessions.id, sessionId))
    .limit(1)
  if (!session) return null

  const result = await options.adapter.status(options.context, {
    paymentSessionId: session.id,
    processorSessionId: session.providerSessionId ?? undefined,
    processorPaymentId: session.providerPaymentId ?? undefined,
    processorIdentity: processorIdentityForStoredSession(session),
  })
  const checkedAt = (options.now?.() ?? new Date()).toISOString()

  return applyPaymentAdapterStatusResult(db, session.id, result, checkedAt, options.runtime ?? {})
}

import type { PaymentAdapter, PaymentAdapterRuntimeContext } from "@voyant-travel/payments"
import { and, eq, inArray, isNotNull, or, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { applyPaymentAdapterStatusResult } from "./payment-adapter-events.js"
import { paymentSessions } from "./schema/payment-sessions.js"
import type { FinanceServiceRuntime } from "./service-shared.js"

export interface PaymentAdapterStatusRefreshExecution {
  context: PaymentAdapterRuntimeContext
  runtime?: FinanceServiceRuntime
  checkedAt?: Date
}

const PAYMENT_ADAPTER_STATUS_REFRESH_LEASE_MS = 120_000
const PAYMENT_ADAPTER_STATUS_REFRESH_AFTER_KEY = "paymentAdapterStatusRefreshAfter"
const PAYMENT_ADAPTER_INITIATION_STATE_KEY = "paymentAdapterInitiationState"
const PAYMENT_ADAPTER_POLLABLE_STATES = ["requires_redirect", "processing", "authorized"] as const

/**
 * Refresh one persisted session through the deployment-selected adapter.
 *
 * Historical processor identity comes from the session, never from the public
 * caller. Legacy `provider = managed` rows intentionally omit identity so the
 * control plane can use its guarded single-revision compatibility path and
 * return the concrete identity for one-way adoption.
 */
export async function refreshPaymentAdapterStatus(
  adapter: PaymentAdapter,
  db: PostgresJsDatabase,
  paymentSessionId: string,
  execution: PaymentAdapterStatusRefreshExecution,
) {
  if (!adapter.capabilities.status || typeof adapter.status !== "function") return null

  const checkedAt = execution.checkedAt ?? new Date()
  const databaseNowEpochMs = execution.checkedAt
    ? sql`${execution.checkedAt.getTime()}::numeric`
    : sql`floor(extract(epoch from clock_timestamp()) * 1000)`
  const [session] = await db
    .update(paymentSessions)
    .set({
      metadata: sql`coalesce(${paymentSessions.metadata}, '{}'::jsonb) || jsonb_build_object(${PAYMENT_ADAPTER_STATUS_REFRESH_AFTER_KEY}::text, ${databaseNowEpochMs} + ${PAYMENT_ADAPTER_STATUS_REFRESH_LEASE_MS}::numeric)`,
      updatedAt: checkedAt,
    })
    .where(
      and(
        eq(paymentSessions.id, paymentSessionId),
        inArray(paymentSessions.status, PAYMENT_ADAPTER_POLLABLE_STATES),
        or(
          isNotNull(paymentSessions.providerConnectionId),
          isNotNull(paymentSessions.providerSessionId),
          isNotNull(paymentSessions.providerPaymentId),
          sql`${paymentSessions.metadata}->>${PAYMENT_ADAPTER_INITIATION_STATE_KEY}::text = 'uncertain'`,
        ),
        sql`case when jsonb_typeof(${paymentSessions.metadata}->${PAYMENT_ADAPTER_STATUS_REFRESH_AFTER_KEY}::text) = 'number' then (${paymentSessions.metadata}->>${PAYMENT_ADAPTER_STATUS_REFRESH_AFTER_KEY}::text)::numeric <= ${databaseNowEpochMs} else true end`,
      ),
    )
    .returning()
  if (!session) return null

  const processorIdentity =
    session.provider && session.provider !== "managed" && session.providerConnectionId
      ? {
          providerId: session.provider,
          connectionId: session.providerConnectionId,
        }
      : undefined

  const result = await adapter.status(execution.context, {
    paymentSessionId: session.id,
    processorSessionId: session.providerSessionId,
    processorPaymentId: session.providerPaymentId,
    processorIdentity,
  })
  const completedAt = execution.checkedAt ?? new Date()

  return applyPaymentAdapterStatusResult(db, session.id, result, execution.runtime, completedAt)
}

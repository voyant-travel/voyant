import type { PaymentAdapter, PaymentAdapterRuntimeContext } from "@voyant-travel/payments"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { applyPaymentAdapterStatusResult } from "./payment-adapter-events.js"
import { paymentSessions } from "./schema/payment-sessions.js"
import type { FinanceServiceRuntime } from "./service-shared.js"

export interface PaymentAdapterStatusRefreshExecution {
  context: PaymentAdapterRuntimeContext
  runtime?: FinanceServiceRuntime
  checkedAt?: Date
}

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
  const [session] = await db
    .select()
    .from(paymentSessions)
    .where(eq(paymentSessions.id, paymentSessionId))
    .limit(1)
  if (!session) return null

  if (
    session.status === "paid" ||
    !adapter.capabilities.status ||
    typeof adapter.status !== "function"
  ) {
    return session
  }

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

  return applyPaymentAdapterStatusResult(
    db,
    session.id,
    result,
    execution.runtime,
    execution.checkedAt,
  )
}

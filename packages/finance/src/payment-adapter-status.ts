import type { PaymentAdapter, PaymentAdapterRuntimeContext } from "@voyant-travel/payments"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import {
  applyPaymentAdapterReportedState,
  paymentAdapterRawPayload,
} from "./payment-adapter-events.js"
import { paymentSessions } from "./schema/payment-sessions.js"
import type { FinanceServiceRuntime } from "./service-shared.js"

export interface PaymentAdapterStatusRefreshOptions {
  adapter?: PaymentAdapter | null
  context: PaymentAdapterRuntimeContext
  runtime?: FinanceServiceRuntime
  now?: () => Date
}

export async function refreshPaymentSessionFromPaymentAdapterStatus(
  db: PostgresJsDatabase,
  sessionId: string,
  options: PaymentAdapterStatusRefreshOptions,
) {
  const { adapter } = options
  if (!adapter?.capabilities.status || typeof adapter.status !== "function") {
    return null
  }

  const [session] = await db
    .select()
    .from(paymentSessions)
    .where(eq(paymentSessions.id, sessionId))
    .limit(1)
  if (!session) return null

  const processorIdentity =
    session.provider && session.providerConnectionId
      ? {
          providerId: session.provider,
          connectionId: session.providerConnectionId,
        }
      : undefined

  const result = await adapter.status(options.context, {
    paymentSessionId: session.id,
    processorSessionId: session.providerSessionId ?? undefined,
    processorPaymentId: session.providerPaymentId ?? undefined,
    processorIdentity,
  })
  const checkedAt = (options.now?.() ?? new Date()).toISOString()

  return applyPaymentAdapterReportedState(
    db,
    {
      paymentSessionId: session.id,
      nextState: result.nextState,
      occurredAt: checkedAt,
      processorIdentity: result.processorIdentity,
      processorSessionId: result.processorSessionId,
      processorPaymentId: result.processorPaymentId,
      providerPayload:
        result.raw === undefined ? undefined : { status: paymentAdapterRawPayload(result.raw) },
      metadata: {
        paymentAdapterStatusCheckedAt: checkedAt,
      },
    },
    options.runtime,
  )
}

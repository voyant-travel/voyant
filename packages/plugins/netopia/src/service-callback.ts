import type { EventBus } from "@voyantjs/core"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { resolveNetopiaRuntimeOptions } from "./client.js"
import {
  amountToCents,
  financeService,
  mapNetopiaPaymentStatus,
  mergeRecord,
  type NetopiaCallbackResult,
  normalizeCurrency,
} from "./service-shared.js"
import type { NetopiaRuntimeOptions, NetopiaWebhookPayload } from "./types.js"

export async function handleCallback(
  db: PostgresJsDatabase,
  payload: NetopiaWebhookPayload,
  runtimeOptions: NetopiaRuntimeOptions = {},
  bindings?: Record<string, unknown>,
  financeRuntime: { eventBus?: EventBus } = {},
): Promise<NetopiaCallbackResult> {
  const runtime = resolveNetopiaRuntimeOptions(bindings, runtimeOptions)
  const orderId = payload.order.orderID
  const lookup = await financeService.listPaymentSessions(db, {
    provider: "netopia",
    externalReference: orderId,
    limit: 1,
    offset: 0,
  })

  let session = lookup.data[0] ?? null
  if (!session) {
    session = await financeService.getPaymentSessionById(db, orderId)
  }

  if (!session) {
    return {
      action: "ignored",
      reason: "payment_session_not_found",
      session: null,
      orderId,
    }
  }

  const callbackState = mapNetopiaPaymentStatus(payload.payment.status, runtime)
  const providerPayload = mergeRecord(session.providerPayload, {
    netopiaCallback: payload,
  })
  const normalizedCurrency = normalizeCurrency(payload.payment.currency)
  const amountCents = amountToCents(payload.payment.amount)

  if (
    callbackState === "completed" &&
    (normalizedCurrency !== normalizeCurrency(session.currency) ||
      amountCents !== session.amountCents)
  ) {
    const failed = await financeService.failPaymentSession(db, session.id, {
      providerSessionId: payload.payment.ntpID,
      providerPaymentId: payload.payment.ntpID,
      externalReference: orderId,
      failureCode: "amount_or_currency_mismatch",
      failureMessage: `Expected ${session.amountCents} ${normalizeCurrency(session.currency)}, received ${amountCents} ${normalizedCurrency}`,
      providerPayload,
    })

    return {
      action: "failed",
      reason: "amount_or_currency_mismatch",
      session: failed,
      orderId,
    }
  }

  if (callbackState === "processing") {
    const updated = await financeService.updatePaymentSession(db, session.id, {
      status: "processing",
      provider: "netopia",
      providerSessionId: payload.payment.ntpID,
      providerPaymentId: payload.payment.ntpID,
      externalReference: orderId,
      providerPayload,
    })

    return {
      action: "processing",
      session: updated,
      orderId,
    }
  }

  if (callbackState === "completed") {
    if (session.status === "paid" || session.status === "authorized") {
      const current = await financeService.updatePaymentSession(db, session.id, {
        provider: "netopia",
        providerSessionId: payload.payment.ntpID,
        providerPaymentId: payload.payment.ntpID,
        externalReference: orderId,
        providerPayload,
      })

      return {
        action: "ignored",
        reason: "already_completed",
        session: current,
        orderId,
      }
    }

    const completed = await financeService.completePaymentSession(
      db,
      session.id,
      {
        status: "paid",
        captureMode: "manual",
        paymentMethod: "credit_card",
        providerSessionId: payload.payment.ntpID,
        providerPaymentId: payload.payment.ntpID,
        externalReference: orderId,
        externalAuthorizationId:
          typeof payload.payment.data?.AuthCode === "string"
            ? payload.payment.data.AuthCode
            : payload.payment.ntpID,
        externalCaptureId:
          typeof payload.payment.data?.RRN === "string"
            ? payload.payment.data.RRN
            : payload.payment.ntpID,
        approvalCode:
          typeof payload.payment.data?.AuthCode === "string"
            ? payload.payment.data.AuthCode
            : undefined,
        referenceNumber:
          typeof payload.payment.data?.RRN === "string" ? payload.payment.data.RRN : undefined,
        authorizedAt: new Date().toISOString(),
        capturedAt: new Date().toISOString(),
        paymentDate: new Date().toISOString(),
        providerPayload,
      },
      { eventBus: financeRuntime.eventBus },
    )

    return {
      action: "completed",
      session: completed,
      orderId,
    }
  }

  const failed = await financeService.failPaymentSession(db, session.id, {
    providerSessionId: payload.payment.ntpID,
    providerPaymentId: payload.payment.ntpID,
    externalReference: orderId,
    failureCode:
      typeof payload.payment.code === "string" && payload.payment.code.length > 0
        ? payload.payment.code
        : `netopia_status_${payload.payment.status}`,
    failureMessage:
      typeof payload.payment.message === "string" && payload.payment.message.length > 0
        ? payload.payment.message
        : "Netopia payment was not approved",
    providerPayload,
  })

  return {
    action: "failed",
    session: failed,
    orderId,
  }
}

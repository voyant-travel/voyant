/**
 * Provider-agnostic card-payment seam.
 *
 * Finance defines the neutral contract a deployment's chosen card processor
 * implements; checkout surfaces (flights, trips checkout, payment links,
 * catalog) route card payments through a single `CardPaymentStarter` rather
 * than importing any specific provider. The Netopia (or Stripe/Adyen/…)
 * implementation lives in the provider's own package — finance never names a
 * processor.
 *
 * Returning `null` from a starter means "this processor isn't configured" so
 * callers fall back gracefully (bank-transfer paths still work).
 */
import type { PaymentAdapter, PaymentAdapterRuntimeContext } from "@voyant-travel/payments"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"
import { paymentSessions } from "./schema/payment-sessions.js"

/**
 * Billing details a card processor needs to start a hosted payment.
 *
 * Field names are kept structurally compatible with a provider's own billing
 * shape (e.g. Netopia's `NetopiaBillingAddress`) so callers' existing billing
 * objects satisfy this without reshaping. `country` accepts a numeric code or
 * ISO string depending on the processor.
 */
export interface CardPaymentBilling {
  email: string
  phone?: string
  firstName: string
  lastName?: string
  city?: string
  country?: number | string
  state?: string
  postalCode?: string
  details?: string
}

/** Arguments a caller maps from its checkout surface to start a card payment. */
export interface CardPaymentStartArgs {
  db: PostgresJsDatabase
  sessionId: string
  billing: CardPaymentBilling
  description?: string
  returnUrl?: string
}

/** Result of a card-payment start: the hosted-payment URL to redirect to. */
export interface CardPaymentStartResult {
  redirectUrl: string | null
}

/**
 * The neutral card-payment starter contract. A deployment selects exactly one
 * implementation (its chosen processor) and every checkout surface routes
 * through it.
 *
 * `c` carries the request env + container so a processor can resolve its own
 * request-scoped runtime. Returning `null` means "this processor isn't
 * configured" — callers fall back (bank transfer still works).
 */
export type CardPaymentStarter = (
  c: Context,
  args: CardPaymentStartArgs,
) => Promise<CardPaymentStartResult | null>

export interface PaymentAdapterCardPaymentStarterOptions {
  resolveContext?(c: Context): PaymentAdapterRuntimeContext
  idempotencyKey?(sessionId: string): string
}

export function createPaymentAdapterCardPaymentStarter(
  adapter: PaymentAdapter,
  options: PaymentAdapterCardPaymentStarterOptions = {},
): CardPaymentStarter {
  return async (c, args) => {
    const [session] = await args.db
      .select()
      .from(paymentSessions)
      .where(eq(paymentSessions.id, args.sessionId))
      .limit(1)
    if (!session) return null

    const idempotencyKey =
      session.idempotencyKey ?? options.idempotencyKey?.(session.id) ?? `payment:${session.id}`
    const result = await adapter.initiate(options.resolveContext?.(c) ?? { env: c.env }, {
      paymentSessionId: session.id,
      money: { amountMinor: session.amountCents, currency: session.currency },
      description: args.description ?? session.notes ?? undefined,
      returnUrl: args.returnUrl ?? session.returnUrl ?? undefined,
      idempotencyKey,
      customer: {
        email: args.billing.email,
        phone: args.billing.phone ?? null,
        firstName: args.billing.firstName,
        lastName: args.billing.lastName ?? null,
      },
    })

    await args.db
      .update(paymentSessions)
      .set({
        provider: adapter.id,
        providerSessionId: result.processorSessionId ?? undefined,
        providerPaymentId: result.processorPaymentId ?? undefined,
        redirectUrl: result.checkout?.url ?? undefined,
        status: result.nextState,
        idempotencyKey,
        updatedAt: new Date(),
      })
      .where(eq(paymentSessions.id, session.id))

    return { redirectUrl: result.checkout?.url ?? null }
  }
}

/** Standard statically composed payment-link runtime selected by Storefront. */

import type { CommerceCardPaymentRuntime } from "@voyant-travel/commerce/runtime-port"
import { productMedia, products } from "@voyant-travel/inventory/schema"
import {
  getOperatorPaymentInstructions,
  getOperatorProfile,
} from "@voyant-travel/operator-settings"
import type { PaymentAdapter, PaymentAdapterRuntimeContext } from "@voyant-travel/payments"
import type {
  PaymentLinkRoutesOptions,
  PaymentLinkTripData,
} from "@voyant-travel/storefront/payment-link"
import { and, asc, desc, eq, inArray } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"
import { tripComponents, tripEnvelopes } from "./schema.js"
import { tripsService } from "./service.js"

const FINANCE_CARD_PAYMENT_MODULE = "@voyant-travel/finance/card-payment"

type StartCardPayment = ReturnType<CommerceCardPaymentRuntime["createStartCardPayment"]>
type CardPaymentStartArgs = Parameters<NonNullable<StartCardPayment>>[0]
type CardPaymentStartResult = Awaited<ReturnType<NonNullable<StartCardPayment>>>
type PaymentAdapterCardPaymentStarterFactory = (
  adapter: PaymentAdapter,
  options: {
    resolveContext(c: Context): PaymentAdapterRuntimeContext
    resolveRuntime(c: Context): { eventBus?: unknown }
    idempotencyKey(sessionId: string): string
  },
) => (context: Context, args: CardPaymentStartArgs) => Promise<CardPaymentStartResult>

/** Standard selected payment provider exposed through Commerce's neutral port. */
export function createCommerceCardPaymentRuntime(
  adapter: PaymentAdapter,
): CommerceCardPaymentRuntime {
  return {
    createStartCardPayment: (context) => (args) => startAdapterCardPayment(adapter, context, args),
  }
}

async function startAdapterCardPayment(
  adapter: PaymentAdapter,
  context: Context,
  args: CardPaymentStartArgs,
): Promise<CardPaymentStartResult> {
  const { createPaymentAdapterCardPaymentStarter } = (await import(
    FINANCE_CARD_PAYMENT_MODULE
  )) as {
    createPaymentAdapterCardPaymentStarter: PaymentAdapterCardPaymentStarterFactory
  }
  const starter = createPaymentAdapterCardPaymentStarter(adapter, {
    resolveContext: (c) => ({ env: c.env }),
    resolveRuntime: (c) => ({ eventBus: c.var.eventBus }),
    idempotencyKey: (sessionId) => `payment:${sessionId}`,
  })
  return starter(context, args)
}

interface PaymentConfigBindings {
  APP_URL?: string
  BANK_TRANSFER_BANK_NAME?: string
  BANK_TRANSFER_BENEFICIARY?: string
  BANK_TRANSFER_IBAN?: string
  DASH_BASE_URL?: string
  PUBLIC_CHECKOUT_BASE_URL?: string
}

function resolvePublicCheckoutBaseUrl(bindings: Record<string, unknown>): string | null {
  const env = bindings as PaymentConfigBindings
  return (
    env.PUBLIC_CHECKOUT_BASE_URL?.trim() ||
    env.DASH_BASE_URL?.trim() ||
    env.APP_URL?.trim().replace(/\/api\/?$/, "") ||
    null
  )
}

function resolveEnvironmentBankTransferDetails(bindings: Record<string, unknown>) {
  const env = bindings as PaymentConfigBindings
  if (!env.BANK_TRANSFER_BENEFICIARY || !env.BANK_TRANSFER_IBAN) return null
  return {
    beneficiary: env.BANK_TRANSFER_BENEFICIARY,
    iban: env.BANK_TRANSFER_IBAN,
    bankName: env.BANK_TRANSFER_BANK_NAME ?? null,
  }
}

function getDb(c: Context): PostgresJsDatabase {
  return c.get("db") as PostgresJsDatabase
}

/** Bank-transfer beneficiary details from operator settings merged with env. */
async function resolveBankTransferDetails(c: Context) {
  const db = getDb(c)
  const [operatorProfile, paymentInstructions] = await Promise.all([
    getOperatorProfile(db),
    getOperatorPaymentInstructions(db),
  ])
  const environment = resolveEnvironmentBankTransferDetails(c.env as Record<string, unknown>)
  const beneficiary =
    paymentInstructions?.bankTransferBeneficiary ||
    operatorProfile?.legalName ||
    operatorProfile?.name ||
    environment?.beneficiary
  const iban = paymentInstructions?.iban || environment?.iban
  if (!beneficiary || !iban) return null
  return {
    beneficiary,
    iban,
    bankName: paymentInstructions?.bank || environment?.bankName || null,
  }
}

/** Start a fresh card payment via this deployment's processor, or report it isn't configured. */
const startCardPayment: PaymentLinkRoutesOptions["startCardPayment"] = async () => ({
  configured: false,
})

/**
 * Resolve a trip envelope (+ reconcile a paid checkout) and its visible
 * components with product-media enrichment. Encapsulates the trips + inventory
 * schema reads the package stays free of.
 */
const resolveTripData: PaymentLinkRoutesOptions["resolveTripData"] = async (
  c,
  tripEnvelopeId,
  session,
): Promise<PaymentLinkTripData | null> => {
  const db = getDb(c)

  const [envelope] = await db
    .select()
    .from(tripEnvelopes)
    .where(eq(tripEnvelopes.id, tripEnvelopeId))
    .limit(1)
  if (!envelope) return null

  if (session.status === "paid" && envelope.status !== "booked") {
    try {
      await tripsService.completeTripCheckout(db, {
        envelopeId: envelope.id,
        paymentSessionId: session.id,
        payload: {
          source: "payment_link_trip_summary_reconcile",
          amountCents: session.amountCents,
          currency: session.currency,
          provider: session.provider,
        },
      })
    } catch (err) {
      console.error("[trips] payment summary reconciliation failed", err)
    }
  }

  const components = await db
    .select()
    .from(tripComponents)
    .where(eq(tripComponents.envelopeId, tripEnvelopeId))
    .orderBy(asc(tripComponents.sequence), asc(tripComponents.createdAt))

  const visibleComponents = components.filter(
    (component) => component.status !== "removed" && component.status !== "cancelled",
  )

  const productIds = Array.from(
    new Set(
      visibleComponents
        .map((component) => component.entityId)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  )

  const mediaByProductId = new Map<string, { url: string; altText: string | null }>()
  const productNameById = new Map<string, string>()
  if (productIds.length > 0) {
    const productRows = await db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(inArray(products.id, productIds))
    for (const row of productRows) productNameById.set(row.id, row.name)
    const mediaRows = await db
      .select({
        productId: productMedia.productId,
        url: productMedia.url,
        altText: productMedia.altText,
        isCover: productMedia.isCover,
        sortOrder: productMedia.sortOrder,
        mediaType: productMedia.mediaType,
      })
      .from(productMedia)
      .where(and(inArray(productMedia.productId, productIds), eq(productMedia.mediaType, "image")))
      .orderBy(asc(productMedia.productId), desc(productMedia.isCover), asc(productMedia.sortOrder))
    for (const row of mediaRows) {
      if (!mediaByProductId.has(row.productId)) {
        mediaByProductId.set(row.productId, { url: row.url, altText: row.altText })
      }
    }
  }

  return {
    envelope: { id: envelope.id, status: envelope.status },
    components: visibleComponents.map((component) => ({
      id: component.id,
      kind: component.kind,
      entityModule: component.entityModule,
      entityId: component.entityId,
      description: component.description,
      status: component.status,
      sequence: component.sequence,
      componentTotalAmountCents: component.componentTotalAmountCents,
      componentCurrency: component.componentCurrency,
      metadata: (component.metadata ?? null) as Record<string, unknown> | null,
    })),
    productNameById,
    mediaByProductId,
  }
}

/** Build the payment-link route-module options for this deployment. */
export function createStandardPaymentLinkRouteOptions(): PaymentLinkRoutesOptions {
  return {
    resolveBankTransferDetails,
    resolvePublicCheckoutBaseUrl: (c) =>
      resolvePublicCheckoutBaseUrl(c.env as Record<string, unknown>),
    startCardPayment,
    resolveTripData,
  }
}

/** Standard statically composed payment-link runtime selected by Storefront. */

import type { CommerceCardPaymentRuntime } from "@voyant-travel/commerce/runtime-port"
import type { CardPaymentStarter } from "@voyant-travel/finance/card-payment"
import { productMedia, products } from "@voyant-travel/inventory/schema"
import {
  getOperatorPaymentInstructions,
  getOperatorProfile,
} from "@voyant-travel/operator-settings"
import type {
  PaymentLinkRoutesOptions,
  PaymentLinkTripData,
} from "@voyant-travel/storefront/payment-link"
import { and, asc, desc, eq, inArray } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"
import { tripComponents, tripEnvelopes } from "./schema.js"
import { tripsService } from "./service.js"

let cardPaymentStarterPromise: Promise<CardPaymentStarter | null> | undefined

function resolveCardPaymentStarter(): Promise<CardPaymentStarter | null> {
  cardPaymentStarterPromise ??= import("@voyant-travel/plugin-netopia")
    .then((module) => module.netopiaCardPaymentStarter())
    .catch((error: unknown) => {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ERR_MODULE_NOT_FOUND" &&
        /Cannot find (?:package|module) ['"]@voyant-travel\/plugin-netopia['"]/.test(error.message)
      ) {
        return null
      }
      throw error
    })
  return cardPaymentStarterPromise
}

/** Standard selected payment provider exposed through Commerce's neutral port. */
export function createCommerceCardPaymentRuntime(): CommerceCardPaymentRuntime {
  return {
    createStartCardPayment:
      (context) =>
      async ({ db, sessionId, billing, description, returnUrl }) => {
        const cardPaymentStarter = await resolveCardPaymentStarter()
        if (!cardPaymentStarter) return null
        return cardPaymentStarter(context, {
          db,
          sessionId,
          billing: {
            email: billing.email,
            phone: "0000000000",
            firstName: billing.firstName,
            lastName: billing.lastName,
            city: "TBD",
            country: 642,
            state: "TBD",
            postalCode: "00000",
            details: "Pending — customer to confirm at payment.",
          },
          description,
          returnUrl,
        })
      },
  }
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
const startCardPayment: PaymentLinkRoutesOptions["startCardPayment"] = async (c, session) => {
  const cardPaymentStarter = await resolveCardPaymentStarter()
  if (!cardPaymentStarter) return { configured: false }
  const [first, ...rest] = (session.payerName ?? "").trim().split(/\s+/)
  const last = rest.length > 0 ? rest.join(" ") : "Customer"
  const result = await cardPaymentStarter(c, {
    db: getDb(c),
    sessionId: session.id,
    billing: {
      email: session.payerEmail ?? "tbd@example.com",
      phone: "0000000000",
      firstName: first || "Customer",
      lastName: last,
      city: "TBD",
      country: 642,
      state: "TBD",
      postalCode: "00000",
      details: "Pending - customer to confirm at payment.",
    },
    description: session.notes ?? `Payment ${session.id}`,
  })
  if (!result) {
    return { configured: false }
  }
  return {
    configured: true,
    redirectUrl: result.redirectUrl,
  }
}

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

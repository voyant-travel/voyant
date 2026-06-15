/**
 * Public payment-link + checkout-status routes — owned by
 * `@voyant-travel/storefront`.
 *
 * agent-quality: file-size exception -- the public payment-link surface
 * (config, retry, resolve, start-card, trip/booking summary, checkout-status)
 * is one cohesive route family backed by the finance payment-session record;
 * splitting it would scatter a single checkout contract.
 *
 *   GET  /v1/public/payment-link-config
 *   POST /v1/public/payment-link/:sessionId/retry
 *   GET  /v1/public/payment-link/resolve
 *   POST /v1/public/payment-link/:sessionId/start-card
 *   GET  /v1/public/payment-link/:sessionId/trip-summary
 *   GET  /v1/public/payment-link/:sessionId/booking-summary
 *   GET  /v1/public/bookings/:bookingId/checkout-status
 *
 * The routes are mounted at their ABSOLUTE public paths so the deployment can
 * lazy-mount them via `lazyRoutes.paths`. All cross-module access that
 * storefront does not already depend on (inventory product media, trip
 * envelopes/components reconciliation, the card-payment provider, and the
 * operator settings + checkout base URL) is INJECTED via `options` — the
 * package never statically imports inventory / trips / the netopia plugin /
 * the operator settings module.
 *
 * Storefront already depends acyclically on `@voyant-travel/bookings` and
 * `@voyant-travel/finance`, so the booking / invoice / payment-session reads
 * use those schemas directly.
 */
import { bookingItems, bookings } from "@voyant-travel/bookings/schema"
import { financeService } from "@voyant-travel/finance"
import { invoices, paymentSessions } from "@voyant-travel/finance/schema"
import { and, asc, desc, eq, or } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"
import { Hono } from "hono"

const PUBLIC_PAYMENT_LINK_CONFIG_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=600"

// ─────────────────────────────────────────────────────────────────
// Injected deployment surface (structural — no inventory / trips /
// netopia / operator-settings static import)
// ─────────────────────────────────────────────────────────────────

/** Resolved bank-transfer beneficiary details from operator settings + env. */
export interface PaymentLinkBankTransferDetails {
  beneficiary: string
  iban: string
  bankName?: string | null
}

/** A resolved trip component, with optional product enrichment. */
export interface PaymentLinkTripComponent {
  id: string
  kind: string
  entityModule: string | null
  entityId: string | null
  description: string | null
  status: string | null
  sequence: number | null
  componentTotalAmountCents: number | null
  componentCurrency: string | null
  metadata: Record<string, unknown> | null
}

/** A resolved trip envelope + its visible components and product enrichment. */
export interface PaymentLinkTripData {
  envelope: { id: string; status: string | null }
  /**
   * Visible (non-removed, non-cancelled) components, already ordered by
   * sequence then createdAt.
   */
  components: PaymentLinkTripComponent[]
  /** product id → display name (from the inventory product record). */
  productNameById: Map<string, string>
  /** product id → cover image (from inventory product media). */
  mediaByProductId: Map<string, { url: string; altText: string | null }>
}

/** The payment-session record fields the handlers read across routes. */
export interface PaymentLinkSessionInput {
  invoiceId: string | null
  amountCents: number
  currency: string
}

/**
 * Deployment-supplied access the payment-link handlers need. Everything here
 * encapsulates a module storefront does not statically depend on, so the
 * package stays free of inventory / trips / netopia / operator-settings
 * imports.
 */
export interface PaymentLinkRoutesOptions {
  /**
   * Resolve the bank-transfer beneficiary details (operator settings merged
   * with deploy-wide env defaults), or `null` when not configured.
   */
  resolveBankTransferDetails(c: Context): Promise<PaymentLinkBankTransferDetails | null>
  /** Resolve the public checkout base URL from the deployment bindings. */
  resolvePublicCheckoutBaseUrl(c: Context): string | null
  /**
   * Best-effort: ensure a fresh payment session can be started on the card
   * provider, returning the redirect URL (or null). Returns `{ configured:
   * false }` when no card processor is wired so the handler can 503. May throw
   * — the handler maps the error to a 502.
   */
  startCardPayment(
    c: Context,
    session: {
      id: string
      payerName: string | null
      payerEmail: string | null
      notes: string | null
      redirectUrl: string | null
    },
  ): Promise<{ configured: true; redirectUrl: string | null } | { configured: false }>
  /**
   * Resolve a trip envelope (+ reconcile a paid checkout) and its visible
   * components with product-media enrichment, or `null` when the envelope is
   * gone. Encapsulates the trips + inventory schema reads.
   */
  resolveTripData(
    c: Context,
    tripEnvelopeId: string,
    session: {
      id: string
      status: string | null
      amountCents: number
      currency: string
      provider: string | null
    },
  ): Promise<PaymentLinkTripData | null>
}

// ─────────────────────────────────────────────────────────────────
// Local helpers
// ─────────────────────────────────────────────────────────────────

function cachePublicPaymentLinkConfig(c: Context) {
  c.header("Cache-Control", PUBLIC_PAYMENT_LINK_CONFIG_CACHE_CONTROL)
}

function requireRouteParam(c: Context, name: string): string | Response {
  const value = c.req.param(name)
  return value ? value : c.json({ error: `${name} route param is required` }, 400)
}

function getDb(c: Context): PostgresJsDatabase {
  return c.get("db") as PostgresJsDatabase
}

async function buildPublicBankTransferInstructions(
  c: Context,
  options: PaymentLinkRoutesOptions,
  bookingNumber: string,
  session: PaymentLinkSessionInput,
) {
  const db = getDb(c)
  const details = await options.resolveBankTransferDetails(c)
  if (!details) return null

  const [invoice] = session.invoiceId
    ? await db
        .select({
          invoiceNumber: invoices.invoiceNumber,
          dueDate: invoices.dueDate,
          balanceDueCents: invoices.balanceDueCents,
          currency: invoices.currency,
        })
        .from(invoices)
        .where(eq(invoices.id, session.invoiceId))
        .limit(1)
    : []

  return {
    beneficiary: details.beneficiary,
    iban: details.iban,
    bankName: details.bankName ?? "-",
    reference: `BOOK-${bookingNumber}`,
    amountCents: invoice?.balanceDueCents ?? session.amountCents,
    currency: invoice?.currency ?? session.currency,
    dueAt: invoice?.dueDate ?? null,
    proformaNumber: invoice?.invoiceNumber ?? null,
  }
}

// ─────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────

/**
 * Build the public payment-link routes. Paths are ABSOLUTE so the deployment
 * can lazy-mount the returned app directly via `lazyRoutes.paths`.
 */
export function createPaymentLinkRoutes(options: PaymentLinkRoutesOptions): Hono {
  const hono = new Hono()

  hono.get("/v1/public/payment-link-config", async (c) => {
    const bankTransfer = await options.resolveBankTransferDetails(c)
    cachePublicPaymentLinkConfig(c)
    return c.json({
      data: {
        publicCheckoutBaseUrl: options.resolvePublicCheckoutBaseUrl(c),
        bankTransfer,
      },
    })
  })

  hono.post("/v1/public/payment-link/:sessionId/retry", async (c) => {
    const sessionId = requireRouteParam(c, "sessionId")
    if (sessionId instanceof Response) return sessionId
    const db = getDb(c)
    const [original] = await db
      .select()
      .from(paymentSessions)
      .where(eq(paymentSessions.id, sessionId))
      .limit(1)
    if (!original) return c.json({ error: "Session not found" }, 404)
    if (original.status === "paid" || original.status === "authorized") {
      return c.json({ data: { sessionId: original.id, alreadyPaid: true } })
    }
    const dbCast = db as Parameters<typeof financeService.createPaymentSession>[0]
    const fresh = await financeService.createPaymentSession(dbCast, {
      targetType: original.targetType,
      targetId: original.targetId ?? undefined,
      bookingId: original.bookingId ?? undefined,
      invoiceId: original.invoiceId ?? undefined,
      bookingPaymentScheduleId: original.bookingPaymentScheduleId ?? undefined,
      bookingGuaranteeId: original.bookingGuaranteeId ?? undefined,
      currency: original.currency,
      amountCents: original.amountCents,
      status: "pending",
      provider: original.provider ?? undefined,
      paymentMethod: original.paymentMethod ?? undefined,
      payerEmail: original.payerEmail ?? undefined,
      payerName: original.payerName ?? undefined,
      notes: original.notes ?? undefined,
    })
    if (!fresh) return c.json({ error: "Failed to create payment session" }, 500)
    return c.json({ data: { sessionId: fresh.id } })
  })

  hono.get("/v1/public/payment-link/resolve", async (c) => {
    const ref = c.req.query("ref")
    if (!ref) return c.json({ error: "ref query param is required" }, 400)
    const db = getDb(c)
    const [session] = await db
      .select({ id: paymentSessions.id })
      .from(paymentSessions)
      .where(
        or(
          eq(paymentSessions.id, ref),
          eq(paymentSessions.clientReference, ref),
          eq(paymentSessions.externalReference, ref),
        ),
      )
      .limit(1)
    if (!session) return c.json({ error: "Payment session not found" }, 404)
    return c.json({ data: { sessionId: session.id } })
  })

  hono.post("/v1/public/payment-link/:sessionId/start-card", async (c) => {
    const sessionId = requireRouteParam(c, "sessionId")
    if (sessionId instanceof Response) return sessionId
    const db = getDb(c)
    const [session] = await db
      .select()
      .from(paymentSessions)
      .where(eq(paymentSessions.id, sessionId))
      .limit(1)
    if (!session) return c.json({ error: "Session not found" }, 404)
    if (session.redirectUrl) {
      return c.json({ data: { redirectUrl: session.redirectUrl } })
    }
    try {
      const started = await options.startCardPayment(c, {
        id: session.id,
        payerName: session.payerName,
        payerEmail: session.payerEmail,
        notes: session.notes,
        redirectUrl: session.redirectUrl,
      })
      if (!started.configured) {
        return c.json({ error: "Card processor not configured" }, 503)
      }
      return c.json({ data: { redirectUrl: started.redirectUrl } })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start card payment"
      return c.json({ error: message }, 502)
    }
  })

  hono.get("/v1/public/payment-link/:sessionId/trip-summary", async (c) => {
    const sessionId = requireRouteParam(c, "sessionId")
    if (sessionId instanceof Response) return sessionId
    const db = getDb(c)
    const [session] = await db
      .select()
      .from(paymentSessions)
      .where(eq(paymentSessions.id, sessionId))
      .limit(1)
    if (!session) return c.json({ error: "Session not found" }, 404)

    const metadata = (session.metadata ?? {}) as Record<string, unknown>
    const tripEnvelopeId =
      typeof metadata.tripEnvelopeId === "string" ? metadata.tripEnvelopeId : null
    if (!tripEnvelopeId) return c.json({ data: null })

    const tripData = await options.resolveTripData(c, tripEnvelopeId, {
      id: session.id,
      status: session.status,
      amountCents: session.amountCents,
      currency: session.currency,
      provider: session.provider,
    })
    if (!tripData) return c.json({ data: null })

    const { envelope, components: visibleComponents, productNameById, mediaByProductId } = tripData

    type Allocation = {
      componentId?: string
      sourceAmountCents?: number
      sourceCurrency?: string
      targetAmountCents?: number
      targetCurrency?: string
      fx?: { rate: number; quotedAt: string } | null
    }
    const allocationsRaw = Array.isArray(metadata.componentAllocations)
      ? (metadata.componentAllocations as Allocation[])
      : []
    const allocationByComponentId = new Map<string, Allocation>()
    for (const allocation of allocationsRaw) {
      if (allocation.componentId) allocationByComponentId.set(allocation.componentId, allocation)
    }

    const trip = {
      envelopeId: envelope.id,
      currency: session.currency,
      totalAmountCents: session.amountCents,
      components: visibleComponents.map((component) => {
        const metadataRecord = (component.metadata ?? {}) as Record<string, unknown>
        const catalogItem = (metadataRecord.catalogItem ?? null) as { name?: string } | null
        const flightDraft = (metadataRecord.flightDraft ?? null) as {
          origin?: string
          destination?: string
        } | null
        const schedule = resolvePublicTripComponentSchedule(metadataRecord)
        const fallbackName =
          catalogItem?.name ??
          (component.entityId ? productNameById.get(component.entityId) : null) ??
          (flightDraft?.origin && flightDraft?.destination
            ? `${flightDraft.origin} -> ${flightDraft.destination}`
            : null) ??
          component.description ??
          component.kind.replaceAll("_", " ")
        const thumbnail = component.entityId
          ? (mediaByProductId.get(component.entityId) ?? null)
          : null
        const catalogThumbnailUrl = publicStringValue(
          readPublicRecord(metadataRecord.catalogItem)?.thumbnailUrl,
        )
        const allocation = allocationByComponentId.get(component.id)
        return {
          id: component.id,
          kind: component.kind,
          entityModule: component.entityModule,
          title: fallbackName,
          thumbnailUrl: thumbnail?.url ?? catalogThumbnailUrl ?? null,
          thumbnailAlt: thumbnail?.altText ?? null,
          scheduledStartsAt: schedule.start,
          scheduledEndsAt: schedule.end,
          sourceAmountCents:
            allocation?.sourceAmountCents ?? component.componentTotalAmountCents ?? null,
          sourceCurrency:
            allocation?.sourceCurrency ?? component.componentCurrency ?? session.currency,
          targetAmountCents:
            allocation?.targetAmountCents ?? component.componentTotalAmountCents ?? null,
          targetCurrency: allocation?.targetCurrency ?? session.currency,
          fx: allocation?.fx ?? null,
        }
      }),
    }
    return c.json({ data: trip })
  })

  hono.get("/v1/public/payment-link/:sessionId/booking-summary", async (c) => {
    const sessionId = requireRouteParam(c, "sessionId")
    if (sessionId instanceof Response) return sessionId
    const db = getDb(c)
    const [session] = await db
      .select({
        id: paymentSessions.id,
        bookingId: paymentSessions.bookingId,
        amountCents: paymentSessions.amountCents,
        currency: paymentSessions.currency,
        metadata: paymentSessions.metadata,
      })
      .from(paymentSessions)
      .where(eq(paymentSessions.id, sessionId))
      .limit(1)
    if (!session) return c.json({ error: "Session not found" }, 404)

    const metadata = (session.metadata ?? {}) as Record<string, unknown>
    if (typeof metadata.tripEnvelopeId === "string" && metadata.tripEnvelopeId.length > 0) {
      return c.json({ data: null })
    }
    if (!session.bookingId) return c.json({ data: null })

    const [booking] = await db
      .select({
        id: bookings.id,
        bookingNumber: bookings.bookingNumber,
        status: bookings.status,
        sellCurrency: bookings.sellCurrency,
        sellAmountCents: bookings.sellAmountCents,
        pax: bookings.pax,
        startDate: bookings.startDate,
        endDate: bookings.endDate,
      })
      .from(bookings)
      .where(eq(bookings.id, session.bookingId))
      .limit(1)
    if (!booking) return c.json({ data: null })

    const items = await db
      .select({
        id: bookingItems.id,
        title: bookingItems.title,
        itemType: bookingItems.itemType,
        quantity: bookingItems.quantity,
        totalSellAmountCents: bookingItems.totalSellAmountCents,
        sellCurrency: bookingItems.sellCurrency,
        startsAt: bookingItems.startsAt,
        endsAt: bookingItems.endsAt,
        serviceDate: bookingItems.serviceDate,
        productNameSnapshot: bookingItems.productNameSnapshot,
        optionNameSnapshot: bookingItems.optionNameSnapshot,
        unitNameSnapshot: bookingItems.unitNameSnapshot,
        departureLabelSnapshot: bookingItems.departureLabelSnapshot,
      })
      .from(bookingItems)
      .where(eq(bookingItems.bookingId, booking.id))
      .orderBy(asc(bookingItems.createdAt))

    return c.json({
      data: {
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
        status: booking.status,
        pax: booking.pax,
        startDate: booking.startDate,
        endDate: booking.endDate,
        chargeAmountCents: session.amountCents,
        currency: session.currency ?? booking.sellCurrency,
        bookingTotalAmountCents: booking.sellAmountCents,
        bookingCurrency: booking.sellCurrency,
        items: items.map((item) => ({
          id: item.id,
          productName: item.productNameSnapshot ?? item.title,
          optionName: item.optionNameSnapshot,
          unitName: item.unitNameSnapshot,
          departureLabel: item.departureLabelSnapshot,
          startsAt: item.startsAt instanceof Date ? item.startsAt.toISOString() : item.startsAt,
          endsAt: item.endsAt instanceof Date ? item.endsAt.toISOString() : item.endsAt,
          serviceDate: item.serviceDate,
          quantity: item.quantity,
          itemType: item.itemType,
          amountCents: item.totalSellAmountCents,
          currency: item.sellCurrency,
        })),
      },
    })
  })

  hono.get("/v1/public/bookings/:bookingId/checkout-status", async (c) => {
    const bookingId = requireRouteParam(c, "bookingId")
    if (bookingId instanceof Response) return bookingId
    const ref = c.req.query("session") ?? c.req.query("orderId") ?? c.req.query("ref") ?? null
    const db = getDb(c)

    const [booking] = await db
      .select({
        id: bookings.id,
        bookingNumber: bookings.bookingNumber,
        status: bookings.status,
        updatedAt: bookings.updatedAt,
      })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1)
    if (!booking) return c.json({ error: "Booking not found" }, 404)

    const sessionRefFilter = ref
      ? or(
          eq(paymentSessions.id, ref),
          eq(paymentSessions.clientReference, ref),
          eq(paymentSessions.externalReference, ref),
          eq(paymentSessions.providerSessionId, ref),
          eq(paymentSessions.providerPaymentId, ref),
        )
      : undefined
    const sessionWhere = sessionRefFilter
      ? and(eq(paymentSessions.bookingId, bookingId), sessionRefFilter)
      : eq(paymentSessions.bookingId, bookingId)

    let sessions = await db
      .select({
        id: paymentSessions.id,
        status: paymentSessions.status,
        amountCents: paymentSessions.amountCents,
        currency: paymentSessions.currency,
        invoiceId: paymentSessions.invoiceId,
        paymentMethod: paymentSessions.paymentMethod,
        completedAt: paymentSessions.completedAt,
        failedAt: paymentSessions.failedAt,
        updatedAt: paymentSessions.updatedAt,
      })
      .from(paymentSessions)
      .where(sessionWhere)
      .orderBy(desc(paymentSessions.createdAt))
      .limit(5)

    if (sessions.length === 0 && ref) {
      sessions = await db
        .select({
          id: paymentSessions.id,
          status: paymentSessions.status,
          amountCents: paymentSessions.amountCents,
          currency: paymentSessions.currency,
          invoiceId: paymentSessions.invoiceId,
          paymentMethod: paymentSessions.paymentMethod,
          completedAt: paymentSessions.completedAt,
          failedAt: paymentSessions.failedAt,
          updatedAt: paymentSessions.updatedAt,
        })
        .from(paymentSessions)
        .where(eq(paymentSessions.bookingId, bookingId))
        .orderBy(desc(paymentSessions.createdAt))
        .limit(5)
    }

    const paidSession = sessions.find(
      (session) => session.status === "paid" || session.status === "authorized",
    )
    const latestSession = paidSession ?? sessions[0] ?? null
    const isBankTransferSession =
      latestSession?.paymentMethod === "bank_transfer" ||
      (booking.status === "awaiting_payment" && Boolean(latestSession?.invoiceId))
    const bankTransferInstructions =
      isBankTransferSession && latestSession
        ? await buildPublicBankTransferInstructions(
            c,
            options,
            booking.bookingNumber,
            latestSession,
          )
        : null
    const failedStatuses = new Set(["failed", "cancelled", "expired"])
    const paymentStatus =
      booking.status === "confirmed" || paidSession
        ? "paid"
        : sessions.length > 0 && sessions.every((session) => failedStatuses.has(session.status))
          ? "failed"
          : "pending"

    return c.json({
      data: {
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
        bookingStatus: booking.status,
        paymentStatus,
        session: latestSession,
        bankTransferInstructions,
        updatedAt: (latestSession?.updatedAt ?? booking.updatedAt)?.toISOString?.() ?? null,
      },
    })
  })

  return hono
}

// ─────────────────────────────────────────────────────────────────
// Pure schedule resolution helpers
// ─────────────────────────────────────────────────────────────────

function resolvePublicTripComponentSchedule(metadata: Record<string, unknown>): {
  start: string | null
  end: string | null
} {
  const scheduledStart = publicStringValue(metadata.scheduledStartsAt)
  const scheduledEnd = publicStringValue(metadata.scheduledEndsAt)
  if (scheduledStart) return { start: scheduledStart, end: scheduledEnd }

  const flightDraft = readPublicRecord(metadata.flightDraft)
  if (flightDraft) {
    const selectedOffer = readPublicRecord(flightDraft.selectedOffer)
    const itineraries = Array.isArray(selectedOffer?.itineraries) ? selectedOffer.itineraries : []
    const firstItinerary = readPublicRecord(itineraries[0])
    const lastItinerary = readPublicRecord(itineraries[itineraries.length - 1])
    const firstSegments = Array.isArray(firstItinerary?.segments) ? firstItinerary.segments : []
    const lastSegments = Array.isArray(lastItinerary?.segments) ? lastItinerary.segments : []
    const firstSegment = readPublicRecord(firstSegments[0])
    const lastSegment = readPublicRecord(lastSegments[lastSegments.length - 1])
    const departure = readPublicRecord(firstSegment?.departure)
    const arrival = readPublicRecord(lastSegment?.arrival)
    return {
      start: publicStringValue(departure?.at) ?? publicStringValue(flightDraft.departDate),
      end: publicStringValue(arrival?.at) ?? publicStringValue(flightDraft.returnDate),
    }
  }

  const bookingDraft = readPublicRecord(metadata.bookingDraftV1)
  const configure = readPublicRecord(bookingDraft?.configure)
  const dateRange = readPublicRecord(configure?.dateRange)
  const departureDate = publicStringValue(configure?.departureDate)
  const checkIn = publicStringValue(dateRange?.checkIn)
  const checkOut = publicStringValue(dateRange?.checkOut)
  if (departureDate || checkIn) {
    return { start: departureDate ?? checkIn, end: checkOut }
  }

  const cruiseDraft = readPublicRecord(metadata.cruiseDraft)
  const embarkationDate = publicStringValue(cruiseDraft?.embarkationDate)
  if (embarkationDate) return { start: embarkationDate, end: null }

  return { start: null, end: null }
}

function readPublicRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function publicStringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

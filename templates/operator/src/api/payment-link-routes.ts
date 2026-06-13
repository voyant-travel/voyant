// agent-quality: file-size exception -- owner: operator; existing route module stays co-located until a dedicated split preserves behavior and tests.
import { bookingItems, bookings } from "@voyantjs/bookings/schema"
import { financeService } from "@voyantjs/finance"
import { invoices, paymentSessions } from "@voyantjs/finance/schema"
import { productMedia, products } from "@voyantjs/inventory/schema"
import {
  NETOPIA_RUNTIME_CONTAINER_KEY,
  netopiaService,
  type ResolvedNetopiaRuntimeOptions,
} from "@voyantjs/plugin-netopia"
import { tripComposerService } from "@voyantjs/trip-composer"
import { tripComponents, tripEnvelopes } from "@voyantjs/trip-composer/schema"
import { and, asc, desc, eq, inArray, or } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context } from "hono"
import {
  bankTransferDetailsFromOperatorSettings,
  resolvePublicCheckoutBaseUrlFromBindings,
} from "./payment-config"
import { getOperatorPaymentInstructions, getOperatorProfile } from "./settings"

type OperatorContext = Context

function requireRouteParam(c: OperatorContext, name: string): string | Response {
  const value = c.req.param(name)
  return value ? value : c.json({ error: `${name} route param is required` }, 400)
}

async function buildPublicBankTransferInstructions(
  db: PostgresJsDatabase,
  bookingNumber: string,
  session: {
    invoiceId: string | null
    amountCents: number
    currency: string
  },
  bindings: Record<string, unknown>,
) {
  const [operatorProfile, paymentInstructions] = await Promise.all([
    getOperatorProfile(db),
    getOperatorPaymentInstructions(db),
  ])
  const details = bankTransferDetailsFromOperatorSettings(
    operatorProfile,
    paymentInstructions,
    bindings,
  )
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

export async function handlePaymentLinkConfig(c: OperatorContext) {
  const db = c.get("db") as PostgresJsDatabase
  const [operatorProfile, paymentInstructions] = await Promise.all([
    getOperatorProfile(db),
    getOperatorPaymentInstructions(db),
  ])
  const bankTransfer = bankTransferDetailsFromOperatorSettings(
    operatorProfile,
    paymentInstructions,
    c.env as Record<string, unknown>,
  )
  return c.json({
    data: {
      publicCheckoutBaseUrl: resolvePublicCheckoutBaseUrlFromBindings(
        c.env as Record<string, unknown>,
      ),
      bankTransfer,
    },
  })
}

export async function handlePaymentLinkRetry(c: OperatorContext) {
  const sessionId = requireRouteParam(c, "sessionId")
  if (sessionId instanceof Response) return sessionId
  const db = c.get("db")
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
  return c.json({ data: { sessionId: fresh.id } })
}

export async function handlePaymentLinkResolve(c: OperatorContext) {
  const ref = c.req.query("ref")
  if (!ref) return c.json({ error: "ref query param is required" }, 400)
  const db = c.get("db")
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
}

export async function handlePaymentLinkStartCard(c: OperatorContext) {
  const sessionId = requireRouteParam(c, "sessionId")
  if (sessionId instanceof Response) return sessionId
  const db = c.get("db")
  const dbCast = db as Parameters<typeof netopiaService.startPaymentSession>[0]
  const [session] = await db
    .select()
    .from(paymentSessions)
    .where(eq(paymentSessions.id, sessionId))
    .limit(1)
  if (!session) return c.json({ error: "Session not found" }, 404)
  if (session.redirectUrl) {
    return c.json({ data: { redirectUrl: session.redirectUrl } })
  }
  const runtime = c.var.container?.resolve(NETOPIA_RUNTIME_CONTAINER_KEY) as
    | ResolvedNetopiaRuntimeOptions
    | undefined
  if (!runtime) {
    return c.json({ error: "Card processor not configured" }, 503)
  }
  const [first, ...rest] = (session.payerName ?? "").trim().split(/\s+/)
  const last = rest.length > 0 ? rest.join(" ") : "Customer"
  try {
    const started = await netopiaService.startPaymentSession(
      dbCast,
      sessionId,
      {
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
        description: session.notes ?? `Payment ${sessionId}`,
      },
      runtime,
      undefined,
    )
    return c.json({
      data: {
        redirectUrl:
          started.session.redirectUrl ?? started.providerResponse.payment?.paymentURL ?? null,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start card payment"
    return c.json({ error: message }, 502)
  }
}

export async function handlePaymentLinkTripSummary(c: OperatorContext) {
  const sessionId = requireRouteParam(c, "sessionId")
  if (sessionId instanceof Response) return sessionId
  const db = c.get("db") as PostgresJsDatabase
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

  const [envelope] = await db
    .select()
    .from(tripEnvelopes)
    .where(eq(tripEnvelopes.id, tripEnvelopeId))
    .limit(1)
  if (!envelope) return c.json({ data: null })

  if (session.status === "paid" && envelope.status !== "booked") {
    try {
      await tripComposerService.completeTripCheckout(db, {
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
      console.error("[trip-composer] payment summary reconciliation failed", err)
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
}

export async function handlePaymentLinkBookingSummary(c: OperatorContext) {
  const sessionId = requireRouteParam(c, "sessionId")
  if (sessionId instanceof Response) return sessionId
  const db = c.get("db") as PostgresJsDatabase
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
}

export async function handleBookingCheckoutStatus(c: OperatorContext) {
  const bookingId = requireRouteParam(c, "bookingId")
  if (bookingId instanceof Response) return bookingId
  const ref = c.req.query("session") ?? c.req.query("orderId") ?? c.req.query("ref") ?? null
  const db = c.get("db") as PostgresJsDatabase

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
          db,
          booking.bookingNumber,
          latestSession,
          c.env as Record<string, unknown>,
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
}

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

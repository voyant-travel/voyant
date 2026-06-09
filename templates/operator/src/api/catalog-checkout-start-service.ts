import { bookingsService, canTransitionBooking, transitionBooking } from "@voyantjs/bookings"
import { bookings } from "@voyantjs/bookings/schema"
import type { EventBus } from "@voyantjs/core"
import {
  type CreateInvoiceFromBookingInput,
  financeService,
  issueProformaFromBooking,
} from "@voyantjs/finance"
import {
  NETOPIA_RUNTIME_CONTAINER_KEY,
  netopiaService,
  type ResolvedNetopiaRuntimeOptions,
} from "@voyantjs/plugin-netopia"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { z } from "zod"
import { materializeBookingFromSnapshot } from "./catalog-checkout-materialization"
import { getOperatorPaymentInstructions, getOperatorProfile } from "./settings"

export const checkoutStartSchema = z.object({
  bookingId: z.string().min(1),
  paymentIntent: z.enum(["card", "bank_transfer", "hold", "inquiry"]),
  contractAcceptance: z
    .object({
      templateId: z.string().min(1),
      templateSlug: z.string().min(1),
      acceptedTerms: z.literal(true),
      acceptedMarketing: z.boolean(),
      acceptedAt: z.string().datetime(),
      renderedHtml: z.string().min(1),
    })
    .optional(),
  payerEmail: z.string().email().optional(),
  payerName: z.string().optional(),
  returnOrigin: z.string().url().optional(),
})

export type CheckoutStartInput = z.infer<typeof checkoutStartSchema>

export interface CheckoutStartRequestMeta {
  clientIp?: string
  userAgent?: string
}

export interface CatalogCheckoutStartContext {
  db: PostgresJsDatabase
  env: CloudflareBindings & Record<string, string | undefined>
  eventBus?: EventBus
  resolveRuntime?: (key: string) => unknown
  requestMeta?: CheckoutStartRequestMeta
}

export type CatalogCheckoutStartResult =
  | {
      kind: "card_redirect"
      bookingId: string
      paymentSessionId: string
      redirectUrl: string | null
      note?: string
    }
  | {
      kind: "bank_transfer_instructions"
      bookingId: string
      proformaId: string | null
      proformaNumber: string | null
      paymentSessionId: string | null
      instructions: {
        beneficiary: string
        iban: string
        bankName: string
        reference: string
        amountCents: number
        currency: string
        dueAt: string
      }
    }
  | {
      kind: "inquiry_received"
      bookingId: string
      inquiryId: string
      note?: string
    }
  | {
      kind: "hold_placed"
      bookingId: string
    }

export class CatalogCheckoutStartError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: 404 | 409 | 500 | 502,
  ) {
    super(code)
    this.name = "CatalogCheckoutStartError"
  }
}

interface CheckoutAcceptanceMetadata {
  templateId: string
  templateSlug: string
  acceptedAt: string
  acceptedMarketing: boolean
  clientIp?: string
  userAgent?: string
  renderedHtmlLength: number
}

export async function startCatalogCheckout(
  context: CatalogCheckoutStartContext,
  body: CheckoutStartInput,
): Promise<CatalogCheckoutStartResult> {
  const db = context.db
  let booking: typeof bookings.$inferSelect | null =
    (await db.select().from(bookings).where(eq(bookings.id, body.bookingId)).limit(1))[0] ?? null

  // Sourced products go through the catalog-snapshot path on
  // /book — they never write to the `bookings` table directly.
  // Materialize a minimal row from the snapshot so the rest of the
  // checkout-start flow (state transitions, payment session, etc)
  // can operate on a normal booking. Owned products already have
  // the row written by their OwnedBookingHandler.commit.
  if (!booking) {
    booking = await materializeBookingFromSnapshot(db, body.bookingId, context.env)
  }
  if (!booking) throw new CatalogCheckoutStartError("booking_not_found", 404)
  if (
    (body.paymentIntent === "card" || body.paymentIntent === "bank_transfer") &&
    booking.holdExpiresAt &&
    booking.holdExpiresAt <= new Date()
  ) {
    throw new CatalogCheckoutStartError("hold_expired", 409)
  }

  // Pre-create a draft contract carrying the acceptance fingerprint
  // in `metadata.acceptance`. The auto-generate-contract subscriber
  // (fired by `booking.confirmed` after payment) detects this draft
  // by booking_id, populates the rendered body + variables from the
  // confirmed booking state, and issues + generates the PDF —
  // allocating the contract number at issue time. The signature
  // promotion path then reads `metadata.acceptance` straight off
  // the contract row instead of relaying through internal_notes.
  //
  // Idempotency: re-entering /checkout/start (e.g. customer hits
  // Back then resubmits) finds the existing draft and updates its
  // metadata in place — no duplicate contract rows, no duplicate
  // acceptance fingerprints.
  if (body.contractAcceptance) {
    try {
      await persistAcceptanceDraftContract(
        db,
        context.requestMeta ?? {},
        booking,
        body.contractAcceptance,
      )
    } catch (err) {
      // Acceptance recording is best-effort during checkout-start —
      // the customer still needs to reach payment even if our
      // legal-side pre-create stumbles. Surfacing as a 5xx here
      // would block real bookings on a contract-template mis-config;
      // we log and proceed so payment can land.
      console.error("[catalog-checkout] persistAcceptanceDraftContract failed", err)
    }
  }

  switch (body.paymentIntent) {
    case "card":
      return startCardCheckout(context, booking, body)
    case "bank_transfer":
      return startBankTransferCheckout(context, booking)
    case "inquiry":
      return startInquiryCheckout(context, booking)
    case "hold":
      return {
        kind: "hold_placed",
        bookingId: booking.id,
      }
  }
}

/**
 * Inquiry intent — write a CRM quote for the operator to follow
 * up on, then cancel the booking so inventory isn't blocked.
 *
 * The pipeline + stage used can be pinned via env vars
 * (`INQUIRY_PIPELINE_ID` / `INQUIRY_STAGE_ID`); otherwise we pick the
 * first sales pipeline + its first stage. Without any configured
 * pipeline the endpoint falls back to a stub response so the journey
 * keeps working through demos.
 */
async function startInquiryCheckout(
  context: CatalogCheckoutStartContext,
  booking: typeof bookings.$inferSelect,
): Promise<CatalogCheckoutStartResult> {
  const db = context.db
  const env = context.env
  const eventBus = context.eventBus

  let pipelineId = env.INQUIRY_PIPELINE_ID ?? null
  let stageId = env.INQUIRY_STAGE_ID ?? null

  if (!pipelineId || !stageId) {
    const { crmService } = await import("@voyantjs/crm")
    const pipelines = await crmService
      .listPipelines(db, { entityType: "quote", limit: 1, offset: 0 })
      .catch(() => null)
    const firstPipeline = pipelines?.data?.[0] ?? null
    if (firstPipeline) {
      pipelineId = pipelineId ?? firstPipeline.id
      const stages = await crmService
        .listStages(db, { pipelineId: firstPipeline.id, limit: 1, offset: 0 })
        .catch(() => null)
      stageId = stageId ?? stages?.data?.[0]?.id ?? null
    }
  }

  if (!pipelineId || !stageId) {
    // No CRM pipeline configured. Still cancel the booking so the
    // hold doesn't linger, and return a stub inquiry reference.
    await releaseInquiryBooking(db, booking, eventBus)
    return {
      kind: "inquiry_received",
      bookingId: booking.id,
      inquiryId: `inq-${booking.id}`,
      note: "No CRM pipeline configured — set INQUIRY_PIPELINE_ID + INQUIRY_STAGE_ID to record a real quote.",
    }
  }

  const { crmService } = await import("@voyantjs/crm")
  const quote = await crmService.createQuote(db, {
    title: `Inquiry — booking ${booking.bookingNumber}`,
    pipelineId,
    stageId,
    personId: booking.personId,
    organizationId: booking.organizationId,
    status: "open",
    valueAmountCents: booking.sellAmountCents ?? null,
    valueCurrency: booking.sellCurrency ?? null,
    source: "storefront-inquiry",
    sourceRef: booking.id,
    tags: [],
  })

  await releaseInquiryBooking(db, booking, eventBus)

  await eventBus?.emit("inquiry.created", {
    opportunityId: quote?.id ?? null,
    bookingId: booking.id,
    bookingNumber: booking.bookingNumber,
    pipelineId,
    stageId,
  })

  return {
    kind: "inquiry_received",
    bookingId: booking.id,
    inquiryId: quote?.id ?? `inq-${booking.id}`,
  }
}

async function releaseInquiryBooking(
  db: PostgresJsDatabase,
  booking: typeof bookings.$inferSelect,
  eventBus: EventBus | undefined,
): Promise<void> {
  // Inquiry mode: don't keep capacity locked. Cancel the booking so
  // the hold drops; the row stays for the audit trail.
  if (!canTransitionBooking(booking.status, "cancelled")) return
  try {
    await bookingsService.cancelBooking(
      db,
      booking.id,
      { reason: "Released — converted to inquiry" } as never,
      undefined,
      { eventBus },
    )
  } catch (err) {
    console.warn("[catalog-checkout] could not release booking on inquiry path", err)
  }
}

/**
 * Move the booking from `on_hold` (or `draft`) into `awaiting_payment`
 * so ops can see in the bookings list which rows are pending money
 * vs. just brokered. The state machine accepts the transition;
 * already-`awaiting_payment` / already-`confirmed` rows are
 * silently no-op'd so re-entries (e.g. user reloads the dialog
 * twice) stay idempotent.
 */
async function markAwaitingPayment(
  db: PostgresJsDatabase,
  booking: typeof bookings.$inferSelect,
): Promise<void> {
  if (!canTransitionBooking(booking.status, "awaiting_payment")) return
  const patch = transitionBooking(booking.status, "awaiting_payment")
  await db
    .update(bookings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(bookings.id, booking.id))
}

async function startCardCheckout(
  context: CatalogCheckoutStartContext,
  booking: typeof bookings.$inferSelect,
  body: CheckoutStartInput,
): Promise<CatalogCheckoutStartResult> {
  const db = context.db
  const runtime = resolveNetopiaRuntime(context)

  // Without Netopia configured, fall back to a placeholder redirect
  // — the storefront's confirmation page polls booking status and
  // surfaces "we're still processing" until ops marks payment
  // received manually. Useful for demos without sandbox creds.
  const amountCents = booking.sellAmountCents ?? 0
  const currency = booking.sellCurrency ?? "EUR"

  await markAwaitingPayment(db, booking)

  const session = await financeService.createPaymentSession(db, {
    bookingId: booking.id,
    amountCents,
    currency,
    status: "pending",
    expiresAt: booking.holdExpiresAt?.toISOString() ?? null,
    payerName: body.payerName ?? null,
    payerEmail: body.payerEmail ?? null,
    notes: `Storefront card payment for booking ${booking.bookingNumber}`,
    targetType: "booking",
  } as never)
  if (!session) {
    throw new CatalogCheckoutStartError("could_not_create_payment_session", 500)
  }

  if (!runtime) {
    // No Netopia configured — surface the booking on the standard
    // confirmation page in `card_pending` mode. The page polls
    // booking status and unlocks contract/invoice download links
    // once the operator marks payment received via the booking
    // detail's pending-payment-sessions panel.
    return {
      kind: "card_redirect",
      bookingId: booking.id,
      paymentSessionId: session.id,
      redirectUrl: `/shop/confirmation/${encodeURIComponent(booking.id)}?kind=card_pending&session=${encodeURIComponent(session.id)}`,
      note: "Netopia not configured — falling back to a confirmation-page poll.",
    }
  }

  const [firstName, ...rest] = (body.payerName ?? "").trim().split(/\s+/)
  const lastName = rest.length > 0 ? rest.join(" ") : "Customer"
  try {
    const started = await netopiaService.startPaymentSession(
      db,
      session.id,
      {
        billing: {
          email: body.payerEmail ?? "tbd@example.com",
          phone: "0000000000",
          firstName: firstName || "Customer",
          lastName,
          city: "TBD",
          country: 642,
          state: "TBD",
          postalCode: "00000",
          details: "Pending — customer to confirm at payment.",
        },
        description: `Booking ${booking.bookingNumber}`,
        // Netopia redirects the customer back to this URL after 3DS.
        // Land them on the confirmation page in card_pending mode —
        // the webhook (NETOPIA_NOTIFY_URL) does the actual booking
        // confirmation in the background; this page just polls until
        // the booking flips to `confirmed`.
        returnUrl: body.returnOrigin
          ? `${body.returnOrigin}/shop/confirmation/${encodeURIComponent(booking.id)}?kind=card_pending`
          : undefined,
      },
      runtime,
      undefined,
    )
    return {
      kind: "card_redirect",
      bookingId: booking.id,
      paymentSessionId: session.id,
      redirectUrl: started.providerResponse.payment?.paymentURL ?? null,
    }
  } catch (err) {
    console.error("[catalog-checkout] netopia startPaymentSession failed", err)
    throw new CatalogCheckoutStartError("payment_provider_failed", 502)
  }
}

function resolveNetopiaRuntime(
  context: CatalogCheckoutStartContext,
): ResolvedNetopiaRuntimeOptions | undefined {
  try {
    return context.resolveRuntime?.(NETOPIA_RUNTIME_CONTAINER_KEY) as
      | ResolvedNetopiaRuntimeOptions
      | undefined
  } catch {
    return undefined
  }
}

async function startBankTransferCheckout(
  context: CatalogCheckoutStartContext,
  booking: typeof bookings.$inferSelect,
): Promise<CatalogCheckoutStartResult> {
  const db = context.db
  await markAwaitingPayment(db, booking)

  // Issue a proforma synchronously so the customer leaves with a
  // document reference. SmartBill (subscribing to
  // invoice.proforma.issued) will sync to its proforma endpoint.
  const issueDate = new Date().toISOString().slice(0, 10)
  const dueDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const eventBus = context.eventBus

  const proformaInput: CreateInvoiceFromBookingInput = {
    bookingId: booking.id,
    issueDate,
    dueDate,
    invoiceType: "proforma",
    notes: null,
  }

  // Pull the booking's items via the shared schema; financeService
  // wants the InvoiceFromBookingData shape (booking + items).
  const { bookingItems } = await import("@voyantjs/bookings/schema")
  const bookingItemRows = await db
    .select()
    .from(bookingItems)
    .where(eq(bookingItems.bookingId, booking.id))

  const proforma = await issueProformaFromBooking(
    db,
    proformaInput,
    {
      booking: {
        id: booking.id,
        bookingNumber: booking.bookingNumber,
        personId: booking.personId,
        organizationId: booking.organizationId,
        sellCurrency: booking.sellCurrency,
        baseCurrency: booking.baseCurrency,
        fxRateSetId: null,
        sellAmountCents: booking.sellAmountCents,
        baseSellAmountCents: booking.baseSellAmountCents,
      },
      items: bookingItemRows.map((item) => ({
        id: item.id,
        title: item.title,
        quantity: item.quantity,
        unitSellAmountCents: item.unitSellAmountCents,
        totalSellAmountCents: item.totalSellAmountCents,
      })),
    },
    { eventBus },
  )

  // Create a payment session targeting the booking + proforma so the
  // operator can mark it received via the existing
  // POST /v1/admin/finance/payment-sessions/:id/complete endpoint.
  // That endpoint emits payment.completed which fires the
  // checkout-finalize workflow (final invoice, contract auto-gen).
  const paymentSession = await financeService.createPaymentSession(db, {
    bookingId: booking.id,
    invoiceId: proforma?.id ?? null,
    amountCents: booking.sellAmountCents ?? 0,
    currency: booking.sellCurrency ?? "EUR",
    status: "pending",
    paymentMethod: "bank_transfer",
    expiresAt: booking.holdExpiresAt?.toISOString() ?? null,
    notes: `Bank transfer for booking ${booking.bookingNumber} (proforma ${
      proforma?.invoiceNumber ?? "—"
    })`,
    targetType: "booking",
  } as never)

  const bankTransfer = await resolveBankTransferInstructions(db, context.env)
  return {
    kind: "bank_transfer_instructions",
    bookingId: booking.id,
    proformaId: proforma?.id ?? null,
    proformaNumber: proforma?.invoiceNumber ?? null,
    paymentSessionId: paymentSession?.id ?? null,
    instructions: {
      beneficiary: bankTransfer.beneficiary,
      iban: bankTransfer.iban,
      bankName: bankTransfer.bankName,
      reference: `BOOK-${booking.bookingNumber}`,
      amountCents: booking.sellAmountCents ?? 0,
      currency: booking.sellCurrency ?? "EUR",
      dueAt: dueDate,
    },
  }
}

async function resolveBankTransferInstructions(
  db: PostgresJsDatabase,
  env: Record<string, string | undefined>,
) {
  const [operatorProfile, paymentInstructions] = await Promise.all([
    getOperatorProfile(db),
    getOperatorPaymentInstructions(db),
  ])
  return {
    beneficiary:
      paymentInstructions?.bankTransferBeneficiary ||
      operatorProfile?.legalName ||
      operatorProfile?.name ||
      env.BANK_TRANSFER_BENEFICIARY ||
      env.STOREFRONT_BANK_BENEFICIARY ||
      "—",
    iban: paymentInstructions?.iban || env.BANK_TRANSFER_IBAN || env.STOREFRONT_BANK_IBAN || "—",
    bankName:
      paymentInstructions?.bank || env.BANK_TRANSFER_BANK_NAME || env.STOREFRONT_BANK_NAME || "—",
  }
}

/**
 * Pre-create (or update) a draft contract carrying the acceptance
 * fingerprint in `metadata.acceptance`. Called from /checkout/start
 * when the customer accepts the contract preview, BEFORE payment
 * lands.
 *
 * The draft has:
 *   - status="draft" (no number yet — issued post-payment)
 *   - templateVersionId pointing at the slug's current version
 *   - bookingId / personId / organizationId from the booking
 *   - metadata.acceptance with templateId/Slug, acceptedAt,
 *     acceptedMarketing, ipAddress, userAgent, renderedHtmlLength
 *
 * The body is left empty; `autoGenerateContractForBooking` (fired by
 * `booking.confirmed`) detects the existing draft, fills in the
 * fully-resolved variables, then issues + generates the PDF.
 *
 * Idempotency: a re-entry of /checkout/start finds the existing draft
 * and updates its `metadata.acceptance` in place (last acceptance
 * wins — typical when customer hits Back, edits acceptance, resubmits).
 */
async function persistAcceptanceDraftContract(
  db: PostgresJsDatabase,
  requestMeta: CheckoutStartRequestMeta,
  booking: typeof bookings.$inferSelect,
  acceptance: NonNullable<CheckoutStartInput["contractAcceptance"]>,
): Promise<void> {
  const { contractsService } = await import("@voyantjs/legal/contracts")

  const template = await contractsService.findTemplateBySlug(db, acceptance.templateSlug)
  if (!template?.currentVersionId) {
    console.warn(
      `[catalog-checkout] persistAcceptanceDraftContract: template "${acceptance.templateSlug}" not found or has no current version; skipping.`,
    )
    return
  }

  const acceptanceMetadata: CheckoutAcceptanceMetadata = {
    templateId: acceptance.templateId,
    templateSlug: acceptance.templateSlug,
    acceptedAt: acceptance.acceptedAt,
    acceptedMarketing: acceptance.acceptedMarketing,
    clientIp: requestMeta.clientIp ?? "",
    userAgent: requestMeta.userAgent ?? "",
    renderedHtmlLength: acceptance.renderedHtml.length,
  }

  // Look for an existing draft contract on this booking. Storefront
  // re-submissions hit this branch.
  const existingList = await contractsService.listContracts(db, {
    bookingId: booking.id,
    limit: 1,
    offset: 0,
  })
  const existing = existingList.data[0]

  if (existing) {
    const prior = (existing.metadata as Record<string, unknown> | null) ?? {}
    await contractsService.updateContract(db, existing.id, {
      metadata: { ...prior, acceptance: acceptanceMetadata },
    })
    return
  }

  await contractsService.createContract(db, {
    scope: "customer",
    status: "draft",
    title: `${template.name} — ${booking.bookingNumber}`,
    templateVersionId: template.currentVersionId,
    seriesId: null,
    bookingId: booking.id,
    personId: booking.personId ?? null,
    organizationId: booking.organizationId ?? null,
    language: template.language,
    variables: {},
    metadata: {
      autoGenerated: true,
      trigger: "storefront.checkout-acceptance",
      acceptance: acceptanceMetadata,
    },
  })
}

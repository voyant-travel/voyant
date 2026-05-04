/**
 * Storefront checkout endpoint + workflow wiring.
 *
 * `POST /v1/public/catalog/checkout/start` — invoked by the
 * storefront's BookingJourney after the customer accepts the
 * contract preview. The booking is created via `/v1/public/catalog/book`
 * before this is called, so the request carries a real `bookingId`.
 * Branches by `paymentIntent`:
 *
 *   - `card`         → create a payment session targeting the
 *                       booking, ask the Netopia plugin to start it,
 *                       return its redirect URL.
 *   - `bank_transfer`→ issue a proforma synchronously, return
 *                       bank-details + reference. Deployment-side
 *                       config supplies the actual IBAN.
 *   - `inquiry`      → write a CRM-stub lead. (Phase 6 lights up
 *                       the real opportunity creation.)
 *   - `hold`         → no payment workflow; staff broker the booking.
 *
 * Subscribes to `payment.completed`: when the Netopia webhook (card)
 * or the admin "Mark payment received" action (bank-transfer) fires
 * the event, runs the `checkout-finalize` workflow which transitions
 * the booking to `confirmed` and triggers contract + invoice
 * generation.
 *
 * See `docs/architecture/storefront-checkout-flow.md` Phases 3–5.
 */

import { bookingsService, canTransitionBooking, transitionBooking } from "@voyantjs/bookings"
import { bookings } from "@voyantjs/bookings/schema"
import { runCheckoutFinalize } from "@voyantjs/catalog/booking-engine"
import type { EventBus } from "@voyantjs/core"
import {
  type CreateInvoiceFromBookingInput,
  financeService,
  issueInvoiceFromBooking,
  issueProformaFromBooking,
} from "@voyantjs/finance"
import { parseJsonBody } from "@voyantjs/hono"
import type { HonoBundle } from "@voyantjs/hono/plugin"
import {
  NETOPIA_RUNTIME_CONTAINER_KEY,
  netopiaService,
  type ResolvedNetopiaRuntimeOptions,
} from "@voyantjs/plugin-netopia"
import { beginWorkflowRun } from "@voyantjs/workflow-runs"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context, Hono } from "hono"
import { z } from "zod"

import { getDbFromHyperdrive } from "./lib/db"

const checkoutStartSchema = z.object({
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
  /** Buyer email — used for downstream proforma + receipt routing. */
  payerEmail: z.string().email().optional(),
  /** Buyer name — used by Netopia's hosted form for placeholder
   *  billing details (the customer can correct on the form). */
  payerName: z.string().optional(),
  /** Storefront origin — used to build absolute return URLs that
   *  Netopia redirects back to after 3DS. */
  returnOrigin: z.string().url().optional(),
})

interface PaymentCompletedPayload {
  bookingId: string | null
  paymentSessionId?: string
  paymentIntent?: "card" | "bank_transfer" | "hold" | "ticket_on_credit"
  amountCents?: number
  currency?: string
  provider?: string | null
}

interface ContractDocumentGeneratedPayload {
  contractId: string
  contractStatus: string
  attachmentId: string
  attachmentKind: string
  attachmentName: string
}

const ACCEPTANCE_MARKER_PREFIX = "__contract_acceptance__:"

interface StoredAcceptance {
  templateId: string
  templateSlug: string
  acceptedAt: string
  acceptedMarketing: boolean
  renderedHtmlLength: number
}

export function mountCatalogCheckoutRoutes(hono: Hono): void {
  hono.post("/v1/public/catalog/checkout/start", handleCheckoutStart)
}

async function handleCheckoutStart(c: Context): Promise<Response> {
  let body: z.infer<typeof checkoutStartSchema>
  try {
    body = await parseJsonBody(c, checkoutStartSchema)
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "invalid body" }, 400)
  }

  const db = c.get("db") as PostgresJsDatabase
  let booking: typeof bookings.$inferSelect | null =
    (await db.select().from(bookings).where(eq(bookings.id, body.bookingId)).limit(1))[0] ?? null

  // Sourced products go through the catalog-snapshot path on
  // /book — they never write to the `bookings` table directly.
  // Materialize a minimal row from the snapshot so the rest of the
  // checkout-start flow (state transitions, payment session, etc)
  // can operate on a normal booking. Owned products already have
  // the row written by their OwnedBookingHandler.commit.
  if (!booking) {
    booking = await materializeBookingFromSnapshot(db, body.bookingId)
  }
  if (!booking) return c.json({ error: "booking_not_found" }, 404)

  // Persist the contract acceptance against the booking so the
  // audit trail keeps the rendered HTML alongside the booking
  // number. Stored on `internalNotes` for now — Phase 6 promotes
  // this to a real `contract_signatures` row once the legal
  // auto-generate-contract subscriber materialises a contract on
  // booking.confirmed.
  if (body.contractAcceptance) {
    const acceptanceMarker = `__contract_acceptance__:${JSON.stringify({
      templateId: body.contractAcceptance.templateId,
      templateSlug: body.contractAcceptance.templateSlug,
      acceptedAt: body.contractAcceptance.acceptedAt,
      acceptedMarketing: body.contractAcceptance.acceptedMarketing,
      // Truncate the rendered HTML so we don't blow up the notes
      // column. The full rendered body lives on the contract once
      // it's auto-generated.
      renderedHtmlLength: body.contractAcceptance.renderedHtml.length,
    })}`
    await db
      .update(bookings)
      .set({
        internalNotes:
          (booking.internalNotes ?? "") + (booking.internalNotes ? "\n\n" : "") + acceptanceMarker,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, booking.id))
  }

  switch (body.paymentIntent) {
    case "card":
      return handleCardIntent(c, db, booking, body)
    case "bank_transfer":
      return handleBankTransferIntent(c, db, booking, body)
    case "inquiry":
      return handleInquiryIntent(c, db, booking, body)
    case "hold":
      return c.json({
        kind: "hold_placed" as const,
        bookingId: booking.id,
      })
  }
}

/**
 * Inquiry intent — write a CRM opportunity for the operator to follow
 * up on, then cancel the booking so inventory isn't blocked.
 *
 * The pipeline + stage used can be pinned via env vars
 * (`INQUIRY_PIPELINE_ID` / `INQUIRY_STAGE_ID`); otherwise we pick the
 * first sales pipeline + its first stage. Without any configured
 * pipeline the endpoint falls back to a stub response so the journey
 * keeps working through demos.
 */
async function handleInquiryIntent(
  c: Context,
  db: PostgresJsDatabase,
  booking: typeof bookings.$inferSelect,
  _body: z.infer<typeof checkoutStartSchema>,
): Promise<Response> {
  const env = c.env as Record<string, string | undefined>
  const eventBus = c.var.eventBus

  let pipelineId = env.INQUIRY_PIPELINE_ID ?? null
  let stageId = env.INQUIRY_STAGE_ID ?? null

  if (!pipelineId || !stageId) {
    const { crmService } = await import("@voyantjs/crm")
    const pipelines = await crmService
      .listPipelines(db, { entityType: "person", limit: 1, offset: 0 })
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
    return c.json({
      kind: "inquiry_received" as const,
      bookingId: booking.id,
      inquiryId: `inq-${booking.id}`,
      note: "No CRM pipeline configured — set INQUIRY_PIPELINE_ID + INQUIRY_STAGE_ID to record a real opportunity.",
    })
  }

  const { crmService } = await import("@voyantjs/crm")
  const opportunity = await crmService.createOpportunity(db, {
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
  } as never)

  await releaseInquiryBooking(db, booking, eventBus)

  await eventBus?.emit("inquiry.created", {
    opportunityId: opportunity?.id ?? null,
    bookingId: booking.id,
    bookingNumber: booking.bookingNumber,
    pipelineId,
    stageId,
  })

  return c.json({
    kind: "inquiry_received" as const,
    bookingId: booking.id,
    inquiryId: opportunity?.id ?? `inq-${booking.id}`,
  })
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
/**
 * Look up the catalog snapshot for a `bookingId` (the catalog plane
 * always writes one) and materialize a minimal bookings row from it.
 * Used when /book went through the sourced arm — sourced adapters
 * don't write to the bookings table directly, so the checkout flow
 * has to bridge the snapshot into a real bookings row before it can
 * place payment sessions, transition status, etc.
 */
async function materializeBookingFromSnapshot(
  db: PostgresJsDatabase,
  bookingId: string,
): Promise<typeof bookings.$inferSelect | null> {
  const { bookingCatalogSnapshotTable } = await import("@voyantjs/catalog")
  const [snapshot] = await db
    .select()
    .from(bookingCatalogSnapshotTable)
    .where(eq(bookingCatalogSnapshotTable.booking_id, bookingId))
    .limit(1)
  if (!snapshot) return null

  const baseAmount = snapshot.pricing_base_amount
    ? Number.parseFloat(String(snapshot.pricing_base_amount))
    : 0
  const taxes = snapshot.pricing_taxes ? Number.parseFloat(String(snapshot.pricing_taxes)) : 0
  const fees = snapshot.pricing_fees ? Number.parseFloat(String(snapshot.pricing_fees)) : 0
  const surcharges = snapshot.pricing_surcharges
    ? Number.parseFloat(String(snapshot.pricing_surcharges))
    : 0
  const sellAmountCents = Math.round(baseAmount + taxes + fees + surcharges)
  const sellCurrency = snapshot.pricing_currency ?? "EUR"

  // Booking number — short, human-friendly, derived from the
  // snapshot id so it's stable across retries with the same
  // idempotency key.
  const bookingNumber = `BK-${bookingId.slice(-12).toUpperCase()}`

  const [row] = await db
    .insert(bookings)
    .values({
      id: bookingId,
      bookingNumber,
      status: "on_hold",
      sourceType: "direct",
      sellCurrency,
      sellAmountCents,
    })
    .onConflictDoNothing({ target: bookings.id })
    .returning()

  if (row) return row
  // Race: another request already inserted; re-fetch.
  const [existing] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1)
  return existing ?? null
}

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

async function handleCardIntent(
  c: Context,
  db: PostgresJsDatabase,
  booking: typeof bookings.$inferSelect,
  body: z.infer<typeof checkoutStartSchema>,
): Promise<Response> {
  const runtime = (() => {
    try {
      return c.var.container?.resolve(NETOPIA_RUNTIME_CONTAINER_KEY) as
        | ResolvedNetopiaRuntimeOptions
        | undefined
    } catch {
      return undefined
    }
  })()

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
    payerName: body.payerName ?? null,
    payerEmail: body.payerEmail ?? null,
    notes: `Storefront card payment for booking ${booking.bookingNumber}`,
    targetType: "booking",
  } as never)
  if (!session) {
    return c.json({ error: "could_not_create_payment_session" }, 500)
  }

  if (!runtime) {
    // No Netopia configured — surface the booking on the standard
    // confirmation page in `card_pending` mode. The page polls
    // booking status and unlocks contract/invoice download links
    // once the operator marks payment received via the booking
    // detail's pending-payment-sessions panel.
    return c.json({
      kind: "card_redirect" as const,
      bookingId: booking.id,
      paymentSessionId: session.id,
      redirectUrl: `/shop/confirmation/${encodeURIComponent(booking.id)}?kind=card_pending&session=${encodeURIComponent(session.id)}`,
      note: "Netopia not configured — falling back to a confirmation-page poll.",
    })
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
    return c.json({
      kind: "card_redirect" as const,
      bookingId: booking.id,
      paymentSessionId: session.id,
      redirectUrl: started.providerResponse.payment?.paymentURL ?? null,
    })
  } catch (err) {
    console.error("[catalog-checkout] netopia startPaymentSession failed", err)
    return c.json({ error: "payment_provider_failed" }, 502)
  }
}

async function handleBankTransferIntent(
  c: Context,
  db: PostgresJsDatabase,
  booking: typeof bookings.$inferSelect,
  _body: z.infer<typeof checkoutStartSchema>,
): Promise<Response> {
  await markAwaitingPayment(db, booking)

  // Issue a proforma synchronously so the customer leaves with a
  // document reference. SmartBill (subscribing to
  // invoice.proforma.issued) will sync to its proforma endpoint.
  const issueDate = new Date().toISOString().slice(0, 10)
  const dueDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const eventBus = c.var.eventBus

  const proformaInput: CreateInvoiceFromBookingInput = {
    bookingId: booking.id,
    invoiceNumber: `PRO-${booking.bookingNumber}`,
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
    notes: `Bank transfer for booking ${booking.bookingNumber} (proforma ${
      proforma?.invoiceNumber ?? "—"
    })`,
    targetType: "booking",
  } as never)

  // Bank-transfer instructions come from deployment-level
  // configuration. Until the storefront wires that through, we
  // surface a placeholder so the dev loop is functional.
  const env = c.env as Record<string, string | undefined>
  return c.json({
    kind: "bank_transfer_instructions" as const,
    bookingId: booking.id,
    proformaId: proforma?.id ?? null,
    proformaNumber: proforma?.invoiceNumber ?? null,
    paymentSessionId: paymentSession?.id ?? null,
    instructions: {
      beneficiary:
        env.STOREFRONT_BANK_BENEFICIARY ?? "Your company name (BANK_BENEFICIARY env var)",
      iban: env.STOREFRONT_BANK_IBAN ?? "—",
      bankName: env.STOREFRONT_BANK_NAME ?? "—",
      reference: `BOOK-${booking.bookingNumber}`,
      amountCents: booking.sellAmountCents ?? 0,
      currency: booking.sellCurrency ?? "EUR",
      dueAt: dueDate,
    },
  })
}

/**
 * Pull the storefront's acceptance marker out of `bookings.internalNotes`
 * and turn it into a real `contract_signatures` row once the contract
 * has been auto-generated. The marker is the JSON-stringified payload
 * the checkout-start endpoint stashed at acceptance time; we keep it
 * keyed by prefix so unrelated notes survive untouched.
 */
function readStoredAcceptance(internalNotes: string | null): StoredAcceptance | null {
  if (!internalNotes) return null
  for (const line of internalNotes.split("\n")) {
    if (!line.startsWith(ACCEPTANCE_MARKER_PREFIX)) continue
    try {
      return JSON.parse(line.slice(ACCEPTANCE_MARKER_PREFIX.length)) as StoredAcceptance
    } catch {
      // Bad marker — fall through and try the next line.
    }
  }
  return null
}

async function persistAcceptanceSignature(
  db: PostgresJsDatabase,
  contractId: string,
): Promise<void> {
  const { contractsService } = await import("@voyantjs/legal/contracts")
  const { contracts: contractsTable } = await import("@voyantjs/legal/contracts")
  const [contract] = await db
    .select()
    .from(contractsTable)
    .where(eq(contractsTable.id, contractId))
    .limit(1)
  if (!contract?.bookingId) return

  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, contract.bookingId))
    .limit(1)
  if (!booking) return

  const acceptance = readStoredAcceptance(booking.internalNotes)
  if (!acceptance) return

  // Already signed for this contract? `signContract` requires status
  // ∈ {issued, sent}; idempotency comes from listSignatures.
  const existing = await contractsService.listSignatures(db, contractId)
  if (existing.length > 0) return

  const signerName =
    [booking.bookingNumber, "lead booker"].filter(Boolean).join(" — ") || "Storefront customer"

  const result = await contractsService.signContract(db, contractId, {
    signerName,
    method: "electronic" as const,
    metadata: {
      source: "storefront-checkout",
      templateId: acceptance.templateId,
      templateSlug: acceptance.templateSlug,
      acceptedAt: acceptance.acceptedAt,
      acceptedMarketing: acceptance.acceptedMarketing,
      renderedHtmlLength: acceptance.renderedHtmlLength,
    },
  } as never)

  if (result.status !== "signed") {
    console.warn(
      `[catalog-checkout] could not record acceptance signature for ${contractId}: ${result.status}`,
    )
  }
}

/**
 * Bundle that subscribes to `payment.completed` and runs the
 * checkout-finalize workflow. The workflow transitions the booking
 * to `confirmed` (which emits `booking.confirmed` for legal /
 * notifications subscribers) and issues the final invoice — using
 * the proforma linkage when bank-transfer is the path.
 *
 * Also subscribes to `contract.document.generated` so once the
 * legal package's auto-generate-contract subscriber materialises a
 * contract, we promote the storefront's acceptance marker into a
 * real `contract_signatures` row.
 */
export const catalogCheckoutBundle: HonoBundle = {
  name: "catalog-checkout",
  bootstrap: ({ bindings, eventBus }) => {
    const env = bindings as CloudflareBindings
    eventBus.subscribe<ContractDocumentGeneratedPayload>(
      "contract.document.generated",
      async ({ data }) => {
        const db = getDbFromHyperdrive(env) as unknown as PostgresJsDatabase
        try {
          await persistAcceptanceSignature(db, data.contractId)
        } catch (err) {
          console.error("[catalog-checkout] persistAcceptanceSignature failed", err)
        }
      },
    )
    eventBus.subscribe<PaymentCompletedPayload>("payment.completed", async ({ data }) => {
      if (!data.bookingId) return
      const db = getDbFromHyperdrive(env) as unknown as PostgresJsDatabase
      const recorder = await beginWorkflowRun(db, {
        workflowName: "checkout-finalize",
        trigger: "payment.completed",
        correlationId: data.paymentSessionId ?? null,
        tags: [
          `bookingId:${data.bookingId}`,
          ...(data.paymentSessionId ? [`paymentSessionId:${data.paymentSessionId}`] : []),
          ...(data.paymentIntent ? [`paymentIntent:${data.paymentIntent}`] : []),
        ],
        input: {
          bookingId: data.bookingId,
          paymentSessionId: data.paymentSessionId ?? null,
          paymentIntent: data.paymentIntent ?? null,
          amountCents: data.amountCents ?? null,
          currency: data.currency ?? null,
        },
      })
      try {
        await runCheckoutFinalize(
          {
            bookingId: data.bookingId,
            paymentSessionId: data.paymentSessionId,
            paymentIntent: data.paymentIntent,
          },
          {
            db,
            eventBus,
            recorder: {
              startStep: (name) => {
                void recorder.startStep(name)
              },
              completeStep: (name, output) => {
                void recorder.completeStep(name, output ?? null)
              },
              failStep: (name, error) => {
                void recorder.failStep(name, error)
              },
            },
            confirmBooking: async (bookingId) => {
              await bookingsService.confirmBooking(db, bookingId, {}, undefined, { eventBus })
            },
            issueInvoice: async ({ bookingId, convertedFromInvoiceId }) => {
              const [booking] = await db
                .select()
                .from(bookings)
                .where(eq(bookings.id, bookingId))
                .limit(1)
              if (!booking) return null

              const { bookingItems } = await import("@voyantjs/bookings/schema")
              const items = await db
                .select()
                .from(bookingItems)
                .where(eq(bookingItems.bookingId, bookingId))

              const today = new Date().toISOString().slice(0, 10)
              const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
                .toISOString()
                .slice(0, 10)

              const invoice = await issueInvoiceFromBooking(
                db,
                {
                  bookingId,
                  invoiceNumber: `INV-${booking.bookingNumber}`,
                  issueDate: today,
                  dueDate,
                  invoiceType: "invoice",
                  notes: convertedFromInvoiceId
                    ? `Converted from proforma ${convertedFromInvoiceId}`
                    : null,
                },
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
                  items: items.map((item) => ({
                    id: item.id,
                    title: item.title,
                    quantity: item.quantity,
                    unitSellAmountCents: item.unitSellAmountCents,
                    totalSellAmountCents: item.totalSellAmountCents,
                  })),
                },
                { eventBus },
              )

              if (invoice && convertedFromInvoiceId) {
                await db
                  .update((await import("@voyantjs/finance")).invoices)
                  .set({ convertedFromInvoiceId })
                  .where(eq((await import("@voyantjs/finance")).invoices.id, invoice.id))
              }

              return invoice ? { invoiceId: invoice.id } : null
            },
            findProformaForBooking: async (bookingId) => {
              const { invoices } = await import("@voyantjs/finance")
              const [proforma] = await db
                .select({ id: invoices.id })
                .from(invoices)
                .where(eq(invoices.bookingId, bookingId))
                .limit(1)
              return proforma ? { invoiceId: proforma.id } : null
            },
          },
        )
        await recorder.complete()
      } catch (err) {
        console.error("[catalog-checkout] checkout-finalize workflow failed", err)
        await recorder.fail(err)
      }
    })
  },
}

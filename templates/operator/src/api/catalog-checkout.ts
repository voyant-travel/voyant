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

import {
  bookingsService,
  buildBookingRouteRuntime,
  canTransitionBooking,
  createBookingPiiService,
  transitionBooking,
} from "@voyantjs/bookings"
import { bookingActivityLog, bookings } from "@voyantjs/bookings/schema"
import {
  type CheckoutFinalizeDeps,
  type CheckoutFinalizeInput,
  OWNED_SOURCE_KIND,
  runCheckoutFinalize,
} from "@voyantjs/catalog/booking-engine"
import type { EventBus } from "@voyantjs/core"
import {
  bookingItemTaxLines,
  type CreateInvoiceFromBookingInput,
  computeBookingItemTaxLine,
  financeService,
  issueInvoiceFromBooking,
  issueProformaFromBooking,
  resolveBookingSellTaxRate,
} from "@voyantjs/finance"
import { parseJsonBody } from "@voyantjs/hono"
import type { HonoBundle } from "@voyantjs/hono/plugin"
import {
  NETOPIA_RUNTIME_CONTAINER_KEY,
  netopiaService,
  type ResolvedNetopiaRuntimeOptions,
} from "@voyantjs/plugin-netopia"
import {
  beginWorkflowRun,
  type WorkflowRunnerRegistry,
  type WorkflowRunRecorder,
} from "@voyantjs/workflow-runs"
import { and, eq, isNull } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context, Hono } from "hono"
import { z } from "zod"

import { withDbFromEnv } from "./lib/db"
import {
  getOperatorPaymentInstructions,
  getOperatorProfile,
  resolveBookingTaxSettings,
} from "./settings"

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
  /** IP captured from request headers at acceptance time. Empty when
   *  the upstream proxy didn't set any of the recognised headers. */
  clientIp?: string
  /** User-Agent header at acceptance time. */
  userAgent?: string
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
    booking = await materializeBookingFromSnapshot(db, body.bookingId, c.env as CloudflareBindings)
  }
  if (!booking) return c.json({ error: "booking_not_found" }, 404)
  if (
    (body.paymentIntent === "card" || body.paymentIntent === "bank_transfer") &&
    booking.holdExpiresAt &&
    booking.holdExpiresAt <= new Date()
  ) {
    return c.json({ error: "hold_expired" }, 409)
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
      await persistAcceptanceDraftContract(db, c, booking, body.contractAcceptance)
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
 * always writes one) and materialize a real bookings row plus the
 * traveler / item children. Used when /book went through the sourced
 * arm — sourced adapters don't write to the bookings table directly,
 * so the checkout flow has to bridge the snapshot into normal
 * booking shape before it can place payment sessions, transition
 * status, etc.
 *
 * The booking_drafts table carries the customer-entered detail
 * (passengers, billing contact, configure pax / dates) — we look
 * up the draft via `consumed_booking_id` and pull contact + traveler
 * rows out of it. Snapshot supplies pricing + entity refs.
 */
async function materializeBookingFromSnapshot(
  db: PostgresJsDatabase,
  bookingId: string,
  env: CloudflareBindings,
): Promise<typeof bookings.$inferSelect | null> {
  const { bookingCatalogSnapshotTable } = await import("@voyantjs/catalog")
  const { bookingDraftsTable } = await import("@voyantjs/catalog/booking-engine")
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

  // Pull the consuming draft so we can copy the customer-entered
  // billing contact + travelers + dates into the booking row.
  const [draftRow] = await db
    .select()
    .from(bookingDraftsTable)
    .where(eq(bookingDraftsTable.consumed_booking_id, bookingId))
    .limit(1)
  const draftPayload = (draftRow?.draft_payload ?? {}) as DraftPayload
  const frozenPayload = (snapshot.frozen_payload ?? {}) as Record<string, unknown>
  const bookingDates = extractBookingDates(
    {
      frozen_payload: frozenPayload,
    },
    draftPayload,
  )

  const billingContact = draftPayload.billing?.contact
  const billingAddress = draftPayload.billing?.address
  const config = draftPayload.configure
  const pax = config?.pax
  const totalPax = pax ? (pax.adult ?? 0) + (pax.child ?? 0) + (pax.infant ?? 0) : null
  const startDate = bookingDates.startDate
  const endDate = bookingDates.endDate

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
      contactFirstName: billingContact?.firstName ?? null,
      contactLastName: billingContact?.lastName ?? null,
      contactEmail: billingContact?.email ?? null,
      contactPhone: billingContact?.phone ?? null,
      contactCountry: billingAddress?.country ?? null,
      contactCity: billingAddress?.city ?? null,
      contactAddressLine1: billingAddress?.line1 ?? null,
      contactPostalCode: billingAddress?.postal ?? null,
      startDate,
      endDate,
      pax: totalPax && totalPax > 0 ? totalPax : null,
      internalNotes:
        typeof draftPayload.internalNotes === "string" ? draftPayload.internalNotes : null,
    })
    .onConflictDoNothing({ target: bookings.id })
    .returning()

  const inserted = row ?? null

  // Materialize travelers + a single line item per booked entity so
  // the operator detail page has something to render. No-ops on
  // re-entry (race or retry) because we only run this when the
  // bookings row was just inserted.
  if (inserted) {
    await materializeChildren(
      db,
      inserted,
      {
        id: snapshot.id,
        entity_module: snapshot.entity_module,
        entity_id: snapshot.entity_id,
        source_kind: snapshot.source_kind,
        source_provider: snapshot.source_provider,
        source_ref: snapshot.source_ref,
        frozen_payload: (snapshot.frozen_payload ?? {}) as Record<string, unknown>,
        pricing_base_amount:
          snapshot.pricing_base_amount != null ? String(snapshot.pricing_base_amount) : null,
        pricing_taxes: snapshot.pricing_taxes != null ? String(snapshot.pricing_taxes) : null,
        pricing_fees: snapshot.pricing_fees != null ? String(snapshot.pricing_fees) : null,
        pricing_surcharges:
          snapshot.pricing_surcharges != null ? String(snapshot.pricing_surcharges) : null,
        pricing_currency: snapshot.pricing_currency,
      },
      draftPayload,
      env,
    )
  }

  if (inserted) return inserted
  // Race: another request already inserted; re-fetch.
  const [existing] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1)
  return existing ?? null
}

interface DraftPayload {
  billing?: {
    contact?: {
      firstName?: string
      lastName?: string
      email?: string
      phone?: string
    }
    address?: {
      country?: string
      city?: string
      line1?: string
      line2?: string
      postal?: string
    }
  }
  configure?: {
    pax?: { adult?: number; child?: number; infant?: number }
    departureSlotId?: string
    departureDate?: string
    dateRange?: { checkIn?: string; checkOut?: string }
  }
  travelers?: Array<{
    rowId?: string
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
    band?: string
    dateOfBirth?: string
    nationality?: string
    passportNumber?: string
    passportExpiry?: string
    dietaryRequirements?: string
    accessibilityNeeds?: string
    preferredLanguage?: string
    specialRequests?: string
    isPrimary?: boolean
    isLeadTraveler?: boolean
    documents?: Record<string, unknown>
  }>
  entity?: { module?: string; id?: string }
  internalNotes?: string
}

/**
 * Snapshot subset `materializeChildren` reads from. The catalog table
 * has more columns (idempotency_key, captured_at, etc.), but children
 * materialization only needs the parts that drive line items + supplier
 * statuses.
 */
type MaterializationSnapshot = {
  /** Snapshot id — stamped on each `booking_items.source_snapshot_id`. */
  id?: string
  entity_module: string
  entity_id: string
  source_kind: string
  source_provider: string | null
  source_ref: string | null
  frozen_payload: Record<string, unknown> | null
  pricing_base_amount: string | null
  pricing_taxes: string | null
  pricing_fees: string | null
  pricing_surcharges: string | null
  pricing_currency: string | null
}

async function materializeChildren(
  db: PostgresJsDatabase,
  booking: typeof bookings.$inferSelect,
  snapshot: MaterializationSnapshot,
  draftPayload: DraftPayload,
  env: CloudflareBindings,
): Promise<void> {
  const { bookingTravelers, bookingItems, bookingSupplierStatuses } = await import(
    "@voyantjs/bookings/schema"
  )

  const travelers = draftPayload.travelers ?? []
  if (travelers.length > 0) {
    const travelerRows = travelers
      .map((t, idx) => ({
        draftTraveler: t,
        row: {
          bookingId: booking.id,
          firstName: t.firstName ?? "Traveler",
          lastName: t.lastName ?? `${idx + 1}`,
          email: t.email ?? null,
          phone: t.phone ?? null,
          travelerCategory: travelerBandToCategory(t.band),
          preferredLanguage: t.preferredLanguage ?? null,
          specialRequests: t.specialRequests ?? null,
          isPrimary: t.isPrimary ?? t.isLeadTraveler ?? idx === 0,
        },
      }))
      .filter(({ draftTraveler }) => {
        return (
          (draftTraveler.firstName?.length ?? 0) > 0 || (draftTraveler.lastName?.length ?? 0) > 0
        )
      })
    const rows = travelerRows.map(({ row }) => row)
    if (rows.length > 0) {
      const insertedTravelers = await db.insert(bookingTravelers).values(rows).returning()
      try {
        await materializeTravelerTravelDetails(
          db,
          insertedTravelers,
          travelerRows.map(({ draftTraveler }) => draftTraveler),
          env,
        )
      } catch (err) {
        console.warn("[catalog-checkout] traveler travel-details materialization failed", err)
      }
    }
  }

  // One item summarizing the booked entity, so the items tab isn't
  // empty. Real verticals (cruises with cabin lines, hospitality with
  // room lines) fan this out per their own conventions; this is the
  // generic fallback so sourced products show up in the UI.
  //
  // Resolve a real product title rather than the dumb fallback
  // "Tour booking". For sourced products, the projection captured
  // by `catalog_sourced_entries` carries the upstream name; for
  // owned products, the local `products.title` is canonical.
  const resolvedTitle = await resolveLineItemTitle(db, snapshot)
  const itemDates = extractItemDates(snapshot, draftPayload, booking)
  const itemDescription = extractItemDescription(snapshot)

  // Item-level cost mirrors the booking-level cost we set later: when
  // the upstream provides a net rate (Bokun-style net/gross split),
  // use it; otherwise fall back to sell. Owned bookings skip cost on
  // the item — the operator IS the supplier, no "cost" makes sense.
  const sellAmountCents = booking.sellAmountCents ?? 0
  const upstreamCostCents =
    snapshot.source_kind !== OWNED_SOURCE_KIND ? await resolveUpstreamCostCents(db, snapshot) : null
  const itemCostAmountCents =
    snapshot.source_kind !== OWNED_SOURCE_KIND ? (upstreamCostCents ?? sellAmountCents) : null
  const itemQuantity = booking.pax ?? 1

  const insertedItems = await db
    .insert(bookingItems)
    .values({
      bookingId: booking.id,
      title: resolvedTitle,
      description: itemDescription,
      productId: snapshot.entity_module === "products" ? snapshot.entity_id : null,
      quantity: itemQuantity,
      itemType: "service",
      status: "on_hold",
      serviceDate: itemDates.serviceDate ?? null,
      startsAt: itemDates.startsAt ?? null,
      endsAt: itemDates.endsAt ?? null,
      unitSellAmountCents:
        booking.pax && booking.pax > 0 && booking.sellAmountCents
          ? Math.round(booking.sellAmountCents / booking.pax)
          : (booking.sellAmountCents ?? 0),
      totalSellAmountCents: booking.sellAmountCents ?? 0,
      sellCurrency: booking.sellCurrency,
      ...(itemCostAmountCents != null
        ? {
            costCurrency: booking.sellCurrency,
            unitCostAmountCents:
              itemQuantity > 0
                ? Math.round(itemCostAmountCents / itemQuantity)
                : itemCostAmountCents,
            totalCostAmountCents: itemCostAmountCents,
          }
        : {}),
      sourceSnapshotId: (snapshot as { id?: string }).id ?? null,
    })
    .onConflictDoNothing()
    .returning()

  for (const item of insertedItems) {
    await materializeBookingItemTaxLine(
      db,
      booking,
      item.id,
      item.totalSellAmountCents ?? 0,
      snapshot,
    )
  }

  await materializeBookingAllocations(db, booking, insertedItems, draftPayload, snapshot)

  // Sourced bookings: auto-populate the supplier-status row + booking
  // cost columns from the catalog snapshot. Without this the operator
  // sees an empty "Furnizori" tab and "Cost / Marja —" on a deal
  // we already know the supplier for. Owned bookings skip — the
  // operator IS the supplier.
  if (snapshot.source_kind !== OWNED_SOURCE_KIND) {
    const supplierInfo = await resolveSupplierFromSnapshot(db, snapshot)
    if (supplierInfo) {
      // Cost = sell as a working assumption (zero-markup default).
      // Operators with a configured net/gross split should override
      // via the supplier-status edit form. We mark the row's notes so
      // it's clear this came from auto-fill, not from a real
      // supplier confirmation.
      const costAmountCents = supplierInfo.upstreamCostCents ?? sellAmountCents
      const costCurrency = booking.sellCurrency

      try {
        await db
          .insert(bookingSupplierStatuses)
          .values({
            bookingId: booking.id,
            supplierServiceId: supplierInfo.supplierServiceId ?? null,
            serviceName: supplierInfo.serviceName,
            supplierReference: supplierInfo.supplierReference ?? null,
            costCurrency,
            costAmountCents,
            status: "pending",
            notes:
              `Auto-populated from ${snapshot.source_kind} catalog snapshot. ` +
              "Verify against supplier confirmation when it lands.",
          })
          .onConflictDoNothing()
      } catch (err) {
        console.warn("[catalog-checkout] auto supplier-status insert failed", err)
      }

      // Stamp booking-level cost so the header's Cost/Marja card
      // shows something meaningful. Margin computed against the
      // current cost+sell — when sell == cost, margin is 0; that's
      // accurate for our zero-markup default until the operator
      // updates the cost.
      try {
        const margin =
          sellAmountCents > 0
            ? Math.round(((sellAmountCents - costAmountCents) / sellAmountCents) * 100)
            : 0
        const baseCurrencyMatches =
          booking.baseCurrency != null && booking.baseCurrency === booking.sellCurrency
        await db
          .update(bookings)
          .set({
            costAmountCents,
            // Only set base_cost_amount_cents when base_currency is
            // already set on the booking. The check constraint
            // `ck_bookings_base_currency_amounts` rejects setting
            // base_*_amount with no base_currency.
            baseCostAmountCents: baseCurrencyMatches
              ? costAmountCents
              : booking.baseCostAmountCents,
            marginPercent: margin,
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, booking.id))
      } catch (err) {
        console.warn("[catalog-checkout] booking cost update failed", err)
      }
    }
  }
}

/**
 * Backfill `booking_item_tax_lines` for an existing booking using the
 * catalog snapshot stamped on it at checkout time. Used by the admin
 * "rebuild tax lines" route to repair bookings created before the
 * snapshot fallback shipped (or any time the operator changes the tax
 * policy and wants to re-derive). Deletes any existing rows for each
 * item before re-materializing — the route is destructive by design.
 */
export async function rebuildBookingItemTaxLines(
  db: PostgresJsDatabase,
  bookingId: string,
): Promise<{ rebuilt: number; itemsWithoutSnapshot: number }> {
  const { bookingItems: bookingItemsTable, bookings: bookingsTable } = await import(
    "@voyantjs/bookings/schema"
  )
  const { bookingCatalogSnapshotTable } = await import("@voyantjs/catalog")
  const [booking] = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.id, bookingId))
    .limit(1)
  if (!booking) return { rebuilt: 0, itemsWithoutSnapshot: 0 }

  const items = await db
    .select()
    .from(bookingItemsTable)
    .where(eq(bookingItemsTable.bookingId, bookingId))

  let rebuilt = 0
  let itemsWithoutSnapshot = 0
  for (const item of items) {
    const snapshot = await loadSnapshotForItem(db, bookingCatalogSnapshotTable, item)
    if (!snapshot) {
      itemsWithoutSnapshot += 1
      continue
    }
    await db.delete(bookingItemTaxLines).where(eq(bookingItemTaxLines.bookingItemId, item.id))
    await materializeBookingItemTaxLine(
      db,
      booking,
      item.id,
      item.totalSellAmountCents ?? 0,
      snapshot,
    )
    rebuilt += 1
  }
  return { rebuilt, itemsWithoutSnapshot }
}

async function loadSnapshotForItem(
  db: PostgresJsDatabase,
  snapshotTable: typeof import("@voyantjs/catalog").bookingCatalogSnapshotTable,
  item: { sourceSnapshotId: string | null; bookingId: string },
): Promise<MaterializationSnapshot | null> {
  const snapshotId = item.sourceSnapshotId
  if (!snapshotId) {
    // Item wasn't materialized from a catalog snapshot; fall back to the
    // booking-level snapshot if there is exactly one for this booking.
    const rows = await db
      .select()
      .from(snapshotTable)
      .where(eq(snapshotTable.booking_id, item.bookingId))
      .limit(2)
    return rows.length === 1 && rows[0] ? toMaterializationSnapshot(rows[0]) : null
  }
  const [row] = await db
    .select()
    .from(snapshotTable)
    .where(eq(snapshotTable.id, snapshotId))
    .limit(1)
  return row ? toMaterializationSnapshot(row) : null
}

function toMaterializationSnapshot(
  row: import("@voyantjs/catalog").SelectBookingCatalogSnapshot,
): MaterializationSnapshot {
  return {
    id: row.id,
    entity_module: row.entity_module,
    entity_id: row.entity_id,
    source_kind: row.source_kind,
    source_provider: row.source_provider,
    source_ref: row.source_ref,
    frozen_payload: row.frozen_payload as Record<string, unknown> | null,
    pricing_base_amount: row.pricing_base_amount != null ? String(row.pricing_base_amount) : null,
    pricing_taxes: row.pricing_taxes != null ? String(row.pricing_taxes) : null,
    pricing_fees: row.pricing_fees != null ? String(row.pricing_fees) : null,
    pricing_surcharges: row.pricing_surcharges != null ? String(row.pricing_surcharges) : null,
    pricing_currency: row.pricing_currency,
  }
}

async function materializeBookingItemTaxLine(
  db: PostgresJsDatabase,
  booking: typeof bookings.$inferSelect,
  bookingItemId: string,
  amountCents: number,
  snapshot: MaterializationSnapshot,
) {
  const currency = booking.sellCurrency ?? snapshot.pricing_currency ?? "EUR"
  const taxRate = await resolveBookingSellTaxRate(
    db,
    {
      productId: snapshot.entity_module === "products" ? snapshot.entity_id : null,
      facts: inferSnapshotTaxFacts(snapshot),
    },
    {
      resolveBookingTaxSettings,
    },
  )
  const policyLine = computeBookingItemTaxLine(taxRate, amountCents, currency)
  // Fall back to the snapshot's `pricing_taxes` when the operator has no
  // tax policy configured. Without this the booking page (which reads the
  // snapshot directly) shows tax but the invoice (which reads
  // `booking_item_tax_lines`) shows zero — operators see a mismatch.
  // The booking total already includes this tax (sellAmountCents = base +
  // taxes + fees + surcharges), so the row is `includedInPrice: true`.
  const fallbackLine = policyLine ? null : buildSnapshotFallbackTaxLine(snapshot, currency)
  const taxLine = policyLine ?? fallbackLine
  if (!taxLine) return

  await db
    .insert(bookingItemTaxLines)
    .values({
      bookingItemId,
      ...taxLine,
    })
    .onConflictDoNothing()
}

function buildSnapshotFallbackTaxLine(snapshot: MaterializationSnapshot, currency: string) {
  if (!snapshot.pricing_taxes) return null
  const taxAmount = Number.parseFloat(snapshot.pricing_taxes)
  if (!Number.isFinite(taxAmount) || taxAmount <= 0) return null
  const taxCents = Math.round(taxAmount)
  if (taxCents <= 0) return null
  return {
    code: "snapshot/tax",
    name: "Tax",
    scope: "included" as const,
    currency,
    amountCents: taxCents,
    rateBasisPoints: null,
    includedInPrice: true,
    sortOrder: 0,
  }
}

/**
 * Write `booking_allocations` rows linking each booking item to the
 * availability slot the customer selected. The allocation manifest +
 * "Generate resources" queries both filter by `availability_slot_id`,
 * so without these rows the slot appears empty even when bookings
 * exist for the right product + dates.
 *
 * Idempotent: short-circuits when allocations for the booking already
 * exist (re-running checkout finalize doesn't create duplicates).
 */
interface InsertedBookingItem {
  id: string
  quantity?: number | null
  optionId?: string | null
  optionUnitId?: string | null
}

async function materializeBookingAllocations(
  db: PostgresJsDatabase,
  booking: typeof bookings.$inferSelect,
  insertedItems: ReadonlyArray<InsertedBookingItem>,
  draftPayload: DraftPayload,
  snapshot: MaterializationSnapshot,
): Promise<void> {
  const slotId = pickString(draftPayload.configure?.departureSlotId)
  if (!slotId || insertedItems.length === 0) return

  const { bookingAllocations } = await import("@voyantjs/bookings/schema")
  const existing = await db
    .select({ id: bookingAllocations.id })
    .from(bookingAllocations)
    .where(eq(bookingAllocations.bookingId, booking.id))
    .limit(1)
  if (existing.length > 0) return

  const productId = snapshot.entity_module === "products" ? snapshot.entity_id : null
  const status: "held" | "confirmed" =
    booking.status === "confirmed" ||
    booking.status === "in_progress" ||
    booking.status === "completed"
      ? "confirmed"
      : "held"
  const confirmedAt = status === "confirmed" ? new Date() : null

  await db.insert(bookingAllocations).values(
    insertedItems.map((item) => ({
      bookingId: booking.id,
      bookingItemId: item.id,
      productId,
      optionId: item.optionId ?? null,
      optionUnitId: item.optionUnitId ?? null,
      availabilitySlotId: slotId,
      quantity: item.quantity ?? 1,
      status,
      confirmedAt,
    })),
  )
}

function inferSnapshotTaxFacts(snapshot: MaterializationSnapshot) {
  const content = snapshot.frozen_payload?.content
  const accommodationCountries = extractAccommodationCountries(content)
  return {
    hasAccommodation: accommodationCountries.length > 0,
    accommodationCountries,
  }
}

function extractAccommodationCountries(value: unknown): string[] {
  const countries = new Set<string>()
  collectAccommodationCountries(value, countries, 0)
  return [...countries]
}

function collectAccommodationCountries(value: unknown, countries: Set<string>, depth: number) {
  if (depth > 6 || value == null) return
  if (Array.isArray(value)) {
    for (const item of value) collectAccommodationCountries(item, countries, depth + 1)
    return
  }
  if (typeof value !== "object") return

  const record = value as Record<string, unknown>
  const typeValue = pickString(record.type, record.kind, record.serviceType, record.service_type)
  const looksLikeAccommodation =
    typeValue?.toLowerCase().includes("accommodation") ||
    typeValue?.toLowerCase().includes("hotel") ||
    typeValue?.toLowerCase().includes("lodging")
  if (looksLikeAccommodation) {
    const country = pickString(record.countryCode, record.country_code, record.country)
    if (country && /^[a-z]{2}$/i.test(country)) countries.add(country.toUpperCase())
  }

  for (const child of Object.values(record)) {
    collectAccommodationCountries(child, countries, depth + 1)
  }
}

async function materializeTravelerTravelDetails(
  db: PostgresJsDatabase,
  insertedTravelers: Array<{ id: string }>,
  draftTravelers: NonNullable<DraftPayload["travelers"]>,
  env: CloudflareBindings,
): Promise<void> {
  const runtime = buildBookingRouteRuntime(env)
  const pii = createBookingPiiService({ kms: await runtime.getKmsProvider() })

  for (const [index, traveler] of insertedTravelers.entries()) {
    const draftTraveler = draftTravelers[index]
    if (!draftTraveler) continue

    const details = extractDraftTravelerTravelDetails(draftTraveler, index)
    if (!hasTravelDetails(details)) continue

    await pii.upsertTravelerTravelDetails(db, traveler.id, details, "system")
  }
}

function extractDraftTravelerTravelDetails(
  traveler: NonNullable<DraftPayload["travelers"]>[number],
  index: number,
) {
  const documents = traveler.documents ?? {}
  return {
    nationality: pickString(traveler.nationality, documents.nationality, documents.country),
    passportNumber: pickString(
      traveler.passportNumber,
      documents.passportNumber,
      documents.passport_number,
      documents.documentNumber,
      documents.document_number,
      documents.passport,
    ),
    passportExpiry: pickString(
      traveler.passportExpiry,
      documents.passportExpiry,
      documents.passport_expiry,
      documents.documentExpiry,
      documents.document_expiry,
      documents.passportExpiresAt,
    ),
    dateOfBirth: pickString(
      traveler.dateOfBirth,
      documents.dateOfBirth,
      documents.date_of_birth,
      documents.dob,
    ),
    dietaryRequirements: pickString(
      traveler.dietaryRequirements,
      documents.dietaryRequirements,
      documents.dietary,
    ),
    accessibilityNeeds: pickString(
      traveler.accessibilityNeeds,
      documents.accessibilityNeeds,
      documents.accessibility,
    ),
    isLeadTraveler: traveler.isLeadTraveler ?? traveler.isPrimary ?? index === 0,
  }
}

function hasTravelDetails(input: ReturnType<typeof extractDraftTravelerTravelDetails>): boolean {
  return (
    Boolean(input.nationality) ||
    Boolean(input.passportNumber) ||
    Boolean(input.passportExpiry) ||
    Boolean(input.dateOfBirth) ||
    Boolean(input.dietaryRequirements) ||
    Boolean(input.accessibilityNeeds) ||
    input.isLeadTraveler
  )
}

/**
 * Resolve supplier info for the booking from the catalog snapshot.
 * Pulls from:
 *   1. `catalog_sourced_entries.projection.supplierId` — supplier
 *      name/id captured at sync time (covers Bokun, demo adapter, etc.).
 *   2. The frozen payload's `upstream_payload.supplierId` — fallback
 *      when the sourced-entries row is missing (legacy bookings).
 *   3. `frozen_payload.reserve.orderId` — used as `supplierReference`
 *      so operators can match up against the upstream provider's
 *      booking reference.
 *
 * Returns null when no supplier can be resolved — the caller treats
 * that as "skip auto-fill, leave blank for manual entry".
 */
async function resolveSupplierFromSnapshot(
  db: PostgresJsDatabase,
  snapshot: MaterializationSnapshot,
): Promise<{
  serviceName: string
  supplierReference: string | null
  supplierServiceId: string | null
  upstreamCostCents: number | null
} | null> {
  let supplierName: string | null = null
  let serviceName: string | null = null
  let upstreamCostCents: number | null = null

  // Layer 1: sourced entry projection.
  try {
    const { catalogSourcedEntriesTable } = await import("@voyantjs/catalog")
    const [sourcedEntry] = await db
      .select({ projection: catalogSourcedEntriesTable.projection })
      .from(catalogSourcedEntriesTable)
      .where(
        and(
          eq(catalogSourcedEntriesTable.entity_module, snapshot.entity_module),
          eq(catalogSourcedEntriesTable.entity_id, snapshot.entity_id),
        ),
      )
      .limit(1)
    if (sourcedEntry?.projection) {
      const p = sourcedEntry.projection as Record<string, unknown>
      supplierName = pickString(p.supplierName, p.supplier_name, p.supplierId)
      serviceName = pickString(p.name, p.title)
      const cost = p.upstreamCostCents ?? p.netPriceCents ?? p.costCents
      if (typeof cost === "number" && Number.isFinite(cost)) upstreamCostCents = cost
    }
  } catch {
    // continue
  }

  // Layer 2: frozen upstream payload.
  if (!supplierName || !serviceName) {
    const upstream = (snapshot.frozen_payload?.quote as Record<string, unknown> | undefined)
      ?.upstream_payload as Record<string, unknown> | undefined
    if (upstream) {
      supplierName = supplierName ?? pickString(upstream.supplierName, upstream.supplierId)
      serviceName = serviceName ?? pickString(upstream.name, upstream.title)
    }
  }

  // Layer 3: fallback labels.
  if (!serviceName) serviceName = `${snapshot.entity_module} booking`

  // Reserve.orderId is the upstream provider's reference for this
  // booking — operators reconcile against it when the supplier
  // sends a confirmation. Falls back to the snapshot's source_ref.
  const reserve = snapshot.frozen_payload?.reserve as Record<string, unknown> | undefined
  const supplierReference =
    pickString(reserve?.orderId, reserve?.upstream_ref) ?? snapshot.source_ref

  // Compose the human label: "$serviceName" if no supplier name,
  // "$supplierName · $serviceName" otherwise — gives operators the
  // most useful one-line scan in the supplier statuses table.
  const composedName = supplierName ? `${supplierName} · ${serviceName}` : serviceName

  return {
    serviceName: composedName,
    supplierReference,
    supplierServiceId: null,
    upstreamCostCents,
  }
}

function pickString(...candidates: unknown[]): string | null {
  for (const c of candidates) if (typeof c === "string" && c.length > 0) return c
  return null
}

/**
 * Resolve booking-level dates from the draft and frozen source data.
 * `start_date`/`end_date` drive the admin booking header, while item
 * dates drive the line table. A storefront product selection usually
 * carries only `departureSlotId`, so we resolve that id against the
 * quote/reserve/content payload before falling back to free-form dates.
 */
function extractBookingDates(
  snapshot: Pick<MaterializationSnapshot, "frozen_payload">,
  draftPayload: DraftPayload,
): { startDate: string | null; endDate: string | null } {
  const range = draftPayload.configure?.dateRange
  if (range?.checkIn) {
    return {
      startDate: range.checkIn.slice(0, 10),
      endDate: range.checkOut ? range.checkOut.slice(0, 10) : null,
    }
  }

  const selectedDeparture = findSelectedDeparture(snapshot, draftPayload)
  if (selectedDeparture?.startsRaw) {
    return {
      startDate: selectedDeparture.startsRaw.slice(0, 10),
      endDate: selectedDeparture.endsRaw ? selectedDeparture.endsRaw.slice(0, 10) : null,
    }
  }

  if (typeof draftPayload.configure?.departureDate === "string") {
    return {
      startDate: draftPayload.configure.departureDate.slice(0, 10),
      endDate: null,
    }
  }

  return { startDate: null, endDate: null }
}

/**
 * Pull start/end dates for a booking-item from the most reliable
 * source available. Order:
 *   1. The selected `departureSlotId` resolved against reserve /
 *      quote / captured content payloads.
 *   2. `frozen_payload.quote.upstream_payload.metadata.days[]` —
 *      Bokun-style itinerary captured at quote time, gives us per-day
 *      dates with full timezone fidelity.
 *   3. Draft `configure.dateRange.checkIn`/`checkOut` — what the
 *      customer selected on the storefront before booking.
 *   4. Draft `configure.departureDate` — single-day tour selection.
 *   5. Booking row's own `start_date` / `end_date` columns — the
 *      caller already populated these from the same draft when
 *      writing the booking row, so this is a final safety net.
 *
 * Returns nulls when nothing resolves — the caller treats that as
 * "no date data, leave NULL" rather than fabricating one.
 */
function extractItemDates(
  snapshot: MaterializationSnapshot,
  draftPayload: DraftPayload,
  booking: typeof bookings.$inferSelect,
): { serviceDate: string | null; startsAt: Date | null; endsAt: Date | null } {
  // Layer 1: concrete selected departure/sailing.
  const selectedDeparture = findSelectedDeparture(snapshot, draftPayload)
  if (selectedDeparture?.startsRaw) {
    const startsAt = new Date(selectedDeparture.startsRaw)
    const endsAt = selectedDeparture.endsRaw ? new Date(selectedDeparture.endsRaw) : null
    if (Number.isFinite(startsAt.getTime())) {
      return {
        serviceDate: selectedDeparture.startsRaw.slice(0, 10),
        startsAt,
        endsAt: endsAt && Number.isFinite(endsAt.getTime()) ? endsAt : null,
      }
    }
  }

  // Layer 2: upstream metadata.days[] — flat array of {date, ...} or
  // {startAt/endAt} entries.
  const days = (
    (snapshot.frozen_payload?.quote as Record<string, unknown> | undefined)?.upstream_payload as
      | Record<string, unknown>
      | undefined
  )?.metadata as Record<string, unknown> | undefined
  const daysArray = (days?.days ?? days) as Array<Record<string, unknown>> | undefined
  if (Array.isArray(daysArray) && daysArray.length > 0) {
    const first = daysArray[0]
    const last = daysArray[daysArray.length - 1]
    const startsRaw = pickString(first?.startAt, first?.startsAt, first?.date)
    const endsRaw = pickString(last?.endAt, last?.endsAt, last?.date)
    if (startsRaw) {
      const startsAt = new Date(startsRaw)
      const endsAt = endsRaw ? new Date(endsRaw) : null
      if (Number.isFinite(startsAt.getTime())) {
        return {
          serviceDate: startsRaw.slice(0, 10),
          startsAt,
          endsAt: endsAt && Number.isFinite(endsAt.getTime()) ? endsAt : null,
        }
      }
    }
  }

  // Layer 3: draft date range.
  const range = draftPayload.configure?.dateRange
  if (range?.checkIn) {
    const startsAt = new Date(range.checkIn)
    const endsAt = range.checkOut ? new Date(range.checkOut) : null
    if (Number.isFinite(startsAt.getTime())) {
      return {
        serviceDate: range.checkIn.slice(0, 10),
        startsAt,
        endsAt: endsAt && Number.isFinite(endsAt.getTime()) ? endsAt : null,
      }
    }
  }

  // Layer 4: single-day tour.
  if (typeof draftPayload.configure?.departureDate === "string") {
    const startsAt = new Date(draftPayload.configure.departureDate)
    if (Number.isFinite(startsAt.getTime())) {
      return {
        serviceDate: draftPayload.configure.departureDate.slice(0, 10),
        startsAt,
        endsAt: null,
      }
    }
  }

  // Layer 5: booking row dates (already populated from the draft).
  if (booking.startDate) {
    return {
      serviceDate: booking.startDate,
      startsAt: new Date(booking.startDate),
      endsAt: booking.endDate ? new Date(booking.endDate) : null,
    }
  }

  return { serviceDate: null, startsAt: null, endsAt: null }
}

function findSelectedDeparture(
  snapshot: Pick<MaterializationSnapshot, "frozen_payload">,
  draftPayload: DraftPayload,
): { startsRaw: string | null; endsRaw: string | null } | null {
  const slotId = pickString(draftPayload.configure?.departureSlotId)
  const frozen = snapshot.frozen_payload ?? {}
  const reserve = frozen.reserve as Record<string, unknown> | null | undefined
  const quote = frozen.quote as Record<string, unknown> | null | undefined
  const quotePayload = quote?.upstream_payload as Record<string, unknown> | null | undefined
  const content = frozen.content as Record<string, unknown> | null | undefined

  const direct = departureDatesFromRecord(
    asRecord(reserve?.departure) ?? asRecord(quotePayload?.departure),
  )
  if (direct?.startsRaw && (!slotId || direct.id === slotId)) {
    return direct
  }

  if (!slotId) return direct?.startsRaw ? direct : null

  const candidates = [
    content?.departures,
    (content?.product as Record<string, unknown> | undefined)?.departures,
    quotePayload?.departures,
    (quotePayload?.metadata as Record<string, unknown> | undefined)?.departures,
  ]

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue
    for (const item of candidate) {
      const row = asRecord(item)
      if (!row || row.id !== slotId) continue
      const dates = departureDatesFromRecord(row)
      if (dates?.startsRaw) return dates
    }
  }

  return null
}

function departureDatesFromRecord(
  row: Record<string, unknown> | undefined,
): { id: string | null; startsRaw: string | null; endsRaw: string | null } | null {
  if (!row) return null
  const startsRaw = pickString(
    row.starts_at,
    row.startsAt,
    row.start_at,
    row.startAt,
    row.start_date,
    row.startDate,
    row.date,
  )
  if (!startsRaw) return null
  return {
    id: pickString(row.id),
    startsRaw,
    endsRaw: pickString(row.ends_at, row.endsAt, row.end_at, row.endAt, row.end_date, row.endDate),
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

/**
 * Pull a description for the booking item from the upstream payload.
 * Sourced products typically carry rich descriptions on the upstream
 * entry; surfacing a short snippet on the item helps operators scan
 * a multi-item booking without clicking into each line.
 */
function extractItemDescription(snapshot: MaterializationSnapshot): string | null {
  const upstream = (snapshot.frozen_payload?.quote as Record<string, unknown> | undefined)
    ?.upstream_payload as Record<string, unknown> | undefined
  const desc = pickString(upstream?.description, upstream?.summary, upstream?.short_description)
  if (!desc) return null
  // Cap at 600 chars — anything longer belongs in the catalog source
  // sheet rather than on every booking-item row.
  return desc.length > 600 ? `${desc.slice(0, 597)}…` : desc
}

/**
 * Look up the upstream cost (net rate the operator pays the supplier)
 * for a sourced entity. Returns null when the adapter doesn't expose
 * a net/gross split — caller falls back to sell-as-cost (zero-markup
 * default).
 */
async function resolveUpstreamCostCents(
  db: PostgresJsDatabase,
  snapshot: MaterializationSnapshot,
): Promise<number | null> {
  try {
    const { catalogSourcedEntriesTable } = await import("@voyantjs/catalog")
    const [sourced] = await db
      .select({ projection: catalogSourcedEntriesTable.projection })
      .from(catalogSourcedEntriesTable)
      .where(
        and(
          eq(catalogSourcedEntriesTable.entity_module, snapshot.entity_module),
          eq(catalogSourcedEntriesTable.entity_id, snapshot.entity_id),
        ),
      )
      .limit(1)
    if (sourced?.projection) {
      const p = sourced.projection as Record<string, unknown>
      const cost = p.upstreamCostCents ?? p.netPriceCents ?? p.costCents
      if (typeof cost === "number" && Number.isFinite(cost)) return cost
    }
  } catch {
    // ignore
  }
  return null
}

/**
 * Resolve a human title for the booking line item. Tries:
 *   1. `catalog_sourced_entries.projection.name` — sourced products
 *      (demo, Bokun, …) all carry the upstream title there.
 *   2. `products.title` — owned products from this template's own
 *      products module.
 *   3. A generic "$module booking" fallback.
 *
 * Errors fall through quietly — a title is purely cosmetic, the
 * booking-item row should always insert successfully.
 */
async function resolveLineItemTitle(
  db: PostgresJsDatabase,
  snapshot: { entity_module: string; entity_id: string },
): Promise<string> {
  try {
    const { catalogSourcedEntriesTable } = await import("@voyantjs/catalog")
    const [sourcedEntry] = await db
      .select({ projection: catalogSourcedEntriesTable.projection })
      .from(catalogSourcedEntriesTable)
      .where(
        and(
          eq(catalogSourcedEntriesTable.entity_module, snapshot.entity_module),
          eq(catalogSourcedEntriesTable.entity_id, snapshot.entity_id),
        ),
      )
      .limit(1)
    if (sourcedEntry?.projection) {
      const projection = sourcedEntry.projection as Record<string, unknown>
      const candidate = projection.name ?? projection.title
      if (typeof candidate === "string" && candidate.length > 0) {
        return candidate
      }
    }
  } catch {
    // continue to owned-products fallback
  }

  if (snapshot.entity_module === "products") {
    try {
      const { productsService } = await import("@voyantjs/products")
      const product = await productsService.getProductById(db, snapshot.entity_id)
      if (product?.name) return product.name
    } catch {
      // continue to generic fallback
    }
  }

  return `${snapshot.entity_module} booking`
}

function travelerBandToCategory(
  band: string | undefined,
): "adult" | "child" | "infant" | "senior" | "other" {
  if (band === "child" || band === "infant" || band === "senior") return band
  return "adult"
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
    expiresAt: booking.holdExpiresAt?.toISOString() ?? null,
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
    paymentMethod: "bank_transfer",
    expiresAt: booking.holdExpiresAt?.toISOString() ?? null,
    notes: `Bank transfer for booking ${booking.bookingNumber} (proforma ${
      proforma?.invoiceNumber ?? "—"
    })`,
    targetType: "booking",
  } as never)

  const env = c.env as Record<string, string | undefined>
  const bankTransfer = await resolveBankTransferInstructions(db, env)
  return c.json({
    kind: "bank_transfer_instructions" as const,
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
  })
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
 * Read the acceptance fingerprint stashed by the storefront from the
 * contract's own metadata. The pre-create flow (see
 * `persistAcceptanceDraftContract`) writes it to `contract.metadata.acceptance`
 * at /checkout/start time; this is the canonical home — no relay
 * through `bookings.internal_notes`.
 *
 * Older contracts created via the legacy marker-on-internal-notes
 * pattern fall back to the per-booking marker reader so existing
 * bookings finish their signature flow without manual re-entry.
 */
function readContractAcceptance(
  contractMetadata: unknown,
  internalNotesFallback: string | null,
): StoredAcceptance | null {
  if (contractMetadata && typeof contractMetadata === "object") {
    const meta = contractMetadata as Record<string, unknown>
    if (meta.acceptance && typeof meta.acceptance === "object") {
      return meta.acceptance as StoredAcceptance
    }
  }
  if (!internalNotesFallback) return null
  for (const line of internalNotesFallback.split("\n")) {
    if (!line.startsWith(ACCEPTANCE_MARKER_PREFIX)) continue
    try {
      return JSON.parse(line.slice(ACCEPTANCE_MARKER_PREFIX.length)) as StoredAcceptance
    } catch {
      // Bad marker — try next line.
    }
  }
  return null
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
  c: Context,
  booking: typeof bookings.$inferSelect,
  acceptance: NonNullable<z.infer<typeof checkoutStartSchema>["contractAcceptance"]>,
): Promise<void> {
  const { contractsService } = await import("@voyantjs/legal/contracts")

  const template = await contractsService.findTemplateBySlug(db, acceptance.templateSlug)
  if (!template?.currentVersionId) {
    console.warn(
      `[catalog-checkout] persistAcceptanceDraftContract: template "${acceptance.templateSlug}" not found or has no current version; skipping.`,
    )
    return
  }

  const clientIp =
    c.req.header("cf-connecting-ip") ??
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip") ??
    ""
  const userAgent = c.req.header("user-agent") ?? ""
  const acceptanceMetadata: StoredAcceptance = {
    templateId: acceptance.templateId,
    templateSlug: acceptance.templateSlug,
    acceptedAt: acceptance.acceptedAt,
    acceptedMarketing: acceptance.acceptedMarketing,
    clientIp,
    userAgent,
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

async function persistAcceptanceSignature(
  db: PostgresJsDatabase,
  contractId: string,
  eventBus?: EventBus,
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

  // Prefer the contract's own metadata (the new pre-create path);
  // fall back to the legacy internal_notes marker for old contracts.
  const acceptance = readContractAcceptance(contract.metadata, booking.internalNotes)
  if (!acceptance) return

  // Already signed? Idempotency comes from listSignatures.
  const existing = await contractsService.listSignatures(db, contractId)
  if (existing.length > 0) return

  if (contract.status === "issued") {
    const sent = await contractsService.sendContract(db, contractId, { eventBus })
    if (sent.status !== "sent") {
      console.warn(
        `[catalog-checkout] could not send contract before acceptance signature for ${contractId}: ${sent.status}`,
      )
      return
    }
  }

  // Prefer the booking's contact name when available so the signer
  // line on the contract reads as the human, not the booking ref.
  const contactName = [booking.contactFirstName, booking.contactLastName]
    .filter(Boolean)
    .join(" ")
    .trim()
  const signerName =
    contactName ||
    `Storefront customer${booking.bookingNumber ? ` (${booking.bookingNumber})` : ""}`

  const result = await contractsService.signContract(
    db,
    contractId,
    {
      signerName,
      signerEmail: booking.contactEmail ?? null,
      method: "electronic" as const,
      ipAddress: acceptance.clientIp ? acceptance.clientIp.slice(0, 64) : null,
      userAgent: acceptance.userAgent ? acceptance.userAgent.slice(0, 500) : null,
      metadata: {
        source: "storefront-checkout",
        templateId: acceptance.templateId,
        templateSlug: acceptance.templateSlug,
        acceptedAt: acceptance.acceptedAt,
        acceptedMarketing: acceptance.acceptedMarketing,
        renderedHtmlLength: acceptance.renderedHtmlLength,
      },
    } as never,
    { eventBus },
  )

  if (result.status !== "signed") {
    console.warn(
      `[catalog-checkout] could not record acceptance signature for ${contractId}: ${result.status}`,
    )
    return
  }

  // Legacy cleanup: strip any leftover marker from internal_notes for
  // contracts that came through the old relay path. New contracts
  // (created via persistAcceptanceDraftContract) never had a marker
  // written, so this branch no-ops.
  if (booking.internalNotes?.includes(ACCEPTANCE_MARKER_PREFIX)) {
    const cleanedNotes = booking.internalNotes
      .split("\n")
      .filter((line) => !line.startsWith(ACCEPTANCE_MARKER_PREFIX))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
    await db
      .update(bookings)
      .set({
        internalNotes: cleanedNotes.length > 0 ? cleanedNotes : null,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, booking.id))
  }
}

/**
 * Optional callback that generates (or fetches existing) the
 * contract PDF for a booking. Wired into `createCatalogCheckoutBundle`
 * by `app.ts` and forwarded into `CheckoutFinalizeDeps.generateContractPdf`
 * so the explicit `generate_contract_pdf` workflow step can run.
 *
 * Idempotent — if a contract document already exists for this
 * booking (because the legal subscriber on `booking.confirmed` won
 * the race, or because a prior run completed this step), the
 * implementation should return the existing ids rather than
 * generating a new contract.
 */
export type CatalogCheckoutContractPdfGenerator = (input: {
  env: CloudflareBindings
  db: PostgresJsDatabase
  eventBus: EventBus
  bookingId: string
}) => Promise<{ contractId: string; attachmentId: string } | null>

/**
 * Build the deps object the `checkout-finalize` workflow expects,
 * binding to the supplied db / eventBus / recorder. Lifted out of
 * the event subscriber so the rerun / resume runners share the same
 * implementation — keeping rerun semantics in lockstep with the
 * normal "fired by payment.completed" path.
 */
function buildCheckoutFinalizeDeps(
  env: CloudflareBindings,
  db: PostgresJsDatabase,
  eventBus: EventBus,
  recorder: WorkflowRunRecorder,
  generateContractPdf?: CatalogCheckoutContractPdfGenerator,
): CheckoutFinalizeDeps {
  return {
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
      const result = await bookingsService.confirmBooking(db, bookingId, {}, undefined, {
        eventBus,
      })
      if (result.status === "ok") return

      if (result.status === "hold_expired") {
        const recovered = await bookingsService.recoverExpiredPaidBooking(
          db,
          bookingId,
          { note: "Recovered after late payment completion" },
          undefined,
          { eventBus },
        )
        if (recovered.status === "ok") return
        throw new Error(`checkout-finalize: late payment recovery failed (${recovered.status})`)
      }

      throw new Error(`checkout-finalize: booking confirmation failed (${result.status})`)
    },
    issueInvoice: async ({ bookingId, convertedFromInvoiceId }) => {
      const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1)
      if (!booking) return null

      const { bookingItems } = await import("@voyantjs/bookings/schema")
      const items = await db
        .select()
        .from(bookingItems)
        .where(eq(bookingItems.bookingId, bookingId))

      const today = new Date().toISOString().slice(0, 10)
      const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

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
    generateContractPdf: generateContractPdf
      ? async ({ bookingId }) => generateContractPdf({ env, db, eventBus, bookingId })
      : undefined,
    linkPaymentToInvoice: async ({ bookingId, invoiceId, paymentSessionId }) => {
      // Find paid sessions targeting this booking that aren't yet
      // linked to an invoice. There's usually exactly one (the
      // checkout session the customer just paid), but the loop covers
      // edge cases like split deposits paid through multiple sessions.
      const { paymentSessions } = await import("@voyantjs/finance/schema")
      const { financeService } = await import("@voyantjs/finance")
      const paidSessions = await db
        .select()
        .from(paymentSessions)
        .where(
          and(
            eq(paymentSessions.bookingId, bookingId),
            eq(paymentSessions.status, "paid"),
            isNull(paymentSessions.invoiceId),
          ),
        )

      let firstPaymentId: string | null = null
      let sessionsLinked = 0

      for (const session of paidSessions) {
        // 1. Back-link the session to the invoice for audit / future
        //    queries (`SELECT * FROM payment_sessions WHERE invoice_id = ?`).
        await db
          .update(paymentSessions)
          .set({ invoiceId, updatedAt: new Date() })
          .where(eq(paymentSessions.id, session.id))

        // 2. Record a `payments` row tying real money received to the
        //    invoice. `financeService.createPayment` runs in a
        //    transaction that recalculates `paid_cents` /
        //    `balance_due_cents` and flips the invoice to "paid"
        //    when the totals match.
        const payment = await financeService.createPayment(db, invoiceId, {
          amountCents: session.amountCents,
          currency: session.currency,
          paymentMethod: session.paymentMethod ?? "credit_card",
          paymentInstrumentId: session.paymentInstrumentId ?? null,
          paymentAuthorizationId: session.paymentAuthorizationId ?? null,
          paymentCaptureId: session.paymentCaptureId ?? null,
          status: "completed",
          referenceNumber:
            session.providerPaymentId ??
            session.externalReference ??
            session.providerSessionId ??
            session.id,
          paymentDate: (session.completedAt ?? new Date()).toISOString().slice(0, 10),
          notes:
            `Checkout-finalize linkage from session ${session.id}` +
            (paymentSessionId && session.id !== paymentSessionId
              ? ` (workflow input session: ${paymentSessionId})`
              : ""),
        })

        // 3. Stamp the session with the payments.id so the operator
        //    UI can resolve session → payment in one hop.
        if (payment?.id) {
          await db
            .update(paymentSessions)
            .set({ paymentId: payment.id, updatedAt: new Date() })
            .where(eq(paymentSessions.id, session.id))
          if (!firstPaymentId) firstPaymentId = payment.id
        }
        sessionsLinked++
      }

      return { paymentId: firstPaymentId, sessionsLinked }
    },
  }
}

interface DispatchCheckoutFinalizeParams {
  env: CloudflareBindings
  db: PostgresJsDatabase
  eventBus: EventBus
  /** Workflow input — booking + payment metadata. */
  input: CheckoutFinalizeInput
  /** Run-row metadata: trigger string, correlationId, tags. */
  trigger: string
  correlationId: string | null
  tags: ReadonlyArray<string>
  /** When set, run is recorded as a child of this parent run. */
  parentRunId?: string | null
  /** User who triggered the run (for audit). */
  triggeredByUserId?: string | null
  /** When set, run is resumed at this step. */
  resumeFromStep?: string
  /** Pre-seeded step results from the parent (resume path). */
  seedResults?: Record<string, unknown>
  /** Optional contract-PDF generator forwarded into deps. */
  generateContractPdf?: CatalogCheckoutContractPdfGenerator
}

/**
 * Begin a `checkout-finalize` run, execute the workflow, and finalize
 * the run row. Used by the `payment.completed` subscriber and the
 * rerun/resume runners. Returns the new run id.
 *
 * Recorder failures don't mask workflow failures — `recorder.fail` is
 * fire-and-forget and we still propagate the original error to the
 * caller (the runner) for HTTP error reporting.
 */
async function dispatchCheckoutFinalize(
  params: DispatchCheckoutFinalizeParams,
): Promise<{ runId: string }> {
  const recorder = await beginWorkflowRun(params.db, {
    workflowName: "checkout-finalize",
    trigger: params.trigger,
    correlationId: params.correlationId ?? null,
    tags: [...params.tags],
    input: params.input as unknown as Record<string, unknown>,
    parentRunId: params.parentRunId ?? null,
    triggeredByUserId: params.triggeredByUserId ?? null,
    resumeFromStep: params.resumeFromStep ?? null,
  })

  // Manual rerun/resume — write a `system_action` activity row on
  // the booking so the customer-facing booking detail page surfaces
  // an entry like "checkout-finalize was manually resumed from
  // issue_invoice by Mihai". The recorded `workflow_runs` row
  // already exists (one above), but operators land on the booking
  // page first and shouldn't have to cross-reference the dashboard
  // to know a workflow was retried.
  if (params.parentRunId) {
    try {
      const action = params.resumeFromStep ? "resumed" : "rerun"
      const description = params.resumeFromStep
        ? `Workflow checkout-finalize ${action} from step "${params.resumeFromStep}"`
        : `Workflow checkout-finalize ${action}`
      await params.db.insert(bookingActivityLog).values({
        bookingId: params.input.bookingId,
        actorId: params.triggeredByUserId ?? null,
        activityType: "system_action",
        description,
        metadata: {
          kind: "workflow_rerun",
          workflowName: "checkout-finalize",
          parentRunId: params.parentRunId,
          newRunId: recorder.runId,
          resumeFromStep: params.resumeFromStep ?? null,
        },
      })
    } catch (err) {
      console.warn("[catalog-checkout] failed to write rerun activity log", err)
    }
  }

  // Resume path: write skipped step rows for everything before the
  // resume target so the UI shows the full step list with the source
  // of each output (parent run output, marked "skipped").
  if (params.resumeFromStep && params.seedResults) {
    for (const [stepName, output] of Object.entries(params.seedResults)) {
      // Skip the synthetic deps step — it has no observable meaning
      // in the dashboard, and re-recording it as "skipped" would
      // confuse users.
      if (stepName === "__deps") continue
      await recorder.recordSkippedStep(
        stepName,
        output && typeof output === "object" ? (output as Record<string, unknown>) : null,
      )
    }
  }

  const deps = buildCheckoutFinalizeDeps(
    params.env,
    params.db,
    params.eventBus,
    recorder,
    params.generateContractPdf,
  )
  try {
    await runCheckoutFinalize(params.input, deps, {
      skipUntil: params.resumeFromStep,
      seedResults: params.seedResults,
    })
    await recorder.complete()
    return { runId: recorder.runId }
  } catch (err) {
    console.error("[catalog-checkout] checkout-finalize workflow failed", err)
    await recorder.fail(err)
    throw err
  }
}

/**
 * Bundle factory that subscribes to `payment.completed` (running the
 * `checkout-finalize` workflow) and `contract.document.generated`
 * (promoting the storefront's acceptance marker into a real
 * `contract_signatures` row), and registers the `checkout-finalize`
 * runner with the supplied {@link WorkflowRunnerRegistry} so the
 * dashboard's "Rerun" / "Resume" buttons work.
 *
 * The runner is declared `idempotency: "unsafe"` because a fresh
 * rerun would attempt to re-issue the invoice (which collides on
 * `INV-${bookingNumber}`). The dashboard requires a confirm dialog
 * before sending `confirm: true`. The Resume path is always safe —
 * it skips already-completed steps.
 */
export function createCatalogCheckoutBundle(opts: {
  workflowRunnerRegistry?: WorkflowRunnerRegistry
  /**
   * Hook the explicit `generate_contract_pdf` step in the workflow
   * to a real implementation. Operators that wire this also rely on
   * `autoGenerateContractForBooking` being idempotent (it is) so the
   * legal package's `booking.confirmed` subscriber and this step
   * coexist without double-generating.
   *
   * Omit to skip the step (returns `null`) — useful for deploys that
   * don't want explicit-step recording, falling back to the
   * subscriber-only path.
   */
  generateContractPdf?: CatalogCheckoutContractPdfGenerator
}): HonoBundle {
  return {
    name: "catalog-checkout",
    bootstrap: ({ bindings, eventBus }) => {
      const env = bindings as CloudflareBindings
      eventBus.subscribe<ContractDocumentGeneratedPayload>(
        "contract.document.generated",
        async ({ data }) => {
          try {
            await withDbFromEnv(env, async (rawDb) => {
              const db = rawDb as unknown as PostgresJsDatabase
              await persistAcceptanceSignature(db, data.contractId, eventBus)
            })
          } catch (err) {
            console.error("[catalog-checkout] persistAcceptanceSignature failed", err)
          }
        },
      )
      eventBus.subscribe<PaymentCompletedPayload>("payment.completed", async ({ data }) => {
        if (!data.bookingId) return
        const bookingId = data.bookingId
        try {
          await withDbFromEnv(env, async (rawDb) => {
            const db = rawDb as unknown as PostgresJsDatabase
            await dispatchCheckoutFinalize({
              env,
              db,
              eventBus,
              input: {
                bookingId,
                paymentSessionId: data.paymentSessionId,
                paymentIntent: data.paymentIntent,
              },
              trigger: "payment.completed",
              correlationId: data.paymentSessionId ?? null,
              tags: [
                `bookingId:${bookingId}`,
                ...(data.paymentSessionId ? [`paymentSessionId:${data.paymentSessionId}`] : []),
                ...(data.paymentIntent ? [`paymentIntent:${data.paymentIntent}`] : []),
              ],
              generateContractPdf: opts.generateContractPdf,
            })
          })
        } catch {
          // dispatchCheckoutFinalize already logged + recorded the
          // failure; swallow here so the event-bus callback doesn't
          // bubble to the dispatch caller.
        }
      })

      if (opts.workflowRunnerRegistry) {
        opts.workflowRunnerRegistry.register({
          name: "checkout-finalize",
          idempotency: "unsafe",
          description:
            "Confirms the booking and issues the final invoice. A fresh rerun re-issues the invoice (collides on existing INV- numbers); use Resume to retry from a failed step.",
          rerun: async (rawInput, ctx) => {
            const input = rawInput as CheckoutFinalizeInput | null
            if (!input?.bookingId) {
              throw new Error("checkout-finalize rerun: recorded input has no bookingId")
            }
            return withDbFromEnv(env, async (rawDb) => {
              const db = rawDb as unknown as PostgresJsDatabase
              return dispatchCheckoutFinalize({
                env,
                db,
                eventBus,
                input,
                trigger: "manual.rerun",
                correlationId: ctx.correlationId,
                tags: [...ctx.tags, "rerun:true"],
                parentRunId: ctx.parentRunId,
                triggeredByUserId: ctx.triggeredByUserId,
                generateContractPdf: opts.generateContractPdf,
              })
            })
          },
          resume: async (rawInput, ctx) => {
            const input = rawInput as CheckoutFinalizeInput | null
            if (!input?.bookingId) {
              throw new Error("checkout-finalize resume: recorded input has no bookingId")
            }
            return withDbFromEnv(env, async (rawDb) => {
              const db = rawDb as unknown as PostgresJsDatabase
              return dispatchCheckoutFinalize({
                env,
                db,
                eventBus,
                input,
                trigger: "manual.resume",
                correlationId: ctx.correlationId,
                tags: [...ctx.tags, "resume:true"],
                parentRunId: ctx.parentRunId,
                triggeredByUserId: ctx.triggeredByUserId,
                resumeFromStep: ctx.resumeFromStep,
                seedResults: ctx.seedResults,
                generateContractPdf: opts.generateContractPdf,
              })
            })
          },
        })
      }
    },
  }
}

/** @deprecated Kept for callers that still import the static bundle —
 *  use {@link createCatalogCheckoutBundle} so the rerun/resume
 *  runner is registered with the dashboard. */
export const catalogCheckoutBundle = createCatalogCheckoutBundle({})

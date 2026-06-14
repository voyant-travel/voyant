import { bookings } from "@voyant-travel/bookings/schema"
import { OWNED_SOURCE_KIND } from "@voyant-travel/catalog/booking-engine"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import {
  extractBookingDates,
  extractItemDates,
  extractItemDescription,
  materializeBookingAllocations,
  materializeTravelerTravelDetails,
  resolveLineItemTitle,
  resolveSupplierFromSnapshot,
  resolveUpstreamCostCents,
  travelerBandToCategory,
} from "./catalog-checkout-materialization-support"
import { materializeBookingItemTaxLine } from "./catalog-checkout-materialization-tax"

export { rebuildBookingItemTaxLines } from "./catalog-checkout-materialization-tax"

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
export async function materializeBookingFromSnapshot(
  db: PostgresJsDatabase,
  bookingId: string,
  env: CloudflareBindings,
): Promise<typeof bookings.$inferSelect | null> {
  const { bookingCatalogSnapshotTable } = await import("@voyant-travel/catalog")
  const { bookingDraftsTable } = await import("@voyant-travel/catalog/booking-engine")
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
      contactAddressLine2: billingAddress?.line2 ?? null,
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

export interface DraftPayload {
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
    documentType?: "passport" | "id_card" | "driver_license" | "visa" | "other"
    documentNumber?: string
    documentExpiry?: string
    passportNumber?: string
    passportExpiry?: string
    passportExpiresAt?: string
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
export type MaterializationSnapshot = {
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
    "@voyant-travel/bookings/schema"
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
  // empty. Real verticals (cruises with cabin lines, accommodations with
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

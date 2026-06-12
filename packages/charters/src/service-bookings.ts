// agent-quality: file-size exception -- owner: charters; existing service module stays co-located until a dedicated split preserves behavior and tests.
import { bookingsService } from "@voyantjs/bookings"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type { CharterAdapter, SourceRef } from "./adapters/index.js"
import { type BookingCharterDetail, bookingCharterDetailsService } from "./booking-extension.js"
import { type CharterVoyage, charterProducts, charterVoyages } from "./schema-core.js"
import { type CharterSuite, charterSuites } from "./schema-pricing.js"
import { type CharterYacht, charterYachts } from "./schema-yachts.js"
import {
  composePerSuiteQuote,
  composeWholeYachtQuote,
  type PerSuiteQuote,
  type WholeYachtQuote,
} from "./service-pricing.js"

// ---------- shared shapes ----------

export type CharterGuest = {
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  travelerCategory?: "adult" | "child" | "infant" | "senior" | "other" | null
  preferredLanguage?: string | null
  specialRequests?: string | null
  personId?: string | null
  isPrimary?: boolean
  notes?: string | null
}

export type CharterContact = {
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  language?: string | null
  country?: string | null
  region?: string | null
  city?: string | null
  address?: string | null
  postalCode?: string | null
}

// ---------- per-suite booking ----------

export type CreatePerSuiteBookingInput = {
  voyageId: string
  suiteId: string
  currency: string
  personId?: string | null
  organizationId?: string | null
  contact: CharterContact
  guests: CharterGuest[]
  notes?: string | null
}

export type CreatePerSuiteBookingResult = {
  bookingId: string
  bookingNumber: string
  charterDetails: BookingCharterDetail
  quote: PerSuiteQuote
}

// ---------- whole-yacht booking ----------

export type CreateWholeYachtBookingInput = {
  voyageId: string
  currency: string
  personId?: string | null
  organizationId?: string | null
  contact: CharterContact
  /**
   * The lead/principal charterer. For whole-yacht bookings the actual on-board
   * guest list isn't fixed at booking time (charterers add guests as the trip
   * approaches), so guests are optional.
   */
  guests?: CharterGuest[]
  notes?: string | null
}

export type CreateWholeYachtBookingResult = {
  bookingId: string
  bookingNumber: string
  charterDetails: BookingCharterDetail
  quote: WholeYachtQuote
}

// ---------- helpers ----------

function generateCharterBookingNumber(prefix: "CHT" | "WYC" = "CHT"): string {
  const ts = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${prefix}-${ts}-${rand}`
}

function priceCentsFromString(s: string): number {
  const negative = s.startsWith("-")
  const abs = negative ? s.slice(1) : s
  const [whole = "0", frac = ""] = abs.split(".")
  const fracPadded = `${frac}00`.slice(0, 2)
  const cents = Number(whole) * 100 + Number(fracPadded)
  return negative ? -cents : cents
}

async function loadVoyage(db: PostgresJsDatabase, voyageId: string): Promise<CharterVoyage> {
  const [row] = await db
    .select()
    .from(charterVoyages)
    .where(eq(charterVoyages.id, voyageId))
    .limit(1)
  if (!row) throw new Error(`Charter voyage ${voyageId} not found`)
  return row
}

async function loadSuite(db: PostgresJsDatabase, suiteId: string): Promise<CharterSuite> {
  const [row] = await db.select().from(charterSuites).where(eq(charterSuites.id, suiteId)).limit(1)
  if (!row) throw new Error(`Charter suite ${suiteId} not found`)
  return row
}

async function loadYacht(db: PostgresJsDatabase, yachtId: string): Promise<CharterYacht | null> {
  const [row] = await db.select().from(charterYachts).where(eq(charterYachts.id, yachtId)).limit(1)
  return row ?? null
}

async function loadProductDefaults(
  db: PostgresJsDatabase,
  productId: string,
): Promise<{ defaultApaPercent: string | null; defaultMybaTemplateId: string | null } | null> {
  const [row] = await db
    .select({
      defaultApaPercent: charterProducts.defaultApaPercent,
      defaultMybaTemplateId: charterProducts.defaultMybaTemplateId,
    })
    .from(charterProducts)
    .where(eq(charterProducts.id, productId))
    .limit(1)
  return row ?? null
}

// ---------- service ----------

export const chartersBookingService = {
  /**
   * Create a per-suite charter booking. Atomic: assembles the quote,
   * creates the booking via bookingsService, snapshots into
   * booking_charter_details — all in one transaction.
   *
   * Self-managed (local) voyages only in v1; external voyages ship with
   * the adapter contract in phase 3.
   */
  async createPerSuiteBooking(
    db: PostgresJsDatabase,
    input: CreatePerSuiteBookingInput,
    userId?: string,
  ): Promise<CreatePerSuiteBookingResult> {
    if (input.guests.length < 1) throw new Error("At least one guest is required")

    return db.transaction(async (tx) => {
      const voyage = await loadVoyage(tx, input.voyageId)
      const suite = await loadSuite(tx, input.suiteId)
      if (suite.voyageId !== voyage.id) {
        throw new Error(`Suite ${suite.id} does not belong to voyage ${voyage.id}`)
      }
      if (!voyage.bookingModes.includes("per_suite")) {
        throw new Error(`Voyage ${voyage.id} does not offer per_suite bookings`)
      }
      if (suite.maxGuests !== null && input.guests.length > suite.maxGuests) {
        throw new Error(
          `Suite ${suite.id} max guests is ${suite.maxGuests}; got ${input.guests.length}`,
        )
      }
      const yacht = await loadYacht(tx, voyage.yachtId)

      const quote = composePerSuiteQuote({
        voyageId: voyage.id,
        suite,
        currency: input.currency,
      })

      const bookingNumber = generateCharterBookingNumber("CHT")
      const totalCents = priceCentsFromString(quote.total)
      const booking = await bookingsService.createBooking(
        tx,
        {
          bookingNumber,
          sellCurrency: quote.currency,
          status: "draft",
          sourceType: "manual",
          personId: input.personId ?? null,
          organizationId: input.organizationId ?? null,
          contactFirstName: input.contact.firstName,
          contactLastName: input.contact.lastName,
          contactEmail: input.contact.email ?? null,
          contactPhone: input.contact.phone ?? null,
          contactPreferredLanguage: input.contact.language ?? null,
          contactCountry: input.contact.country ?? null,
          contactRegion: input.contact.region ?? null,
          contactCity: input.contact.city ?? null,
          contactAddressLine1: input.contact.address ?? null,
          contactPostalCode: input.contact.postalCode ?? null,
          sellAmountCents: totalCents,
          pax: input.guests.length,
          startDate: voyage.departureDate,
          endDate: voyage.returnDate,
          internalNotes: input.notes ?? null,
        },
        userId,
      )
      if (!booking) throw new Error("bookingsService.createBooking returned null")

      for (const guest of input.guests) {
        await bookingsService.createTraveler(
          tx,
          booking.id,
          {
            firstName: guest.firstName,
            lastName: guest.lastName,
            email: guest.email ?? null,
            phone: guest.phone ?? null,
            travelerCategory: guest.travelerCategory ?? null,
            preferredLanguage: guest.preferredLanguage ?? null,
            specialRequests: guest.specialRequests ?? null,
            isPrimary: guest.isPrimary ?? false,
            notes: guest.notes ?? null,
          },
          userId,
        )
      }

      const charterDetails = await bookingCharterDetailsService.upsert(tx, booking.id, {
        bookingMode: "per_suite",
        source: "local",
        sourceProvider: null,
        sourceRef: null,
        voyageId: voyage.id,
        suiteId: suite.id,
        yachtId: voyage.yachtId,
        voyageDisplayName: voyage.name ?? voyage.voyageCode,
        suiteDisplayName: suite.suiteName,
        yachtName: yacht?.name ?? null,
        charterAreaSnapshot: voyage.charterAreaOverride ?? null,
        guestCount: input.guests.length,
        quotedCurrency: quote.currency,
        quotedSuitePrice: quote.suitePrice,
        quotedPortFee: quote.portFee,
        quotedCharterFee: null,
        apaPercent: null,
        apaAmount: null,
        quotedTotal: quote.total,
        mybaTemplateIdSnapshot: null,
        mybaContractId: null,
        apaPaidAmount: null,
        apaSpentAmount: null,
        apaRefundAmount: null,
        connectorBookingRef: null,
        connectorStatus: null,
        notes: input.notes ?? null,
      })

      return {
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
        charterDetails,
        quote,
      }
    })
  },

  /**
   * Create a whole-yacht charter booking. Atomic: composes the quote
   * (charter fee + APA), creates the booking, snapshots into
   * booking_charter_details with APA + MYBA template references.
   *
   * MYBA contract generation is a separate step — call
   * `mybaService.generateContract` after the booking exists. The booking
   * snapshot records `mybaTemplateIdSnapshot` so the contract uses the
   * exact template that was current at booking time, not whatever's
   * default later.
   *
   * Refuses to create the booking unless an APA percent + an MYBA
   * template are resolvable from the voyage/product chain — these are
   * non-negotiable for whole-yacht charters.
   */
  async createWholeYachtBooking(
    db: PostgresJsDatabase,
    input: CreateWholeYachtBookingInput,
    userId?: string,
  ): Promise<CreateWholeYachtBookingResult> {
    return db.transaction(async (tx) => {
      const voyage = await loadVoyage(tx, input.voyageId)
      if (!voyage.bookingModes.includes("whole_yacht")) {
        throw new Error(`Voyage ${voyage.id} does not offer whole_yacht bookings`)
      }
      const productDefaults = await loadProductDefaults(tx, voyage.productId)
      const yacht = await loadYacht(tx, voyage.yachtId)

      const quote = composeWholeYachtQuote({
        voyage,
        productDefaultApaPercent: productDefaults?.defaultApaPercent ?? null,
        currency: input.currency,
      })

      const mybaTemplateId =
        voyage.mybaTemplateIdOverride ?? productDefaults?.defaultMybaTemplateId ?? null
      if (!mybaTemplateId) {
        throw new Error(
          `Voyage ${voyage.id} cannot be booked whole-yacht: no MYBA template configured (neither voyage override nor product default).`,
        )
      }

      const guestCount = Math.max(1, input.guests?.length ?? 1)
      const bookingNumber = generateCharterBookingNumber("WYC")
      const totalCents = priceCentsFromString(quote.total)
      const booking = await bookingsService.createBooking(
        tx,
        {
          bookingNumber,
          sellCurrency: quote.currency,
          status: "draft",
          sourceType: "manual",
          personId: input.personId ?? null,
          organizationId: input.organizationId ?? null,
          contactFirstName: input.contact.firstName,
          contactLastName: input.contact.lastName,
          contactEmail: input.contact.email ?? null,
          contactPhone: input.contact.phone ?? null,
          contactPreferredLanguage: input.contact.language ?? null,
          contactCountry: input.contact.country ?? null,
          contactRegion: input.contact.region ?? null,
          contactCity: input.contact.city ?? null,
          contactAddressLine1: input.contact.address ?? null,
          contactPostalCode: input.contact.postalCode ?? null,
          sellAmountCents: totalCents,
          pax: guestCount,
          startDate: voyage.departureDate,
          endDate: voyage.returnDate,
          internalNotes: input.notes ?? null,
        },
        userId,
      )
      if (!booking) throw new Error("bookingsService.createBooking returned null")

      for (const guest of input.guests ?? []) {
        await bookingsService.createTraveler(
          tx,
          booking.id,
          {
            firstName: guest.firstName,
            lastName: guest.lastName,
            email: guest.email ?? null,
            phone: guest.phone ?? null,
            travelerCategory: guest.travelerCategory ?? null,
            preferredLanguage: guest.preferredLanguage ?? null,
            specialRequests: guest.specialRequests ?? null,
            isPrimary: guest.isPrimary ?? false,
            notes: guest.notes ?? null,
          },
          userId,
        )
      }

      const charterDetails = await bookingCharterDetailsService.upsert(tx, booking.id, {
        bookingMode: "whole_yacht",
        source: "local",
        sourceProvider: null,
        sourceRef: null,
        voyageId: voyage.id,
        suiteId: null,
        yachtId: voyage.yachtId,
        voyageDisplayName: voyage.name ?? voyage.voyageCode,
        suiteDisplayName: null,
        yachtName: yacht?.name ?? null,
        charterAreaSnapshot: voyage.charterAreaOverride ?? null,
        guestCount,
        quotedCurrency: quote.currency,
        quotedSuitePrice: null,
        quotedPortFee: null,
        quotedCharterFee: quote.charterFee,
        apaPercent: quote.apaPercent,
        apaAmount: quote.apaAmount,
        quotedTotal: quote.total,
        mybaTemplateIdSnapshot: mybaTemplateId,
        mybaContractId: null,
        apaPaidAmount: "0.00",
        apaSpentAmount: "0.00",
        apaRefundAmount: "0.00",
        connectorBookingRef: null,
        connectorStatus: null,
        notes: input.notes ?? null,
      })

      return {
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
        charterDetails,
        quote,
      }
    })
  },

  /**
   * Create a per-suite booking against an external (adapter-sourced) voyage.
   *
   * 1. Fetch the upstream voyage + its suites; locate the matching suite and
   *    compose a `PerSuiteQuote` locally from its multi-currency price columns.
   * 2. Commit upstream BEFORE writing local rows so we can fail loudly if the
   *    broker rejects the booking.
   * 3. Inside a single transaction, create the local booking + travelers +
   *    snapshot the quote into `booking_charter_details` with `source='external'`
   *    and the upstream connectorBookingRef.
   *
   * If the upstream commit succeeds but the local insert fails, the upstream
   * booking exists with no local trace — we surface the upstream ref in the
   * thrown error so the operator can manually reconcile via the broker's UI.
   */
  async createExternalPerSuiteBooking(
    db: PostgresJsDatabase,
    input: CreateExternalPerSuiteBookingInput,
    userId?: string,
  ): Promise<CreateExternalPerSuiteBookingResult> {
    if (input.guests.length < 1) throw new Error("At least one guest is required")

    const voyage = await input.adapter.fetchVoyage(input.voyageRef)
    if (!voyage) {
      throw new Error(
        `Adapter '${input.adapter.name}' has no voyage for sourceRef ${JSON.stringify(input.voyageRef)}`,
      )
    }
    if (!voyage.bookingModes.includes("per_suite")) {
      throw new Error(`External voyage ${voyage.voyageCode} does not offer per_suite bookings`)
    }

    const suites = await input.adapter.fetchVoyageSuites(input.voyageRef)
    const suite = suites.find((s) => sourceRefEquals(s.sourceRef, input.suiteRef))
    if (!suite) {
      throw new Error(
        `Adapter '${input.adapter.name}' has no suite ${JSON.stringify(input.suiteRef)} on voyage ${voyage.voyageCode}`,
      )
    }
    if (suite.maxGuests != null && input.guests.length > suite.maxGuests) {
      throw new Error(
        `External suite ${suite.suiteCode} max guests is ${suite.maxGuests}; got ${input.guests.length}`,
      )
    }

    const composed = composePerSuiteQuote({
      voyageId: voyage.sourceRef.externalId,
      suite: {
        id: suite.sourceRef.externalId,
        suiteName: suite.suiteName,
        pricesByCurrency: suite.pricesByCurrency ?? {},
        portFeesByCurrency: suite.portFeesByCurrency ?? {},
      },
      currency: input.currency,
    })

    const yacht = await input.adapter.fetchYacht(voyage.yachtRef)

    // Commit upstream first — failure here means no local row is created.
    const upstream = await input.adapter.createPerSuiteBooking({
      voyageRef: input.voyageRef,
      suiteRef: input.suiteRef,
      currency: input.currency,
      guests: input.guests,
      contact: input.contact,
      notes: input.notes ?? null,
    })

    const finalQuote: PerSuiteQuote = {
      ...composed,
      suitePrice: upstream.finalSuitePrice ?? composed.suitePrice,
      portFee: upstream.finalPortFee !== undefined ? upstream.finalPortFee : composed.portFee,
      total: upstream.finalTotal ?? composed.total,
      currency: (upstream.finalCurrency ?? composed.currency) as string,
    }

    return db.transaction(async (tx) => {
      const bookingNumber = generateCharterBookingNumber("CHT")
      const totalCents = priceCentsFromString(finalQuote.total)
      const booking = await bookingsService.createBooking(
        tx,
        {
          bookingNumber,
          sellCurrency: finalQuote.currency,
          status: "draft",
          sourceType: "manual",
          personId: input.personId ?? null,
          organizationId: input.organizationId ?? null,
          contactFirstName: input.contact.firstName,
          contactLastName: input.contact.lastName,
          contactEmail: input.contact.email ?? null,
          contactPhone: input.contact.phone ?? null,
          contactPreferredLanguage: input.contact.language ?? null,
          contactCountry: input.contact.country ?? null,
          contactRegion: input.contact.region ?? null,
          contactCity: input.contact.city ?? null,
          contactAddressLine1: input.contact.address ?? null,
          contactPostalCode: input.contact.postalCode ?? null,
          sellAmountCents: totalCents,
          pax: input.guests.length,
          startDate: voyage.departureDate,
          endDate: voyage.returnDate,
          internalNotes: input.notes ?? null,
        },
        userId,
      )
      if (!booking) {
        throw new Error(
          `Upstream booking ${upstream.connectorBookingRef} succeeded but local createBooking returned null. Operator must reconcile manually via '${input.adapter.name}'.`,
        )
      }

      for (const guest of input.guests) {
        await bookingsService.createTraveler(
          tx,
          booking.id,
          {
            firstName: guest.firstName,
            lastName: guest.lastName,
            email: guest.email ?? null,
            phone: guest.phone ?? null,
            travelerCategory: guest.travelerCategory ?? null,
            preferredLanguage: guest.preferredLanguage ?? null,
            specialRequests: guest.specialRequests ?? null,
            isPrimary: guest.isPrimary ?? false,
            notes: null,
          },
          userId,
        )
      }

      const charterDetails = await bookingCharterDetailsService.upsert(tx, booking.id, {
        bookingMode: "per_suite",
        source: "external",
        sourceProvider: input.adapter.name,
        sourceRef: input.voyageRef,
        voyageId: null,
        suiteId: null,
        yachtId: null,
        voyageDisplayName: voyage.name ?? voyage.voyageCode,
        suiteDisplayName: suite.suiteName,
        yachtName: yacht?.name ?? null,
        charterAreaSnapshot: voyage.charterAreaOverride ?? null,
        guestCount: input.guests.length,
        quotedCurrency: finalQuote.currency,
        quotedSuitePrice: finalQuote.suitePrice,
        quotedPortFee: finalQuote.portFee,
        quotedCharterFee: null,
        apaPercent: null,
        apaAmount: null,
        quotedTotal: finalQuote.total,
        mybaTemplateIdSnapshot: null,
        mybaContractId: null,
        apaPaidAmount: null,
        apaSpentAmount: null,
        apaRefundAmount: null,
        connectorBookingRef: upstream.connectorBookingRef,
        connectorStatus: upstream.connectorStatus ?? null,
        notes: input.notes ?? null,
      })

      return {
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
        charterDetails,
        quote: finalQuote,
        sourceProvider: input.adapter.name,
        sourceRef: input.voyageRef,
      }
    })
  },

  /**
   * Create a whole-yacht booking against an external (adapter-sourced) voyage.
   *
   * Same atomicity model as `createExternalPerSuiteBooking`. External
   * whole-yacht bookings still require a Voyant-side MYBA template — the
   * adapter must surface it via `voyage.mybaTemplateRefOverride` or
   * `product.defaultMybaTemplateRef`. The string is stored as
   * `mybaTemplateIdSnapshot` and the operator wires up an actual contract
   * later via `mybaService.generateContract`.
   */
  async createExternalWholeYachtBooking(
    db: PostgresJsDatabase,
    input: CreateExternalWholeYachtBookingInput,
    userId?: string,
  ): Promise<CreateExternalWholeYachtBookingResult> {
    const voyage = await input.adapter.fetchVoyage(input.voyageRef)
    if (!voyage) {
      throw new Error(
        `Adapter '${input.adapter.name}' has no voyage for sourceRef ${JSON.stringify(input.voyageRef)}`,
      )
    }
    if (!voyage.bookingModes.includes("whole_yacht")) {
      throw new Error(`External voyage ${voyage.voyageCode} does not offer whole_yacht bookings`)
    }

    // Resolve product (for default APA + default MYBA template ref).
    const product = await input.adapter.fetchProduct(voyage.productRef)
    const apaPercent = voyage.apaPercentOverride ?? product?.defaultApaPercent ?? null
    if (!apaPercent) {
      throw new Error(
        `External voyage ${voyage.voyageCode} has no APA percent set (neither voyage override nor product default).`,
      )
    }
    const mybaTemplateRef =
      voyage.mybaTemplateRefOverride ?? product?.defaultMybaTemplateRef ?? null
    if (!mybaTemplateRef) {
      throw new Error(
        `External voyage ${voyage.voyageCode} cannot be booked whole-yacht: no MYBA template ref configured (neither voyage override nor product default).`,
      )
    }

    const composed = composeWholeYachtQuote({
      voyage: {
        id: voyage.sourceRef.externalId,
        wholeYachtPricesByCurrency: voyage.wholeYachtPricesByCurrency ?? {},
        apaPercentOverride: voyage.apaPercentOverride ?? null,
      },
      productDefaultApaPercent: product?.defaultApaPercent ?? null,
      currency: input.currency,
    })

    const yacht = await input.adapter.fetchYacht(voyage.yachtRef)

    // Commit upstream first — failure rolls everything back without writing.
    const upstream = await input.adapter.createWholeYachtBooking({
      voyageRef: input.voyageRef,
      currency: input.currency,
      guests: input.guests,
      contact: input.contact,
      notes: input.notes ?? null,
    })

    const finalQuote: WholeYachtQuote = {
      ...composed,
      charterFee: upstream.finalCharterFee ?? composed.charterFee,
      apaPercent: upstream.finalApaPercent ?? composed.apaPercent,
      apaAmount: upstream.finalApaAmount ?? composed.apaAmount,
      total: upstream.finalTotal ?? composed.total,
      currency: (upstream.finalCurrency ?? composed.currency) as string,
    }

    const guestCount = Math.max(1, input.guests?.length ?? 1)

    return db.transaction(async (tx) => {
      const bookingNumber = generateCharterBookingNumber("WYC")
      const totalCents = priceCentsFromString(finalQuote.total)
      const booking = await bookingsService.createBooking(
        tx,
        {
          bookingNumber,
          sellCurrency: finalQuote.currency,
          status: "draft",
          sourceType: "manual",
          personId: input.personId ?? null,
          organizationId: input.organizationId ?? null,
          contactFirstName: input.contact.firstName,
          contactLastName: input.contact.lastName,
          contactEmail: input.contact.email ?? null,
          contactPhone: input.contact.phone ?? null,
          contactPreferredLanguage: input.contact.language ?? null,
          contactCountry: input.contact.country ?? null,
          contactRegion: input.contact.region ?? null,
          contactCity: input.contact.city ?? null,
          contactAddressLine1: input.contact.address ?? null,
          contactPostalCode: input.contact.postalCode ?? null,
          sellAmountCents: totalCents,
          pax: guestCount,
          startDate: voyage.departureDate,
          endDate: voyage.returnDate,
          internalNotes: input.notes ?? null,
        },
        userId,
      )
      if (!booking) {
        throw new Error(
          `Upstream booking ${upstream.connectorBookingRef} succeeded but local createBooking returned null. Operator must reconcile manually via '${input.adapter.name}'.`,
        )
      }

      for (const guest of input.guests ?? []) {
        await bookingsService.createTraveler(
          tx,
          booking.id,
          {
            firstName: guest.firstName,
            lastName: guest.lastName,
            email: guest.email ?? null,
            phone: guest.phone ?? null,
            travelerCategory: guest.travelerCategory ?? null,
            preferredLanguage: guest.preferredLanguage ?? null,
            specialRequests: guest.specialRequests ?? null,
            isPrimary: guest.isPrimary ?? false,
            notes: null,
          },
          userId,
        )
      }

      const charterDetails = await bookingCharterDetailsService.upsert(tx, booking.id, {
        bookingMode: "whole_yacht",
        source: "external",
        sourceProvider: input.adapter.name,
        sourceRef: input.voyageRef,
        voyageId: null,
        suiteId: null,
        yachtId: null,
        voyageDisplayName: voyage.name ?? voyage.voyageCode,
        suiteDisplayName: null,
        yachtName: yacht?.name ?? null,
        charterAreaSnapshot: voyage.charterAreaOverride ?? null,
        guestCount,
        quotedCurrency: finalQuote.currency,
        quotedSuitePrice: null,
        quotedPortFee: null,
        quotedCharterFee: finalQuote.charterFee,
        apaPercent: finalQuote.apaPercent,
        apaAmount: finalQuote.apaAmount,
        quotedTotal: finalQuote.total,
        mybaTemplateIdSnapshot: mybaTemplateRef,
        mybaContractId: null,
        apaPaidAmount: "0.00",
        apaSpentAmount: "0.00",
        apaRefundAmount: "0.00",
        connectorBookingRef: upstream.connectorBookingRef,
        connectorStatus: upstream.connectorStatus ?? null,
        notes: input.notes ?? null,
      })

      return {
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
        charterDetails,
        quote: finalQuote,
        sourceProvider: input.adapter.name,
        sourceRef: input.voyageRef,
      }
    })
  },
}

function sourceRefEquals(a: SourceRef, b: SourceRef): boolean {
  return (a.connectionId ?? null) === (b.connectionId ?? null) && a.externalId === b.externalId
}

// ---------- external booking input/result types ----------

export type CreateExternalPerSuiteBookingInput = {
  adapter: CharterAdapter
  voyageRef: SourceRef
  suiteRef: SourceRef
  currency: string
  personId?: string | null
  organizationId?: string | null
  contact: CharterContact
  guests: CharterGuest[]
  notes?: string | null
}

export type CreateExternalPerSuiteBookingResult = CreatePerSuiteBookingResult & {
  sourceProvider: string
  sourceRef: SourceRef
}

export type CreateExternalWholeYachtBookingInput = {
  adapter: CharterAdapter
  voyageRef: SourceRef
  currency: string
  personId?: string | null
  organizationId?: string | null
  contact: CharterContact
  guests?: CharterGuest[]
  notes?: string | null
}

export type CreateExternalWholeYachtBookingResult = CreateWholeYachtBookingResult & {
  sourceProvider: string
  sourceRef: SourceRef
}

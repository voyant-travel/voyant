import { bookingsService } from "@voyant-travel/bookings"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { bookingCharterDetailsService } from "./booking-extension.js"
import {
  createCharterTravelers,
  generateCharterBookingNumber,
  loadProductDefaults,
  loadSuite,
  loadVoyage,
  loadYacht,
  priceCentsFromString,
} from "./service-bookings-helpers.js"
import type {
  CreatePerSuiteBookingInput,
  CreatePerSuiteBookingResult,
  CreateWholeYachtBookingInput,
  CreateWholeYachtBookingResult,
} from "./service-bookings-types.js"
import { composePerSuiteQuote, composeWholeYachtQuote } from "./service-pricing.js"

export async function createPerSuiteBooking(
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

    await createCharterTravelers(tx, booking.id, input.guests, userId, {
      includeGuestNotes: true,
    })

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
}

export async function createWholeYachtBooking(
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

    await createCharterTravelers(tx, booking.id, input.guests ?? [], userId, {
      includeGuestNotes: true,
    })

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
}

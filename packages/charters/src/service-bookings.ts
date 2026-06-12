import { bookingsService } from "@voyantjs/bookings"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { bookingCharterDetailsService } from "./booking-extension.js"
import {
  createCharterTravelers,
  generateCharterBookingNumber,
  priceCentsFromString,
  sourceRefEquals,
} from "./service-bookings-helpers.js"
import { createPerSuiteBooking, createWholeYachtBooking } from "./service-bookings-local.js"
import type {
  CreateExternalPerSuiteBookingInput,
  CreateExternalPerSuiteBookingResult,
  CreateExternalWholeYachtBookingInput,
  CreateExternalWholeYachtBookingResult,
} from "./service-bookings-types.js"

export type {
  CharterContact,
  CharterGuest,
  CreateExternalPerSuiteBookingInput,
  CreateExternalPerSuiteBookingResult,
  CreateExternalWholeYachtBookingInput,
  CreateExternalWholeYachtBookingResult,
  CreatePerSuiteBookingInput,
  CreatePerSuiteBookingResult,
  CreateWholeYachtBookingInput,
  CreateWholeYachtBookingResult,
} from "./service-bookings-types.js"

import {
  composePerSuiteQuote,
  composeWholeYachtQuote,
  type PerSuiteQuote,
  type WholeYachtQuote,
} from "./service-pricing.js"

// ---------- service ----------

export const chartersBookingService = {
  createPerSuiteBooking,
  createWholeYachtBooking,

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

      await createCharterTravelers(tx, booking.id, input.guests, userId, {
        includeGuestNotes: false,
      })

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

      await createCharterTravelers(tx, booking.id, input.guests ?? [], userId, {
        includeGuestNotes: false,
      })

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

import { bookingGroupsService, bookingsService } from "@voyant-travel/bookings"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type { SourceRef } from "./adapters/index.js"
import {
  bookingCruiseDetailsService,
  bookingGroupCruiseDetailsService,
} from "./booking-extension.js"
import {
  assertPassengerCompositionMatchesPassengers,
  generateCruiseBookingNumber,
  passengerCompositionCount,
  passengerCompositionMatches,
  priceCentsFromString,
  sourceRefMatches,
} from "./service-booking-helpers.js"
import type {
  CreateCruiseBookingInput,
  CreateCruiseBookingResult,
  CreateCruisePartyBookingInput,
  CreateCruisePartyBookingResult,
  CreateExternalCruiseBookingInput,
  CruisePartyCabinEntry,
} from "./service-booking-types.js"
import { composeQuote, pricingService, type Quote } from "./service-pricing.js"

export type {
  CreateCruiseBookingInput,
  CreateCruiseBookingResult,
  CreateCruisePartyBookingInput,
  CreateCruisePartyBookingResult,
  CreateExternalCruiseBookingInput,
  CruiseBookingContact,
  CruiseBookingMode,
  CruiseBookingPassenger,
  CruisePartyCabinEntry,
} from "./service-booking-types.js"

export const cruisesBookingService = {
  /**
   * Create a single-cabin cruise booking.
   *
   * Atomic: assembles the quote, creates the booking via bookingsService,
   * inserts travelers, snapshots the quote into booking_cruise_details — all
   * in one transaction. If any step fails the transaction is rolled back.
   *
   * Self-managed (local) sailings only in v1. External sailings flow through
   * the adapter contract in §10 of the design doc; that branch lands in phase 3.
   */
  async createCruiseBooking(
    db: PostgresJsDatabase,
    input: CreateCruiseBookingInput,
    userId?: string,
  ): Promise<CreateCruiseBookingResult> {
    const guestCount = input.passengers.length
    if (guestCount < 1) throw new Error("At least one passenger is required")
    if (guestCount > input.occupancy) {
      throw new Error(
        `passengers.length (${guestCount}) cannot exceed occupancy (${input.occupancy})`,
      )
    }

    return db.transaction(async (tx) => {
      // 1. Resolve quote (reads pricing for self-managed sailings).
      const quote = await pricingService.assembleQuote(tx, {
        sailingId: input.sailingId,
        cabinCategoryId: input.cabinCategoryId,
        occupancy: input.occupancy,
        guestCount,
        fareCode: input.fareCode ?? null,
        fareVariant: input.fareVariant ?? null,
      })

      // 2. Create the booking row.
      const bookingNumber = generateCruiseBookingNumber()
      const totalCents = priceCentsFromString(quote.totalForCabin)
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
          internalNotes: input.notes ?? null,
        },
        userId,
      )
      if (!booking) throw new Error("bookingsService.createBooking returned null")

      // 3. Insert travelers.
      for (const passenger of input.passengers) {
        await bookingsService.createTraveler(
          tx,
          booking.id,
          {
            firstName: passenger.firstName,
            lastName: passenger.lastName,
            email: passenger.email ?? null,
            phone: passenger.phone ?? null,
            travelerCategory: passenger.travelerCategory ?? null,
            preferredLanguage: passenger.preferredLanguage ?? null,
            specialRequests: passenger.specialRequests ?? null,
            isPrimary: passenger.isPrimary ?? false,
            notes: passenger.notes ?? null,
          },
          userId,
        )
      }

      // 4. Snapshot the quote into booking_cruise_details.
      const cruiseDetails = await bookingCruiseDetailsService.upsert(tx, booking.id, {
        source: "local",
        sourceProvider: null,
        sourceRef: null,
        sailingId: input.sailingId,
        cabinCategoryId: input.cabinCategoryId,
        cabinId: input.cabinId ?? null,
        sailingDisplayName: null,
        cabinDisplayName: null,
        occupancy: input.occupancy,
        fareCode: input.fareCode ?? null,
        fareVariant: quote.fareVariant,
        mode: input.mode ?? "inquiry",
        quotedPricePerPerson: quote.totalPerPerson,
        quotedTotalForCabin: quote.totalForCabin,
        quotedCurrency: quote.currency,
        quotedComponentsJson: quote.components,
        connectorBookingRef: null,
        connectorStatus: null,
        airArrangement: input.airArrangement ?? null,
        linkedFlightBookingId: input.linkedFlightBookingId ?? null,
        notes: input.notes ?? null,
      })

      return {
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
        cruiseDetails,
        quote,
      }
    })
  },

  /**
   * Create a multi-cabin cruise booking — one booking_group of kind 'cruise_party'
   * containing N child cabin bookings on the same sailing.
   *
   * Same atomicity guarantees as createCruiseBooking. The group is the unit of
   * shared confirmation / atomic cancellation / single deposit.
   */
  async createCruisePartyBooking(
    db: PostgresJsDatabase,
    input: CreateCruisePartyBookingInput,
    userId?: string,
  ): Promise<CreateCruisePartyBookingResult> {
    if (input.cabins.length < 2) {
      throw new Error(
        "createCruisePartyBooking requires at least 2 cabins; use createCruiseBooking for a single cabin",
      )
    }
    if (input.cabins.length > 20) {
      throw new Error("createCruisePartyBooking supports at most 20 cabins per group")
    }

    return db.transaction(async (tx) => {
      // 1. Quote each cabin independently and validate currency consistency.
      const quotes: Array<{ quote: Quote; cabin: CruisePartyCabinEntry }> = []
      for (const cabin of input.cabins) {
        const guestCount = cabin.passengers.length
        if (guestCount < 1)
          throw new Error("Each cabin in a party booking must have at least one passenger")
        if (guestCount > cabin.occupancy)
          throw new Error(
            `Cabin passengers.length (${guestCount}) cannot exceed occupancy (${cabin.occupancy})`,
          )
        const quote = await pricingService.assembleQuote(tx, {
          sailingId: input.sailingId,
          cabinCategoryId: cabin.cabinCategoryId,
          occupancy: cabin.occupancy,
          guestCount,
          fareCode: cabin.fareCode ?? null,
          fareVariant: cabin.fareVariant ?? null,
        })
        quotes.push({ quote, cabin })
      }
      const firstCurrency = quotes[0]?.quote.currency
      if (!firstCurrency) throw new Error("No quotes assembled")
      for (const q of quotes) {
        if (q.quote.currency !== firstCurrency) {
          throw new Error(
            `All cabins in a party booking must share a currency; got ${q.quote.currency} after ${firstCurrency}`,
          )
        }
      }

      // 2. Create the booking group up front so we have a primaryBookingId target.
      const group = await bookingGroupsService.createBookingGroup(tx, {
        kind: "cruise_party",
        label: input.label ?? `Party booking on sailing ${input.sailingId}`,
        primaryBookingId: null,
        productId: null,
        optionUnitId: null,
        metadata: { sailingId: input.sailingId, cabinCount: input.cabins.length },
      })

      // 3. Create each cabin booking and add it to the group.
      const cabinResults: CreateCruiseBookingResult[] = []
      let primaryBookingId: string | null = null
      for (let i = 0; i < quotes.length; i++) {
        const { cabin, quote } = quotes[i]!
        const isPrimary = i === 0
        const bookingNumber = generateCruiseBookingNumber(i + 1)
        const totalCents = priceCentsFromString(quote.totalForCabin)
        const booking = await bookingsService.createBooking(
          tx,
          {
            bookingNumber,
            sellCurrency: quote.currency,
            status: "draft",
            sourceType: "manual",
            personId: input.leadPersonId ?? null,
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
            pax: cabin.passengers.length,
            internalNotes: cabin.notes ?? null,
          },
          userId,
        )
        if (!booking) throw new Error("bookingsService.createBooking returned null")

        for (const passenger of cabin.passengers) {
          await bookingsService.createTraveler(
            tx,
            booking.id,
            {
              firstName: passenger.firstName,
              lastName: passenger.lastName,
              email: passenger.email ?? null,
              phone: passenger.phone ?? null,
              travelerCategory: passenger.travelerCategory ?? null,
              preferredLanguage: passenger.preferredLanguage ?? null,
              specialRequests: passenger.specialRequests ?? null,
              isPrimary: passenger.isPrimary ?? false,
              notes: passenger.notes ?? null,
            },
            userId,
          )
        }

        const cruiseDetails = await bookingCruiseDetailsService.upsert(tx, booking.id, {
          source: "local",
          sourceProvider: null,
          sourceRef: null,
          sailingId: input.sailingId,
          cabinCategoryId: cabin.cabinCategoryId,
          cabinId: cabin.cabinId ?? null,
          sailingDisplayName: null,
          cabinDisplayName: null,
          occupancy: cabin.occupancy,
          fareCode: cabin.fareCode ?? null,
          fareVariant: quote.fareVariant,
          mode: input.mode ?? "inquiry",
          quotedPricePerPerson: quote.totalPerPerson,
          quotedTotalForCabin: quote.totalForCabin,
          quotedCurrency: quote.currency,
          quotedComponentsJson: quote.components,
          connectorBookingRef: null,
          connectorStatus: null,
          notes: cabin.notes ?? null,
        })

        const memberResult = await bookingGroupsService.addGroupMember(tx, group.id, {
          bookingId: booking.id,
          role: isPrimary ? "primary" : "shared",
        })
        if (memberResult.status !== "ok") {
          throw new Error(
            `Failed to add booking ${booking.id} to group ${group.id}: ${memberResult.status}`,
          )
        }
        if (isPrimary) primaryBookingId = booking.id

        cabinResults.push({
          bookingId: booking.id,
          bookingNumber: booking.bookingNumber,
          cruiseDetails,
          quote,
        })
      }

      // 4. Sum the per-cabin totals for the group snapshot.
      let totalCents = 0
      for (const r of cabinResults) {
        totalCents += priceCentsFromString(r.quote.totalForCabin)
      }
      const totalString = `${Math.trunc(totalCents / 100)}.${(Math.abs(totalCents) % 100).toString().padStart(2, "0")}`

      const groupDetails = await bookingGroupCruiseDetailsService.upsert(tx, group.id, {
        source: "local",
        sourceProvider: null,
        sourceRef: null,
        sailingId: input.sailingId,
        sailingDisplayName: null,
        cabinCount: input.cabins.length,
        totalQuotedAmount: totalString,
        quotedCurrency: firstCurrency,
        connectorBookingRef: null,
        notes: input.notes ?? null,
      })

      return {
        groupId: group.id,
        primaryBookingId,
        groupDetails,
        cabins: cabinResults,
      }
    })
  },

  /**
   * Create a single-cabin booking against an external (adapter-sourced) sailing.
   *
   * 1. Fetch sailing pricing from the adapter and pick the matching row.
   * 2. composeQuote locally — pricing math is identical to local sailings.
   * 3. Call adapter.createBooking to commit upstream — receives the carrier's
   *    confirmation reference.
   * 4. Create the local booking row + travelers + booking_cruise_details with
   *    source='external' and the upstream connectorBookingRef snapshotted.
   *
   * If the upstream commit succeeds but the local insert fails, the upstream
   * booking exists with no local trace — operators see it through the adapter's
   * own UI but can't manage it via Voyant. v2 will introduce a reconciliation
   * sweep; v1 surfaces the upstream ref in the error so the operator can manually
   * cancel if needed.
   */
  async createExternalCruiseBooking(
    db: PostgresJsDatabase,
    input: CreateExternalCruiseBookingInput,
    userId?: string,
  ): Promise<CreateCruiseBookingResult & { sourceProvider: string; sourceRef: SourceRef }> {
    const passengerComposition = assertPassengerCompositionMatchesPassengers(
      input.passengerComposition,
      input.passengers,
    )
    const guestCount = passengerCompositionCount(passengerComposition)
    if (guestCount < 1) throw new Error("At least one passenger is required")
    if (guestCount > input.occupancy) {
      throw new Error(
        `passengers.length (${guestCount}) cannot exceed occupancy (${input.occupancy})`,
      )
    }

    // 1. Fetch upstream pricing + locate the matching row.
    const prices = await input.adapter.fetchSailingPricing(input.sailingRef)
    const matching = prices.find(
      (p) =>
        sourceRefMatches(p.cabinCategoryRef, input.cabinCategoryRef) &&
        p.occupancy === input.occupancy &&
        passengerCompositionMatches(p.passengerComposition, passengerComposition) &&
        (!input.fareCode || p.fareCode === input.fareCode) &&
        (!input.fareVariant || p.fareVariant === input.fareVariant),
    )
    if (!matching) {
      throw new Error(
        `Adapter '${input.adapter.name}' has no matching price for sailing=${input.sailingRef.externalId} category=${input.cabinCategoryRef.externalId} occupancy=${input.occupancy}`,
      )
    }

    // 2. Compose the quote locally for snapshot purposes.
    const quote = composeQuote({
      price: {
        pricePerPerson: matching.pricePerPerson,
        originalPricePerPerson: matching.originalPricePerPerson ?? null,
        secondGuestPricePerPerson: matching.secondGuestPricePerPerson ?? null,
        singlePricePerPerson: matching.singlePricePerPerson ?? null,
        singleSupplementPercent: matching.singleSupplementPercent ?? null,
        currency: matching.currency,
        fareCode: matching.fareCode ?? null,
        fareCodeName: matching.fareCodeName ?? null,
        fareVariant: matching.fareVariant ?? "cruise_only",
        earlyBookingDeadline: matching.earlyBookingDeadline ?? null,
        earlyBookingBonusDescription: matching.earlyBookingBonusDescription ?? null,
      },
      components: (matching.components ?? []).map((c) => ({
        kind: c.kind,
        label: c.label ?? null,
        amount: c.amount,
        currency: c.currency,
        direction: c.direction,
        perPerson: c.perPerson,
      })),
      occupancy: input.occupancy,
      guestCount,
      bookingTerms: input.bookingTerms ?? matching.bookingTerms ?? null,
    })

    // 3. Commit upstream BEFORE writing local rows so we can fail loudly if the
    //    cruise line rejects the booking.
    const upstream = await input.adapter.createBooking({
      sailingRef: input.sailingRef,
      cabinCategoryRef: input.cabinCategoryRef,
      occupancy: input.occupancy,
      passengerComposition,
      fareCode: input.fareCode ?? null,
      fareVariant: input.fareVariant ?? null,
      passengers: input.passengers,
      contact: input.contact,
      bookingTerms: input.bookingTerms ?? matching.bookingTerms ?? null,
      notes: input.notes ?? null,
    })

    // The adapter may return a refined quote (e.g. last-minute promo expired).
    // Prefer the upstream-resolved quote when present.
    const finalQuote = upstream.finalQuote ?? quote
    const finalComponents = upstream.finalComponents ?? quote.components
    const finalBookingTerms =
      upstream.finalBookingTerms ??
      finalQuote.bookingTerms ??
      input.bookingTerms ??
      matching.bookingTerms ??
      null

    // 4. Local persistence (now that upstream confirmation is in hand).
    return db.transaction(async (tx) => {
      const bookingNumber = generateCruiseBookingNumber()
      const totalCents = priceCentsFromString(finalQuote.totalForCabin)
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
          internalNotes: input.notes ?? null,
        },
        userId,
      )
      if (!booking) {
        throw new Error(
          `Upstream booking ${upstream.connectorBookingRef} succeeded but local createBooking returned null. Operator must reconcile manually.`,
        )
      }

      for (const passenger of input.passengers) {
        await bookingsService.createTraveler(
          tx,
          booking.id,
          {
            firstName: passenger.firstName,
            lastName: passenger.lastName,
            email: passenger.email ?? null,
            phone: passenger.phone ?? null,
            travelerCategory: passenger.travelerCategory ?? null,
            preferredLanguage: passenger.preferredLanguage ?? null,
            specialRequests: passenger.specialRequests ?? null,
            isPrimary: passenger.isPrimary ?? false,
            notes: null,
          },
          userId,
        )
      }

      const cruiseDetails = await bookingCruiseDetailsService.upsert(tx, booking.id, {
        source: "external",
        sourceProvider: input.adapter.name,
        sourceRef: input.sailingRef,
        sailingId: null,
        cabinCategoryId: null,
        cabinId: null,
        sailingDisplayName: null,
        cabinDisplayName: null,
        occupancy: input.occupancy,
        fareCode: input.fareCode ?? null,
        fareVariant: finalQuote.fareVariant,
        mode: input.mode ?? "inquiry",
        quotedPricePerPerson: finalQuote.totalPerPerson,
        quotedTotalForCabin: finalQuote.totalForCabin,
        quotedCurrency: finalQuote.currency,
        quotedComponentsJson: finalComponents,
        bookingTermsSnapshotJson: finalBookingTerms,
        passengerCompositionSnapshotJson: passengerComposition,
        connectorBookingRef: upstream.connectorBookingRef,
        connectorStatus: upstream.connectorStatus ?? null,
        notes: input.notes ?? null,
      })

      return {
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
        cruiseDetails,
        quote: finalQuote,
        sourceProvider: input.adapter.name,
        sourceRef: input.sailingRef,
      }
    })
  },
}

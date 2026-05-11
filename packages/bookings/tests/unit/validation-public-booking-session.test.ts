import { describe, expect, it } from "vitest"

import {
  publicBookingOverviewSchema,
  publicBookingSessionSchema,
  publicBookingSessionTravelerInputSchema,
  publicCheckoutCapabilitySchema,
  publicCreateBookingSessionSchema,
  publicUpdateBookingSessionSchema,
} from "../../src/validation-public.js"

describe("public booking session traveler schema", () => {
  it("parses checkout session capability response metadata", () => {
    const result = publicCheckoutCapabilitySchema.parse({
      token: "capability-token",
      expiresAt: "2026-05-11T12:00:00.000Z",
      actions: ["session:read", "session:update", "payment:start"],
    })

    expect(result.actions).toContain("payment:start")
  })

  it("uses traveler input as the primary public schema", () => {
    const result = publicBookingSessionTravelerInputSchema.parse({
      firstName: "Ana",
      lastName: "Popescu",
      email: "ana@example.com",
      isPrimary: true,
    })

    expect(result).toMatchObject({
      participantType: "traveler",
      firstName: "Ana",
      lastName: "Popescu",
      isPrimary: true,
    })
  })

  it("accepts travelers on session create", () => {
    const result = publicCreateBookingSessionSchema.parse({
      sellCurrency: "EUR",
      items: [
        {
          title: "Danube tour",
          availabilitySlotId: "avsl_test",
        },
      ],
      travelers: [
        {
          firstName: "Ana",
          lastName: "Popescu",
        },
      ],
    })

    expect(result.travelers).toHaveLength(1)
  })

  it("accepts removedTravelerIds on session update", () => {
    const result = publicUpdateBookingSessionSchema.parse({
      removedTravelerIds: ["bkpt_abc"],
    })

    expect(result.removedTravelerIds).toEqual(["bkpt_abc"])
  })

  it("rejects staff traveler inputs on public session flows", () => {
    expect(() =>
      publicBookingSessionTravelerInputSchema.parse({
        firstName: "Guide",
        lastName: "Local",
        participantType: "staff",
      }),
    ).toThrow()
  })

  it("rejects non-traveler participant roles in public session responses", () => {
    expect(() =>
      publicBookingSessionSchema.parse({
        sessionId: "bkss_1",
        bookingNumber: "BKG-1",
        status: "confirmed",
        externalBookingRef: null,
        communicationLanguage: null,
        sellCurrency: "EUR",
        sellAmountCents: null,
        startDate: null,
        endDate: null,
        pax: null,
        holdExpiresAt: null,
        confirmedAt: null,
        expiredAt: null,
        cancelledAt: null,
        completedAt: null,
        travelers: [
          {
            id: "bkpt_1",
            participantType: "staff",
            travelerCategory: null,
            firstName: "Guide",
            lastName: "Local",
            email: null,
            phone: null,
            preferredLanguage: null,
            accessibilityNeeds: null,
            specialRequests: null,
            isPrimary: false,
            notes: null,
          },
        ],
        items: [],
        allocations: [],
        checklist: {
          hasTravelers: false,
          hasPrimaryTraveler: false,
          hasItems: false,
          hasAllocations: false,
          readyForConfirmation: false,
        },
        state: null,
      }),
    ).toThrow()
  })

  it("rejects non-traveler participant roles in public booking overviews", () => {
    expect(() =>
      publicBookingOverviewSchema.parse({
        bookingId: "book_1",
        bookingNumber: "BKG-1",
        status: "confirmed",
        sellCurrency: "EUR",
        sellAmountCents: null,
        startDate: null,
        endDate: null,
        pax: null,
        confirmedAt: null,
        cancelledAt: null,
        completedAt: null,
        travelers: [
          {
            id: "bkpt_1",
            participantType: "contact",
            firstName: "Billing",
            lastName: "Contact",
            isPrimary: false,
          },
        ],
        items: [],
        documents: [],
        fulfillments: [],
      }),
    ).toThrow()
  })
})

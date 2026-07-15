import { describe, expect, it } from "vitest"

import type { Draft } from "../journey/index.js"
import { buildStorefrontBookFailureMessage } from "./storefront-booking-errors"
import {
  buildStorefrontBookBody,
  buildStorefrontCheckoutStartBody,
  buildStorefrontCommitParty,
} from "./storefront-booking-journey"

describe("package-owned storefront booking journey", () => {
  it.each([
    "card",
    "bank_transfer",
    "inquiry",
  ] as const)("reserves with hold before starting %s checkout", (intent) => {
    const draft = {
      entity: { module: "products", id: "prod_1", sourceKind: "owned" },
      configure: { pax: { adult: 2 }, departureSlotId: "slot_1" },
      billing: {
        buyerType: "B2C",
        contact: {
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada@example.com",
        },
        address: {},
      },
      travelers: [],
      addons: [],
      payment: { intent },
    } as Draft

    const book = buildStorefrontBookBody({
      draftId: "draft_1",
      quoteId: "quote_1",
      draft,
    })
    const checkout = buildStorefrontCheckoutStartBody({
      bookingId: "booking_1",
      draft,
      acceptance: null,
      returnOrigin: "https://shop.example",
    })

    expect(book.paymentIntent).toEqual({ type: "hold" })
    expect(checkout.paymentIntent).toBe(intent)
  })

  it("keeps billing contact and traveler details for sourced reserve", () => {
    const party = buildStorefrontCommitParty({
      entity: { module: "products", id: "pkg_1", sourceKind: "" },
      configure: { pax: { adult: 1 } },
      billing: {
        buyerType: "B2C",
        contact: {
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada@example.com",
          phone: "+40 700 000 000",
          personId: "person_1",
        },
        address: {},
      },
      travelers: [
        {
          firstName: "Ada",
          lastName: "Lovelace",
          band: "adult",
          dateOfBirth: "1980-01-02",
          documents: { sex: "female" },
          isPrimary: true,
        },
      ],
      addons: [],
      payment: { intent: "hold" },
    })

    expect(party).toMatchObject({
      personId: "person_1",
      billing: {
        personId: "person_1",
        contact: {
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada@example.com",
          phone: "+40 700 000 000",
        },
      },
      travelerParty: {
        travelers: [
          {
            firstName: "Ada",
            lastName: "Lovelace",
            dateOfBirth: "1980-01-02",
            band: "adult",
            documents: { sex: "female" },
            isPrimary: true,
          },
        ],
      },
    })
  })
})

describe("buildStorefrontBookFailureMessage", () => {
  it("includes the API error and request id for failed public booking", () => {
    expect(
      buildStorefrontBookFailureMessage(
        {
          error: "Select a billing person or organization",
          code: "invalid_request",
          requestId: "req_book_1",
        },
        "req_header_ignored",
        "We couldn't complete your booking. Please try again.",
        "Reference: {requestId}",
      ),
    ).toBe(
      "We couldn't complete your booking. Please try again. Select a billing person or organization. Reference: req_book_1.",
    )
  })

  it("falls back to nested field errors and the response header request id", () => {
    expect(
      buildStorefrontBookFailureMessage(
        {
          code: "invalid_request",
          details: {
            fields: {
              fieldErrors: {
                personId: ["Select a billing person or organization"],
              },
            },
          },
        },
        "req_header_1",
        "We couldn't complete your booking. Please try again.",
        "Reference: {requestId}",
      ),
    ).toBe(
      "We couldn't complete your booking. Please try again. Select a billing person or organization. Reference: req_header_1.",
    )
  })

  it("uses the generic checkout message when the API body is not actionable", () => {
    expect(
      buildStorefrontBookFailureMessage(
        { error: "" },
        null,
        "We couldn't complete your booking. Please try again.",
        "Reference: {requestId}",
      ),
    ).toBe("We couldn't complete your booking. Please try again.")
  })

  it("keeps parse-failure bodies generic while preserving a request reference", () => {
    expect(
      buildStorefrontBookFailureMessage(
        {},
        "req_header_1",
        "We couldn't complete your booking. Please try again.",
        "Reference: {requestId}",
      ),
    ).toBe("We couldn't complete your booking. Please try again. Reference: req_header_1.")
  })
})

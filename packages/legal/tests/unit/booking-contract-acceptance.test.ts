import { describe, expect, it } from "vitest"

import { bookingContractAcceptanceMetadata } from "../../src/booking-contract-confirmed.js"

describe("booking contract acceptance evidence", () => {
  it("enriches the customer's act with server-owned template evidence", () => {
    expect(
      bookingContractAcceptanceMetadata({
        internalNotes:
          '__contract_acceptance__:{"acceptedAt":"2026-08-10T12:00:00.000Z","acceptedMarketing":false}',
        templateId: "ctpl_customer",
        templateSlug: "customer-agreement",
        renderedHtmlLength: 412,
      }),
    ).toEqual({
      acceptedAt: "2026-08-10T12:00:00.000Z",
      acceptedMarketing: false,
      templateId: "ctpl_customer",
      templateSlug: "customer-agreement",
      renderedHtmlLength: 412,
    })
  })

  it("refuses malformed acceptance markers", () => {
    expect(
      bookingContractAcceptanceMetadata({
        internalNotes: '__contract_acceptance__:{"acceptedAt":"not-a-date"}',
        templateId: "ctpl_customer",
        templateSlug: "customer-agreement",
        renderedHtmlLength: 412,
      }),
    ).toBeNull()
  })
})

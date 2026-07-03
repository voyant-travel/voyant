import { describe, expect, it } from "vitest"

import { buildStorefrontCommitParty } from "./storefront-booking-journey"

describe("buildStorefrontCommitParty", () => {
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

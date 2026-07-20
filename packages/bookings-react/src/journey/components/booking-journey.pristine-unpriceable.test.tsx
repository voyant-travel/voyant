import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

// Reproduces the EXACT payload the owned booking-engine returns when the journey
// first opens for a stay/room product (captured live from the acme managed
// operator, product `Coastal Day Cruise`): the baseline quote is `available:
// false` / `invalidReason: "no_sell_amount_configured"` because no room has been
// picked yet, and the shape carries an `option-units` configure sub-step (so
// it's a room product). Before the fix, step 1 rendered the red "can't be priced"
// banner AND a raw `no_sell_amount_configured` code — making a bookable product
// look broken. This test pins the pristine baseline to a clean, non-alarming state.
const ACME_PRISTINE_QUOTE = {
  quoteId: "cquo_pristine",
  quotedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  available: false,
  invalidReason: "no_sell_amount_configured",
  pricing: undefined,
}

const ACME_SHAPE = {
  showsConfigure: true,
  showsBilling: true,
  showsTravelers: true,
  showsAccommodation: false,
  showsAddons: false,
  showsPayment: true,
  showsReview: true,
  configureSubSteps: [
    {
      kind: "product-option",
      options: [
        {
          id: "popt_standard",
          code: "standard",
          name: "Standard",
          isDefault: true,
          units: [
            {
              id: "ount_double",
              name: "Double",
              unitType: "room",
              minQuantity: 3,
              maxQuantity: 3,
            },
          ],
        },
      ],
    },
    { kind: "departure", required: true },
    { kind: "option-units" },
    {
      kind: "occupancy",
      bands: [{ code: "adult", label: "Adult", minAge: 18, minCount: 1, maxCount: 8 }],
    },
  ],
  paxBands: [{ code: "adult", label: "Adult", minAge: 18, minCount: 1, maxCount: 8 }],
  paxBandsAllowedTotal: { min: 1, max: 8 },
  paxBandDependencies: [],
  travelerFields: [
    { key: "firstName", label: "First name", type: "text", required: true },
    { key: "lastName", label: "Last name", type: "text", required: true },
  ],
  bookingFields: [
    { key: "buyerType", label: "Buyer type", type: "select", required: true, group: "billing" },
  ],
  paymentIntents: ["card", "bank_transfer", "hold", "inquiry", "ticket_on_credit"],
}

vi.mock("@voyant-travel/catalog-react/booking-engine", () => ({
  useBookingQuote: () => ({
    data: ACME_PRISTINE_QUOTE,
    isQuoting: false,
    error: null,
    requote: async () => ({}) as never,
    refetch: async () => ({}) as never,
  }),
  // The journey treats this as a room product via the `option-units` sub-step.
  useBookingDraftShape: () => ACME_SHAPE,
  useBookingDraft: () => ({ save: { mutate: () => {} } }),
  useBookingCommit: () => ({ mutateAsync: async () => {}, isPending: false, error: null }),
  useBookingHold: () => ({ place: async () => ({}), release: async () => ({}) }),
}))

const { BookingJourney } = await import("./booking-journey.js")

describe("BookingJourney — pristine baseline is not flagged un-priceable (voyant#3584/#3586)", () => {
  const html = renderToStaticMarkup(
    <BookingJourney
      entityModule="products"
      entityId="prod_coastal"
      draftId="draft-1"
      surface="public"
    />,
  )

  it("does not show the 'can't be priced' banner before any room is picked", () => {
    expect(html).not.toContain("This selection can&#x27;t be priced right now")
  })

  it("never leaks the raw engine reason code", () => {
    expect(html).not.toContain("no_sell_amount_configured")
  })

  it("guides the buyer to pick a room instead", () => {
    expect(html).toContain("Select rooms to see pricing")
  })
})

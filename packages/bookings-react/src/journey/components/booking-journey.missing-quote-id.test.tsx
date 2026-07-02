import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("@voyant-travel/catalog-react/booking-engine", () => ({
  useBookingQuote: () => ({
    data: {
      available: true,
      pricing: null,
    },
    isQuoting: false,
    error: null,
    requote: async () => ({}) as never,
    refetch: async () => ({}) as never,
  }),
  useBookingDraftShape: (opts: { fallback: unknown }) => opts.fallback,
  useBookingDraft: () => ({ save: { mutate: () => {} } }),
  useBookingCommit: () => ({ mutateAsync: async () => {}, isPending: false, error: null }),
  useBookingHold: () => ({ place: async () => ({}), release: async () => ({}) }),
}))

const { BookingJourney } = await import("./booking-journey.js")

describe("BookingJourney — missing quote id handling (#2425)", () => {
  it("keeps admin confirm disabled until a successful quote id exists", () => {
    const html = renderToStaticMarkup(
      <BookingJourney
        entityModule="products"
        entityId="prod-1"
        draftId="draft-1"
        surface="admin"
        renderVoucherPicker={() => null}
      />,
    )

    expect(html).toContain("Confirm booking")
    expect(html).toContain("disabled")
  })
})

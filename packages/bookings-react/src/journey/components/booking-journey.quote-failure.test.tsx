import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

// Mock the booking-engine hooks so the live quote is in an ERROR state — the
// exact condition from #2645 (the demo connector adapter 500s on quote). The
// journey must surface a visible, recoverable error rather than silently
// letting a stale/absent price through to Review where Confirm no-ops.
vi.mock("@voyant-travel/catalog-react/booking-engine", () => ({
  useBookingQuote: () => ({
    data: null,
    isQuoting: false,
    error: new Error("Network connection lost"),
    requote: async () => ({}) as never,
    refetch: async () => ({}) as never,
  }),
  useBookingDraftShape: (opts: { fallback: unknown }) => opts.fallback,
  useBookingDraft: () => ({ save: { mutate: () => {} } }),
  useBookingCommit: () => ({ mutateAsync: async () => {}, isPending: false, error: null }),
  useBookingHold: () => ({ place: async () => ({}), release: async () => ({}) }),
}))

// Imported after the mock so the hooks are stubbed (vitest hoists vi.mock).
const { BookingJourney } = await import("./booking-journey.js")

describe("BookingJourney — failed quote handling (#2645)", () => {
  it("surfaces a recoverable pricing error with a retry action", () => {
    const html = renderToStaticMarkup(
      <BookingJourney
        entityModule="products"
        entityId="prod-1"
        draftId="draft-1"
        surface="public"
      />,
    )

    // Visible, recoverable error — not a silent failure.
    expect(html).toContain("We couldn&#x27;t refresh live pricing")
    expect(html).toContain("Retry pricing")
  })
})

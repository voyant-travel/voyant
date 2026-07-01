import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

// Mock the booking-engine hooks so the live quote SETTLES successfully (no
// thrown error, a real quoteId) but reports `invalidReason: "rates_missing"`
// with no pricing — the exact shape the owned accommodation handler returns
// when the selected stay has no applicable rate plan (#2638). The journey used
// to treat this as a valid quote and let contract acceptance / Confirm proceed,
// then /book returned a 502 RESERVE_FAILED that was only console-logged.
vi.mock("@voyant-travel/catalog-react/booking-engine", () => ({
  useBookingQuote: () => ({
    data: {
      quoteId: "quote-1",
      quotedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      available: true,
      invalidReason: "rates_missing",
      pricing: undefined,
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

// Imported after the mock so the hooks are stubbed (vitest hoists vi.mock).
const { BookingJourney } = await import("./booking-journey.js")

describe("BookingJourney — un-priceable quote (rates_missing, #2638)", () => {
  it("surfaces a pricing-unavailable block instead of a silent retry banner", () => {
    const html = renderToStaticMarkup(
      <BookingJourney
        entityModule="accommodations"
        entityId="acc-1"
        draftId="draft-1"
        surface="public"
      />,
    )

    // Visible, actionable message — not a valid quote the buyer can confirm.
    expect(html).toContain("This selection can&#x27;t be priced right now")
    // No "retry pricing" affordance — re-quoting yields the same result, so we
    // ask the buyer to adjust their selection rather than retry.
    expect(html).not.toContain("Retry pricing")
  })
})

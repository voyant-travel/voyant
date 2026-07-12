import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  useBookingQuote: vi.fn(),
  useQuery: vi.fn(),
}))

vi.mock("@tanstack/react-query", () => ({
  useQuery: mocks.useQuery,
}))

vi.mock("@voyant-travel/catalog-react/booking-engine", () => ({
  useBookingQuote: mocks.useBookingQuote,
}))

import { AccommodationDetailPage } from "./accommodation-detail-page.js"
import { StorefrontUiProvider } from "./context.js"

describe("AccommodationDetailPage", () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
    mocks.useQuery.mockReset()
    mocks.useBookingQuote.mockReset()
    mocks.navigate.mockReset()
    mocks.useBookingQuote.mockReturnValue({ data: null, isQuoting: false })
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
  })

  it("shows unavailable detail content without a booking sidebar when accommodation content cannot resolve", async () => {
    mocks.useQuery.mockReturnValue({ data: null, isLoading: false })

    await act(async () => {
      root.render(
        <StorefrontUiProvider value={testStorefrontUiValue()}>
          <AccommodationDetailPage entityId="cdmi_demo_hotel_20260629" />
        </StorefrontUiProvider>,
      )
    })

    expect(host.textContent).toContain("Detail content isn't available for this item yet.")
    expect(host.textContent).not.toContain("Book this")
    expect(host.textContent).not.toContain("Subtotal")
    expect(host.querySelector("aside")).toBeNull()
  })
})

function testStorefrontUiValue() {
  return {
    apiUrl: "https://example.test",
    navigate: mocks.navigate,
    scope: {},
    messages: {
      shop: {},
      shopDetailProducts: {},
      shopDetailAccommodations: {},
      shopDetailCruises: {},
      shopDetailShared: {
        backToAll: "Back to all",
        bookThis: "Book this",
        detailUnavailable: "Detail content isn't available for this item yet.",
        subtotal: "Subtotal",
      },
    },
  }
}

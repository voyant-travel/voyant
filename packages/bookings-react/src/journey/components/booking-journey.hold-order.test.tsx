// @vitest-environment jsdom

import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { DeparturePickerProps } from "../types.js"

const holdApi = vi.hoisted(() => ({
  place: vi.fn(),
  release: vi.fn(),
}))

vi.mock("@voyant-travel/catalog-react/booking-engine", () => ({
  useBookingQuote: () => ({
    data: { available: true, pricing: null, quoteId: "quote-1" },
    isQuoting: false,
    error: null,
    requote: async () => ({}) as never,
    refetch: async () => ({}) as never,
  }),
  useBookingDraftShape: (options: { fallback: unknown }) => options.fallback,
  useBookingDraft: () => ({ save: { mutate: () => {} } }),
  useBookingCommit: () => ({ mutateAsync: async () => {}, isPending: false, error: null }),
  useBookingHold: () => holdApi,
}))

const { BookingJourney } = await import("./booking-journey.js")

;(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

describe("BookingJourney hold replacement", () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    holdApi.place.mockReset().mockResolvedValue({ holdToken: "draft-1" })
    holdApi.release.mockReset().mockResolvedValue({})
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it("releases the previous token before placing a replacement hold", async () => {
    let changeDeparture: DeparturePickerProps["onChange"] | undefined

    await act(async () => {
      root.render(
        <BookingJourney
          entityModule="products"
          entityId="product-1"
          draftId="draft-1"
          surface="admin"
          initialConfigure={{ departureSlotId: "slot-1", pax: { adult: 1 } }}
          renderDeparturePicker={(picker) => {
            changeDeparture = picker.onChange
            return null
          }}
          renderTravelCreditPicker={() => null}
        />,
      )
    })

    expect(holdApi.place).toHaveBeenCalledOnce()
    expect(holdApi.place).toHaveBeenLastCalledWith(
      expect.objectContaining({ parameters: expect.objectContaining({ slotId: "slot-1" }) }),
    )

    let finishRelease: (() => void) | undefined
    holdApi.release.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRelease = () => resolve({})
        }),
    )

    await act(async () => {
      changeDeparture?.({ slotId: "slot-2" })
    })

    expect(holdApi.release).toHaveBeenCalledWith({
      entityModule: "products",
      holdToken: "draft-1",
    })
    expect(holdApi.place).toHaveBeenCalledTimes(1)

    await act(async () => {
      finishRelease?.()
      await Promise.resolve()
    })

    expect(holdApi.place).toHaveBeenCalledTimes(2)
    expect(holdApi.place).toHaveBeenLastCalledWith(
      expect.objectContaining({ parameters: expect.objectContaining({ slotId: "slot-2" }) }),
    )
    expect(holdApi.release.mock.invocationCallOrder[0]).toBeLessThan(
      holdApi.place.mock.invocationCallOrder[1] ?? Number.POSITIVE_INFINITY,
    )
  })
})

// @vitest-environment jsdom

import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const hookMocks = vi.hoisted(() => ({
  useBookingPaymentSchedules: vi.fn(),
  useCheckoutPaymentLinkConfig: vi.fn(),
  useCollectPayment: vi.fn(),
}))

vi.mock("../hooks/use-booking-payment-schedules.js", () => ({
  useBookingPaymentSchedules: hookMocks.useBookingPaymentSchedules,
}))

vi.mock("../checkout-hooks/index.js", () => ({
  useCheckoutPaymentLinkConfig: hookMocks.useCheckoutPaymentLinkConfig,
  useCollectPayment: hookMocks.useCollectPayment,
}))

import { CollectPaymentDialog } from "./collect-payment-dialog.js"

;(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

describe("CollectPaymentDialog", () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    hookMocks.useBookingPaymentSchedules.mockReturnValue({
      data: {
        data: [
          {
            id: "bps_123",
            bookingId: "book_123",
            bookingItemId: null,
            scheduleType: "deposit",
            status: "pending",
            dueDate: "2026-07-15",
            currency: "EUR",
            amountCents: 5000,
            notes: null,
            createdAt: "2026-07-01T00:00:00.000Z",
            updatedAt: "2026-07-01T00:00:00.000Z",
          },
        ],
      },
    })
    hookMocks.useCheckoutPaymentLinkConfig.mockReturnValue({ data: null })
    hookMocks.useCollectPayment.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
      reset: vi.fn(),
    })
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.clearAllMocks()
  })

  it("labels the full-amount charge option instead of exposing its sentinel value", async () => {
    await act(async () => {
      root.render(
        <CollectPaymentDialog
          open
          onOpenChange={() => {}}
          bookingId="book_123"
          defaultCurrency="EUR"
          defaultAmountCents={12345}
        />,
      )
    })

    expect(document.body.textContent).toContain("Full amount")
    expect(document.body.textContent).not.toContain("__full__")
  })
})

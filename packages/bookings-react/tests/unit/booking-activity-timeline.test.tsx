import type { ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const financeHooks = vi.hoisted(() => ({
  useAdminBookingPayments: vi.fn(),
  usePublicBookingPayments: vi.fn(),
}))

vi.mock("@voyant-travel/finance-react", () => ({
  useAdminBookingPayments: financeHooks.useAdminBookingPayments,
  usePublicBookingPayments: financeHooks.usePublicBookingPayments,
}))

vi.mock("@voyant-travel/ui/components", () => ({
  Badge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Button: ({ children }: { children?: ReactNode }) => <button type="button">{children}</button>,
}))

vi.mock("@voyant-travel/ui/components/pagination", () => ({
  Pagination: ({ children }: { children?: ReactNode }) => <nav>{children}</nav>,
  PaginationContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  PaginationItem: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  PaginationLink: ({ children }: { children?: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  PaginationNext: ({ children }: { children?: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  PaginationPrevious: ({ children }: { children?: ReactNode }) => (
    <button type="button">{children}</button>
  ),
}))

vi.mock("../../src/index.js", () => ({
  useBookingActivity: () => ({ data: { data: [] } }),
  useBookingTravelerDocuments: () => ({ data: { data: [] } }),
}))

import { BookingActivityTimeline } from "../../src/components/booking-activity-timeline.js"

beforeEach(() => {
  financeHooks.useAdminBookingPayments.mockReset()
  financeHooks.usePublicBookingPayments.mockReset()
  financeHooks.useAdminBookingPayments.mockReturnValue({ data: { data: { payments: [] } } })
  financeHooks.usePublicBookingPayments.mockReturnValue({ data: { data: { payments: [] } } })
})

describe("BookingActivityTimeline", () => {
  it("uses public booking payments by default", () => {
    renderToStaticMarkup(<BookingActivityTimeline bookingId="book_123" />)

    expect(financeHooks.usePublicBookingPayments).toHaveBeenCalledWith("book_123", {
      enabled: true,
    })
    expect(financeHooks.useAdminBookingPayments).toHaveBeenCalledWith("book_123", {
      enabled: false,
    })
  })

  it("uses admin booking payments for admin booking detail timelines", () => {
    renderToStaticMarkup(<BookingActivityTimeline bookingId="book_123" paymentsVariant="admin" />)

    expect(financeHooks.usePublicBookingPayments).toHaveBeenCalledWith("book_123", {
      enabled: false,
    })
    expect(financeHooks.useAdminBookingPayments).toHaveBeenCalledWith("book_123", {
      enabled: true,
    })
  })
})

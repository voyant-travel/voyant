import type { ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const financeHooks = vi.hoisted(() => ({
  useAdminBookingPayments: vi.fn(),
  usePublicBookingPayments: vi.fn(),
}))

const bookingHooks = vi.hoisted(() => ({
  activity: [] as Array<Record<string, unknown>>,
  documents: [] as Array<Record<string, unknown>>,
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
  useBookingActivity: () => ({ data: { data: bookingHooks.activity } }),
  useBookingTravelerDocuments: () => ({ data: { data: bookingHooks.documents } }),
}))

import { BookingActivityTimeline } from "../../src/components/booking-activity-timeline.js"

beforeEach(() => {
  financeHooks.useAdminBookingPayments.mockReset()
  financeHooks.usePublicBookingPayments.mockReset()
  financeHooks.useAdminBookingPayments.mockReturnValue({ data: { data: { payments: [] } } })
  financeHooks.usePublicBookingPayments.mockReturnValue({ data: { data: { payments: [] } } })
  bookingHooks.activity = []
  bookingHooks.documents = []
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

  it("uses the activity description for note lifecycle rows", () => {
    bookingHooks.activity = [
      {
        id: "act_note_updated",
        bookingId: "book_123",
        actorId: "user_123",
        activityType: "note_added",
        description: "Note updated",
        metadata: { noteId: "note_123" },
        createdAt: "2026-07-01T12:00:00.000Z",
      },
    ]

    const html = renderToStaticMarkup(<BookingActivityTimeline bookingId="book_123" />)

    expect(html).toContain("Note updated")
  })

  it("uses system-action descriptions as visible lifecycle text", () => {
    bookingHooks.activity = [
      {
        id: "act_bank_transfer",
        bookingId: "book_123",
        actorId: "system",
        activityType: "system_action",
        description: "Proforma/payment instructions issued; awaiting bank transfer",
        metadata: { kind: "storefront_bank_transfer_awaiting_payment" },
        createdAt: "2026-07-03T12:00:00.000Z",
      },
    ]

    const html = renderToStaticMarkup(<BookingActivityTimeline bookingId="book_123" />)

    expect(html).toContain("Proforma/payment instructions issued; awaiting bank transfer")
  })
})

import type { ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const legalHooks = vi.hoisted(() => ({
  useResolvePolicy: vi.fn(),
  useEvaluateCancellation: vi.fn(),
}))

const bookingHooks = vi.hoisted(() => ({
  useBookingCancelMutation: vi.fn(),
  useBookingPrimaryProduct: vi.fn(),
}))

vi.mock("@voyant-travel/legal-react", () => ({
  useResolvePolicy: legalHooks.useResolvePolicy,
  useEvaluateCancellation: legalHooks.useEvaluateCancellation,
}))

vi.mock("@voyant-travel/ui/components", () => ({
  Badge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Button: ({ children }: { children?: ReactNode }) => <button type="button">{children}</button>,
  Dialog: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogBody: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children?: ReactNode }) => <footer>{children}</footer>,
  DialogHeader: ({ children }: { children?: ReactNode }) => <header>{children}</header>,
  DialogTitle: ({ children }: { children?: ReactNode }) => <h1>{children}</h1>,
  Label: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Textarea: () => <textarea />,
}))

vi.mock("../../src/index.js", () => ({
  useBookingCancelMutation: bookingHooks.useBookingCancelMutation,
  useBookingPrimaryProduct: bookingHooks.useBookingPrimaryProduct,
}))

import { BookingCancellationDialog } from "../../src/components/booking-cancellation-dialog.js"
import type { BookingRecord } from "../../src/schemas.js"

beforeEach(() => {
  legalHooks.useResolvePolicy.mockReturnValue({ data: null, isLoading: false })
  legalHooks.useEvaluateCancellation.mockReturnValue({ data: null, isFetching: false })
  bookingHooks.useBookingPrimaryProduct.mockReturnValue({ productId: null })
  bookingHooks.useBookingCancelMutation.mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  })
})

describe("BookingCancellationDialog", () => {
  it("warns operators that paid cancellations require settlement review", () => {
    const html = renderToStaticMarkup(
      <BookingCancellationDialog
        open
        onOpenChange={() => {}}
        booking={bookingRecord}
        paidAmountCents={0}
        hasRecordedPayment
      />,
    )

    expect(html).toContain("Paid booking settlement required")
    expect(html).toContain("refund, credit note, or no-refund decision")
  })
})

const bookingRecord: BookingRecord = {
  id: "book_1",
  bookingNumber: "BK-1",
  status: "confirmed",
  personId: null,
  organizationId: null,
  sellCurrency: "GBP",
  sellAmountCents: 12000,
  costAmountCents: null,
  marginPercent: null,
  startDate: null,
  endDate: null,
  pax: 1,
  internalNotes: null,
  createdAt: "2026-07-04T08:00:00.000Z",
  updatedAt: "2026-07-04T08:00:00.000Z",
}

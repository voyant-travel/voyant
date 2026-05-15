import type { BookingRecord } from "@voyantjs/bookings-react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("../../src/components/booking-detail-page.js", () => ({
  BookingDetailPage: ({ id, className }: { id: string; className?: string }) => (
    <section data-testid="booking-detail" className={className}>
      Booking detail {id}
    </section>
  ),
}))

import { BookingWorkspaceShell } from "../../src/components/booking-workspace-page.js"

const booking: BookingRecord = {
  id: "booking_123",
  bookingNumber: "BK-123",
  status: "confirmed",
  personId: "person_123",
  organizationId: null,
  sellCurrency: "USD",
  sellAmountCents: 120000,
  costAmountCents: 90000,
  marginPercent: 25,
  startDate: "2026-06-01",
  endDate: "2026-06-08",
  pax: 2,
  internalNotes: null,
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-05-02T00:00:00.000Z",
}

describe("BookingWorkspaceShell", () => {
  it("renders a loading workspace state", () => {
    const html = renderToStaticMarkup(<BookingWorkspaceShell id="booking_123" isLoading />)

    expect(html).toContain("Booking workspace")
    expect(html).toContain("Loading...")
  })

  it("renders an empty workspace state", () => {
    const html = renderToStaticMarkup(<BookingWorkspaceShell id="missing" booking={null} />)

    expect(html).toContain("The booking workspace could not find this booking.")
  })

  it("mounts the booking detail page as the primary workspace surface", () => {
    const html = renderToStaticMarkup(<BookingWorkspaceShell id={booking.id} booking={booking} />)

    expect(html).toContain("BK-123")
    expect(html).toContain("Booking detail booking_123")
    expect(html).toContain("Booking")
    expect(html).toContain("Finance")
    expect(html).toContain("Legal")
    expect(html).toContain("Travelers")
    expect(html).toContain("Activity")
  })

  it("allows consumers to replace the booking tab content", () => {
    const html = renderToStaticMarkup(
      <BookingWorkspaceShell
        id={booking.id}
        booking={booking}
        slots={{
          bookingTab: ({ bookingId, booking }) => (
            <section>
              Overview only {booking.bookingNumber} for {bookingId}
            </section>
          ),
        }}
      />,
    )

    expect(html).toContain("Overview only BK-123 for booking_123")
    expect(html).not.toContain("Booking detail booking_123")
  })

  it("renders typed workspace slots with bulk-action context", () => {
    const html = renderToStaticMarkup(
      <BookingWorkspaceShell
        id={booking.id}
        booking={booking}
        defaultSection="finance"
        slots={{
          actionBar: ({ booking }) => <button type="button">Assign {booking.bookingNumber}</button>,
          financeTab: ({ bookingId, bulkActions }) => (
            <section>
              Finance panel {bookingId} travelers {bulkActions.selectedTravelerIds.length}
            </section>
          ),
          financeSidebar: ({ bookingId }) => <aside>Finance sidebar {bookingId}</aside>,
        }}
      />,
    )

    expect(html).toContain("Assign BK-123")
    expect(html).toContain("Finance panel booking_123 travelers 0")
    expect(html).toContain("Finance sidebar booking_123")
  })
})

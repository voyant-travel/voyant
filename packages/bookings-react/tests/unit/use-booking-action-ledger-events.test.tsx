import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const ledgerState = vi.hoisted(() => ({
  entries: [] as Array<Record<string, unknown>>,
}))

vi.mock("@voyant-travel/admin", () => ({
  useOperatorAdminMessages: () => ({
    bookings: {
      detail: {
        actionLedger: {
          travelerFallback: "Traveler",
          targetBooking: "Booking",
          loadingMore: "Loading",
          loadMore: "Load more",
        },
      },
    },
  }),
}))

vi.mock("@voyant-travel/ui/components/button", () => ({
  Button: ({ children }: { children?: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
}))

vi.mock("../../src/index.js", () => ({
  useBookingActionLedger: () => ({
    data: {
      pages: [
        {
          data: ledgerState.entries,
          travelers: [],
          pageInfo: { nextCursor: null },
        },
      ],
    },
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
  }),
}))

import { useBookingActionLedgerEvents } from "../../src/admin/use-booking-action-ledger-events.js"

function EventsProbe() {
  const { events } = useBookingActionLedgerEvents("book_123")
  return (
    <div>
      {events.map((event) => (
        <span key={event.id} data-source={event.source}>
          {event.title}
        </span>
      ))}
    </div>
  )
}

describe("useBookingActionLedgerEvents", () => {
  beforeEach(() => {
    ledgerState.entries = []
  })

  it("classifies finance invoice and payment ledger entries into timeline filters", () => {
    ledgerState.entries = [
      {
        id: "act_invoice",
        actionName: "finance.invoice.issue_from_booking",
        targetId: "book_123",
        targetType: "booking",
        status: "succeeded",
        evaluatedRisk: "high",
        principalId: "user_123",
        occurredAt: "2026-07-01T12:00:00.000Z",
      },
      {
        id: "act_payment",
        actionName: "finance.payment.record",
        targetId: "book_123",
        targetType: "booking",
        status: "succeeded",
        evaluatedRisk: "medium",
        principalId: "user_123",
        occurredAt: "2026-07-01T12:01:00.000Z",
      },
      {
        id: "act_credit_note_line_item",
        actionName: "finance.credit_note_line_item.create",
        targetId: "book_123",
        targetType: "booking",
        status: "succeeded",
        evaluatedRisk: "low",
        principalId: "user_123",
        occurredAt: "2026-07-01T12:02:00.000Z",
      },
    ]

    const html = renderToStaticMarkup(<EventsProbe />)

    expect(html.match(/data-source="document"/g)).toHaveLength(2)
    expect(html).toContain('data-source="payment"')
  })
})

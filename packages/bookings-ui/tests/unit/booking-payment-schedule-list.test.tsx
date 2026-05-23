// @vitest-environment jsdom

import type * as ReactTypes from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const testState = vi.hoisted(() => ({
  createFromBooking: vi.fn(async () => ({ id: "inv_123" })),
  renderInvoice: vi.fn(async () => ({ id: "rend_123" })),
  invalidateQueries: vi.fn(async () => undefined),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  removeSchedule: vi.fn(),
}))

;(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: testState.invalidateQueries,
  }),
}))

vi.mock("sonner", () => ({
  toast: {
    success: testState.toastSuccess,
    error: testState.toastError,
  },
}))

vi.mock("@voyantjs/bookings-react", () => ({
  useBooking: () => ({
    data: {
      data: {
        id: "book_123",
        bookingNumber: "BK-2026-000001",
      },
    },
  }),
}))

vi.mock("@voyantjs/finance-react", () => ({
  financeQueryKeys: {
    invoices: () => ["voyant", "finance", "invoices"],
  },
  useBookingPaymentScheduleMutation: () => ({
    remove: { mutate: testState.removeSchedule },
  }),
  useBookingPaymentSchedules: () => ({
    data: {
      data: [
        {
          id: "sched_123",
          bookingId: "book_123",
          bookingItemId: null,
          scheduleType: "deposit",
          status: "due",
          dueDate: "2026-05-30",
          currency: "EUR",
          amountCents: 16500,
          notes: null,
          createdAt: "2026-05-23T00:00:00.000Z",
          updatedAt: "2026-05-23T00:00:00.000Z",
        },
      ],
    },
  }),
  useInvoiceMutation: () => ({
    createFromBooking: { mutateAsync: testState.createFromBooking },
    render: { mutateAsync: testState.renderInvoice },
  }),
}))

vi.mock("@voyantjs/ui/components", () => ({
  Badge: ({ children }: { children?: ReactTypes.ReactNode }) => <span>{children}</span>,
  Button: ({ children, ...props }: ReactTypes.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  Card: ({ children }: { children?: ReactTypes.ReactNode }) => <section>{children}</section>,
  CardContent: ({ children }: { children?: ReactTypes.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children?: ReactTypes.ReactNode }) => <header>{children}</header>,
  CardTitle: ({ children }: { children?: ReactTypes.ReactNode }) => <h2>{children}</h2>,
}))

vi.mock("@voyantjs/ui/components/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children?: ReactTypes.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children?: ReactTypes.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children?: ReactTypes.ReactNode
    onClick?: () => void
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  DropdownMenuTrigger: ({ render }: { render: ReactTypes.ReactElement }) => render,
}))

vi.mock("../../src/components/booking-payment-schedule-dialog.js", () => ({
  BookingPaymentScheduleDialog: () => null,
}))

import { BookingPaymentScheduleList } from "../../src/components/booking-payment-schedule-list.js"

function clickButton(container: HTMLElement, label: string) {
  const button = [...container.querySelectorAll("button")].find((candidate) =>
    candidate.textContent?.includes(label),
  )
  if (!button) throw new Error(`Button not found: ${label}`)
  button.dispatchEvent(new MouseEvent("click", { bubbles: true }))
}

describe("BookingPaymentScheduleList", () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    testState.createFromBooking.mockReset()
    testState.createFromBooking.mockResolvedValue({ id: "inv_123" })
    testState.renderInvoice.mockReset()
    testState.renderInvoice.mockResolvedValue({ id: "rend_123" })
    testState.invalidateQueries.mockReset()
    testState.invalidateQueries.mockResolvedValue(undefined)
    testState.toastSuccess.mockReset()
    testState.toastError.mockReset()
    testState.removeSchedule.mockReset()
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it("toasts success and refreshes invoices after issuing a document", async () => {
    await act(async () => {
      root.render(<BookingPaymentScheduleList bookingId="book_123" />)
    })

    await act(async () => {
      clickButton(container, "Issue invoice")
    })

    expect(testState.createFromBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: "book_123",
        invoiceType: "invoice",
      }),
    )
    expect(testState.renderInvoice).toHaveBeenCalledWith({
      id: "inv_123",
      input: { format: "pdf" },
    })
    expect(testState.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["voyant", "finance", "invoices"],
    })
    expect(testState.toastSuccess).toHaveBeenCalledWith("Document issued.")
    expect(testState.toastError).not.toHaveBeenCalled()
  })

  it("toasts failure details when document issuing fails", async () => {
    testState.createFromBooking.mockRejectedValue(new Error("Internal Server Error"))

    await act(async () => {
      root.render(<BookingPaymentScheduleList bookingId="book_123" />)
    })

    await act(async () => {
      clickButton(container, "Issue invoice")
    })

    expect(testState.renderInvoice).not.toHaveBeenCalled()
    expect(testState.invalidateQueries).not.toHaveBeenCalled()
    expect(testState.toastSuccess).not.toHaveBeenCalled()
    expect(testState.toastError).toHaveBeenCalledWith(
      "Could not issue document: Internal Server Error",
    )
  })
})

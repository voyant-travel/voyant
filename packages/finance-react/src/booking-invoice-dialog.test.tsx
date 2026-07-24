// @vitest-environment jsdom

import type * as ReactTypes from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const testState = vi.hoisted(() => ({
  schedules: [] as Array<{
    id: string
    status: string
    amountCents: number
    currency: string
    dueDate: string
    scheduleType: string
  }>,
  schedulesLoading: false,
  schedulesError: null as Error | null,
  createFromBookingAsync: vi.fn(async () => ({
    id: "inv_123",
    totalCents: 10000,
    currency: "EUR",
  })),
  fetcher: vi.fn(async () => ({ ok: true })),
}))

;(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

vi.mock("./index.js", () => ({
  useBookingPaymentSchedules: () => ({
    data: testState.schedulesError ? undefined : { data: testState.schedules },
    isLoading: testState.schedulesLoading,
    isError: testState.schedulesError != null,
    isSuccess: !testState.schedulesLoading && testState.schedulesError == null,
    error: testState.schedulesError,
  }),
  useInvoiceMutation: () => ({
    createFromBooking: {
      isPending: false,
      mutateAsync: testState.createFromBookingAsync,
    },
  }),
  useVoyantFinanceContext: () => ({
    baseUrl: "",
    fetcher: testState.fetcher,
  }),
}))

vi.mock("@voyant-travel/ui/components", async () => {
  return {
    Button: ({ children, ...props }: ReactTypes.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button {...props}>{children}</button>
    ),
    Dialog: ({
      children,
      open,
    }: {
      children: ReactTypes.ReactNode
      open?: boolean
      onOpenChange?: (open: boolean) => void
    }) => (open ? <div>{children}</div> : null),
    DialogContent: ({ children }: { children: ReactTypes.ReactNode }) => <div>{children}</div>,
    DialogDescription: ({ children }: { children: ReactTypes.ReactNode }) => <p>{children}</p>,
    DialogHeader: ({ children }: { children: ReactTypes.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: ReactTypes.ReactNode }) => <h2>{children}</h2>,
    Sheet: ({
      children,
      open,
    }: {
      children: ReactTypes.ReactNode
      open?: boolean
      onOpenChange?: (open: boolean) => void
    }) => (open ? <div>{children}</div> : null),
    SheetBody: ({ children }: { children: ReactTypes.ReactNode }) => <div>{children}</div>,
    SheetContent: ({
      children,
    }: {
      children: ReactTypes.ReactNode
      size?: string
      side?: string
    }) => <div>{children}</div>,
    SheetDescription: ({ children }: { children: ReactTypes.ReactNode }) => <p>{children}</p>,
    SheetFooter: ({ children }: { children: ReactTypes.ReactNode }) => <div>{children}</div>,
    SheetHeader: ({ children }: { children: ReactTypes.ReactNode }) => <div>{children}</div>,
    SheetTitle: ({ children }: { children: ReactTypes.ReactNode }) => <h2>{children}</h2>,
    Input: (props: ReactTypes.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
    Label: ({ children }: ReactTypes.LabelHTMLAttributes<HTMLLabelElement>) => (
      <span>{children}</span>
    ),
    Select: ({
      children,
      onValueChange,
      value,
    }: {
      children: ReactTypes.ReactNode
      onValueChange?: (value: string) => void
      value?: string
    }) => (
      <select value={value ?? ""} onChange={(event) => onValueChange?.(event.target.value)}>
        {children}
      </select>
    ),
    SelectContent: ({ children }: { children: ReactTypes.ReactNode }) => <>{children}</>,
    SelectItem: ({ children, value }: { children: ReactTypes.ReactNode; value: string }) => (
      <option value={value}>{children}</option>
    ),
    SelectTrigger: () => null,
    SelectValue: () => null,
    Switch: ({
      checked,
      onCheckedChange,
    }: {
      checked?: boolean
      onCheckedChange?: (next: boolean) => void
    }) => (
      <input
        type="checkbox"
        checked={checked ?? false}
        onChange={(event) => onCheckedChange?.(event.target.checked)}
      />
    ),
    Textarea: (props: ReactTypes.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
      <textarea {...props} />
    ),
  }
})

vi.mock("@voyant-travel/ui/components/currency-combobox", () => ({
  CurrencyCombobox: ({
    disabled,
    onChange,
    value,
  }: {
    disabled?: boolean
    onChange: (value: string | null) => void
    value: string | null | undefined
  }) => (
    <select
      aria-label="Currency"
      disabled={disabled}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value || null)}
    >
      <option value="EUR">EUR</option>
      <option value="RON">RON</option>
    </select>
  ),
}))

vi.mock("@voyant-travel/ui/components/currency-input", () => ({
  CurrencyInput: ({
    disabled,
    onChange,
    value,
  }: {
    disabled?: boolean
    onChange: (value: number | null) => void
    value: number | null | undefined
  }) => (
    <input
      disabled={disabled}
      value={value == null ? "" : String(value / 100)}
      onChange={(event) => onChange(Math.round(Number(event.target.value) * 100))}
    />
  ),
}))

vi.mock("@voyant-travel/ui/components/date-picker", () => ({
  DatePicker: ({
    disabled,
    onChange,
    placeholder,
    value,
  }: {
    disabled?: boolean
    onChange: (value: string | null) => void
    placeholder?: string
    value: string | null | undefined
  }) => (
    <input
      aria-label={placeholder}
      disabled={disabled}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value || null)}
    />
  ),
}))

import { BookingInvoiceDialog } from "./components/booking-invoice-dialog.js"

function clickButton(container: HTMLElement, text: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === text,
  )
  if (!button) throw new Error(`Button not found: ${text}`)
  button.dispatchEvent(new MouseEvent("click", { bubbles: true }))
}

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event("input", { bubbles: true }))
}

describe("BookingInvoiceDialog", () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    testState.schedules = []
    testState.schedulesLoading = false
    testState.schedulesError = null
    testState.createFromBookingAsync.mockClear()
    testState.fetcher.mockClear()
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it("defaults to custom invoices when no unpaid schedule is eligible", async () => {
    await act(async () => {
      root.render(<BookingInvoiceDialog open onOpenChange={() => {}} bookingId="book_123" />)
    })

    expect(container.textContent).toContain("Add line item")
    expect(container.textContent).not.toContain("No unpaid schedules available.")
  })

  it("does not default to custom invoices when schedule loading fails", async () => {
    testState.schedulesError = new Error("Schedule API unavailable")

    await act(async () => {
      root.render(<BookingInvoiceDialog open onOpenChange={() => {}} bookingId="book_123" />)
    })

    expect(container.textContent).toContain("Schedule API unavailable")
    expect(container.textContent).not.toContain("Add line item")

    await act(async () => {
      clickButton(container, "Create Invoice")
    })

    expect(testState.createFromBookingAsync).not.toHaveBeenCalled()
  })

  it("clears the schedule validation message when switching to custom", async () => {
    testState.schedules = [
      {
        id: "sched_123",
        status: "pending",
        amountCents: 10000,
        currency: "EUR",
        dueDate: "2026-07-15",
        scheduleType: "deposit",
      },
    ]

    await act(async () => {
      root.render(<BookingInvoiceDialog open onOpenChange={() => {}} bookingId="book_123" />)
    })

    await act(async () => {
      clickButton(container, "Create Invoice")
    })
    expect(container.textContent).toContain("Select a payment schedule")

    await act(async () => {
      clickButton(container, "Custom")
    })
    expect(container.textContent).not.toContain("Select a payment schedule")
  })

  it("clears the due-date validation message after choosing a due date", async () => {
    await act(async () => {
      root.render(<BookingInvoiceDialog open onOpenChange={() => {}} bookingId="book_123" />)
    })

    await act(async () => {
      clickButton(container, "Create Invoice")
    })
    expect(container.textContent).toContain("Due date is required")

    await act(async () => {
      const dueDate = container.querySelector<HTMLInputElement>('input[aria-label="Pick due date"]')
      if (!dueDate) throw new Error("Due date input not found")
      setNativeInputValue(dueDate, "2026-07-20")
    })

    expect(container.textContent).not.toContain("Due date is required")
  })
})

// @vitest-environment jsdom

import type * as ReactTypes from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const testState = vi.hoisted(() => ({
  invoices: [
    {
      id: "inv_123",
      invoiceNumber: "PF-2026-001",
      status: "issued",
      currency: "EUR",
      totalCents: 66000,
      paidCents: 0,
      balanceDueCents: 66000,
    },
  ],
  mutateAsync: vi.fn(async () => ({ data: { id: "pay_123" } })),
  updateAsync: vi.fn(async () => ({ data: { id: "pay_123" } })),
  fxRate: null as number | null,
}))

;(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

vi.mock("./index.js", () => ({
  paymentMethodSchema: {
    options: ["bank_transfer", "credit_card", "cash", "cheque", "other"],
  },
  paymentStatusSchema: {
    options: ["pending", "completed", "failed", "refunded"],
  },
  useInvoices: () => ({
    data: {
      data: testState.invoices,
    },
    isLoading: false,
  }),
  useInvoicePaymentMutation: () => ({
    isPending: false,
    mutateAsync: testState.mutateAsync,
  }),
  usePaymentMutation: () => ({
    update: { isPending: false, mutateAsync: testState.updateAsync },
    remove: { isPending: false, mutateAsync: vi.fn() },
  }),
  useInvoiceMutation: () => ({
    convertToInvoice: { isPending: false, mutateAsync: vi.fn() },
  }),
  useInvoiceFxRate: ({ enabled }: { enabled?: boolean }) => ({
    data:
      enabled && testState.fxRate != null
        ? {
            data: {
              rate: testState.fxRate,
              effectiveRate: testState.fxRate,
              fxCommissionBps: 0,
            },
          }
        : undefined,
    isFetching: false,
    isFetched: Boolean(enabled),
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
    DialogBody: ({ children }: { children: ReactTypes.ReactNode }) => <div>{children}</div>,
    DialogContent: ({ children }: { children: ReactTypes.ReactNode; size?: string }) => (
      <div>{children}</div>
    ),
    DialogFooter: ({ children }: { children: ReactTypes.ReactNode }) => <div>{children}</div>,
    DialogHeader: ({ children }: { children: ReactTypes.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: ReactTypes.ReactNode }) => <h2>{children}</h2>,
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
      <select value={value} onChange={(event) => onValueChange?.(event.target.value)}>
        {children}
      </select>
    ),
    SelectContent: ({ children }: { children: ReactTypes.ReactNode }) => <>{children}</>,
    SelectItem: ({ children, value }: { children: ReactTypes.ReactNode; value: string }) => (
      <option value={value}>{children}</option>
    ),
    SelectTrigger: () => null,
    SelectValue: () => null,
    Textarea: (props: ReactTypes.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
      <textarea {...props} />
    ),
    Switch: ({
      checked,
      onCheckedChange,
      id,
    }: {
      checked?: boolean
      onCheckedChange?: (next: boolean) => void
      id?: string
    }) => (
      <input
        type="checkbox"
        id={id}
        checked={checked ?? false}
        onChange={(event) => onCheckedChange?.(event.target.checked)}
      />
    ),
  }
})

vi.mock("@voyant-travel/ui/components/currency-combobox", () => ({
  CurrencyCombobox: ({
    onChange,
    value,
  }: {
    onChange: (value: string | null) => void
    value: string | null | undefined
  }) => (
    <select
      aria-label="Payment currency"
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value || null)}
    >
      <option value="EUR">EUR</option>
      <option value="RON">RON</option>
      <option value="USD">USD</option>
    </select>
  ),
}))

vi.mock("@voyant-travel/ui/components/currency-input", () => ({
  CurrencyInput: ({
    id,
    onChange,
    value,
  }: {
    id?: string
    onChange: (value: number | null) => void
    value: number | null | undefined
  }) => (
    <input
      id={id}
      value={value == null ? "" : String(value / 100)}
      onChange={(event) => onChange(Math.round(Number(event.target.value) * 100))}
    />
  ),
}))

vi.mock("@voyant-travel/ui/components/date-picker", () => ({
  DatePicker: ({
    onChange,
    value,
  }: {
    onChange: (value: string | null) => void
    value: string | null | undefined
  }) => (
    <input
      aria-label="Payment date"
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value || null)}
    />
  ),
}))

import { RecordBookingPaymentDialog } from "./components/record-booking-payment-dialog.js"

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event("input", { bubbles: true }))
}

describe("RecordBookingPaymentDialog", () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    testState.mutateAsync.mockClear()
    testState.updateAsync.mockClear()
    testState.fxRate = null
    testState.invoices = [
      {
        id: "inv_123",
        invoiceNumber: "PF-2026-001",
        status: "issued",
        currency: "EUR",
        totalCents: 66000,
        paidCents: 0,
        balanceDueCents: 66000,
      },
    ]
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it("records a cross-currency booking payment with invoice-currency base amount", async () => {
    await act(async () => {
      root.render(
        <RecordBookingPaymentDialog
          open
          onOpenChange={() => {}}
          bookingId="book_123"
          defaultCurrency="EUR"
        />,
      )
    })

    await act(async () => {
      container.querySelector<HTMLSelectElement>('select[aria-label="Payment currency"]')!.value =
        "RON"
      container
        .querySelector<HTMLSelectElement>('select[aria-label="Payment currency"]')!
        .dispatchEvent(new Event("change", { bubbles: true }))
    })

    await act(async () => {
      setNativeInputValue(container.querySelector<HTMLInputElement>("#record-amount")!, "3300")
    })

    await act(async () => {
      setNativeInputValue(container.querySelector<HTMLInputElement>("#record-fx-rate")!, "5")
    })

    await act(async () => {
      container.querySelector<HTMLFormElement>("form")!.dispatchEvent(
        new Event("submit", {
          bubbles: true,
          cancelable: true,
        }),
      )
    })

    expect(testState.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 330000,
        baseAmountCents: 66000,
        baseCurrency: "EUR",
        currency: "RON",
      }),
    )
  })

  it("offers issued unpaid invoices while excluding pending allocation placeholders", async () => {
    testState.invoices = [
      {
        id: "inv_pending",
        invoiceNumber: "PENDING-INVOICE",
        status: "pending_external_allocation",
        currency: "EUR",
        totalCents: 30000,
        paidCents: 0,
        balanceDueCents: 30000,
      },
      {
        id: "inv_issued",
        invoiceNumber: "INV-2026-010",
        status: "issued",
        currency: "EUR",
        totalCents: 66000,
        paidCents: 0,
        balanceDueCents: 66000,
      },
    ]

    await act(async () => {
      root.render(
        <RecordBookingPaymentDialog
          open
          onOpenChange={() => {}}
          bookingId="book_123"
          defaultCurrency="EUR"
        />,
      )
    })

    const optionText = Array.from(container.querySelectorAll("option")).map(
      (option) => option.textContent ?? "",
    )

    expect(optionText).toContain("INV-2026-010 — issued — 660.00 EUR due")
    expect(optionText).not.toContain(
      "PENDING-INVOICE — pending_external_allocation — 300.00 EUR due",
    )
    expect(container.textContent).toContain("Draft and pending allocation invoices are excluded.")
    expect(container.textContent).not.toContain("No unpaid invoices on this booking.")
  })

  it("preserves invoice currency casing for same-currency payments", async () => {
    testState.invoices = [
      {
        id: "inv_123",
        invoiceNumber: "PF-2026-001",
        status: "issued",
        currency: "eur",
        totalCents: 66000,
        paidCents: 0,
        balanceDueCents: 66000,
      },
    ]

    await act(async () => {
      root.render(
        <RecordBookingPaymentDialog
          open
          onOpenChange={() => {}}
          bookingId="book_123"
          defaultCurrency="EUR"
        />,
      )
    })

    await act(async () => {
      container.querySelector<HTMLFormElement>("form")!.dispatchEvent(
        new Event("submit", {
          bubbles: true,
          cancelable: true,
        }),
      )
    })

    expect(testState.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        baseAmountCents: null,
        baseCurrency: null,
        currency: "eur",
      }),
    )
  })

  it("PATCHes /payments/:id when editingPayment is provided", async () => {
    await act(async () => {
      root.render(
        <RecordBookingPaymentDialog
          open
          onOpenChange={() => {}}
          bookingId="book_123"
          defaultCurrency="EUR"
          editingPayment={{
            id: "pay_existing",
            invoiceId: "inv_123",
            amountCents: 50000,
            currency: "EUR",
            baseCurrency: null,
            baseAmountCents: null,
            paymentMethod: "bank_transfer",
            status: "completed",
            paymentDate: "2026-05-20",
            referenceNumber: "ref-1",
            notes: null,
          }}
        />,
      )
    })

    await act(async () => {
      setNativeInputValue(container.querySelector<HTMLInputElement>("#record-amount")!, "600")
    })

    await act(async () => {
      container
        .querySelector<HTMLFormElement>("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    })

    expect(testState.updateAsync).toHaveBeenCalledWith({
      id: "pay_existing",
      input: expect.objectContaining({
        amountCents: 60000,
        currency: "EUR",
      }),
    })
    expect(testState.mutateAsync).not.toHaveBeenCalled()
  })

  it("auto-fills invoice-currency base amount from the configured FX rate", async () => {
    testState.fxRate = 5

    await act(async () => {
      root.render(
        <RecordBookingPaymentDialog
          open
          onOpenChange={() => {}}
          bookingId="book_123"
          defaultCurrency="EUR"
        />,
      )
    })

    await act(async () => {
      container.querySelector<HTMLSelectElement>('select[aria-label="Payment currency"]')!.value =
        "RON"
      container
        .querySelector<HTMLSelectElement>('select[aria-label="Payment currency"]')!
        .dispatchEvent(new Event("change", { bubbles: true }))
    })

    await act(async () => {
      setNativeInputValue(container.querySelector<HTMLInputElement>("#record-amount")!, "3300")
    })

    await act(async () => {
      container.querySelector<HTMLFormElement>("form")!.dispatchEvent(
        new Event("submit", {
          bubbles: true,
          cancelable: true,
        }),
      )
    })

    expect(testState.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 330000,
        baseAmountCents: 66000,
        baseCurrency: "EUR",
        currency: "RON",
      }),
    )
  })
})

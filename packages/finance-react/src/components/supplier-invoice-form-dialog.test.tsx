// @vitest-environment jsdom

import type * as ReactTypes from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const testState = vi.hoisted(() => ({
  createMutate: vi.fn(),
  updateMutate: vi.fn(),
}))

;(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

vi.mock("../index.js", () => ({
  useSupplierInvoiceMutation: () => ({
    create: { isPending: false, mutate: testState.createMutate },
    update: { isPending: false, mutate: testState.updateMutate },
  }),
}))

vi.mock("@voyant-travel/ui/components", () => ({
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
  DialogContent: ({ children }: { children: ReactTypes.ReactNode; className?: string }) => (
    <div>{children}</div>
  ),
  DialogFooter: ({ children }: { children: ReactTypes.ReactNode }) => <div>{children}</div>,
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
    className?: string
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
    <select value={value} onChange={(event) => onValueChange?.(event.target.value)}>
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children: ReactTypes.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: ReactTypes.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: ({ children }: { children?: ReactTypes.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  Textarea: (props: ReactTypes.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea {...props} />
  ),
}))

vi.mock("@voyant-travel/ui/components/currency-combobox", () => ({
  CurrencyCombobox: ({
    onChange,
    value,
  }: {
    onChange?: (value: string | null) => void
    value?: string | null
  }) => (
    <input
      aria-label="Currency"
      value={value ?? ""}
      onChange={(event) => onChange?.(event.target.value || null)}
    />
  ),
}))

vi.mock("@voyant-travel/ui/components/date-picker", () => ({
  DatePicker: ({
    onChange,
    value,
  }: {
    onChange?: (value: string | null) => void
    value?: string | null
  }) => (
    <input
      aria-label="Date"
      value={value ?? ""}
      onChange={(event) => onChange?.(event.target.value || null)}
    />
  ),
}))

vi.mock("./async-combobox.js", () => ({
  AsyncCombobox: ({
    onChange,
    placeholder,
    value,
  }: {
    onChange?: (value: string | null) => void
    placeholder?: string
    value?: string | null
  }) => (
    <input
      aria-label={placeholder ?? "Async combobox"}
      value={value ?? ""}
      onChange={(event) => onChange?.(event.target.value || null)}
    />
  ),
}))

import { SupplierInvoiceFormDialog } from "./supplier-invoice-form-dialog.js"

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event("input", { bubbles: true }))
  input.dispatchEvent(new Event("change", { bubbles: true }))
}

describe("SupplierInvoiceFormDialog", () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    testState.createMutate.mockReset()
    testState.updateMutate.mockReset()
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it("creates a draft supplier invoice with an initial line from the entered total", async () => {
    await act(async () => {
      root.render(
        <SupplierInvoiceFormDialog open onOpenChange={() => {}} searchProducts={async () => []} />,
      )
    })

    const inputs = container.querySelectorAll<HTMLInputElement>("input")
    await act(async () => {
      setNativeInputValue(inputs[0]!, "SUP-2026-001")
      setNativeInputValue(inputs[1]!, "sup_123")
      setNativeInputValue(inputs[3]!, "2026-06-01")
      setNativeInputValue(inputs[6]!, "125.50")
    })

    await act(async () => {
      container.querySelector<HTMLButtonElement>("button")!.click()
    })

    expect(testState.createMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "draft",
        supplierInvoiceNo: "SUP-2026-001",
        totalCents: 12550,
        lines: [
          expect.objectContaining({
            description: "SUP-2026-001",
            unitAmountCents: 12550,
            taxAmountCents: 0,
            totalAmountCents: 12550,
          }),
        ],
      }),
      expect.anything(),
    )
  })

  it("blocks negative create totals before mutation", async () => {
    await act(async () => {
      root.render(
        <SupplierInvoiceFormDialog open onOpenChange={() => {}} searchProducts={async () => []} />,
      )
    })

    const inputs = container.querySelectorAll<HTMLInputElement>("input")
    await act(async () => {
      setNativeInputValue(inputs[0]!, "SUP-2026-001")
      setNativeInputValue(inputs[1]!, "sup_123")
      setNativeInputValue(inputs[3]!, "2026-06-01")
      setNativeInputValue(inputs[6]!, "-1")
    })

    const save = container.querySelector<HTMLButtonElement>("button")!
    expect(save.disabled).toBe(true)

    await act(async () => {
      save.click()
    })

    expect(testState.createMutate).not.toHaveBeenCalled()
  })
})

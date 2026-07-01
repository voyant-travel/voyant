// @vitest-environment jsdom

import type * as ReactTypes from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

;(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

vi.mock("../../index.js", () => ({
  useCostCategories: () => ({ data: { data: [] } }),
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

vi.mock("../async-combobox.js", () => ({
  AsyncCombobox: ({
    onChange,
    value,
  }: {
    onChange?: (value: string | null) => void
    value?: string | null
  }) => <input value={value ?? ""} onChange={(event) => onChange?.(event.target.value || null)} />,
}))

import { LineDialog, PaymentDialog } from "./dialogs.js"

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event("input", { bubbles: true }))
  input.dispatchEvent(new Event("change", { bubbles: true }))
}

describe("supplier invoice detail dialogs", () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it("derives submitted line totals from quantity, unit amount, and tax", async () => {
    const onSubmit = vi.fn()
    await act(async () => {
      root.render(
        <LineDialog
          open
          line={null}
          currency="EUR"
          pending={false}
          onOpenChange={() => {}}
          onSubmit={onSubmit}
        />,
      )
    })

    const inputs = container.querySelectorAll<HTMLInputElement>("input")
    await act(async () => {
      setNativeInputValue(inputs[0]!, "Guide")
      setNativeInputValue(inputs[1]!, "2")
      setNativeInputValue(inputs[2]!, "450.00")
      setNativeInputValue(inputs[3]!, "190.00")
    })

    expect(inputs[4]!.value).toBe("1090.00")
    await act(async () => {
      container.querySelector<HTMLButtonElement>("button")!.click()
    })

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        quantity: 2,
        unitAmountCents: 45000,
        taxAmountCents: 19000,
        totalAmountCents: 109000,
      }),
    )
  })

  it("does not submit negative line money values", async () => {
    const onSubmit = vi.fn()
    await act(async () => {
      root.render(
        <LineDialog
          open
          line={null}
          currency="EUR"
          pending={false}
          onOpenChange={() => {}}
          onSubmit={onSubmit}
        />,
      )
    })

    const inputs = container.querySelectorAll<HTMLInputElement>("input")
    await act(async () => {
      setNativeInputValue(inputs[0]!, "Guide")
      setNativeInputValue(inputs[1]!, "1")
      setNativeInputValue(inputs[2]!, "-1")
      setNativeInputValue(inputs[3]!, "0")
    })

    const save = container.querySelector<HTMLButtonElement>("button")!
    expect(save.disabled).toBe(true)
    await act(async () => {
      save.click()
    })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("caps supplier invoice payments at the payable balance", async () => {
    const onSubmit = vi.fn()
    await act(async () => {
      root.render(
        <PaymentDialog
          open
          currency="EUR"
          maxAmountCents={30000}
          pending={false}
          onOpenChange={() => {}}
          onSubmit={onSubmit}
        />,
      )
    })

    const amount = container.querySelector<HTMLInputElement>("input")!
    await act(async () => {
      setNativeInputValue(amount, "300.01")
    })

    const save = container.querySelector<HTMLButtonElement>("button")!
    expect(save.disabled).toBe(true)
    await act(async () => {
      save.click()
    })
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

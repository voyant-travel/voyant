// @vitest-environment jsdom

import type * as ReactTypes from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const testState = vi.hoisted(() => ({
  createAsync: vi.fn(async () => ({ data: { id: "series_123" } })),
  updateAsync: vi.fn(async () => ({ data: { id: "series_123" } })),
}))

;(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

vi.mock("@voyant-travel/admin", () => ({
  useOperatorAdminMessages: () => ({
    legal: {
      numberSeriesDialog: {
        titleNew: "New Number Series",
        titleEdit: "Edit Number Series",
        cancel: "Cancel",
        createAction: "Create Series",
        saveChanges: "Save Changes",
        nameLabel: "Name",
        namePlaceholder: "Contract Series",
        prefixLabel: "Prefix",
        prefixPlaceholder: "CTR",
        prefixHelp: "Visible text prefix used in the generated contract number.",
        separatorLabel: "Separator",
        separatorPlaceholder: "-",
        padLengthLabel: "Pad Length",
        previewLabel: "Preview",
        previewExisting: "Next issued contract number based on the current sequence.",
        previewSample: "Sample format using a preview sequence.",
        resetStrategyLabel: "Reset Strategy",
        scopeLabel: "Scope",
        activeLabel: "Active",
        conflictMessage:
          'An active series with prefix "{prefix}" and scope "{scope}" already exists ("{name}"). Save will fail unless you archive it first.',
        resetStrategyOptions: {
          never: "Never",
          annual: "Annual",
          monthly: "Monthly",
        },
        scopeOptions: {
          customer: "Customer",
          supplier: "Supplier",
          partner: "Partner",
          channel: "Channel",
          other: "Other",
        },
        validation: {
          nameRequired: "Name is required",
          prefixRequired: "Prefix is required",
        },
      },
    },
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
    children?: ReactTypes.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
  }) => (open ? <div>{children}</div> : null),
  DialogBody: ({ children }: { children?: ReactTypes.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children?: ReactTypes.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children?: ReactTypes.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: ReactTypes.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: ReactTypes.ReactNode }) => <h2>{children}</h2>,
  Sheet: ({
    children,
    open,
  }: {
    children?: ReactTypes.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
  }) => (open ? <div>{children}</div> : null),
  SheetBody: ({ children }: { children?: ReactTypes.ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children?: ReactTypes.ReactNode }) => <div>{children}</div>,
  SheetDescription: ({ children }: { children?: ReactTypes.ReactNode }) => <p>{children}</p>,
  SheetFooter: ({ children }: { children?: ReactTypes.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children?: ReactTypes.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children?: ReactTypes.ReactNode }) => <h2>{children}</h2>,
  Input: (props: ReactTypes.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Label: ({ children }: ReactTypes.LabelHTMLAttributes<HTMLLabelElement>) => (
    <span>{children}</span>
  ),
  Select: ({
    children,
    onValueChange,
    value,
  }: {
    children?: ReactTypes.ReactNode
    onValueChange?: (value: string) => void
    value?: string
  }) => (
    <select value={value} onChange={(event) => onValueChange?.(event.target.value)}>
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children?: ReactTypes.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children?: ReactTypes.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
}))

vi.mock("@voyant-travel/ui/components/switch", () => ({
  Switch: ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean
    onCheckedChange?: (checked: boolean) => void
  }) => (
    <input
      checked={checked ?? false}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
      type="checkbox"
    />
  ),
}))

vi.mock("../index.js", () => ({
  useLegalContractNumberSeries: () => ({
    data: { data: [] },
  }),
  useLegalContractNumberSeriesMutation: () => ({
    create: { mutateAsync: testState.createAsync },
    update: { mutateAsync: testState.updateAsync },
  }),
}))

import { NumberSeriesDialog } from "./number-series-dialog.js"

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event("input", { bubbles: true }))
}

function setNativeSelectValue(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set
  setter?.call(select, value)
  select.dispatchEvent(new Event("change", { bubbles: true }))
}

describe("NumberSeriesDialog", () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    testState.createAsync.mockClear()
    testState.updateAsync.mockClear()
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it("updates the create preview immediately when pad length changes", async () => {
    await act(async () => {
      root.render(<NumberSeriesDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />)
    })

    const nameInput = container.querySelector<HTMLInputElement>(
      'input[placeholder="Contract Series"]',
    )
    const prefixInput = container.querySelector<HTMLInputElement>('input[placeholder="CTR"]')
    const separatorInput = container.querySelector<HTMLInputElement>('input[placeholder="-"]')
    const padLengthInput = container.querySelector<HTMLInputElement>('input[type="number"]')
    const scopeSelect = container.querySelectorAll<HTMLSelectElement>("select")[1]

    if (!nameInput || !prefixInput || !separatorInput || !padLengthInput || !scopeSelect) {
      throw new Error("Expected number-series form controls to render")
    }

    await act(async () => {
      setNativeInputValue(nameInput, "UIT series")
      setNativeInputValue(prefixInput, "UIT")
      setNativeInputValue(separatorInput, "-")
      setNativeInputValue(padLengthInput, "3")
      setNativeSelectValue(scopeSelect, "other")
    })

    expect(container.textContent).toContain("UIT-042")
    expect(container.textContent).not.toContain("UIT-0042")
  })

  it("clamps temporary out-of-range preview pad lengths", async () => {
    await act(async () => {
      root.render(<NumberSeriesDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />)
    })

    const padLengthInput = container.querySelector<HTMLInputElement>('input[type="number"]')

    if (!padLengthInput) {
      throw new Error("Expected pad length control to render")
    }

    await act(async () => {
      setNativeInputValue(padLengthInput, "1000000000")
    })

    expect(container.textContent).toContain("CTR000000000042")
  })
})

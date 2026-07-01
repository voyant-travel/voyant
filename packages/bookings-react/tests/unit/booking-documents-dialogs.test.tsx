// @vitest-environment jsdom

import type * as ReactTypes from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const testState = vi.hoisted(() => ({
  createDocument: vi.fn(async () => ({ id: "bdoc_123" })),
  uploadContract: vi.fn(async () => ({ id: "att_123" })),
  createContract: vi.fn(async () => ({ id: "ctr_123" })),
  invalidateQueries: vi.fn(async () => undefined),
  previewMutate: vi.fn(),
  previewReset: vi.fn(),
  generateContract: vi.fn(async () => ({ contractId: "ctr_123", attachmentId: "att_123" })),
  previewState: {
    data: undefined as undefined | { html: string; templateName?: string },
    isPending: false,
    isError: false,
    error: null as unknown,
  },
}))

;(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const adminMessages = {
  bookings: {
    detail: {
      contractDialog: {
        title: "Add contract",
        description: "Generate a contract from the configured template or upload a signed PDF.",
        modeLabel: "Source",
        modeGenerate: "Generate",
        modeUpload: "Upload",
        previewLabel: "Preview",
        previewIframeFallback: "Contract preview",
        previewTemplateLabel: "Template:",
        previewFailed: "Could not render the contract preview.",
        previewErrorPrefix: "Preview error:",
        previewUnavailable: "Contract generation is not ready for this booking.",
        previewSetupHint:
          "Configure an active customer contract template with a published version in Legal > Templates, and make sure the deployment has contract document generation configured.",
        uploadTitleLabel: "Title",
        uploadTitlePlaceholder: "Contract title",
        uploadTitleHint: "Defaults to the booking reference when left empty.",
        uploadFileLabel: "PDF file",
        uploadFileRequired: "Choose a PDF to upload.",
        generateAction: "Create contract",
        uploadAction: "Upload contract",
        cancel: "Cancel",
      },
    },
  },
}

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: testState.invalidateQueries }),
}))

vi.mock("@voyant-travel/admin", () => ({
  useOperatorAdminMessages: () => adminMessages,
}))

vi.mock("@voyant-travel/legal-react", () => ({
  legalQueryKeys: {
    contracts: () => ["legal", "contracts"],
  },
  useLegalContractAttachmentMutation: () => ({
    upload: { mutateAsync: testState.uploadContract },
  }),
  useLegalContractMutation: () => ({
    create: { mutateAsync: testState.createContract },
  }),
}))

vi.mock("../../src/index.js", () => ({
  useBookingContractGenerationMutation: () => ({
    preview: {
      ...testState.previewState,
      mutate: testState.previewMutate,
      reset: testState.previewReset,
    },
    generate: {
      isPending: false,
      mutateAsync: testState.generateContract,
    },
  }),
  useBookingTravelerDocumentMutation: () => ({
    create: {
      isPending: false,
      mutateAsync: testState.createDocument,
    },
  }),
  useTravelers: () => ({ data: { data: [] } }),
}))

vi.mock("@voyant-travel/ui/components/date-picker", () => ({
  DatePicker: ({
    placeholder,
  }: {
    value?: string | null
    onChange?: (next: string | null) => void
    placeholder?: string
  }) => <input aria-label={placeholder} />,
}))

vi.mock("../../src/components/file-dropzone.js", () => ({
  FileDropzone: ({
    helperText,
    onUploaded,
    onCleared,
  }: {
    helperText?: string
    onUploaded: (upload: {
      key: string
      url: string
      mimeType: string
      size: number
      name: string
    }) => void
    onCleared?: () => void
  }) => (
    <div>
      <p>{helperText}</p>
      <button
        type="button"
        onClick={() =>
          onUploaded({
            key: "upload_123",
            url: "https://cdn.example.test/passport.pdf",
            mimeType: "application/pdf",
            size: 1234,
            name: "passport.pdf",
          })
        }
      >
        Mock upload
      </button>
      <button type="button" onClick={() => onCleared?.()}>
        Mock clear
      </button>
    </div>
  ),
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
  DialogDescription: ({ children }: { children?: ReactTypes.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children?: ReactTypes.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: ReactTypes.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: ReactTypes.ReactNode }) => <h2>{children}</h2>,
  Input: (props: ReactTypes.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Label: ({ children }: { children?: ReactTypes.ReactNode }) => <span>{children}</span>,
  Select: ({ children }: { children?: ReactTypes.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children?: ReactTypes.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children?: ReactTypes.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children?: ReactTypes.ReactNode }) => (
    <button type="button">{children}</button>
  ),
  SelectValue: () => null,
  Skeleton: () => <div />,
  Textarea: (props: ReactTypes.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea {...props} />
  ),
}))

import { BookingContractDialog } from "../../src/admin/booking-contract-dialog.js"
import { BookingDocumentDialog } from "../../src/components/booking-document-dialog.js"

function getButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = [...container.querySelectorAll("button")].find((candidate) =>
    candidate.textContent?.includes(label),
  )
  if (!button) throw new Error(`Button not found: ${label}`)
  return button
}

describe("booking document dialogs", () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    testState.createDocument.mockClear()
    testState.uploadContract.mockClear()
    testState.createContract.mockClear()
    testState.invalidateQueries.mockClear()
    testState.previewMutate.mockClear()
    testState.previewReset.mockClear()
    testState.generateContract.mockClear()
    testState.previewState.data = undefined
    testState.previewState.isPending = false
    testState.previewState.isError = false
    testState.previewState.error = null
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it("keeps document upload submit disabled until an uploaded file exists", () => {
    act(() => {
      root.render(
        <BookingDocumentDialog open onOpenChange={() => undefined} bookingId="book_123" />,
      )
    })

    expect(getButton(container, "Add document").disabled).toBe(true)
    expect(container.textContent).not.toContain("Must be a valid URL")

    act(() => {
      getButton(container, "Mock upload").click()
    })

    expect(getButton(container, "Add document").disabled).toBe(false)

    act(() => {
      getButton(container, "Mock clear").click()
    })

    expect(getButton(container, "Add document").disabled).toBe(true)
  })

  it("explains why generated contract creation is disabled without preview content", () => {
    act(() => {
      root.render(
        <BookingContractDialog
          open
          onOpenChange={() => undefined}
          bookingId="book_123"
          bookingNumber="BK-123"
        />,
      )
    })

    expect(testState.previewMutate).toHaveBeenCalledOnce()
    expect(container.textContent).toContain("Contract generation is not ready for this booking.")
    expect(container.textContent).toContain("Legal > Templates")
    expect(getButton(container, "Create contract").disabled).toBe(true)
  })
})

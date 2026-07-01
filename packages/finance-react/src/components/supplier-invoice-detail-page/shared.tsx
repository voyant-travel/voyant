import type {
  SupplierCostAllocationInput,
  SupplierCostAllocationRecord,
  SupplierInvoiceLineInput,
  SupplierInvoiceLineRecord,
  SupplierInvoiceStatus,
} from "../../index.js"
import type { AsyncComboboxOption } from "../async-combobox.js"
import type { SupplierInvoiceExtraction } from "../supplier-invoice-form-dialog.js"

export type SupplierInvoiceTargetSearch = (
  targetType: "departure" | "product" | "booking" | "traveler",
  query: string,
) => Promise<AsyncComboboxOption[]>

export const STATUS_VARIANT: Record<
  SupplierInvoiceStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "outline",
  received: "secondary",
  approved: "secondary",
  partially_paid: "default",
  paid: "default",
  disputed: "destructive",
  void: "outline",
}

export const TARGET_TYPES = ["departure", "product", "booking", "traveler", "unattributed"] as const
export type TargetType = (typeof TARGET_TYPES)[number]

/**
 * Target types that support search-and-select; others fall back to a text id.
 * Departure search is product-centric (search a product → pick its dated slot),
 * wired by the host. Travelers have no global search, so they stay raw-id.
 */
export const SEARCHABLE_TARGETS = new Set<TargetType>(["departure", "product", "booking"])

export const LINE_CATEGORY_NONE = "__none__"

export const PAYMENT_METHODS = ["bank_transfer", "credit_card", "cash", "cheque", "other"] as const

export function toCents(major: string): number {
  const n = Number.parseFloat(major)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

export function parseNonNegativeCents(major: string): number | null {
  if (!major.trim()) return null
  const n = Number.parseFloat(major)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

export function parseOptionalNonNegativeCents(major: string): number | null {
  if (!major.trim()) return 0
  return parseNonNegativeCents(major)
}

export function targetIdFor(
  targetType: TargetType,
  targetId: string,
): Partial<SupplierCostAllocationInput> {
  switch (targetType) {
    case "departure":
      return { departureId: targetId }
    case "product":
      return { productId: targetId }
    case "booking":
      return { bookingId: targetId }
    case "traveler":
      return { travelerId: targetId }
    default:
      return {}
  }
}

export function allocationToInput(a: SupplierCostAllocationRecord): SupplierCostAllocationInput {
  return {
    targetType: a.targetType,
    amountCents: a.amountCents,
    splitMethod: a.splitMethod,
    ...targetIdFor(a.targetType, a.departureId ?? a.productId ?? a.bookingId ?? a.travelerId ?? ""),
  }
}

export function lineToInput(line: SupplierInvoiceLineRecord): SupplierInvoiceLineInput {
  return {
    description: line.description,
    serviceType: line.serviceType,
    supplierServiceId: line.supplierServiceId,
    quantity: line.quantity,
    unitAmountCents: line.unitAmountCents,
    taxRateBps: line.taxRateBps,
    taxAmountCents: line.taxAmountCents,
    totalAmountCents: line.totalAmountCents,
    sortOrder: line.sortOrder,
  }
}

export interface SupplierInvoiceAttachmentUpload {
  storageKey: string
  mimeType?: string | null
  fileSize?: number | null
}

export interface SupplierInvoiceDetailPageProps {
  id: string
  className?: string
  /** Breadcrumb root link + post-delete navigation back to the list. */
  onBack?: () => void
  /** Operator wires this to open the document download endpoint. */
  onDownloadDocument?: () => void
  /**
   * Upload a file's bytes to durable storage (R2) and return its location.
   * The template owns the upload endpoint (e.g. `/api/v1/admin/uploads`). When
   * omitted, the attachment upload control is hidden.
   */
  uploadFile?: (file: File) => Promise<SupplierInvoiceAttachmentUpload>
  /** Operator wires this to open an attachment's download endpoint. */
  onDownloadAttachment?: (attachmentId: string) => void
  /**
   * Resolve searchable options for an allocation target (departure / product /
   * booking). When provided, those targets use a search-and-select combobox in
   * the allocation dialog instead of a raw id field.
   */
  searchTargets?: SupplierInvoiceTargetSearch
  /**
   * List a product's departures for the two-step departure picker (pick product,
   * then departure). When provided alongside `searchTargets`, departure
   * allocation uses product → departure selects instead of a flat list.
   */
  listDeparturesForProduct?: (productId: string, query: string) => Promise<AsyncComboboxOption[]>
  /** Optional invoice-extraction extension point for the edit dialog. */
  extractFromFile?: (file: File) => Promise<SupplierInvoiceExtraction>
  /** Search suppliers for the edit dialog's supplier picker. */
  searchSuppliers?: (query: string) => Promise<AsyncComboboxOption[]>
  /** Create a supplier inline from the edit dialog's supplier picker. */
  createSupplier?: (name: string) => Promise<AsyncComboboxOption | null>
}

export function formatFileSize(bytes: number | null): string {
  if (bytes == null) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium tabular-nums">{value}</span>
    </div>
  )
}

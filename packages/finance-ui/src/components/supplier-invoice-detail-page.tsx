import {
  type ApServiceType,
  type SupplierCostAllocationInput,
  type SupplierCostAllocationRecord,
  type SupplierInvoiceLineInput,
  type SupplierInvoiceLineRecord,
  type SupplierInvoiceStatus,
  useSupplierInvoice,
  useSupplierInvoiceAttachments,
  useSupplierInvoiceMutation,
  useSupplierInvoicePayments,
} from "@voyantjs/finance-react"
import { formatMessage } from "@voyantjs/i18n"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@voyantjs/ui/components/alert-dialog"
import { DatePicker } from "@voyantjs/ui/components/date-picker"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyantjs/ui/components/table"
import { cn } from "@voyantjs/ui/lib/utils"
import { Download, Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"

import { useFinanceUiMessagesOrDefault } from "../i18n/index.js"
import { AsyncCombobox, type AsyncComboboxOption } from "./async-combobox.js"
import { formatInvoiceAmount } from "./invoice-table-parts.js"
import {
  type SupplierInvoiceExtraction,
  SupplierInvoiceFormDialog,
} from "./supplier-invoice-form-dialog.js"

export type SupplierInvoiceTargetSearch = (
  targetType: "departure" | "product" | "booking" | "traveler",
  query: string,
) => Promise<AsyncComboboxOption[]>

const STATUS_VARIANT: Record<
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

const TARGET_TYPES = ["departure", "product", "booking", "traveler", "unattributed"] as const
type TargetType = (typeof TARGET_TYPES)[number]

/**
 * Target types that support search-and-select; others fall back to a text id.
 * Departure search is product-centric (search a product → pick its dated slot),
 * wired by the host. Travelers have no global search, so they stay raw-id.
 */
const SEARCHABLE_TARGETS = new Set<TargetType>(["departure", "product", "booking"])

const SERVICE_TYPES: ApServiceType[] = [
  "transport",
  "flight",
  "accommodation",
  "guide",
  "meal",
  "experience",
  "insurance",
  "other",
]

const PAYMENT_METHODS = ["bank_transfer", "credit_card", "cash", "cheque", "other"] as const

function toCents(major: string): number {
  const n = Number.parseFloat(major)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

function targetIdFor(
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

function allocationToInput(a: SupplierCostAllocationRecord): SupplierCostAllocationInput {
  return {
    targetType: a.targetType,
    amountCents: a.amountCents,
    splitMethod: a.splitMethod,
    ...targetIdFor(a.targetType, a.departureId ?? a.productId ?? a.bookingId ?? a.travelerId ?? ""),
  }
}

function lineToInput(line: SupplierInvoiceLineRecord): SupplierInvoiceLineInput {
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
   * The template owns the upload endpoint (e.g. `/api/v1/uploads`). When
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
  /** Optional invoice-extraction extension point for the edit dialog. */
  extractFromFile?: (file: File) => Promise<SupplierInvoiceExtraction>
  /** Search suppliers for the edit dialog's supplier picker. */
  searchSuppliers?: (query: string) => Promise<AsyncComboboxOption[]>
  /** Create a supplier inline from the edit dialog's supplier picker. */
  createSupplier?: (name: string) => Promise<AsyncComboboxOption | null>
}

function formatFileSize(bytes: number | null): string {
  if (bytes == null) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function SupplierInvoiceDetailPage({
  id,
  className,
  onBack,
  onDownloadDocument,
  uploadFile,
  onDownloadAttachment,
  searchTargets,
  extractFromFile,
  searchSuppliers,
  createSupplier,
}: SupplierInvoiceDetailPageProps) {
  const messages = useFinanceUiMessagesOrDefault()
  const t = messages.supplierInvoiceDetail
  const statusLabels = messages.supplierInvoicesPage.statusLabels

  const { data, isPending, isError } = useSupplierInvoice(id)
  const paymentsQuery = useSupplierInvoicePayments(id)
  const attachmentsQuery = useSupplierInvoiceAttachments(id)
  const { setAllocations, setLines, recordPayment, remove, addAttachment, removeAttachment } =
    useSupplierInvoiceMutation()
  const [uploading, setUploading] = useState(false)

  const invoice = data?.data ?? null
  const currency = invoice?.currency ?? ""

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [lineDialog, setLineDialog] = useState<{ line: SupplierInvoiceLineRecord | null } | null>(
    null,
  )
  const [allocationDialog, setAllocationDialog] = useState<{
    allocation: SupplierCostAllocationRecord | null
  } | null>(null)
  const [paymentOpen, setPaymentOpen] = useState(false)

  if (isPending) return <div className="p-6 text-muted-foreground">{t.loading}</div>
  if (isError || !invoice) return <div className="p-6 text-destructive">{t.notFound}</div>

  // Whole-invoice allocations (per-line allocation is a future mode).
  const allocationList = invoice.allocations.filter((a) => a.supplierInvoiceLineId == null)
  const allocatedCents = allocationList.reduce((sum, a) => sum + a.amountCents, 0)
  const remainderCents = invoice.totalCents - allocatedCents
  const overAllocated = remainderCents < 0

  // Lines + allocations are edited via the full-replace mutations.
  const persistLines = (lines: SupplierInvoiceLineInput[]) => setLines.mutate({ id, lines })
  const removeLine = (lineId: string) =>
    persistLines(invoice.lines.filter((l) => l.id !== lineId).map(lineToInput))

  const persistAllocations = (allocations: SupplierCostAllocationInput[]) =>
    setAllocations.mutate({ id, allocations })
  const removeAllocation = (allocationId: string) =>
    persistAllocations(allocationList.filter((a) => a.id !== allocationId).map(allocationToInput))

  const allocationTargetId = (a: SupplierCostAllocationRecord) =>
    a.departureId ?? a.productId ?? a.bookingId ?? a.travelerId ?? ""

  const methodLabel = (method: string) =>
    (t.payments.methodLabels as Record<string, string>)[method] ?? method

  const payments = paymentsQuery.data?.data ?? []
  const attachments = attachmentsQuery.data?.data ?? []

  const handleUpload = async (files: FileList | null) => {
    if (!uploadFile || !files || files.length === 0) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const uploaded = await uploadFile(file)
        await addAttachment.mutateAsync({
          id,
          input: {
            name: file.name,
            mimeType: uploaded.mimeType ?? file.type ?? null,
            fileSize: uploaded.fileSize ?? file.size,
            storageKey: uploaded.storageKey,
          },
        })
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6 p-6", className)}>
      {/* Actions (breadcrumb lives in the app shell) */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="size-4" />
          {t.actions.edit}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="size-4" />
          {t.actions.delete}
        </Button>
      </div>

      {/* Header */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">{invoice.supplierInvoiceNo}</CardTitle>
            <p className="text-sm text-muted-foreground">{invoice.supplierId}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANT[invoice.status]}>{statusLabels[invoice.status]}</Badge>
            {invoice.storageKey ? (
              <Button variant="outline" size="sm" onClick={onDownloadDocument}>
                <Download className="size-4" />
                {t.document}
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <Field
            label={t.summary.subtotal}
            value={formatInvoiceAmount(invoice.subtotalCents, currency)}
          />
          <Field label={t.summary.tax} value={formatInvoiceAmount(invoice.taxCents, currency)} />
          <Field
            label={t.summary.total}
            value={formatInvoiceAmount(invoice.totalCents, currency)}
          />
          <Field label={t.summary.paid} value={formatInvoiceAmount(invoice.paidCents, currency)} />
          <Field
            label={t.summary.balanceDue}
            value={formatInvoiceAmount(invoice.balanceDueCents, currency)}
          />
          <Field label={t.summary.issueDate} value={invoice.issueDate} />
          <Field label={t.summary.dueDate} value={invoice.dueDate ?? t.summary.noValue} />
        </CardContent>
      </Card>

      {/* Lines */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t.lines.title}</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setLineDialog({ line: null })}>
            <Plus className="size-4" />
            {t.lines.add}
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.lines.description}</TableHead>
                <TableHead>{t.lines.service}</TableHead>
                <TableHead className="text-right">{t.lines.qty}</TableHead>
                <TableHead className="text-right">{t.lines.unit}</TableHead>
                <TableHead className="text-right">{t.lines.tax}</TableHead>
                <TableHead className="text-right">{t.lines.total}</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.lines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    {t.lines.empty}
                  </TableCell>
                </TableRow>
              ) : (
                invoice.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>{line.description}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.lineForm.serviceTypeLabels[line.serviceType]}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{line.quantity}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatInvoiceAmount(line.unitAmountCents, currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatInvoiceAmount(line.taxAmountCents, currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatInvoiceAmount(line.totalAmountCents, currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setLineDialog({ line })}
                        aria-label={t.lines.edit}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLine(line.id)}
                        aria-label={t.lines.remove}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Cost allocation */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t.allocation.title}</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAllocationDialog({ allocation: null })}
          >
            <Plus className="size-4" />
            {t.allocation.add}
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.allocation.target}</TableHead>
                <TableHead>{formatMessage(t.allocation.idLabel, { type: "" }).trim()}</TableHead>
                <TableHead className="text-right">{t.payments.amount}</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {allocationList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    {t.allocation.none}
                  </TableCell>
                </TableRow>
              ) : (
                allocationList.map((allocation) => (
                  <TableRow key={allocation.id}>
                    <TableCell>{t.allocation.targetTypeLabels[allocation.targetType]}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {allocationTargetId(allocation) || "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatInvoiceAmount(allocation.amountCents, currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setAllocationDialog({ allocation })}
                        aria-label={t.actions.edit}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeAllocation(allocation.id)}
                        aria-label={t.lines.remove}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <div className="border-t pt-3 text-sm">
            <span className={cn("text-muted-foreground", overAllocated && "text-destructive")}>
              {overAllocated
                ? formatMessage(t.allocation.overAllocated, {
                    amount: formatInvoiceAmount(-remainderCents, currency),
                  })
                : formatMessage(t.allocation.remainder, {
                    amount: formatInvoiceAmount(remainderCents, currency),
                  })}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Payments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t.payments.title}</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setPaymentOpen(true)}>
            <Plus className="size-4" />
            {t.payments.record}
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.payments.date}</TableHead>
                <TableHead>{t.payments.method}</TableHead>
                <TableHead>{t.payments.status}</TableHead>
                <TableHead className="text-right">{t.payments.amount}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    {t.payments.empty}
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{payment.paymentDate}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {methodLabel(payment.paymentMethod)}
                    </TableCell>
                    <TableCell>{payment.status}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatInvoiceAmount(payment.amountCents, payment.currency)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Attachments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t.attachments.title}</CardTitle>
          {uploadFile ? (
            <label className="cursor-pointer">
              <span className="inline-flex h-8 items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-muted">
                <Plus className="size-4" />
                {uploading ? t.attachments.uploading : t.attachments.upload}
              </span>
              <input
                type="file"
                multiple
                className="sr-only"
                disabled={uploading}
                onChange={(e) => {
                  void handleUpload(e.target.files)
                  e.target.value = ""
                }}
              />
            </label>
          ) : null}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.attachments.name}</TableHead>
                <TableHead className="text-right">{t.attachments.size}</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {attachments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    {t.attachments.empty}
                  </TableCell>
                </TableRow>
              ) : (
                attachments.map((attachment) => (
                  <TableRow key={attachment.id}>
                    <TableCell>{attachment.name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatFileSize(attachment.fileSize)}
                    </TableCell>
                    <TableCell className="text-right">
                      {onDownloadAttachment && attachment.storageKey ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDownloadAttachment(attachment.id)}
                          aria-label={t.attachments.download}
                        >
                          <Download className="size-4" />
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeAttachment.mutate({ id, attachmentId: attachment.id })}
                        aria-label={t.attachments.remove}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <SupplierInvoiceFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        invoice={invoice}
        extractFromFile={extractFromFile}
        searchSuppliers={searchSuppliers}
        createSupplier={createSupplier}
      />

      <LineDialog
        open={lineDialog != null}
        line={lineDialog?.line ?? null}
        currency={currency}
        pending={setLines.isPending}
        onOpenChange={(open) => setLineDialog(open ? (lineDialog ?? { line: null }) : null)}
        onSubmit={(input) => {
          const existing = invoice.lines.map(lineToInput)
          const editing = lineDialog?.line
          const next = editing
            ? invoice.lines.map((l) => (l.id === editing.id ? input : lineToInput(l)))
            : [...existing, input]
          persistLines(next)
          setLineDialog(null)
        }}
      />

      <AllocationDialog
        open={allocationDialog != null}
        allocation={allocationDialog?.allocation ?? null}
        currency={currency}
        pending={setAllocations.isPending}
        searchTargets={searchTargets}
        onOpenChange={(open) =>
          setAllocationDialog(open ? (allocationDialog ?? { allocation: null }) : null)
        }
        onSubmit={(input) => {
          const editing = allocationDialog?.allocation
          const next = editing
            ? allocationList.map((a) => (a.id === editing.id ? input : allocationToInput(a)))
            : [...allocationList.map(allocationToInput), input]
          persistAllocations(next)
          setAllocationDialog(null)
        }}
      />

      <PaymentDialog
        open={paymentOpen}
        currency={currency}
        pending={recordPayment.isPending}
        onOpenChange={setPaymentOpen}
        onSubmit={(input) => {
          recordPayment.mutate(
            { id, input: { ...input, currency } },
            { onSuccess: () => setPaymentOpen(false) },
          )
        }}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{t.deleteDialog.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.deleteDialog.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => remove.mutate(id, { onSuccess: () => onBack?.() })}
              disabled={remove.isPending}
            >
              {t.deleteDialog.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ---------- line dialog ----------

function LineDialog({
  open,
  line,
  currency,
  pending,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  line: SupplierInvoiceLineRecord | null
  currency: string
  pending: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: SupplierInvoiceLineInput) => void
}) {
  const t = useFinanceUiMessagesOrDefault().supplierInvoiceDetail.lineForm
  const [description, setDescription] = useState("")
  const [serviceType, setServiceType] = useState<ApServiceType>("other")
  const [quantity, setQuantity] = useState("1")
  const [unit, setUnit] = useState("")
  const [tax, setTax] = useState("")
  const [total, setTotal] = useState("")

  // Seed when (re)opened for a specific line.
  const seedKey = open ? (line?.id ?? "new") : "closed"
  const [seeded, setSeeded] = useState<string>("closed")
  if (seedKey !== seeded) {
    setSeeded(seedKey)
    setDescription(line?.description ?? "")
    setServiceType(line?.serviceType ?? "other")
    setQuantity(String(line?.quantity ?? 1))
    setUnit(line ? (line.unitAmountCents / 100).toFixed(2) : "")
    setTax(line ? (line.taxAmountCents / 100).toFixed(2) : "")
    setTotal(line ? (line.totalAmountCents / 100).toFixed(2) : "")
  }

  const submit = () => {
    if (!description.trim()) return
    onSubmit({
      description: description.trim(),
      serviceType,
      quantity: Math.max(1, Number.parseInt(quantity, 10) || 1),
      unitAmountCents: toCents(unit),
      taxAmountCents: toCents(tax),
      totalAmountCents: toCents(total),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{line ? t.editTitle : t.addTitle}</DialogTitle>
        </DialogHeader>
        <DialogBody className="grid grid-cols-2 gap-3">
          <div className="col-span-2 flex flex-col gap-2">
            <Label>{t.description}</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t.serviceType}</Label>
            <Select
              value={serviceType}
              onValueChange={(v) => setServiceType((v as ApServiceType) ?? "other")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_TYPES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t.serviceTypeLabels[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t.quantity}</Label>
            <Input
              inputMode="numeric"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{`${t.unitAmount} (${currency})`}</Label>
            <Input inputMode="decimal" value={unit} onChange={(e) => setUnit(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{`${t.taxAmount} (${currency})`}</Label>
            <Input inputMode="decimal" value={tax} onChange={(e) => setTax(e.target.value)} />
          </div>
          <div className="col-span-2 flex flex-col gap-2">
            <Label>{`${t.total} (${currency})`}</Label>
            <Input inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" disabled={!description.trim() || pending} onClick={submit}>
            {t.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------- allocation dialog ----------

function AllocationDialog({
  open,
  allocation,
  currency,
  pending,
  searchTargets,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  allocation: SupplierCostAllocationRecord | null
  currency: string
  pending: boolean
  searchTargets?: SupplierInvoiceTargetSearch
  onOpenChange: (open: boolean) => void
  onSubmit: (input: SupplierCostAllocationInput) => void
}) {
  const t = useFinanceUiMessagesOrDefault().supplierInvoiceDetail.allocation
  const [targetType, setTargetType] = useState<TargetType>("departure")
  const [targetId, setTargetId] = useState("")
  const [amount, setAmount] = useState("")

  const seedKey = open ? (allocation?.id ?? "new") : "closed"
  const [seeded, setSeeded] = useState("closed")
  if (seedKey !== seeded) {
    setSeeded(seedKey)
    setTargetType(allocation?.targetType ?? "departure")
    setTargetId(
      allocation
        ? (allocation.departureId ??
            allocation.productId ??
            allocation.bookingId ??
            allocation.travelerId ??
            "")
        : "",
    )
    setAmount(allocation ? (allocation.amountCents / 100).toFixed(2) : "")
  }

  const submit = () => {
    if (!amount) return
    onSubmit({
      targetType,
      amountCents: toCents(amount),
      splitMethod: "manual",
      ...targetIdFor(targetType, targetId.trim()),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.add}</DialogTitle>
        </DialogHeader>
        <DialogBody className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label>{t.target}</Label>
            <Select
              value={targetType}
              onValueChange={(v) => {
                setTargetType((v as TargetType) ?? "departure")
                setTargetId("")
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGET_TYPES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t.targetTypeLabels[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>{formatMessage(t.amountLabel, { currency })}</Label>
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          {targetType !== "unattributed" ? (
            <div className="col-span-2 flex flex-col gap-2">
              <Label>{formatMessage(t.idLabel, { type: t.targetTypeLabels[targetType] })}</Label>
              {searchTargets && SEARCHABLE_TARGETS.has(targetType) ? (
                <AsyncCombobox
                  value={targetId || null}
                  onChange={(v) => setTargetId(v ?? "")}
                  search={(query) =>
                    searchTargets(
                      targetType as "departure" | "product" | "booking" | "traveler",
                      query,
                    )
                  }
                />
              ) : (
                <Input value={targetId} onChange={(e) => setTargetId(e.target.value)} />
              )}
            </div>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            disabled={!amount || (targetType !== "unattributed" && !targetId.trim()) || pending}
            onClick={submit}
          >
            {pending ? t.saving : t.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------- payment dialog ----------

function PaymentDialog({
  open,
  currency,
  pending,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  currency: string
  pending: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: {
    amountCents: number
    paymentMethod: string
    status: "completed"
    paymentDate: string
  }) => void
}) {
  const t = useFinanceUiMessagesOrDefault().supplierInvoiceDetail.payments
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState<string>("bank_transfer")
  const [date, setDate] = useState("")

  const seedKey = open ? "open" : "closed"
  const [seeded, setSeeded] = useState("closed")
  if (seedKey !== seeded) {
    setSeeded(seedKey)
    if (open) {
      setAmount("")
      setMethod("bank_transfer")
      setDate("")
    }
  }

  const submit = () => {
    if (!amount) return
    onSubmit({
      amountCents: toCents(amount),
      paymentMethod: method,
      status: "completed",
      paymentDate: date || new Date().toISOString().slice(0, 10),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.recordTitle}</DialogTitle>
        </DialogHeader>
        <DialogBody className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label>{formatMessage(t.amountLabel, { currency })}</Label>
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t.methodLabel}</Label>
            <Select value={method} onValueChange={(v) => setMethod(v ?? "other")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {t.methodLabels[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 flex flex-col gap-2">
            <Label>{t.dateLabel}</Label>
            <DatePicker
              value={date || null}
              onChange={(v) => setDate(v ?? "")}
              className="w-full"
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" disabled={!amount || pending} onClick={submit}>
            {pending ? t.recording : t.record}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium tabular-nums">{value}</span>
    </div>
  )
}

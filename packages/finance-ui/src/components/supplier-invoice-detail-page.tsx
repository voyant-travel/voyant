import {
  type ApServiceType,
  type SupplierCostAllocationInput,
  type SupplierInvoiceLineInput,
  type SupplierInvoiceLineRecord,
  type SupplierInvoiceStatus,
  useSupplierInvoice,
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
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@voyantjs/ui/components/breadcrumb"
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
import { formatInvoiceAmount } from "./invoice-table-parts.js"
import { SupplierInvoiceFormDialog } from "./supplier-invoice-form-dialog.js"

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

interface AllocationDraft {
  key: string
  targetType: TargetType
  targetId: string
  amountMajor: string
}

let allocationRowSeq = 0
function newAllocationKey(): string {
  allocationRowSeq += 1
  return `alloc-${allocationRowSeq}`
}

function toCents(major: string): number {
  const n = Number.parseFloat(major)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

function targetIdFor(draft: AllocationDraft): Partial<SupplierCostAllocationInput> {
  switch (draft.targetType) {
    case "departure":
      return { departureId: draft.targetId }
    case "product":
      return { productId: draft.targetId }
    case "booking":
      return { bookingId: draft.targetId }
    case "traveler":
      return { travelerId: draft.targetId }
    default:
      return {}
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

export interface SupplierInvoiceDetailPageProps {
  id: string
  className?: string
  /** Breadcrumb root link + post-delete navigation back to the list. */
  onBack?: () => void
  /** Operator wires this to open the document download endpoint. */
  onDownloadDocument?: () => void
}

export function SupplierInvoiceDetailPage({
  id,
  className,
  onBack,
  onDownloadDocument,
}: SupplierInvoiceDetailPageProps) {
  const messages = useFinanceUiMessagesOrDefault()
  const t = messages.supplierInvoiceDetail
  const statusLabels = messages.supplierInvoicesPage.statusLabels

  const { data, isPending, isError } = useSupplierInvoice(id)
  const paymentsQuery = useSupplierInvoicePayments(id)
  const { setAllocations, setLines, recordPayment, remove } = useSupplierInvoiceMutation()

  const invoice = data?.data ?? null
  const currency = invoice?.currency ?? ""

  const [drafts, setDrafts] = useState<AllocationDraft[] | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [lineDialog, setLineDialog] = useState<{ line: SupplierInvoiceLineRecord | null } | null>(
    null,
  )
  const [paymentOpen, setPaymentOpen] = useState(false)

  if (isPending) return <div className="p-6 text-muted-foreground">{t.loading}</div>
  if (isError || !invoice) return <div className="p-6 text-destructive">{t.notFound}</div>

  const rows: AllocationDraft[] =
    drafts ??
    invoice.allocations
      .filter((a) => a.supplierInvoiceLineId == null)
      .map((a) => ({
        key: a.id,
        targetType: a.targetType,
        targetId: a.departureId ?? a.productId ?? a.bookingId ?? a.travelerId ?? "",
        amountMajor: (a.amountCents / 100).toFixed(2),
      }))

  const allocatedCents = rows.reduce((sum, r) => sum + toCents(r.amountMajor), 0)
  const remainderCents = invoice.totalCents - allocatedCents
  const overAllocated = remainderCents < 0

  const setRows = (next: AllocationDraft[]) => setDrafts(next)
  const updateRow = (index: number, patch: Partial<AllocationDraft>) =>
    setRows(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))

  const saveAllocations = () => {
    const allocations: SupplierCostAllocationInput[] = rows
      .filter((r) => toCents(r.amountMajor) !== 0)
      .map((r) => ({
        targetType: r.targetType,
        amountCents: toCents(r.amountMajor),
        splitMethod: "manual",
        ...targetIdFor(r),
      }))
    setAllocations.mutate({ id, allocations })
  }

  // Lines are edited via the full-replace setLines mutation.
  const persistLines = (lines: SupplierInvoiceLineInput[]) => setLines.mutate({ id, lines })
  const removeLine = (lineId: string) =>
    persistLines(invoice.lines.filter((l) => l.id !== lineId).map(lineToInput))

  const methodLabel = (method: string) =>
    (t.payments.methodLabels as Record<string, string>)[method] ?? method

  const payments = paymentsQuery.data?.data ?? []

  return (
    <div className={cn("flex flex-col gap-6 p-6", className)}>
      {/* Breadcrumb + actions */}
      <div className="flex items-center justify-between gap-2">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              {onBack ? (
                <BreadcrumbLink render={<button type="button" onClick={onBack} />}>
                  {t.breadcrumbRoot}
                </BreadcrumbLink>
              ) : (
                <span className="text-muted-foreground">{t.breadcrumbRoot}</span>
              )}
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{invoice.supplierInvoiceNo}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" />
            {t.actions.edit}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="size-4" />
            {t.actions.delete}
          </Button>
        </div>
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

      {/* Allocation editor */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t.allocation.title}</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setRows([
                ...rows,
                { key: newAllocationKey(), targetType: "departure", targetId: "", amountMajor: "" },
              ])
            }
          >
            <Plus className="size-4" />
            {t.allocation.add}
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.allocation.none}</p>
          ) : (
            rows.map((row, index) => (
              <div key={row.key} className="flex flex-wrap items-end gap-2">
                <div className="w-40">
                  <Label className="text-xs">{t.allocation.target}</Label>
                  <Select
                    value={row.targetType}
                    onValueChange={(value) =>
                      updateRow(index, { targetType: (value as TargetType) ?? "departure" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TARGET_TYPES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {t.allocation.targetTypeLabels[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {row.targetType !== "unattributed" ? (
                  <div className="flex-1 min-w-48">
                    <Label className="text-xs">
                      {formatMessage(t.allocation.idLabel, {
                        type: t.allocation.targetTypeLabels[row.targetType],
                      })}
                    </Label>
                    <Input
                      value={row.targetId}
                      onChange={(event) => updateRow(index, { targetId: event.target.value })}
                    />
                  </div>
                ) : null}
                <div className="w-32">
                  <Label className="text-xs">
                    {formatMessage(t.allocation.amountLabel, { currency })}
                  </Label>
                  <Input
                    inputMode="decimal"
                    value={row.amountMajor}
                    onChange={(event) => updateRow(index, { amountMajor: event.target.value })}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRows(rows.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))
          )}

          <div className="flex items-center justify-between border-t pt-3 text-sm">
            <span className={cn("text-muted-foreground", overAllocated && "text-destructive")}>
              {overAllocated
                ? formatMessage(t.allocation.overAllocated, {
                    amount: formatInvoiceAmount(-remainderCents, currency),
                  })
                : formatMessage(t.allocation.remainder, {
                    amount: formatInvoiceAmount(remainderCents, currency),
                  })}
            </span>
            <Button
              size="sm"
              disabled={overAllocated || setAllocations.isPending}
              onClick={saveAllocations}
            >
              {setAllocations.isPending ? t.allocation.saving : t.allocation.save}
            </Button>
          </div>
          {setAllocations.isError ? (
            <p className="text-sm text-destructive">
              {(setAllocations.error as Error)?.message ?? t.allocation.saveFailed}
            </p>
          ) : null}
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

      {/* Dialogs */}
      <SupplierInvoiceFormDialog open={editOpen} onOpenChange={setEditOpen} invoice={invoice} />

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
          <div className="col-span-2">
            <Label className="text-xs">{t.description}</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{t.serviceType}</Label>
            <Select
              value={serviceType}
              onValueChange={(v) => setServiceType((v as ApServiceType) ?? "other")}
            >
              <SelectTrigger>
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
          <div>
            <Label className="text-xs">{t.quantity}</Label>
            <Input
              inputMode="numeric"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">{`${t.unitAmount} (${currency})`}</Label>
            <Input inputMode="decimal" value={unit} onChange={(e) => setUnit(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{`${t.taxAmount} (${currency})`}</Label>
            <Input inputMode="decimal" value={tax} onChange={(e) => setTax(e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">{`${t.total} (${currency})`}</Label>
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
          <div>
            <Label className="text-xs">{formatMessage(t.amountLabel, { currency })}</Label>
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">{t.methodLabel}</Label>
            <Select value={method} onValueChange={(v) => setMethod(v ?? "other")}>
              <SelectTrigger>
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
          <div className="col-span-2">
            <Label className="text-xs">{t.dateLabel}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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

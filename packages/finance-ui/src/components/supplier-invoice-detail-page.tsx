import {
  type SupplierCostAllocationInput,
  type SupplierInvoiceStatus,
  useSupplierInvoice,
  useSupplierInvoiceMutation,
  useSupplierInvoicePayments,
} from "@voyantjs/finance-react"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyantjs/ui/components/table"
import { cn } from "@voyantjs/ui/lib/utils"
import { Download, Plus, Trash2 } from "lucide-react"
import { useState } from "react"

import { formatInvoiceAmount } from "./invoice-table-parts.js"

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

const PAYMENT_METHODS = ["bank_transfer", "credit_card", "cash", "cheque", "other"] as const

/** Editable allocation row — whole-invoice mode (one target id per row). */
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

export interface SupplierInvoiceDetailPageProps {
  id: string
  className?: string
  /** Operator wires this to open the document download endpoint. */
  onDownloadDocument?: () => void
}

export function SupplierInvoiceDetailPage({
  id,
  className,
  onDownloadDocument,
}: SupplierInvoiceDetailPageProps) {
  const { data, isPending, isError } = useSupplierInvoice(id)
  const paymentsQuery = useSupplierInvoicePayments(id)
  const { setAllocations, recordPayment } = useSupplierInvoiceMutation()

  const invoice = data?.data ?? null
  const currency = invoice?.currency ?? ""

  const [drafts, setDrafts] = useState<AllocationDraft[] | null>(null)
  const [payAmount, setPayAmount] = useState("")
  const [payMethod, setPayMethod] = useState<string>("bank_transfer")
  const [payDate, setPayDate] = useState(() => "")

  if (isPending) return <div className="p-6 text-muted-foreground">Loading…</div>
  if (isError || !invoice)
    return <div className="p-6 text-destructive">Supplier invoice not found.</div>

  // Lazily seed the allocation editor from the persisted whole-invoice allocations.
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

  const submitPayment = () => {
    if (!payAmount) return
    recordPayment.mutate(
      {
        id,
        input: {
          amountCents: toCents(payAmount),
          currency,
          paymentMethod: payMethod,
          status: "completed",
          paymentDate: payDate || new Date().toISOString().slice(0, 10),
        },
      },
      {
        onSuccess: () => {
          setPayAmount("")
          setPayDate("")
        },
      },
    )
  }

  const payments = paymentsQuery.data?.data ?? []

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Header */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">{invoice.supplierInvoiceNo}</CardTitle>
            <p className="text-sm text-muted-foreground">{invoice.supplierId}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANT[invoice.status]}>{invoice.status}</Badge>
            {invoice.storageKey ? (
              <Button variant="outline" size="sm" onClick={onDownloadDocument}>
                <Download className="size-4" />
                Document
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <Field label="Subtotal" value={formatInvoiceAmount(invoice.subtotalCents, currency)} />
          <Field label="Tax" value={formatInvoiceAmount(invoice.taxCents, currency)} />
          <Field label="Total" value={formatInvoiceAmount(invoice.totalCents, currency)} />
          <Field label="Paid" value={formatInvoiceAmount(invoice.paidCents, currency)} />
          <Field
            label="Balance due"
            value={formatInvoiceAmount(invoice.balanceDueCents, currency)}
          />
          <Field label="Issue date" value={invoice.issueDate} />
          <Field label="Due date" value={invoice.dueDate ?? "—"} />
        </CardContent>
      </Card>

      {/* Lines */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lines</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Service</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.lines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No lines.
                  </TableCell>
                </TableRow>
              ) : (
                invoice.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>{line.description}</TableCell>
                    <TableCell className="text-muted-foreground">{line.serviceType}</TableCell>
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
          <CardTitle className="text-base">Cost allocation</CardTitle>
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
            Add allocation
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No allocations — this invoice's cost is unattributed.
            </p>
          ) : (
            rows.map((row, index) => (
              <div key={row.key} className="flex flex-wrap items-end gap-2">
                <div className="w-40">
                  <Label className="text-xs">Target</Label>
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
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {row.targetType !== "unattributed" ? (
                  <div className="flex-1 min-w-48">
                    <Label className="text-xs">{`${row.targetType} id`}</Label>
                    <Input
                      value={row.targetId}
                      onChange={(event) => updateRow(index, { targetId: event.target.value })}
                    />
                  </div>
                ) : null}
                <div className="w-32">
                  <Label className="text-xs">{`Amount (${currency})`}</Label>
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
                ? `Over-allocated by ${formatInvoiceAmount(-remainderCents, currency)}`
                : `Unattributed remainder: ${formatInvoiceAmount(remainderCents, currency)}`}
            </span>
            <Button
              size="sm"
              disabled={overAllocated || setAllocations.isPending}
              onClick={saveAllocations}
            >
              {setAllocations.isPending ? "Saving…" : "Save allocations"}
            </Button>
          </div>
          {setAllocations.isError ? (
            <p className="text-sm text-destructive">
              {(setAllocations.error as Error)?.message ?? "Failed to save allocations."}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Payments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payments</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No payments recorded.
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{payment.paymentDate}</TableCell>
                    <TableCell className="text-muted-foreground">{payment.paymentMethod}</TableCell>
                    <TableCell>{payment.status}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatInvoiceAmount(payment.amountCents, payment.currency)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <div className="flex flex-wrap items-end gap-2 border-t pt-3">
            <div className="w-32">
              <Label className="text-xs">{`Amount (${currency})`}</Label>
              <Input
                inputMode="decimal"
                value={payAmount}
                onChange={(event) => setPayAmount(event.target.value)}
              />
            </div>
            <div className="w-40">
              <Label className="text-xs">Method</Label>
              <Select value={payMethod} onValueChange={(value) => setPayMethod(value ?? "other")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                value={payDate}
                onChange={(event) => setPayDate(event.target.value)}
              />
            </div>
            <Button
              size="sm"
              disabled={!payAmount || recordPayment.isPending}
              onClick={submitPayment}
            >
              {recordPayment.isPending ? "Recording…" : "Record payment"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
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

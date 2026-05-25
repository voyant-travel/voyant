import { useNavigate } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import { useInvoices, useSupplierPayments } from "@voyantjs/finance-react"
import { InvoiceDialog } from "@voyantjs/finance-ui/components/invoice-dialog"
import { InvoiceNumberSeriesPage } from "@voyantjs/finance-ui/components/invoice-number-series-page"
import { SupplierPaymentDialog } from "@voyantjs/finance-ui/components/supplier-payment-dialog"
import { DataTableColumnHeader } from "@voyantjs/ui/components/data-table-column-header"
import { Loader2, Plus, Search } from "lucide-react"
import { useMemo, useState } from "react"
import { Badge, Button, Input } from "@/components/ui"
import { DataTable } from "@/components/ui/data-table"
import { type AdminMessages, useAdminMessages } from "@/lib/admin-i18n"
import {
  formatAmount,
  type InvoiceRow,
  invoiceStatusVariant,
  paymentStatusVariant,
  type SupplierPaymentRow,
} from "./finance-shared"

function getInvoiceStatusLabel(messages: AdminMessages, status: string): string {
  switch (status) {
    case "draft":
      return messages.finance.invoiceStatusDraft
    case "issued":
      return messages.finance.invoiceStatusIssued
    case "partially_paid":
      return messages.finance.invoiceStatusPartiallyPaid
    case "paid":
      return messages.finance.invoiceStatusPaid
    case "overdue":
      return messages.finance.invoiceStatusOverdue
    case "void":
      return messages.finance.invoiceStatusVoid
    default:
      return status.replace(/_/g, " ")
  }
}

function getPaymentStatusLabel(messages: AdminMessages, status: string): string {
  switch (status) {
    case "pending":
      return messages.finance.paymentStatusPending
    case "completed":
      return messages.finance.paymentStatusCompleted
    case "failed":
      return messages.finance.paymentStatusFailed
    case "refunded":
      return messages.finance.paymentStatusRefunded
    default:
      return status.replace(/_/g, " ")
  }
}

function getInvoiceColumns(messages: AdminMessages): ColumnDef<InvoiceRow>[] {
  return [
    {
      accessorKey: "invoiceNumber",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={messages.finance.invoiceNumberColumn} />
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={messages.finance.statusColumn} />
      ),
      cell: ({ row }) => (
        <Badge
          variant={invoiceStatusVariant[row.original.status] ?? "secondary"}
          className="capitalize"
        >
          {getInvoiceStatusLabel(messages, row.original.status)}
        </Badge>
      ),
    },
    {
      accessorKey: "totalCents",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={messages.finance.totalColumn} />
      ),
      cell: ({ row }) => (
        <span className="font-mono">
          {formatAmount(row.original.totalCents, row.original.currency)}
        </span>
      ),
    },
    {
      accessorKey: "paidCents",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={messages.finance.paidColumn} />
      ),
      cell: ({ row }) => (
        <span className="font-mono">
          {formatAmount(row.original.paidCents, row.original.currency)}
        </span>
      ),
    },
    {
      accessorKey: "balanceDueCents",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={messages.finance.balanceDueColumn} />
      ),
      cell: ({ row }) => (
        <span className="font-mono">
          {formatAmount(row.original.balanceDueCents, row.original.currency)}
        </span>
      ),
    },
    {
      accessorKey: "dueDate",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={messages.finance.dueDateColumn} />
      ),
    },
  ]
}

function getSupplierPaymentColumns(messages: AdminMessages): ColumnDef<SupplierPaymentRow>[] {
  const noValue = messages.finance.detailSections.noValue

  return [
    {
      accessorKey: "bookingId",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={messages.finance.bookingColumn} />
      ),
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.bookingId}</span>,
    },
    {
      accessorKey: "supplierId",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={messages.finance.supplierColumn} />
      ),
      cell: ({ row }) =>
        row.original.supplierId ? (
          <span className="font-mono text-xs">{row.original.supplierId}</span>
        ) : (
          noValue
        ),
    },
    {
      accessorKey: "amountCents",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={messages.finance.amountColumn} />
      ),
      cell: ({ row }) => (
        <span className="font-mono">
          {formatAmount(row.original.amountCents, row.original.currency)}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={messages.finance.statusColumn} />
      ),
      cell: ({ row }) => (
        <Badge
          variant={paymentStatusVariant[row.original.status] ?? "secondary"}
          className="capitalize"
        >
          {getPaymentStatusLabel(messages, row.original.status)}
        </Badge>
      ),
    },
    {
      accessorKey: "paymentDate",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={messages.finance.dateColumn} />
      ),
    },
    {
      accessorKey: "referenceNumber",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={messages.finance.referenceColumn} />
      ),
      cell: ({ row }) => row.original.referenceNumber ?? noValue,
    },
  ]
}

const PAGE_SIZE = 25

export function FinancePage() {
  const messages = useAdminMessages()
  const navigate = useNavigate()
  const [tab, setTab] = useState<"invoices" | "supplier-payments" | "number-series">("invoices")
  const [search, setSearch] = useState("")
  const [invoicePageIndex, setInvoicePageIndex] = useState(0)
  const [supplierPaymentPageIndex, setSupplierPaymentPageIndex] = useState(0)
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false)
  const [supplierPaymentDialogOpen, setSupplierPaymentDialogOpen] = useState(false)

  const { data: invoiceData, isPending: invoicesPending } = useInvoices({
    search: search || undefined,
    limit: PAGE_SIZE,
    offset: invoicePageIndex * PAGE_SIZE,
    enabled: tab === "invoices",
  })

  const { data: supplierPaymentData, isPending: supplierPaymentsPending } = useSupplierPayments({
    limit: PAGE_SIZE,
    offset: supplierPaymentPageIndex * PAGE_SIZE,
    enabled: tab === "supplier-payments",
  })

  const invoiceColumns = useMemo(() => getInvoiceColumns(messages), [messages])
  const supplierPaymentColumns = useMemo(() => getSupplierPaymentColumns(messages), [messages])

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{messages.finance.title}</h1>
          <p className="text-sm text-muted-foreground">{messages.finance.description}</p>
        </div>
        {tab === "invoices" ? (
          <Button onClick={() => setInvoiceDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {messages.finance.newInvoice}
          </Button>
        ) : tab === "supplier-payments" ? (
          <Button onClick={() => setSupplierPaymentDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {messages.finance.recordSupplierPayment}
          </Button>
        ) : null}
      </div>

      <div className="flex gap-1 border-b">
        <button
          type="button"
          onClick={() => {
            setTab("invoices")
            setInvoicePageIndex(0)
          }}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === "invoices"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {messages.finance.invoicesTab}
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("supplier-payments")
            setSupplierPaymentPageIndex(0)
          }}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === "supplier-payments"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {messages.finance.supplierPaymentsTab}
        </button>
        <button
          type="button"
          onClick={() => setTab("number-series")}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === "number-series"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {messages.finance.numberSeriesTab}
        </button>
      </div>

      {tab === "number-series" ? (
        <InvoiceNumberSeriesPage className="p-0" />
      ) : tab === "invoices" ? (
        <>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={messages.finance.searchInvoicesPlaceholder}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setInvoicePageIndex(0)
              }}
              className="pl-9"
            />
          </div>

          {invoicesPending ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <DataTable
              columns={invoiceColumns}
              data={invoiceData?.data ?? []}
              pagination={{
                pageIndex: invoicePageIndex,
                pageSize: PAGE_SIZE,
                total: invoiceData?.total ?? 0,
                onPageIndexChange: setInvoicePageIndex,
              }}
              onRowClick={(row) => {
                void navigate({ to: "/finance/invoices/$id", params: { id: row.original.id } })
              }}
            />
          )}
        </>
      ) : supplierPaymentsPending ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DataTable
          columns={supplierPaymentColumns}
          data={supplierPaymentData?.data ?? []}
          pagination={{
            pageIndex: supplierPaymentPageIndex,
            pageSize: PAGE_SIZE,
            total: supplierPaymentData?.total ?? 0,
            onPageIndexChange: setSupplierPaymentPageIndex,
          }}
        />
      )}

      <InvoiceDialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen} />
      <SupplierPaymentDialog
        open={supplierPaymentDialogOpen}
        onOpenChange={setSupplierPaymentDialogOpen}
      />
    </div>
  )
}

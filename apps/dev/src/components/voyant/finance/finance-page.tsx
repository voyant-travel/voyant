import { useNavigate } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import { useInvoices, useSupplierPayments } from "@voyantjs/finance-react"
import { InvoiceDialog } from "@voyantjs/finance-ui/components/invoice-dialog"
import { SupplierPaymentDialog } from "@voyantjs/finance-ui/components/supplier-payment-dialog"
import { DataTableColumnHeader } from "@voyantjs/ui/components/data-table-column-header"
import { Loader2, Plus, Search } from "lucide-react"
import { useState } from "react"
import { Badge, Button, Input } from "@/components/ui"
import { DataTable } from "@/components/ui/data-table"
import {
  formatAmount,
  formatStatus,
  type InvoiceRow,
  invoiceStatusVariant,
  paymentStatusVariant,
  type SupplierPaymentRow,
} from "./finance-shared"

const invoiceColumns: ColumnDef<InvoiceRow>[] = [
  {
    accessorKey: "invoiceNumber",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Invoice #" />,
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => (
      <Badge
        variant={invoiceStatusVariant[row.original.status] ?? "secondary"}
        className="capitalize"
      >
        {formatStatus(row.original.status)}
      </Badge>
    ),
  },
  {
    accessorKey: "totalCents",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Total" />,
    cell: ({ row }) => (
      <span className="font-mono">
        {formatAmount(row.original.totalCents, row.original.currency)}
      </span>
    ),
  },
  {
    accessorKey: "paidCents",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Paid" />,
    cell: ({ row }) => (
      <span className="font-mono">
        {formatAmount(row.original.paidCents, row.original.currency)}
      </span>
    ),
  },
  {
    accessorKey: "balanceDueCents",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Balance Due" />,
    cell: ({ row }) => (
      <span className="font-mono">
        {formatAmount(row.original.balanceDueCents, row.original.currency)}
      </span>
    ),
  },
  {
    accessorKey: "dueDate",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Due Date" />,
  },
]

const supplierPaymentColumns: ColumnDef<SupplierPaymentRow>[] = [
  {
    accessorKey: "bookingId",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Booking" />,
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.bookingId}</span>,
  },
  {
    accessorKey: "supplierId",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Supplier" />,
    cell: ({ row }) =>
      row.original.supplierId ? (
        <span className="font-mono text-xs">{row.original.supplierId}</span>
      ) : (
        "-"
      ),
  },
  {
    accessorKey: "amountCents",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
    cell: ({ row }) => (
      <span className="font-mono">
        {formatAmount(row.original.amountCents, row.original.currency)}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => (
      <Badge
        variant={paymentStatusVariant[row.original.status] ?? "secondary"}
        className="capitalize"
      >
        {row.original.status}
      </Badge>
    ),
  },
  {
    accessorKey: "paymentDate",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
  },
  {
    accessorKey: "referenceNumber",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Reference" />,
    cell: ({ row }) => row.original.referenceNumber ?? "-",
  },
]

const PAGE_SIZE = 25

export function FinancePage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<"invoices" | "supplier-payments">("invoices")
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

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
          <p className="text-sm text-muted-foreground">
            Manage invoices, payments, and supplier finances.
          </p>
        </div>
        {tab === "invoices" ? (
          <Button onClick={() => setInvoiceDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Invoice
          </Button>
        ) : (
          <Button onClick={() => setSupplierPaymentDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Record Supplier Payment
          </Button>
        )}
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
          Invoices
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
          Supplier Payments
        </button>
      </div>

      {tab === "invoices" ? (
        <>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search invoices..."
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

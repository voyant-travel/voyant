import { Skeleton } from "@voyantjs/ui/components/skeleton"
import { Table, TableHead, TableHeader, TableRow } from "@voyantjs/ui/components/table"
import { SkeletonTableRows } from "@/components/ui/skeletons"

const INVOICE_TITLES = ["Invoice", "Status", "Total", "Paid", "Balance", "Due Date"]
const INVOICE_WIDTHS = ["w-28", "w-16", "w-20", "w-20", "w-20", "w-24"]

const PAYMENT_TITLES = ["Booking", "Supplier", "Amount", "Status", "Date", "Reference"]
const PAYMENT_WIDTHS = ["w-28", "w-28", "w-20", "w-16", "w-24", "w-32"]

/** Inline skeleton matching the invoices DataTable shape. */
export function InvoicesTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {INVOICE_TITLES.map((t) => (
              <TableHead key={t}>{t}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <SkeletonTableRows rows={rows} columns={6} columnWidths={INVOICE_WIDTHS} />
      </Table>
    </div>
  )
}

/** Inline skeleton matching the supplier-payments DataTable shape. */
export function SupplierPaymentsTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {PAYMENT_TITLES.map((t) => (
              <TableHead key={t}>{t}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <SkeletonTableRows rows={rows} columns={6} columnWidths={PAYMENT_WIDTHS} />
      </Table>
    </div>
  )
}

/**
 * Route-level placeholder for /finance. Mirrors FinancePage: title +
 * description + "New Invoice" button, tab row (Invoices / Supplier Payments),
 * search, and invoice table (default tab).
 */
export function FinancePageSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>

      <div className="flex gap-1 border-b">
        <Skeleton className="h-9 w-24 rounded-none" />
        <Skeleton className="h-9 w-40 rounded-none" />
      </div>

      <Skeleton className="h-9 w-full max-w-sm" />

      <InvoicesTableSkeleton rows={8} />
    </div>
  )
}

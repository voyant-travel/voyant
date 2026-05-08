import { Skeleton } from "@voyantjs/ui/components/skeleton"
import { Table, TableHead, TableHeader, TableRow } from "@voyantjs/ui/components/table"
import { SkeletonTableRows } from "@/components/ui/skeletons"

const INVOICE_TITLES = ["Invoice", "Status", "Total", "Paid", "Balance", "Due Date"]
const INVOICE_WIDTHS = ["w-28", "w-16", "w-20", "w-20", "w-20", "w-24"]

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

/** Route-level placeholder for /finance/invoices. */
export function InvoicesPageSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>

      <Skeleton className="h-9 w-full max-w-sm" />

      <InvoicesTableSkeleton rows={8} />
    </div>
  )
}

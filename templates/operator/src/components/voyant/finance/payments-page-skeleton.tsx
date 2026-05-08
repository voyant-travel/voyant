import { Skeleton } from "@voyantjs/ui/components/skeleton"
import { Table, TableHead, TableHeader, TableRow } from "@voyantjs/ui/components/table"
import { SkeletonTableRows } from "@/components/ui/skeletons"

const PAYMENT_TITLES = ["Type", "Reference", "Party", "Amount", "Status", "Date", "Method"]
const PAYMENT_WIDTHS = ["w-20", "w-32", "w-32", "w-24", "w-20", "w-24", "w-24"]

/** Inline skeleton matching the unified payments table shape. */
export function PaymentsTableSkeleton({ rows = 8 }: { rows?: number }) {
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
        <SkeletonTableRows rows={rows} columns={7} columnWidths={PAYMENT_WIDTHS} />
      </Table>
    </div>
  )
}

/** Route-level placeholder for /finance/payments. */
export function PaymentsPageSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-9 w-44" />
      </div>

      <Skeleton className="h-9 w-full max-w-sm" />

      <PaymentsTableSkeleton rows={8} />
    </div>
  )
}

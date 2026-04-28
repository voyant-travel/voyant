import { Skeleton } from "@voyantjs/ui/components/skeleton"
import { Table, TableHead, TableHeader, TableRow } from "@voyantjs/ui/components/table"
import { SkeletonTableRows } from "@/components/ui/skeletons"

const COLUMN_WIDTHS = ["w-40", "w-20", "w-16", "w-24", "w-20", "w-12"]
const COLUMN_TITLES = ["Name", "Type", "Status", "City", "Country", "Currency"]

/**
 * Inline skeleton that replaces the DataTable while `useQuery` is pending.
 * Matches the live table's 6-column shape (Name / Type / Status / City /
 * Country / Currency).
 */
export function SuppliersTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {COLUMN_TITLES.map((t) => (
              <TableHead key={t}>{t}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <SkeletonTableRows rows={rows} columns={6} columnWidths={COLUMN_WIDTHS} />
      </Table>
    </div>
  )
}

/**
 * Route-level placeholder for /suppliers. Mirrors SuppliersPage: title +
 * description + "New Supplier" button, search input, table, no pagination
 * (DataTable renders its own).
 */
export function SuppliersListSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>

      <Skeleton className="h-9 w-full max-w-sm" />

      <SuppliersTableSkeleton rows={8} />
    </div>
  )
}

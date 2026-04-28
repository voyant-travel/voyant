import { Skeleton } from "@voyantjs/ui/components/skeleton"
import { Table, TableHead, TableHeader, TableRow } from "@voyantjs/ui/components/table"
import { SkeletonTableRows } from "@/components/ui/skeletons"
import { useAdminMessages } from "@/lib/admin-i18n"

/**
 * Route-level placeholder for /products. Matches ProductsPage's header row,
 * the search input, and the 5-column product table exactly.
 */
export function ProductsListSkeleton() {
  const productMessages = useAdminMessages().products.core

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header: title + description + "New product" button */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>

      {/* Search */}
      <Skeleton className="h-9 w-full max-w-sm" />

      {/* Table: Name | Status | Sell Amount | Pax | Start Date */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{productMessages.tableName}</TableHead>
              <TableHead>{productMessages.tableStatus}</TableHead>
              <TableHead>{productMessages.tableSellAmount}</TableHead>
              <TableHead>{productMessages.tablePax}</TableHead>
              <TableHead>{productMessages.tableStartDate}</TableHead>
            </TableRow>
          </TableHeader>
          <SkeletonTableRows
            rows={6}
            columns={5}
            columnWidths={["w-48", "w-16", "w-24", "w-8", "w-24"]}
          />
        </Table>
      </div>

      {/* Pagination bar */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-40" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-16" />
        </div>
      </div>
    </div>
  )
}

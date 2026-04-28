import { Skeleton } from "@voyantjs/ui/components/skeleton"
import { Table, TableHead, TableHeader, TableRow } from "@voyantjs/ui/components/table"
import { SkeletonTableRows } from "@/components/ui/skeletons"
import { useAdminMessages } from "@/lib/admin-i18n"

/**
 * Route-level placeholder for /bookings. Mirrors BookingsPage + BookingList:
 *   - Page title + description
 *   - Search input (left) + "Quick Book" + "New booking" buttons (right)
 *   - 5-column table: Booking # / Status / Sell Amount / Pax / Start Date
 *   - Pagination bar
 */
export function BookingsListSkeleton() {
  const bookingMessages = useAdminMessages().bookings.list

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-4 w-80" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-9 w-full max-w-sm" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-36" />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{bookingMessages.tableBookingNumber}</TableHead>
              <TableHead>{bookingMessages.tableStatus}</TableHead>
              <TableHead>{bookingMessages.tableSellAmount}</TableHead>
              <TableHead>{bookingMessages.tablePax}</TableHead>
              <TableHead>{bookingMessages.tableStartDate}</TableHead>
            </TableRow>
          </TableHeader>
          <SkeletonTableRows
            rows={8}
            columns={5}
            columnWidths={["w-28", "w-20", "w-24", "w-6", "w-24"]}
          />
        </Table>
      </div>

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

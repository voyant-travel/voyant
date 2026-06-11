"use client"

import { useOperatorAdminMessages } from "@voyantjs/admin"
import { Skeleton } from "@voyantjs/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyantjs/ui/components/table"

/**
 * Route-level placeholder for the bookings list. Mirrors `BookingsPage` +
 * `BookingList`:
 *   - Page title + description
 *   - Search input (left) + "New booking" button (right)
 *   - 5-column table: Booking # / Status / Sell Amount / Pax / Start Date
 *   - Pagination bar
 */
export function BookingsListSkeleton() {
  const bookingMessages = useOperatorAdminMessages().bookings.list

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
          <SkeletonRows rows={8} widths={["w-28", "w-20", "w-24", "w-6", "w-24"]} />
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

/** Placeholder `<TableBody>` with one skeleton line per cell. */
function SkeletonRows({ rows, widths }: { rows: number; widths: ReadonlyArray<string> }) {
  return (
    <TableBody>
      {Array.from({ length: rows }).map((_, r) => (
        <TableRow
          // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholders
          key={r}
        >
          {widths.map((width, c) => (
            <TableCell
              // biome-ignore lint/suspicious/noArrayIndexKey: stable placeholders
              key={c}
            >
              <Skeleton className={`h-4 ${width}`} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  )
}

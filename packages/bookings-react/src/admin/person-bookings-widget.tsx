"use client"

import { useAdminNavigate, useLocale, useOperatorAdminMessages } from "@voyant-travel/admin"
import type { PersonDetailBookingsTabContext } from "@voyant-travel/relationships-react/admin"
import { Badge } from "@voyant-travel/ui/components/badge"
import { Skeleton } from "@voyant-travel/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyant-travel/ui/components/table"
import { bookingStatusBadgeVariant, useBookings } from "../index.js"

export type PersonBookingsWidgetProps = PersonDetailBookingsTabContext

/**
 * The person detail page's Bookings tab, contributed as a widget on
 * crm-ui's `person.details.bookings-tab` slot (packaged-admin RFC §4.7
 * cycle resolution): this package depends on `@voyant-travel/relationships-react/ui`, so the
 * person detail host cannot import this card — the contribution travels
 * the widget seam instead. Receives the slot's typed context
 * (`PersonDetailBookingsTabContext`) as props and opens rows through the
 * semantic `booking.detail` destination.
 */
export function PersonBookingsWidget({ personId }: PersonBookingsWidgetProps) {
  const { resolvedLocale } = useLocale()
  const adminMessages = useOperatorAdminMessages()
  const messages = adminMessages.bookings.list
  const navigateTo = useAdminNavigate()
  const bookingsQuery = useBookings({ personId, limit: 50 })
  const bookings = bookingsQuery.data?.data ?? []

  if (bookingsQuery.isPending) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  if (bookingsQuery.isError) {
    return (
      <div className="p-6 text-center text-destructive text-sm">
        {adminMessages.crm.personDetail.notFound}
      </div>
    )
  }

  if (bookings.length === 0) {
    return (
      <div className="p-6 text-center text-muted-foreground text-sm">{messages.relatedEmpty}</div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{messages.tableBookingNumber}</TableHead>
            <TableHead>{messages.tableItems}</TableHead>
            <TableHead>{messages.tableStatus}</TableHead>
            <TableHead>{messages.tableSellAmount}</TableHead>
            <TableHead>{messages.tablePax}</TableHead>
            <TableHead>{messages.tableStartDate}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bookings.map((booking) => {
            const firstItem = booking.items?.[0]
            const itemLabel = firstItem?.productName ?? firstItem?.title ?? "—"
            const extraItems = Math.max((booking.items?.length ?? 0) - 1, 0)
            return (
              <TableRow
                key={booking.id}
                onClick={() => navigateTo("booking.detail", { bookingId: booking.id })}
                className="cursor-pointer"
              >
                <TableCell className="font-medium">{booking.bookingNumber}</TableCell>
                <TableCell>
                  <div className="max-w-[280px] truncate" title={itemLabel}>
                    {itemLabel}
                    {extraItems > 0 ? (
                      <span className="ml-1 text-muted-foreground text-xs">+{extraItems}</span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={bookingStatusBadgeVariant[booking.status]}>
                    {booking.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {booking.sellAmountCents == null
                    ? "—"
                    : `${(booking.sellAmountCents / 100).toFixed(2)} ${booking.sellCurrency}`}
                </TableCell>
                <TableCell>{booking.pax ?? "—"}</TableCell>
                <TableCell>
                  {formatBookingDate(booking.startsAt ?? booking.startDate, resolvedLocale)}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function formatBookingDate(value: string | null | undefined, locale: string): string {
  if (!value) return "—"
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString(locale)
}

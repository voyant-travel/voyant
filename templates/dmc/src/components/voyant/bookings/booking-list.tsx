"use client"

import {
  type BookingRecord,
  bookingStatusBadgeVariant,
  useBookings,
} from "@voyantjs/bookings-react"
import { Badge } from "@voyantjs/ui/components/badge"
import { Button } from "@voyantjs/ui/components/button"
import { Input } from "@voyantjs/ui/components/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyantjs/ui/components/table"
import { formatMessage } from "@voyantjs/voyant-admin"
import { Plus, Search } from "lucide-react"
import * as React from "react"
import { SkeletonTableRows } from "@/components/ui/skeletons"
import { useAdminMessages } from "@/lib/admin-i18n"

import { BookingDialog } from "./booking-dialog"

export interface BookingListProps {
  pageSize?: number
  onSelectBooking?: (booking: BookingRecord) => void
}

function formatAmount(cents: number | null, currency: string, noValue: string): string {
  if (cents == null) return noValue
  return `${(cents / 100).toFixed(2)} ${currency}`
}

function getBookingStatusLabel(
  status: BookingRecord["status"],
  messages: ReturnType<typeof useAdminMessages>["bookings"]["list"],
) {
  switch (status) {
    case "draft":
      return messages.statusDraft
    case "confirmed":
      return messages.statusConfirmed
    case "in_progress":
      return messages.statusInProgress
    case "completed":
      return messages.statusCompleted
    case "cancelled":
      return messages.statusCancelled
    default:
      return status
  }
}

export function BookingList({ pageSize = 25, onSelectBooking }: BookingListProps = {}) {
  const bookingMessages = useAdminMessages().bookings.list
  const [search, setSearch] = React.useState("")
  const [offset, setOffset] = React.useState(0)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<BookingRecord | undefined>(undefined)

  const { data, isPending, isError } = useBookings({
    search: search || undefined,
    limit: pageSize,
    offset,
  })

  const bookings = data?.data ?? []
  const total = data?.total ?? 0
  const page = Math.floor(offset / pageSize) + 1
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  const handleSelect = (booking: BookingRecord) => {
    if (onSelectBooking) {
      onSelectBooking(booking)
      return
    }
    setEditing(booking)
    setDialogOpen(true)
  }

  return (
    <div data-slot="booking-list" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={bookingMessages.searchPlaceholder}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setOffset(0)
            }}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setEditing(undefined)
              setDialogOpen(true)
            }}
          >
            <Plus className="mr-2 size-4" />
            {bookingMessages.newBooking}
          </Button>
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
          {isPending ? (
            <SkeletonTableRows
              rows={8}
              columns={5}
              columnWidths={["w-28", "w-20", "w-24", "w-6", "w-24"]}
            />
          ) : isError ? (
            <TableBody>
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-sm text-destructive">
                  {bookingMessages.loadFailed}
                </TableCell>
              </TableRow>
            </TableBody>
          ) : bookings.length === 0 ? (
            <TableBody>
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                  {bookingMessages.empty}
                </TableCell>
              </TableRow>
            </TableBody>
          ) : (
            <TableBody>
              {bookings.map((booking) => (
                <TableRow
                  key={booking.id}
                  onClick={() => handleSelect(booking)}
                  className="cursor-pointer"
                >
                  <TableCell className="font-medium">{booking.bookingNumber}</TableCell>
                  <TableCell>
                    <Badge variant={bookingStatusBadgeVariant[booking.status]}>
                      {getBookingStatusLabel(booking.status, bookingMessages)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {formatAmount(
                      booking.sellAmountCents,
                      booking.sellCurrency,
                      bookingMessages.noValue,
                    )}
                  </TableCell>
                  <TableCell>{booking.pax ?? bookingMessages.noValue}</TableCell>
                  <TableCell>{booking.startDate ?? bookingMessages.noValue}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          )}
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {formatMessage(bookingMessages.paginationShowing, {
            count: bookings.length,
            total,
          })}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0}
            onClick={() => setOffset((prev) => Math.max(0, prev - pageSize))}
          >
            {bookingMessages.paginationPrevious}
          </Button>
          <span>{formatMessage(bookingMessages.paginationPage, { page, pageCount })}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={offset + pageSize >= total}
            onClick={() => setOffset((prev) => prev + pageSize)}
          >
            {bookingMessages.paginationNext}
          </Button>
        </div>
      </div>

      <BookingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        booking={editing}
        onSuccess={(booking) => {
          onSelectBooking?.(booking)
        }}
      />
    </div>
  )
}

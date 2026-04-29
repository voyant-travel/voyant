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
import { Loader2, Plus, Search } from "lucide-react"
import * as React from "react"

import {
  formatMessage,
  useBookingsUiI18nOrDefault,
  useBookingsUiMessagesOrDefault,
} from "../i18n/provider"
import { BookingDialog } from "./booking-dialog"

export interface BookingListProps {
  pageSize?: number
  onSelectBooking?: (booking: BookingRecord) => void
}

export function BookingList({ pageSize = 25, onSelectBooking }: BookingListProps = {}) {
  const [search, setSearch] = React.useState("")
  const [offset, setOffset] = React.useState(0)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<BookingRecord | undefined>(undefined)
  const { formatNumber } = useBookingsUiI18nOrDefault()
  const messages = useBookingsUiMessagesOrDefault()

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
            placeholder={messages.bookingList.searchPlaceholder}
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
            {messages.bookingList.newBooking}
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{messages.bookingList.columns.bookingNumber}</TableHead>
              <TableHead>{messages.bookingList.columns.status}</TableHead>
              <TableHead>{messages.bookingList.columns.sellAmount}</TableHead>
              <TableHead>{messages.bookingList.columns.pax}</TableHead>
              <TableHead>{messages.bookingList.columns.startDate}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <Loader2 className="mx-auto size-4 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-sm text-destructive">
                  {messages.bookingList.loadingError}
                </TableCell>
              </TableRow>
            ) : bookings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                  {messages.bookingList.empty}
                </TableCell>
              </TableRow>
            ) : (
              bookings.map((booking) => (
                <TableRow
                  key={booking.id}
                  onClick={() => handleSelect(booking)}
                  className="cursor-pointer"
                >
                  <TableCell className="font-medium">{booking.bookingNumber}</TableCell>
                  <TableCell>
                    <Badge variant={bookingStatusBadgeVariant[booking.status]}>
                      {messages.common.bookingStatusLabels[booking.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {booking.sellAmountCents == null
                      ? "—"
                      : `${formatNumber(booking.sellAmountCents / 100, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })} ${booking.sellCurrency}`}
                  </TableCell>
                  <TableCell>{booking.pax ?? "—"}</TableCell>
                  <TableCell>{booking.startDate ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {formatMessage(messages.bookingList.showingSummary, {
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
            Previous
          </Button>
          <span>
            {formatMessage(messages.bookingList.pageSummary, {
              page,
              pageCount,
            })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={offset + pageSize >= total}
            onClick={() => setOffset((prev) => prev + pageSize)}
          >
            Next
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

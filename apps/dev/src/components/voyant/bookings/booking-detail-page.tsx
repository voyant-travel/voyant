"use client"

import { useNavigate } from "@tanstack/react-router"
import {
  bookingStatusBadgeVariant,
  formatBookingStatus,
  useBooking,
  useBookingMutation,
} from "@voyantjs/bookings-react"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { ArrowLeft, Ban, Loader2, Pencil, RefreshCw, Trash2 } from "lucide-react"
import { useState } from "react"

import { BookingActivityTimeline } from "./booking-activity-timeline"
import { BookingCancellationDialog } from "./booking-cancellation-dialog"
import { BookingDialog } from "./booking-dialog"
import { BookingDocumentList } from "./booking-document-list"
import { BookingGroupSection } from "./booking-group-section"
import { BookingGuaranteeList } from "./booking-guarantee-list"
import { BookingItemList } from "./booking-item-list"
import { BookingNotes } from "./booking-notes"
import { BookingPaymentScheduleList } from "./booking-payment-schedule-list"
import { BookingPaymentsSummary } from "./booking-payments-summary"
import { StatusChangeDialog } from "./status-change-dialog"
import { SupplierStatusList } from "./supplier-status-list"
import { TravelerList } from "./traveler-list"

function formatAmount(cents: number | null, currency: string): string {
  if (cents == null) return "-"
  return `${(cents / 100).toFixed(2)} ${currency}`
}

function formatMargin(percent: number | null): string {
  if (percent == null) return "-"
  return `${(percent / 100).toFixed(2)}%`
}

export function BookingDetailPage({ id }: { id: string }) {
  const navigate = useNavigate()
  const [editOpen, setEditOpen] = useState(false)
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const { data: bookingData, isPending } = useBooking(id)
  const { remove } = useBookingMutation()

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const booking = bookingData?.data
  if (!booking) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">Booking not found</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/bookings" })}>
          Back to Bookings
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => void navigate({ to: "/bookings" })}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{booking.bookingNumber}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant={bookingStatusBadgeVariant[booking.status]}>
              {formatBookingStatus(booking.status)}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setStatusDialogOpen(true)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Change Status
          </Button>
          {["draft", "on_hold", "confirmed", "in_progress"].includes(booking.status) && (
            <Button variant="outline" onClick={() => setCancelDialogOpen(true)}>
              <Ban className="mr-2 h-4 w-4" />
              Cancel Booking
            </Button>
          )}
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="destructive"
            onClick={async () => {
              if (confirm("Are you sure you want to delete this booking?")) {
                await remove.mutateAsync(id)
                void navigate({ to: "/bookings" })
              }
            }}
            disabled={remove.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Booking Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Sell Currency:</span>{" "}
              <span>{booking.sellCurrency}</span>
            </div>
            {booking.sellAmountCents != null ? (
              <div>
                <span className="text-muted-foreground">Sell Amount:</span>{" "}
                <span className="font-mono">
                  {formatAmount(booking.sellAmountCents, booking.sellCurrency)}
                </span>
              </div>
            ) : null}
            {booking.costAmountCents != null ? (
              <div>
                <span className="text-muted-foreground">Cost Amount:</span>{" "}
                <span className="font-mono">
                  {formatAmount(booking.costAmountCents, booking.sellCurrency)}
                </span>
              </div>
            ) : null}
            {booking.marginPercent != null ? (
              <div>
                <span className="text-muted-foreground">Margin:</span>{" "}
                <span className="font-mono">{formatMargin(booking.marginPercent)}</span>
              </div>
            ) : null}
            {booking.pax ? (
              <div>
                <span className="text-muted-foreground">Travelers:</span> <span>{booking.pax}</span>
              </div>
            ) : null}
            {booking.internalNotes ? (
              <div className="mt-2 border-t pt-3">
                <span className="text-muted-foreground">Internal Notes:</span>
                <p className="mt-1 whitespace-pre-wrap">{booking.internalNotes}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dates & Links</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Start Date:</span>{" "}
              <span>{booking.startDate ?? "TBD"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">End Date:</span>{" "}
              <span>{booking.endDate ?? "TBD"}</span>
            </div>
            {booking.personId ? (
              <div>
                <span className="text-muted-foreground">Person:</span>{" "}
                <span className="font-mono text-xs">{booking.personId}</span>
              </div>
            ) : null}
            {booking.organizationId ? (
              <div>
                <span className="text-muted-foreground">Organization:</span>{" "}
                <span className="font-mono text-xs">{booking.organizationId}</span>
              </div>
            ) : null}
            <div className="mt-2 border-t pt-3">
              <div>
                <span className="text-muted-foreground">Created:</span>{" "}
                <span>{new Date(booking.createdAt).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Updated:</span>{" "}
                <span>{new Date(booking.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <TravelerList bookingId={id} />
      <BookingItemList bookingId={id} />
      <BookingGroupSection bookingId={id} />
      <BookingPaymentScheduleList bookingId={id} />
      <BookingGuaranteeList bookingId={id} />
      <BookingPaymentsSummary bookingId={id} />
      <BookingDocumentList bookingId={id} />
      <SupplierStatusList bookingId={id} />
      <BookingActivityTimeline bookingId={id} />
      <BookingNotes bookingId={id} />

      <BookingDialog open={editOpen} onOpenChange={setEditOpen} booking={booking} />

      <StatusChangeDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        bookingId={id}
        currentStatus={booking.status}
      />

      <BookingCancellationDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        booking={booking}
      />
    </div>
  )
}

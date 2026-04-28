"use client"

import {
  type BookingPaymentScheduleRecord,
  useBookingPaymentScheduleMutation,
  useBookingPaymentSchedules,
} from "@voyantjs/finance-react"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { useLocale } from "@voyantjs/voyant-admin"
import { CalendarClock, Pencil, Plus, Trash2 } from "lucide-react"
import * as React from "react"
import { useAdminMessages } from "@/lib/admin-i18n"

import { BookingPaymentScheduleDialog } from "./booking-payment-schedule-dialog"

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline",
  due: "secondary",
  paid: "default",
  waived: "secondary",
  cancelled: "destructive",
  expired: "secondary",
}

function formatAmount(cents: number, currency: string): string {
  return `${(cents / 100).toFixed(2)} ${currency}`
}

function getScheduleTypeLabel(
  type: string,
  messages: ReturnType<typeof useAdminMessages>["bookings"]["detail"]["paymentSchedules"],
) {
  switch (type) {
    case "deposit":
      return messages.typeDeposit
    case "interim":
      return messages.typeInterim
    case "final":
      return messages.typeFinal
    case "custom":
      return messages.typeCustom
    default:
      return type.replace(/_/g, " ")
  }
}

function getScheduleStatusLabel(
  status: string,
  messages: ReturnType<typeof useAdminMessages>["bookings"]["detail"]["paymentSchedules"],
) {
  switch (status) {
    case "pending":
      return messages.statusPending
    case "due":
      return messages.statusDue
    case "paid":
      return messages.statusPaid
    case "waived":
      return messages.statusWaived
    case "cancelled":
      return messages.statusCancelled
    case "expired":
      return messages.statusExpired
    default:
      return status.replace(/_/g, " ")
  }
}

export interface BookingPaymentScheduleListProps {
  bookingId: string
}

export function BookingPaymentScheduleList({ bookingId }: BookingPaymentScheduleListProps) {
  const detailMessages = useAdminMessages().bookings.detail
  const scheduleMessages = detailMessages.paymentSchedules
  const { resolvedLocale } = useLocale()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<BookingPaymentScheduleRecord | undefined>(undefined)
  const { data } = useBookingPaymentSchedules(bookingId)
  const { remove } = useBookingPaymentScheduleMutation(bookingId)

  const schedules = data?.data ?? []

  return (
    <Card data-slot="booking-payment-schedule-list">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4" />
          {scheduleMessages.title}
        </CardTitle>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {scheduleMessages.addAction}
        </Button>
      </CardHeader>
      <CardContent>
        {schedules.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{scheduleMessages.empty}</p>
        ) : (
          <div className="rounded border bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="p-2 text-left font-medium">{scheduleMessages.tableType}</th>
                  <th className="p-2 text-left font-medium">{scheduleMessages.tableStatus}</th>
                  <th className="p-2 text-left font-medium">{scheduleMessages.tableDueDate}</th>
                  <th className="p-2 text-right font-medium">{scheduleMessages.tableAmount}</th>
                  <th className="p-2 text-left font-medium">{scheduleMessages.tableNotes}</th>
                  <th className="w-20 p-2" />
                </tr>
              </thead>
              <tbody>
                {schedules.map((schedule) => (
                  <tr key={schedule.id} className="border-b last:border-b-0">
                    <td className="p-2">
                      {getScheduleTypeLabel(schedule.scheduleType, scheduleMessages)}
                    </td>
                    <td className="p-2">
                      <Badge variant={statusVariant[schedule.status] ?? "secondary"}>
                        {getScheduleStatusLabel(schedule.status, scheduleMessages)}
                      </Badge>
                    </td>
                    <td className="p-2">
                      {new Date(schedule.dueDate).toLocaleDateString(resolvedLocale)}
                    </td>
                    <td className="p-2 text-right font-mono">
                      {formatAmount(schedule.amountCents, schedule.currency)}
                    </td>
                    <td className="max-w-[200px] truncate p-2 text-muted-foreground">
                      {schedule.notes ?? detailMessages.noValue}
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(schedule)
                            setDialogOpen(true)
                          }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(scheduleMessages.deleteConfirm)) {
                              remove.mutate(schedule.id)
                            }
                          }}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <BookingPaymentScheduleDialog
        open={dialogOpen}
        onOpenChange={(nextOpen) => {
          setDialogOpen(nextOpen)
          if (!nextOpen) {
            setEditing(undefined)
          }
        }}
        bookingId={bookingId}
        schedule={editing}
        onSuccess={() => {
          setEditing(undefined)
        }}
      />
    </Card>
  )
}

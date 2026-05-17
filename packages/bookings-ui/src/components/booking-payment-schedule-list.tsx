"use client"

import { useBooking } from "@voyantjs/bookings-react"
import {
  type BookingPaymentScheduleRecord,
  useBookingPaymentScheduleMutation,
  useBookingPaymentSchedules,
  useInvoiceMutation,
} from "@voyantjs/finance-react"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@voyantjs/ui/components/dropdown-menu"
import { CalendarClock, FileText, Loader2, Pencil, Plus, Receipt, Trash2 } from "lucide-react"
import * as React from "react"

import { useBookingsUiI18nOrDefault, useBookingsUiMessagesOrDefault } from "../i18n/provider.js"
import { BookingPaymentScheduleDialog } from "./booking-payment-schedule-dialog.js"

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline",
  due: "secondary",
  paid: "default",
  waived: "secondary",
  cancelled: "destructive",
  expired: "secondary",
}

export interface BookingPaymentScheduleListProps {
  bookingId: string
}

export function BookingPaymentScheduleList({ bookingId }: BookingPaymentScheduleListProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<BookingPaymentScheduleRecord | undefined>(undefined)
  const [generatingInvoiceForId, setGeneratingInvoiceForId] = React.useState<string | null>(null)
  const { data } = useBookingPaymentSchedules(bookingId)
  const { remove } = useBookingPaymentScheduleMutation(bookingId)
  const { data: bookingData } = useBooking(bookingId)
  const booking = bookingData?.data ?? null
  const { createFromBooking: createInvoiceFromBooking, render: renderInvoice } =
    useInvoiceMutation()
  const { formatCurrency } = useBookingsUiI18nOrDefault()
  const messages = useBookingsUiMessagesOrDefault()

  const schedules = data?.data ?? []

  const handleGenerateInvoice = async (
    schedule: BookingPaymentScheduleRecord,
    invoiceType: "invoice" | "proforma",
  ) => {
    if (!booking) return
    setGeneratingInvoiceForId(schedule.id)
    try {
      const todayIso = new Date().toISOString().slice(0, 10)
      const dueIso = schedule.dueDate || todayIso
      const prefix = invoiceType === "proforma" ? "PRO" : "INV"
      const invoice = await createInvoiceFromBooking.mutateAsync({
        bookingId: booking.id,
        invoiceNumber: `${prefix}-${booking.bookingNumber}-${schedule.scheduleType.toUpperCase().slice(0, 3)}`,
        issueDate: todayIso,
        dueDate: dueIso,
        notes: schedule.notes ?? null,
        invoiceType,
      })
      await renderInvoice.mutateAsync({ id: invoice.id, input: { format: "pdf" } })
    } finally {
      setGeneratingInvoiceForId(null)
    }
  }

  return (
    <Card data-slot="booking-payment-schedule-list">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4" />
          {messages.bookingPaymentScheduleList.title}
        </CardTitle>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {messages.bookingPaymentScheduleList.addSchedule}
        </Button>
      </CardHeader>
      <CardContent>
        {schedules.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {messages.bookingPaymentScheduleList.empty}
          </p>
        ) : (
          <div className="rounded border bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="p-2 text-left font-medium">
                    {messages.bookingPaymentScheduleList.columns.type}
                  </th>
                  <th className="p-2 text-left font-medium">
                    {messages.bookingPaymentScheduleList.columns.status}
                  </th>
                  <th className="p-2 text-left font-medium">
                    {messages.bookingPaymentScheduleList.columns.dueDate}
                  </th>
                  <th className="p-2 text-right font-medium">
                    {messages.bookingPaymentScheduleList.columns.amount}
                  </th>
                  <th className="p-2 text-left font-medium">
                    {messages.bookingPaymentScheduleList.columns.notes}
                  </th>
                  <th className="w-20 p-2" />
                </tr>
              </thead>
              <tbody>
                {schedules.map((schedule) => (
                  <tr key={schedule.id} className="border-b last:border-b-0">
                    <td className="p-2">
                      {messages.paymentScheduleDialog.scheduleTypeLabels[schedule.scheduleType]}
                    </td>
                    <td className="p-2">
                      <Badge variant={statusVariant[schedule.status] ?? "secondary"}>
                        {messages.paymentScheduleDialog.scheduleStatusLabels[schedule.status]}
                      </Badge>
                    </td>
                    <td className="p-2">{schedule.dueDate}</td>
                    <td className="p-2 text-right font-mono">
                      {formatCurrency(schedule.amountCents / 100, schedule.currency)}
                    </td>
                    <td className="max-w-[200px] truncate p-2 text-muted-foreground">
                      {schedule.notes ??
                        messages.bookingPaymentScheduleList.values.notesUnavailable}
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            disabled={!booking || generatingInvoiceForId === schedule.id}
                            title={messages.bookingPaymentScheduleList.actions.issueDocument}
                            render={
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                              >
                                {generatingInvoiceForId === schedule.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Receipt className="h-3.5 w-3.5" />
                                )}
                              </button>
                            }
                          />
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => void handleGenerateInvoice(schedule, "invoice")}
                            >
                              <FileText className="h-4 w-4" />
                              {messages.bookingPaymentScheduleList.actions.issueInvoice}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => void handleGenerateInvoice(schedule, "proforma")}
                            >
                              <FileText className="h-4 w-4" />
                              {messages.bookingPaymentScheduleList.actions.issueProforma}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
                            if (
                              confirm(messages.bookingPaymentScheduleList.actions.deleteConfirm)
                            ) {
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

"use client"

import {
  type BookingGuaranteeRecord,
  useBookingGuaranteeMutation,
  useBookingGuarantees,
} from "@voyantjs/finance-react"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react"
import * as React from "react"

import { useBookingsUiI18nOrDefault, useBookingsUiMessagesOrDefault } from "../i18n/provider.js"
import { BookingGuaranteeDialog } from "./booking-guarantee-dialog.js"

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline",
  active: "default",
  released: "secondary",
  failed: "destructive",
  cancelled: "destructive",
  expired: "secondary",
}

export interface BookingGuaranteeListProps {
  bookingId: string
}

export function BookingGuaranteeList({ bookingId }: BookingGuaranteeListProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<BookingGuaranteeRecord | undefined>(undefined)
  const { data } = useBookingGuarantees(bookingId)
  const { remove } = useBookingGuaranteeMutation(bookingId)
  const { formatCurrency, formatDate } = useBookingsUiI18nOrDefault()
  const messages = useBookingsUiMessagesOrDefault()

  const guarantees = data?.data ?? []

  return (
    <Card data-slot="booking-guarantee-list">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          {messages.bookingGuaranteeList.title}
        </CardTitle>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {messages.bookingGuaranteeList.addGuarantee}
        </Button>
      </CardHeader>
      <CardContent>
        {guarantees.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {messages.bookingGuaranteeList.empty}
          </p>
        ) : (
          <div className="rounded border bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="p-2 text-left font-medium">
                    {messages.bookingGuaranteeList.columns.type}
                  </th>
                  <th className="p-2 text-left font-medium">
                    {messages.bookingGuaranteeList.columns.status}
                  </th>
                  <th className="p-2 text-right font-medium">
                    {messages.bookingGuaranteeList.columns.amount}
                  </th>
                  <th className="p-2 text-left font-medium">
                    {messages.bookingGuaranteeList.columns.provider}
                  </th>
                  <th className="p-2 text-left font-medium">
                    {messages.bookingGuaranteeList.columns.reference}
                  </th>
                  <th className="p-2 text-left font-medium">
                    {messages.bookingGuaranteeList.columns.expires}
                  </th>
                  <th className="w-20 p-2" />
                </tr>
              </thead>
              <tbody>
                {guarantees.map((g) => (
                  <tr key={g.id} className="border-b last:border-b-0">
                    <td className="p-2">
                      {messages.bookingGuaranteeDialog.guaranteeTypeLabels[g.guaranteeType]}
                    </td>
                    <td className="p-2">
                      <Badge variant={statusVariant[g.status] ?? "secondary"}>
                        {messages.bookingGuaranteeDialog.guaranteeStatusLabels[g.status]}
                      </Badge>
                    </td>
                    <td className="p-2 text-right font-mono">
                      {g.amountCents == null || !g.currency
                        ? messages.bookingGuaranteeList.values.amountUnavailable
                        : formatCurrency(g.amountCents / 100, g.currency)}
                    </td>
                    <td className="p-2">
                      {g.provider ?? messages.bookingGuaranteeList.values.providerUnavailable}
                    </td>
                    <td className="max-w-[150px] truncate p-2 font-mono text-xs">
                      {g.referenceNumber ??
                        messages.bookingGuaranteeList.values.referenceUnavailable}
                    </td>
                    <td className="p-2">
                      {g.expiresAt
                        ? formatDate(g.expiresAt)
                        : messages.bookingGuaranteeList.values.expiresUnavailable}
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(g)
                            setDialogOpen(true)
                          }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(messages.bookingGuaranteeList.actions.deleteConfirm)) {
                              remove.mutate(g.id)
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

      <BookingGuaranteeDialog
        open={dialogOpen}
        onOpenChange={(nextOpen) => {
          setDialogOpen(nextOpen)
          if (!nextOpen) {
            setEditing(undefined)
          }
        }}
        bookingId={bookingId}
        guarantee={editing}
        onSuccess={() => {
          setEditing(undefined)
        }}
      />
    </Card>
  )
}

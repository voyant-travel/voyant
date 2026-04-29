"use client"

import { useLocale } from "@voyantjs/admin"
import {
  type BookingGuaranteeRecord,
  useBookingGuaranteeMutation,
  useBookingGuarantees,
} from "@voyantjs/finance-react"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react"
import * as React from "react"
import { useAdminMessages } from "@/lib/admin-i18n"

import { BookingGuaranteeDialog } from "./booking-guarantee-dialog"

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline",
  active: "default",
  released: "secondary",
  failed: "destructive",
  cancelled: "destructive",
  expired: "secondary",
}

function formatAmount(cents: number | null, currency: string | null, noValue: string): string {
  if (cents == null || !currency) return noValue
  return `${(cents / 100).toFixed(2)} ${currency}`
}

function getGuaranteeTypeLabel(
  type: string,
  messages: ReturnType<typeof useAdminMessages>["bookings"]["detail"]["guarantees"],
) {
  switch (type) {
    case "card_hold":
      return messages.typeCardHold
    case "deposit":
      return messages.typeDeposit
    case "voucher":
      return messages.typeVoucher
    case "insurance":
      return messages.typeInsurance
    case "other":
      return messages.typeOther
    default:
      return type.replace(/_/g, " ")
  }
}

function getGuaranteeStatusLabel(
  status: string,
  messages: ReturnType<typeof useAdminMessages>["bookings"]["detail"]["guarantees"],
) {
  switch (status) {
    case "pending":
      return messages.statusPending
    case "active":
      return messages.statusActive
    case "released":
      return messages.statusReleased
    case "failed":
      return messages.statusFailed
    case "cancelled":
      return messages.statusCancelled
    case "expired":
      return messages.statusExpired
    default:
      return status.replace(/_/g, " ")
  }
}

export interface BookingGuaranteeListProps {
  bookingId: string
}

export function BookingGuaranteeList({ bookingId }: BookingGuaranteeListProps) {
  const guaranteeMessages = useAdminMessages().bookings.detail.guarantees
  const noValue = useAdminMessages().bookings.detail.noValue
  const { resolvedLocale } = useLocale()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<BookingGuaranteeRecord | undefined>(undefined)
  const { data } = useBookingGuarantees(bookingId)
  const { remove } = useBookingGuaranteeMutation(bookingId)

  const guarantees = data?.data ?? []

  return (
    <Card data-slot="booking-guarantee-list">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          {guaranteeMessages.title}
        </CardTitle>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {guaranteeMessages.addAction}
        </Button>
      </CardHeader>
      <CardContent>
        {guarantees.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {guaranteeMessages.empty}
          </p>
        ) : (
          <div className="rounded border bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="p-2 text-left font-medium">{guaranteeMessages.tableType}</th>
                  <th className="p-2 text-left font-medium">{guaranteeMessages.tableStatus}</th>
                  <th className="p-2 text-right font-medium">{guaranteeMessages.tableAmount}</th>
                  <th className="p-2 text-left font-medium">{guaranteeMessages.tableProvider}</th>
                  <th className="p-2 text-left font-medium">{guaranteeMessages.tableReference}</th>
                  <th className="p-2 text-left font-medium">{guaranteeMessages.tableExpires}</th>
                  <th className="w-20 p-2" />
                </tr>
              </thead>
              <tbody>
                {guarantees.map((g) => (
                  <tr key={g.id} className="border-b last:border-b-0">
                    <td className="p-2">
                      {getGuaranteeTypeLabel(g.guaranteeType, guaranteeMessages)}
                    </td>
                    <td className="p-2">
                      <Badge variant={statusVariant[g.status] ?? "secondary"}>
                        {getGuaranteeStatusLabel(g.status, guaranteeMessages)}
                      </Badge>
                    </td>
                    <td className="p-2 text-right font-mono">
                      {formatAmount(g.amountCents, g.currency, noValue)}
                    </td>
                    <td className="p-2">{g.provider ?? noValue}</td>
                    <td className="max-w-[150px] truncate p-2 font-mono text-xs">
                      {g.referenceNumber ?? noValue}
                    </td>
                    <td className="p-2">
                      {g.expiresAt
                        ? new Date(g.expiresAt).toLocaleDateString(resolvedLocale)
                        : noValue}
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
                            if (confirm(guaranteeMessages.deleteConfirm)) {
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

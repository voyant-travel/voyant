"use client"

import {
  type BookingGuaranteeRecord,
  useBookingGuaranteeMutation,
  useBookingGuarantees,
} from "@voyantjs/finance-react"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react"
import * as React from "react"

import { BookingGuaranteeDialog } from "./booking-guarantee-dialog"

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline",
  active: "default",
  released: "secondary",
  failed: "destructive",
  cancelled: "destructive",
  expired: "secondary",
}

function formatAmount(cents: number | null, currency: string | null): string {
  if (cents == null || !currency) return "-"
  return `${(cents / 100).toFixed(2)} ${currency}`
}

export interface BookingGuaranteeListProps {
  bookingId: string
}

export function BookingGuaranteeList({ bookingId }: BookingGuaranteeListProps) {
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
          Guarantees
        </CardTitle>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Guarantee
        </Button>
      </CardHeader>
      <CardContent>
        {guarantees.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No guarantees yet.</p>
        ) : (
          <div className="rounded border bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="p-2 text-left font-medium">Type</th>
                  <th className="p-2 text-left font-medium">Status</th>
                  <th className="p-2 text-right font-medium">Amount</th>
                  <th className="p-2 text-left font-medium">Provider</th>
                  <th className="p-2 text-left font-medium">Reference</th>
                  <th className="p-2 text-left font-medium">Expires</th>
                  <th className="w-20 p-2" />
                </tr>
              </thead>
              <tbody>
                {guarantees.map((g) => (
                  <tr key={g.id} className="border-b last:border-b-0">
                    <td className="p-2 capitalize">{g.guaranteeType.replace(/_/g, " ")}</td>
                    <td className="p-2">
                      <Badge
                        variant={statusVariant[g.status] ?? "secondary"}
                        className="capitalize"
                      >
                        {g.status.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="p-2 text-right font-mono">
                      {formatAmount(g.amountCents, g.currency)}
                    </td>
                    <td className="p-2">{g.provider ?? "-"}</td>
                    <td className="max-w-[150px] truncate p-2 font-mono text-xs">
                      {g.referenceNumber ?? "-"}
                    </td>
                    <td className="p-2">
                      {g.expiresAt ? new Date(g.expiresAt).toLocaleDateString() : "-"}
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
                            if (confirm("Delete this guarantee?")) {
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

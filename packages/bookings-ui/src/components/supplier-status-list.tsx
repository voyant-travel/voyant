"use client"

import { type BookingSupplierStatusRecord, useSupplierStatuses } from "@voyantjs/bookings-react"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@voyantjs/voyant-ui/components"
import { Pencil, Plus } from "lucide-react"
import * as React from "react"

import { SupplierStatusDialog } from "./supplier-status-dialog"

export interface SupplierStatusListProps {
  bookingId: string
}

const supplierStatusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline",
  confirmed: "default",
  rejected: "destructive",
  cancelled: "secondary",
}

export function SupplierStatusList({ bookingId }: SupplierStatusListProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<BookingSupplierStatusRecord | undefined>(undefined)
  const { data } = useSupplierStatuses(bookingId)

  const statuses = data?.data ?? []

  return (
    <Card data-slot="supplier-status-list">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Supplier Confirmations</CardTitle>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Supplier
        </Button>
      </CardHeader>
      <CardContent>
        {statuses.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No supplier statuses yet.
          </p>
        ) : (
          <div className="rounded border bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="p-2 text-left font-medium">Service</th>
                  <th className="p-2 text-left font-medium">Status</th>
                  <th className="p-2 text-left font-medium">Cost</th>
                  <th className="p-2 text-left font-medium">Reference</th>
                  <th className="p-2 text-left font-medium">Confirmed</th>
                  <th className="w-12 p-2" />
                </tr>
              </thead>
              <tbody>
                {statuses.map((status) => (
                  <tr key={status.id} className="border-b last:border-b-0">
                    <td className="p-2">{status.serviceName}</td>
                    <td className="p-2">
                      <Badge
                        variant={supplierStatusVariant[status.status] ?? "secondary"}
                        className="capitalize text-xs"
                      >
                        {status.status}
                      </Badge>
                    </td>
                    <td className="p-2 font-mono">
                      {(status.costAmountCents / 100).toFixed(2)} {status.costCurrency}
                    </td>
                    <td className="p-2">{status.supplierReference ?? "-"}</td>
                    <td className="p-2">
                      {status.confirmedAt ? new Date(status.confirmedAt).toLocaleDateString() : "-"}
                    </td>
                    <td className="p-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(status)
                          setDialogOpen(true)
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <SupplierStatusDialog
        open={dialogOpen}
        onOpenChange={(nextOpen) => {
          setDialogOpen(nextOpen)
          if (!nextOpen) {
            setEditing(undefined)
          }
        }}
        bookingId={bookingId}
        supplierStatus={editing}
        onSuccess={() => {
          setEditing(undefined)
        }}
      />
    </Card>
  )
}

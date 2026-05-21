"use client"

import { type BookingSupplierStatusRecord, useSupplierStatuses } from "@voyantjs/bookings-react"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { Pencil, Plus } from "lucide-react"
import * as React from "react"

import { useBookingsUiI18nOrDefault, useBookingsUiMessagesOrDefault } from "../i18n/provider.js"
import { SupplierStatusDialog } from "./supplier-status-dialog.js"

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
  const { formatCurrency, formatDate } = useBookingsUiI18nOrDefault()
  const messages = useBookingsUiMessagesOrDefault()

  const statuses = data?.data ?? []
  // `bookingSupplierStatuses` gets one row per `product_day_services`
  // entry — so a 2-day itinerary that includes the same service on
  // both days lands two visually-identical rows. The operator only
  // cares about the per-service total, so collapse identical rows
  // (same service id, name, status, cost) into one with a `× N`
  // badge. The edit pencil opens the first row of the group; for true
  // duplicates that's a no-op-distinction.
  const groupedStatuses = groupSupplierStatuses(statuses)

  return (
    <Card data-slot="supplier-status-list">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{messages.supplierStatusList.title}</CardTitle>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {messages.supplierStatusList.addSupplier}
        </Button>
      </CardHeader>
      <CardContent>
        {statuses.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {messages.supplierStatusList.empty}
          </p>
        ) : (
          <div className="rounded border bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="p-2 text-left font-medium">
                    {messages.supplierStatusList.columns.service}
                  </th>
                  <th className="p-2 text-left font-medium">
                    {messages.supplierStatusList.columns.status}
                  </th>
                  <th className="p-2 text-left font-medium">
                    {messages.supplierStatusList.columns.cost}
                  </th>
                  <th className="p-2 text-left font-medium">
                    {messages.supplierStatusList.columns.reference}
                  </th>
                  <th className="p-2 text-left font-medium">
                    {messages.supplierStatusList.columns.confirmed}
                  </th>
                  <th className="w-12 p-2" />
                </tr>
              </thead>
              <tbody>
                {groupedStatuses.map((group) => {
                  const head = group.statuses[0] as BookingSupplierStatusRecord
                  const totalCostCents = group.statuses.reduce(
                    (sum, s) => sum + (s.costAmountCents ?? 0),
                    0,
                  )
                  const reference =
                    group.statuses.find((s) => s.supplierReference)?.supplierReference ?? null
                  const confirmedAt = group.statuses.find((s) => s.confirmedAt)?.confirmedAt ?? null
                  return (
                    <tr key={group.key} className="border-b last:border-b-0">
                      <td className="p-2">
                        <span className="inline-flex items-center gap-1.5">
                          {head.serviceName}
                          {group.statuses.length > 1 ? (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              × {group.statuses.length}
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td className="p-2">
                        <Badge variant={supplierStatusVariant[head.status] ?? "secondary"}>
                          {messages.common.supplierStatusLabels[head.status]}
                        </Badge>
                      </td>
                      <td className="p-2 font-mono">
                        {totalCostCents === 0 || !head.costCurrency
                          ? messages.supplierStatusList.values.costUnavailable
                          : formatCurrency(totalCostCents / 100, head.costCurrency)}
                      </td>
                      <td className="p-2">
                        {reference ?? messages.supplierStatusList.values.referenceUnavailable}
                      </td>
                      <td className="p-2">
                        {confirmedAt
                          ? formatDate(confirmedAt)
                          : messages.supplierStatusList.values.confirmedUnavailable}
                      </td>
                      <td className="p-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(head)
                            setDialogOpen(true)
                          }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
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

interface SupplierStatusGroup {
  key: string
  statuses: BookingSupplierStatusRecord[]
}

function groupSupplierStatuses(
  statuses: readonly BookingSupplierStatusRecord[],
): SupplierStatusGroup[] {
  const groups = new Map<string, SupplierStatusGroup>()
  for (const status of statuses) {
    // Visually-identical rows collapse together. Reference/confirmed
    // timestamps and `id` are intentionally excluded — those differ
    // between sibling rows that the operator nonetheless sees as one
    // line of business.
    const key = [
      status.supplierServiceId ?? "",
      status.serviceName,
      status.status,
      status.costCurrency ?? "",
      status.costAmountCents ?? "",
    ].join("|")
    const existing = groups.get(key)
    if (existing) {
      existing.statuses.push(status)
    } else {
      groups.set(key, { key, statuses: [status] })
    }
  }
  return Array.from(groups.values())
}

"use client"

import {
  type BookingItemRecord,
  useBookingItemMutation,
  useBookingItems,
} from "@voyantjs/bookings-react"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { ChevronDown, ChevronRight, Package, Pencil, Plus, Trash2 } from "lucide-react"
import * as React from "react"
import { useAdminMessages } from "@/lib/admin-i18n"

import { BookingItemDialog } from "./booking-item-dialog"
import { BookingItemTravelers } from "./booking-item-travelers"

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  on_hold: "secondary",
  confirmed: "default",
  cancelled: "destructive",
  expired: "secondary",
  fulfilled: "default",
}

function formatAmount(cents: number | null, currency: string, noValue: string): string {
  if (cents == null) return noValue
  return `${(cents / 100).toFixed(2)} ${currency}`
}

function getItemTypeLabel(
  itemType: BookingItemRecord["itemType"],
  messages: ReturnType<typeof useAdminMessages>["bookings"]["detail"]["items"],
) {
  switch (itemType) {
    case "unit":
      return messages.typeUnit
    case "extra":
      return messages.typeExtra
    case "service":
      return messages.typeService
    case "fee":
      return messages.typeFee
    case "tax":
      return messages.typeTax
    case "discount":
      return messages.typeDiscount
    case "adjustment":
      return messages.typeAdjustment
    case "accommodation":
      return messages.typeAccommodation
    case "transport":
      return messages.typeTransport
    case "other":
      return messages.typeOther
    default:
      return itemType
  }
}

function getItemStatusLabel(
  status: BookingItemRecord["status"],
  messages: ReturnType<typeof useAdminMessages>["bookings"]["detail"]["items"],
) {
  switch (status) {
    case "draft":
      return messages.statusDraft
    case "on_hold":
      return messages.statusOnHold
    case "confirmed":
      return messages.statusConfirmed
    case "cancelled":
      return messages.statusCancelled
    case "expired":
      return messages.statusExpired
    case "fulfilled":
      return messages.statusFulfilled
    default:
      return status
  }
}

export interface BookingItemListProps {
  bookingId: string
}

export function BookingItemList({ bookingId }: BookingItemListProps) {
  const itemMessages = useAdminMessages().bookings.detail.items
  const noValue = useAdminMessages().bookings.detail.noValue
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<BookingItemRecord | undefined>(undefined)
  const [expandedItemId, setExpandedItemId] = React.useState<string | null>(null)
  const { data } = useBookingItems(bookingId)
  const { remove } = useBookingItemMutation(bookingId)

  const items = data?.data ?? []

  return (
    <Card data-slot="booking-item-list">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Package className="h-4 w-4" />
          {itemMessages.title}
        </CardTitle>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {itemMessages.addAction}
        </Button>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{itemMessages.empty}</p>
        ) : (
          <div className="rounded border bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="w-8 p-2" />
                  <th className="p-2 text-left font-medium">{itemMessages.tableTitle}</th>
                  <th className="p-2 text-left font-medium">{itemMessages.tableType}</th>
                  <th className="p-2 text-left font-medium">{itemMessages.tableStatus}</th>
                  <th className="p-2 text-right font-medium">{itemMessages.tableQuantity}</th>
                  <th className="p-2 text-right font-medium">{itemMessages.tableTotal}</th>
                  <th className="p-2 text-left font-medium">{itemMessages.tableServiceDate}</th>
                  <th className="w-20 p-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const isExpanded = expandedItemId === item.id
                  return (
                    <React.Fragment key={item.id}>
                      <tr className="border-b">
                        <td className="p-2">
                          <button
                            type="button"
                            onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </td>
                        <td className="p-2 font-medium">{item.title}</td>
                        <td className="p-2">{getItemTypeLabel(item.itemType, itemMessages)}</td>
                        <td className="p-2">
                          <Badge variant={statusVariant[item.status] ?? "secondary"}>
                            {getItemStatusLabel(item.status, itemMessages)}
                          </Badge>
                        </td>
                        <td className="p-2 text-right font-mono">{item.quantity}</td>
                        <td className="p-2 text-right font-mono">
                          {formatAmount(item.totalSellAmountCents, item.sellCurrency, noValue)}
                        </td>
                        <td className="p-2">{item.serviceDate ?? noValue}</td>
                        <td className="p-2">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditing(item)
                                setDialogOpen(true)
                              }}
                              aria-label={itemMessages.editAction}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(itemMessages.deleteConfirm)) {
                                  remove.mutate(item.id)
                                }
                              }}
                              aria-label={itemMessages.deleteAction}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b last:border-b-0">
                          <td colSpan={8} className="p-2">
                            <BookingItemTravelers bookingId={bookingId} itemId={item.id} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <BookingItemDialog
        open={dialogOpen}
        onOpenChange={(nextOpen) => {
          setDialogOpen(nextOpen)
          if (!nextOpen) {
            setEditing(undefined)
          }
        }}
        bookingId={bookingId}
        item={editing}
        onSuccess={() => {
          setEditing(undefined)
        }}
      />
    </Card>
  )
}

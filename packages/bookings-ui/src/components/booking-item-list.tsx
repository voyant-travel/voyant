"use client"

import {
  type BookingItemRecord,
  useBookingItemMutation,
  useBookingItems,
} from "@voyantjs/bookings-react"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { ChevronDown, ChevronRight, Package, Pencil, Plus, Trash2 } from "lucide-react"
import * as React from "react"

import { useBookingsUiI18nOrDefault, useBookingsUiMessagesOrDefault } from "../i18n/provider"
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

export interface BookingItemListProps {
  bookingId: string
}

export function BookingItemList({ bookingId }: BookingItemListProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<BookingItemRecord | undefined>(undefined)
  const [expandedItemId, setExpandedItemId] = React.useState<string | null>(null)
  const { data } = useBookingItems(bookingId)
  const { remove } = useBookingItemMutation(bookingId)
  const { formatCurrency } = useBookingsUiI18nOrDefault()
  const messages = useBookingsUiMessagesOrDefault()

  const items = data?.data ?? []

  return (
    <Card data-slot="booking-item-list">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Package className="h-4 w-4" />
          {messages.bookingItemList.title}
        </CardTitle>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {messages.bookingItemList.addItem}
        </Button>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {messages.bookingItemList.empty}
          </p>
        ) : (
          <div className="rounded border bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="w-8 p-2" />
                  <th className="p-2 text-left font-medium">
                    {messages.bookingItemList.columns.title}
                  </th>
                  <th className="p-2 text-left font-medium">
                    {messages.bookingItemList.columns.type}
                  </th>
                  <th className="p-2 text-left font-medium">
                    {messages.bookingItemList.columns.status}
                  </th>
                  <th className="p-2 text-right font-medium">
                    {messages.bookingItemList.columns.quantity}
                  </th>
                  <th className="p-2 text-right font-medium">
                    {messages.bookingItemList.columns.total}
                  </th>
                  <th className="p-2 text-left font-medium">
                    {messages.bookingItemList.columns.serviceDate}
                  </th>
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
                        <td className="p-2">
                          {messages.bookingItemDialog.itemTypeLabels[item.itemType]}
                        </td>
                        <td className="p-2">
                          <Badge variant={statusVariant[item.status] ?? "secondary"}>
                            {messages.bookingItemDialog.itemStatusLabels[item.status]}
                          </Badge>
                        </td>
                        <td className="p-2 text-right font-mono">{item.quantity}</td>
                        <td className="p-2 text-right font-mono">
                          {item.totalSellAmountCents == null
                            ? messages.bookingItemList.values.totalUnavailable
                            : formatCurrency(item.totalSellAmountCents / 100, item.sellCurrency)}
                        </td>
                        <td className="p-2">
                          {item.serviceDate ??
                            messages.bookingItemList.values.serviceDateUnavailable}
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditing(item)
                                setDialogOpen(true)
                              }}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(messages.bookingItemList.actions.deleteConfirm)) {
                                  remove.mutate(item.id)
                                }
                              }}
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

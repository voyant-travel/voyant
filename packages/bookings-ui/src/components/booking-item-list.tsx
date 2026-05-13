"use client"

import {
  type BookingItemRecord,
  useBookingItemMutation,
  useBookingItems,
} from "@voyantjs/bookings-react"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { Calendar, ChevronDown, ChevronRight, Package, Pencil, Plus, Trash2 } from "lucide-react"
import * as React from "react"

import { useBookingsUiI18nOrDefault, useBookingsUiMessagesOrDefault } from "../i18n/provider.js"
import { BookingItemDialog } from "./booking-item-dialog.js"
import { BookingItemTravelers } from "./booking-item-travelers.js"

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
          <p className="py-4 text-center text-muted-foreground text-sm">
            {messages.bookingItemList.empty}
          </p>
        ) : (
          <div className="overflow-x-auto rounded border bg-background">
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
                  <th className="p-2 text-right font-medium">
                    {messages.bookingItemList.columns.cost}
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
                      <tr
                        className="cursor-pointer border-b hover:bg-muted/30"
                        onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                      >
                        <td className="p-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setExpandedItemId(isExpanded ? null : item.id)
                            }}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label={
                              isExpanded
                                ? messages.bookingItemList.actions.collapseItem
                                : messages.bookingItemList.actions.expandItem
                            }
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
                        <td className="p-2 text-right font-mono text-muted-foreground">
                          {item.totalCostAmountCents == null || !item.costCurrency
                            ? messages.bookingItemList.values.costUnavailable
                            : formatCurrency(item.totalCostAmountCents / 100, item.costCurrency)}
                        </td>
                        <td className="p-2 text-xs">
                          {formatItemDateRange(item) ??
                            messages.bookingItemList.values.serviceDateUnavailable}
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditing(item)
                                setDialogOpen(true)
                              }}
                              className="text-muted-foreground hover:text-foreground"
                              aria-label={messages.bookingItemList.actions.editItem}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                if (confirm(messages.bookingItemList.actions.deleteConfirm)) {
                                  remove.mutate(item.id)
                                }
                              }}
                              className="text-muted-foreground hover:text-destructive"
                              aria-label={messages.bookingItemList.actions.deleteItem}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b last:border-b-0 bg-muted/10">
                          <td />
                          <td colSpan={8} className="p-3">
                            <ItemDetailPanel bookingId={bookingId} item={item} />
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

/**
 * Expanded panel for one item — shows the metadata an operator
 * usually needs to act on the line: short description, full date
 * range (timestamps when present, else just the date), cost
 * breakdown (unit × qty), the linked product/snapshot ids, and the
 * per-item travelers list. Compact two-column layout on wide
 * screens, stacks on narrow ones.
 */
function ItemDetailPanel({
  bookingId,
  item,
}: {
  bookingId: string
  item: BookingItemRecord
}): React.ReactElement {
  const messages = useBookingsUiMessagesOrDefault()
  const { formatCurrency } = useBookingsUiI18nOrDefault()
  const dateRange = formatItemDateRange(item)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <DetailBlock label={messages.bookingItemList.detail.description}>
          {item.description ? (
            <p className="whitespace-pre-wrap text-sm">{item.description}</p>
          ) : (
            <p className="text-muted-foreground text-xs italic">
              {messages.bookingItemList.detail.noDescription}
            </p>
          )}
        </DetailBlock>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DetailBlock label={messages.bookingItemList.detail.dates}>
            <div className="flex items-baseline gap-1.5 text-sm">
              <Calendar className="h-3.5 w-3.5 self-center text-muted-foreground" />
              {dateRange ?? (
                <span className="text-muted-foreground text-xs">
                  {messages.bookingItemList.values.serviceDateUnavailable}
                </span>
              )}
            </div>
          </DetailBlock>

          <DetailBlock label={messages.bookingItemList.detail.cost}>
            {item.totalCostAmountCents != null && item.costCurrency ? (
              <div className="text-sm">
                <span className="font-mono">
                  {formatCurrency(item.totalCostAmountCents / 100, item.costCurrency)}
                </span>
                {item.unitCostAmountCents != null && item.quantity > 1 ? (
                  <span className="ml-1.5 text-muted-foreground text-xs">
                    ({formatCurrency(item.unitCostAmountCents / 100, item.costCurrency)} ×{" "}
                    {item.quantity})
                  </span>
                ) : null}
              </div>
            ) : (
              <span className="text-muted-foreground text-xs">
                {messages.bookingItemList.values.costUnavailable}
              </span>
            )}
          </DetailBlock>
        </div>
      </div>

      <BookingItemTravelers bookingId={bookingId} itemId={item.id} />
    </div>
  )
}

function DetailBlock({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div className="space-y-1">
      <div className="text-muted-foreground text-xs uppercase tracking-wide">{label}</div>
      <div>{children}</div>
    </div>
  )
}

/**
 * Compose the most informative date label we can from the item:
 *   - When `startsAt`+`endsAt` differ → "Mar 5 → Mar 8 2026"
 *   - When only `serviceDate` is set → "Mar 5 2026"
 *   - When everything is null → null (caller renders the unavailable
 *     placeholder)
 *
 * Uses Intl date formatting against the runtime locale; the booking
 * detail page renders Romanian by default but the formatter respects
 * whatever the consumer's locale is.
 */
function formatItemDateRange(item: BookingItemRecord): string | null {
  const start = item.startsAt ? new Date(item.startsAt) : null
  const end = item.endsAt ? new Date(item.endsAt) : null
  if (start && Number.isFinite(start.getTime())) {
    if (end && Number.isFinite(end.getTime()) && end.getTime() !== start.getTime()) {
      return `${formatDate(start)} → ${formatDate(end)}`
    }
    return formatDate(start)
  }
  if (item.serviceDate) {
    const d = new Date(item.serviceDate)
    if (Number.isFinite(d.getTime())) return formatDate(d)
    return item.serviceDate
  }
  return null
}

function formatDate(d: Date): string {
  try {
    return d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  } catch {
    return d.toISOString().slice(0, 10)
  }
}

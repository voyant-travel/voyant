"use client"

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  confirmDialog,
} from "@voyant-travel/ui/components"
import { Link2, Unlink, Users } from "lucide-react"
import * as React from "react"
import { formatMessage, useBookingsUiMessagesOrDefault } from "../i18n/provider.js"
import {
  useBookingGroup,
  useBookingGroupForBooking,
  useBookingGroupMemberMutation,
  useBookingItems,
  useBookingPrimaryProduct,
} from "../index.js"
import { BookingGroupLinkDialog } from "./booking-group-link-dialog.js"

export interface BookingGroupSectionProps {
  bookingId: string
  /**
   * Product ID used to scope shared-room group context. Leave unset to
   * auto-resolve from the booking's items; pass an explicit string or `null`
   * to override.
   */
  productId?: string | null
  /**
   * Option unit ID used to scope shared-room group context. Leave unset to
   * auto-resolve from the booking's items; pass an explicit string or `null`
   * to override.
   */
  optionUnitId?: string | null
  /**
   * When true (default), the section hides itself when the booking
   * has no `accommodation` items AND no existing group — shared-room
   * pairing only makes sense for bookings that include a room. Tours,
   * ground-transfer, and inquiry bookings see no Shared-Room card.
   *
   * Set to `false` to always render the section (e.g. legacy
   * dashboards that display it for every booking regardless).
   */
  hideWithoutAccommodation?: boolean
}

export function BookingGroupSection({
  bookingId,
  productId,
  optionUnitId,
  hideWithoutAccommodation = true,
}: BookingGroupSectionProps) {
  const [linkDialogOpen, setLinkDialogOpen] = React.useState(false)
  const messages = useBookingsUiMessagesOrDefault()

  // Auto-resolve product/option-unit from items when the caller hasn't
  // supplied them. Explicit `null` is respected as an override.
  const shouldAutoResolve = productId === undefined || optionUnitId === undefined
  const autoResolved = useBookingPrimaryProduct(bookingId, { enabled: shouldAutoResolve })
  const effectiveProductId = productId === undefined ? autoResolved.productId : productId
  const effectiveOptionUnitId =
    optionUnitId === undefined ? autoResolved.optionUnitId : optionUnitId

  // Fetch items to detect whether the booking has accommodation —
  // shared-room pairing is meaningful only for room-style products.
  // The `useBookingItems` query is already in cache from
  // `useBookingPrimaryProduct` above, so this is a free read.
  const { data: itemsData } = useBookingItems(bookingId)
  const items = itemsData?.data ?? []
  const hasAccommodationItem = items.some((i) => i.itemType === "accommodation")

  const { data: groupForBookingData } = useBookingGroupForBooking(bookingId)
  const group = groupForBookingData?.data ?? null
  const groupId = group?.id ?? null

  const { data: groupDetail } = useBookingGroup(groupId, { enabled: Boolean(groupId) })
  const members = groupDetail?.data?.members ?? []
  const { remove: removeMember } = useBookingGroupMemberMutation()

  // Hide the section entirely when there's nothing to render or
  // pair: no group exists yet AND the booking has no accommodation
  // line item. Operators on tour-only bookings shouldn't see a card
  // they can't usefully act on.
  if (hideWithoutAccommodation && !group && !hasAccommodationItem) {
    return null
  }

  const handleRemove = async () => {
    if (!groupId) return
    if (
      !(await confirmDialog({
        description: messages.bookingGroupSection.actions.removeConfirm,
        destructive: true,
      }))
    )
      return
    await removeMember.mutateAsync({ groupId, bookingId })
  }

  const siblings = members.filter((m) => m.bookingId !== bookingId)

  return (
    <Card data-slot="booking-group-section">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          {messages.bookingGroupSection.title}
        </CardTitle>
        {group ? (
          <Button
            size="sm"
            variant="outline"
            onClick={handleRemove}
            disabled={removeMember.isPending}
          >
            <Unlink className="mr-2 h-4 w-4" />
            {messages.bookingGroupSection.actions.removeFromGroup}
          </Button>
        ) : (
          <Button size="sm" onClick={() => setLinkDialogOpen(true)}>
            <Link2 className="mr-2 h-4 w-4" />
            {messages.bookingGroupSection.actions.linkToSharedRoom}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {!group ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {messages.bookingGroupSection.empty}
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">
                  {messages.bookingGroupSection.group}
                </div>
                <div className="font-medium">{group.label}</div>
              </div>
              <Badge variant="outline">
                {group.kind === "shared_room"
                  ? messages.bookingGroupSection.sharedRoomKind
                  : group.kind.replace(/_/g, " ")}
              </Badge>
            </div>

            <div>
              <div className="mb-2 text-xs font-medium text-muted-foreground">
                {formatMessage(messages.bookingGroupSection.siblingBookings, {
                  count: siblings.length,
                })}
              </div>
              {siblings.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {messages.bookingGroupSection.noSiblingBookings}
                </p>
              ) : (
                <ul className="space-y-1">
                  {siblings.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between rounded px-2 py-1 text-sm"
                    >
                      <span className="font-mono text-xs">
                        {m.booking?.bookingNumber ?? m.bookingId}
                      </span>
                      <div className="flex items-center gap-2">
                        {m.role === "primary" && (
                          <Badge variant="default" className="text-xs">
                            {messages.bookingGroupSection.primaryBadge}
                          </Badge>
                        )}
                        {m.booking?.status && (
                          <span className="text-xs text-muted-foreground">
                            {messages.common.bookingStatusLabels[m.booking.status]}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </CardContent>

      <BookingGroupLinkDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        bookingId={bookingId}
        productId={effectiveProductId}
        optionUnitId={effectiveOptionUnitId}
      />
    </Card>
  )
}

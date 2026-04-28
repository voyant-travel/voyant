"use client"

import {
  useBookingGroup,
  useBookingGroupForBooking,
  useBookingGroupMemberMutation,
  useBookingPrimaryProduct,
} from "@voyantjs/bookings-react"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { Link2, Unlink, Users } from "lucide-react"
import * as React from "react"

import { BookingGroupLinkDialog } from "./booking-group-link-dialog"

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
}

export function BookingGroupSection({
  bookingId,
  productId,
  optionUnitId,
}: BookingGroupSectionProps) {
  const [linkDialogOpen, setLinkDialogOpen] = React.useState(false)

  // Auto-resolve product/option-unit from items when the caller hasn't
  // supplied them. Explicit `null` is respected as an override.
  const shouldAutoResolve = productId === undefined || optionUnitId === undefined
  const autoResolved = useBookingPrimaryProduct(bookingId, { enabled: shouldAutoResolve })
  const effectiveProductId = productId === undefined ? autoResolved.productId : productId
  const effectiveOptionUnitId =
    optionUnitId === undefined ? autoResolved.optionUnitId : optionUnitId

  const { data: groupForBookingData } = useBookingGroupForBooking(bookingId)
  const group = groupForBookingData?.data ?? null
  const groupId = group?.id ?? null

  const { data: groupDetail } = useBookingGroup(groupId, { enabled: Boolean(groupId) })
  const members = groupDetail?.data?.members ?? []

  const { remove: removeMember } = useBookingGroupMemberMutation()

  const handleRemove = async () => {
    if (!groupId) return
    if (!confirm("Remove this booking from the shared-room group?")) return
    await removeMember.mutateAsync({ groupId, bookingId })
  }

  const siblings = members.filter((m) => m.bookingId !== bookingId)

  return (
    <Card data-slot="booking-group-section">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          Shared Room
        </CardTitle>
        {group ? (
          <Button
            size="sm"
            variant="outline"
            onClick={handleRemove}
            disabled={removeMember.isPending}
          >
            <Unlink className="mr-2 h-4 w-4" />
            Remove from group
          </Button>
        ) : (
          <Button size="sm" onClick={() => setLinkDialogOpen(true)}>
            <Link2 className="mr-2 h-4 w-4" />
            Link to shared room
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {!group ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            This booking is not linked to a shared-room group.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Group</div>
                <div className="font-medium">{group.label}</div>
              </div>
              <Badge variant="outline" className="capitalize">
                {group.kind.replace(/_/g, " ")}
              </Badge>
            </div>

            <div>
              <div className="mb-2 text-xs font-medium text-muted-foreground">
                Sibling bookings ({siblings.length})
              </div>
              {siblings.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No other bookings linked yet. Share the group id with another booking to link
                  them.
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
                            Primary
                          </Badge>
                        )}
                        {m.booking?.status && (
                          <span className="text-xs text-muted-foreground capitalize">
                            {m.booking.status.replace(/_/g, " ")}
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

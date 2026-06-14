"use client"

import type {
  AllocationManifestBooking,
  AllocationManifestTraveler,
} from "@voyant-travel/operations-react/availability"
import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyant-travel/ui/components"
import { Accessibility, Crown, Users, UtensilsCrossed } from "lucide-react"
import type { ReactNode } from "react"

import type { useAllocationUiMessagesOrDefault } from "../i18n/index.js"
import { kindLabel, type ResourceCapacitySummary } from "./slot-allocation-model.js"
import { paymentStatusChipClass, paymentStatusTooltip } from "./slot-allocation-shared.js"

export function PassengerListPanel({
  bookings,
  sharingGroupLabels,
  onBookingOpen,
  renderTravelerActions,
  messages,
}: {
  bookings: AllocationManifestBooking[]
  sharingGroupLabels: Record<string, string>
  onBookingOpen?: (bookingId: string) => void
  renderTravelerActions?: (traveler: AllocationManifestTraveler) => ReactNode
  messages: ReturnType<typeof useAllocationUiMessagesOrDefault>
}) {
  const travelerCount = bookings.reduce((sum, booking) => sum + booking.travelers.length, 0)
  const hasActions = Boolean(renderTravelerActions)

  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="font-semibold text-sm">{messages.exportPassengers}</h2>
            <p className="text-xs text-muted-foreground">
              {bookings.length} {messages.booking.toLowerCase()} · {travelerCount}{" "}
              {messages.travelers.toLowerCase()}
            </p>
          </div>
        </div>
      </header>

      {travelerCount === 0 ? (
        <div className="rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground">
          {messages.passengerListEmpty}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {bookings.map((booking) => (
            <section key={booking.id} className="overflow-hidden rounded-md border">
              <header className="flex flex-wrap items-center justify-between gap-2 bg-muted/40 px-3 py-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  {booking.bookingSequence > 0 ? (
                    <span className="text-muted-foreground text-xs tabular-nums" aria-hidden="true">
                      ({booking.bookingSequence})
                    </span>
                  ) : null}
                  {onBookingOpen ? (
                    <button
                      type="button"
                      onClick={() => onBookingOpen(booking.id)}
                      className="truncate font-medium text-sm hover:underline"
                    >
                      {booking.bookingNumber}
                    </button>
                  ) : (
                    <span className="truncate font-medium text-sm">{booking.bookingNumber}</span>
                  )}
                  <Badge variant="outline" className="text-[10px]">
                    {booking.status}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={paymentStatusChipClass(booking.paymentStatus)}
                    title={paymentStatusTooltip(booking.paymentStatus, messages)}
                  >
                    {messages.paymentStatusLabels[booking.paymentStatus]}
                  </Badge>
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  {booking.travelers.length}/{booking.pax ?? booking.travelers.length}
                </Badge>
              </header>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{messages.travelers}</TableHead>
                    <TableHead className="w-40">{messages.sharingGroup}</TableHead>
                    <TableHead className="w-40">{messages.resources}</TableHead>
                    {hasActions ? <TableHead className="w-12" /> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {booking.travelers.map((traveler) => (
                    <TableRow key={traveler.id}>
                      <TableCell>
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          {traveler.isLeadTraveler ? (
                            <Crown
                              className="size-3.5 shrink-0 text-amber-500"
                              aria-label={messages.lead}
                            />
                          ) : null}
                          <span className="truncate font-medium text-sm">{traveler.fullName}</span>
                          {traveler.isPrimary ? (
                            <Badge variant="outline" className="text-[10px]">
                              {messages.lead}
                            </Badge>
                          ) : null}
                          {traveler.travelerCategory ? (
                            <Badge variant="secondary" className="text-[10px]">
                              {traveler.travelerCategory}
                            </Badge>
                          ) : null}
                          {traveler.hasAccessibilityNeeds ? (
                            <Accessibility
                              className="size-3.5 shrink-0 text-muted-foreground"
                              aria-label={messages.accessibility}
                            />
                          ) : null}
                          {traveler.hasDietaryRequirements ? (
                            <UtensilsCrossed
                              className="size-3.5 shrink-0 text-muted-foreground"
                              aria-label={messages.dietary}
                            />
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {traveler.sharingGroupId
                          ? (sharingGroupLabels[traveler.sharingGroupId] ?? messages.sharingGroup)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {[traveler.roomTypeId, traveler.bedPreference]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </TableCell>
                      {hasActions ? (
                        <TableCell className="text-right">
                          {renderTravelerActions?.(traveler)}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          ))}
        </div>
      )}
    </section>
  )
}

export function CapacitySummaryBadges({
  summary,
  messages,
  kind,
}: {
  summary: ResourceCapacitySummary
  messages: ReturnType<typeof useAllocationUiMessagesOrDefault>
  kind: string
}) {
  if (summary.resourceCount === 0 && summary.slotPax == null) return null

  // i18n-literal-ok numeric layout with separator
  const slotLabel =
    summary.slotPax == null
      ? messages.slotCapacityUnlimited
      : `${summary.slotRemainingPax ?? 0} of ${summary.slotPax}`
  const resourceLabel =
    summary.slotPax == null
      ? String(summary.resourceCapacity)
      : `${summary.resourceCapacity} of ${summary.slotPax}`

  return (
    <span className="contents" data-kind={kind} title={kindLabel(kind, messages)}>
      <Badge variant="outline" className="gap-1">
        <Users className="size-3" aria-hidden="true" />
        {messages.slotCapacityLabel}: {slotLabel}
      </Badge>
      <Badge variant="outline" className="gap-1">
        {messages.resourceCapacityLabel}: {resourceLabel}
      </Badge>
    </span>
  )
}

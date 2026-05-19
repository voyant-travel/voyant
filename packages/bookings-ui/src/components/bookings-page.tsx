"use client"

import type { BookingRecord } from "@voyantjs/bookings-react"
import { cn } from "@voyantjs/ui/lib/utils"
import type * as React from "react"
import { useBookingsUiMessagesOrDefault } from "../i18n/index.js"
import { BookingList } from "./booking-list.js"

export interface BookingsPageProps {
  pageSize?: number
  onBookingOpen?: (booking: BookingRecord) => void
  onCreateBooking?: () => void
  /**
   * Extra action(s) rendered alongside the primary "New booking" button.
   * Templates pass adjacent flows (e.g. a "Compose trip" link) here.
   */
  headerActions?: React.ReactNode
  className?: string
}

export function BookingsPage({
  pageSize,
  onBookingOpen,
  onCreateBooking,
  headerActions,
  className,
}: BookingsPageProps = {}) {
  const messages = useBookingsUiMessagesOrDefault().bookingsPage

  return (
    <div data-slot="bookings-page" className={cn("flex flex-col gap-6 p-6", className)}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{messages.title}</h1>
        <p className="text-sm text-muted-foreground">{messages.description}</p>
      </div>

      <BookingList
        pageSize={pageSize}
        onSelectBooking={onBookingOpen}
        onCreateBooking={onCreateBooking}
        headerActions={headerActions}
      />
    </div>
  )
}

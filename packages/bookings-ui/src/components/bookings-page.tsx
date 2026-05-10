"use client"

import type { BookingRecord } from "@voyantjs/bookings-react"
import { cn } from "@voyantjs/ui/lib/utils"
import { useBookingsUiMessagesOrDefault } from "../i18n/index.js"
import { BookingList } from "./booking-list.js"

export interface BookingsPageProps {
  pageSize?: number
  onBookingOpen?: (booking: BookingRecord) => void
  className?: string
}

export function BookingsPage({ pageSize, onBookingOpen, className }: BookingsPageProps = {}) {
  const messages = useBookingsUiMessagesOrDefault().bookingsPage

  return (
    <div data-slot="bookings-page" className={cn("flex flex-col gap-6", className)}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{messages.title}</h1>
        <p className="text-sm text-muted-foreground">{messages.description}</p>
      </div>

      <BookingList pageSize={pageSize} onSelectBooking={onBookingOpen} />
    </div>
  )
}

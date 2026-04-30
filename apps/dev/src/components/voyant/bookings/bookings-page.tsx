import { useNavigate } from "@tanstack/react-router"

import { BookingList } from "@voyantjs/bookings-ui/components/booking-list"

export function BookingsPage() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bookings</h1>
        <p className="text-sm text-muted-foreground">
          Manage bookings, confirmations, and travelers.
        </p>
      </div>

      <BookingList
        onSelectBooking={(booking) => {
          void navigate({ to: "/bookings/$id", params: { id: booking.id } })
        }}
      />
    </div>
  )
}

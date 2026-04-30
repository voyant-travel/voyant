import { useNavigate } from "@tanstack/react-router"
import { BookingList } from "@voyantjs/bookings-ui/components/booking-list"
import { useAdminMessages } from "@/lib/admin-i18n"

export function BookingsPage() {
  const bookingMessages = useAdminMessages().bookings.list
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{bookingMessages.pageTitle}</h1>
        <p className="text-sm text-muted-foreground">{bookingMessages.pageDescription}</p>
      </div>

      <BookingList
        onSelectBooking={(booking) => {
          void navigate({ to: "/bookings/$id", params: { id: booking.id } })
        }}
      />
    </div>
  )
}

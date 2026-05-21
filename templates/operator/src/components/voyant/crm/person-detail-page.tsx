import { useNavigate } from "@tanstack/react-router"
import {
  type BookingRecord,
  bookingStatusBadgeVariant,
  useBookings,
} from "@voyantjs/bookings-react"
import { PersonDetailPage as CanonicalPersonDetailPage } from "@voyantjs/crm-ui/components/person-detail-page"
import { Badge } from "@voyantjs/ui/components/badge"
import { Skeleton } from "@voyantjs/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voyantjs/ui/components/table"
import { useAdminMessages } from "@/lib/admin-i18n"

export function PersonDetailPage({ id }: { id: string }) {
  const navigate = useNavigate()
  const messages = useAdminMessages().crm.personDetail
  const bookingsQuery = useBookings({ personId: id, limit: 50 })
  const bookings = bookingsQuery.data?.data ?? []

  return (
    <CanonicalPersonDetailPage
      id={id}
      onBack={() => void navigate({ to: "/people" })}
      onDeleted={() => void navigate({ to: "/people" })}
      onOrganizationOpen={(organizationId) =>
        void navigate({ to: "/organizations/$id", params: { id: organizationId } })
      }
      onPersonOpen={(personId) => void navigate({ to: "/people/$id", params: { id: personId } })}
      slots={{
        bookingsTab: {
          count: bookingsQuery.data?.total ?? bookings.length,
          content: (
            <PersonBookingsList
              bookings={bookings}
              isPending={bookingsQuery.isPending}
              isError={bookingsQuery.isError}
              onSelect={(booking) =>
                void navigate({ to: "/bookings/$id", params: { id: booking.id } })
              }
              loadingError={messages.notFound}
            />
          ),
        },
      }}
    />
  )
}

interface PersonBookingsListProps {
  bookings: BookingRecord[]
  isPending: boolean
  isError: boolean
  onSelect: (booking: BookingRecord) => void
  loadingError: string
}

function PersonBookingsList({
  bookings,
  isPending,
  isError,
  onSelect,
  loadingError,
}: PersonBookingsListProps) {
  if (isPending) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  if (isError) {
    return <div className="p-6 text-center text-sm text-destructive">{loadingError}</div>
  }

  if (bookings.length === 0) {
    return <div className="p-6 text-center text-sm text-muted-foreground">No bookings yet.</div>
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Booking #</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Sell amount</TableHead>
            <TableHead>Pax</TableHead>
            <TableHead>Start</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bookings.map((booking) => {
            const firstItem = booking.items?.[0]
            const itemLabel = firstItem?.productName ?? firstItem?.title ?? "—"
            const extraItems = Math.max((booking.items?.length ?? 0) - 1, 0)
            return (
              <TableRow
                key={booking.id}
                onClick={() => onSelect(booking)}
                className="cursor-pointer"
              >
                <TableCell className="font-medium">{booking.bookingNumber}</TableCell>
                <TableCell>
                  <div className="max-w-[280px] truncate" title={itemLabel}>
                    {itemLabel}
                    {extraItems > 0 ? (
                      <span className="ml-1 text-xs text-muted-foreground">+{extraItems}</span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={bookingStatusBadgeVariant[booking.status]}>
                    {booking.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {booking.sellAmountCents == null
                    ? "—"
                    : `${(booking.sellAmountCents / 100).toFixed(2)} ${booking.sellCurrency}`}
                </TableCell>
                <TableCell>{booking.pax ?? "—"}</TableCell>
                <TableCell>{formatBookingDate(booking.startsAt ?? booking.startDate)}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function formatBookingDate(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString()
}

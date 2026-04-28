import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { formatDateTime } from "@voyantjs/distribution-react"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@voyantjs/ui/components"
import { ArrowLeft, Link2, Loader2, ReceiptText, Trash2 } from "lucide-react"
import { api } from "@/lib/api-client"
import {
  getDistributionBookingLinkBookingQueryOptions,
  getDistributionBookingLinkChannelQueryOptions,
  getDistributionBookingLinkQueryOptions,
} from "./distribution-detail-query-options"

type DistributionBookingLinkDetailPageProps = {
  id: string
}

export function DistributionBookingLinkDetailPage({ id }: DistributionBookingLinkDetailPageProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: linkData, isPending } = useQuery(getDistributionBookingLinkQueryOptions(id))
  const link = linkData?.data

  const channelQuery = useQuery({
    ...getDistributionBookingLinkChannelQueryOptions(link?.channelId ?? ""),
    enabled: Boolean(link?.channelId),
  })
  const bookingQuery = useQuery({
    ...getDistributionBookingLinkBookingQueryOptions(link?.bookingId ?? ""),
    enabled: Boolean(link?.bookingId),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/v1/distribution/booking-links/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["distribution", "booking-links"] })
      void navigate({ to: "/distribution" })
    },
  })

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!link) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-muted-foreground">Booking link not found</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/distribution" })}>
          Back to Distribution
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => void navigate({ to: "/distribution" })}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Booking Link</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline">{link.externalStatus ?? "unmapped status"}</Badge>
            <Badge variant="secondary">{link.externalReference ?? "no reference"}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() =>
              void navigate({ to: "/distribution/$id", params: { id: link.channelId } })
            }
          >
            <Link2 className="mr-2 h-4 w-4" />
            Open Channel
          </Button>
          <Button
            variant="outline"
            onClick={() => void navigate({ to: "/bookings/$id", params: { id: link.bookingId } })}
          >
            <ReceiptText className="mr-2 h-4 w-4" />
            Open Booking
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm("Delete this booking link?")) {
                deleteMutation.mutate()
              }
            }}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Booking Link Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <span className="text-muted-foreground">Channel:</span>{" "}
            <span>{channelQuery.data?.data.name ?? link.channelId}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Booking:</span>{" "}
            <span>{bookingQuery.data?.data.bookingNumber ?? link.bookingId}</span>
          </div>
          <div>
            <span className="text-muted-foreground">External Booking:</span>{" "}
            <span>{link.externalBookingId ?? "-"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Reference:</span>{" "}
            <span>{link.externalReference ?? "-"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Booked Externally:</span>{" "}
            <span>{formatDateTime(link.bookedAtExternal)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Last Synced:</span>{" "}
            <span>{formatDateTime(link.lastSyncedAt)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Created:</span>{" "}
            <span>{new Date(link.createdAt).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Updated:</span>{" "}
            <span>{new Date(link.updatedAt).toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
